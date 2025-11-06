import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import rateLimit from '@fastify/rate-limit';
import type { RouteDependencies } from './index.js';
import { validateBody, validateParams, validateQuery } from '../validation/middleware.js';
import {
  publishItemSchema,
  resaleListingSchema,
  searchQuerySchema,
  marketplaceItemIdParamSchema,
} from '../validation/schemas/marketplace.js';
import { bodySizeLimit, BodySizeLimits } from '../middleware/bodySizeLimit.js';
import { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB.js';
import type { ProjectData } from '../types.js';

/**
 * Create marketplace routes for Fastify
 */
export async function createMarketplaceRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const {
    authMiddleware,
    authManager,
    marketplaceStorage,
    buildStorage,
    likesStorage,
    gameSessionTracker,
    currencyService,
    purchaseStorage,
    forumStorage,
    forumHandler,
    getUserIdFromToken,
    THUMBNAIL_DIR,
    generateAndSaveThumbnail,
    economyLimiter,
    publishLimiter,
    dbPool,
    path,
    fs,
    resaleListings,
    ECONOMY_MIN_PRICE,
    ECONOMY_PRICE_CHANGE_COOLDOWN_SEC,
    ECONOMY_LISTING_FEE,
    ECONOMY_PLATFORM_FEE_BPS,
    sanitizeMarketplacePublishRequest,
    ValidationError: ValidationErrorClass,
    BuildDataError: BuildDataErrorClass,
    PayloadTooLargeError: PayloadTooLargeErrorClass,
    DatabaseError: DatabaseErrorClass,
  } = opts.dependencies;

  void rateLimit;
  void economyLimiter;
  void publishLimiter;

  // Register rate limiters as plugins for specific scopes
  // Note: Fastify rate limit plugin must be registered per route scope
  // For now, we'll use rate limiting in preHandler hooks

  /**
   * GET /api/marketplace/builds
   * List marketplace builds (paginated).
   */
  app.get('/builds', async (request, reply) => {
    try {
      const query = request.query as {
        type?: 'build' | 'avatar';
        tags?: string;
        limit?: number | string;
        offset?: number | string;
      };

      const type = query.type;
      const tags = query.tags ? String(query.tags).split(',') : undefined;
      const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
      const offset = query.offset ? parseInt(String(query.offset), 10) : 0;

      const items = await marketplaceStorage.getItems({
        type: type ?? 'build',
        tags: tags ?? [],
        public: true,
        limit,
        offset,
      });

      // Add online player count and liked status for each item
      const userId = await getUserIdFromToken(request.headers.authorization);
      const itemsWithMetadata = await Promise.all(
        items.map(async (item) => {
          const playersOnline = gameSessionTracker.getPlayerCount(item.id);
          let liked: boolean | undefined;
          if (userId) {
            liked = await likesStorage.isLiked(item.id, userId);
          }
          return {
            ...item,
            playersOnline,
            ...(liked !== undefined && { liked }),
          };
        })
      );

      reply.send({
        items: itemsWithMetadata,
        total: items.length,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get marketplace builds error:', error);
      reply.code(500).send({
        error: 'Failed to get builds',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/marketplace/paid
   * List paid marketplace items (with price).
   */
  app.get('/paid', async (request, reply) => {
    try {
      const query = request.query as {
        type?: 'build' | 'avatar';
        limit?: number | string;
        offset?: number | string;
      };

      const type = query.type;
      const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
      const offset = query.offset ? parseInt(String(query.offset), 10) : 0;

      // Get all items and filter for those with price
      const allItems = await marketplaceStorage.getItems({
        ...(type && { type }),
        public: true,
        limit: 1000, // Get more to filter
        offset: 0,
      });

      const paidItems = allItems.filter((item) => item.price !== undefined);

      // Apply pagination
      const paginatedItems = paidItems.slice(offset, offset + limit);

      reply.send({
        items: paginatedItems,
        total: paidItems.length,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get paid marketplace items error:', error);
      reply.code(500).send({
        error: 'Failed to get paid items',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/marketplace/:id/price
   * Set or update price for marketplace item (author or admin only).
   */
  app.put('/:id/price', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }
      const body = request.body as {
        price?: { currency: string; amount: number } | null;
      };

      const item = await marketplaceStorage.getItem(id);
      if (!item) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      // Check authorization (author or admin)
      if (item.authorId !== request.user.id && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Anti-abuse: price floor (per currency)
      if (body.price) {
        const min = ECONOMY_MIN_PRICE[body.price.currency] ?? 0;
        if (!(Number.isFinite(body.price.amount) && body.price.amount >= min)) {
          return reply.code(400).send({
            error: `Price below minimum for ${body.price.currency}: ${min}`,
          });
        }
      }

      // Anti-abuse: cooldown on price changes
      const now = Date.now();
      const lastUpdateAt = item.updatedAt ?? 0; // JSON/DB storage keeps updatedAt
      const isPriceChange = (() => {
        const prev = item.price;
        const next = body.price ?? undefined;
        if (!prev && !next) return false;
        if (!!prev !== !!next) return true;
        if (!prev || !next) return false;
        return prev.currency !== next.currency || prev.amount !== next.amount;
      })();
      if (isPriceChange) {
        const diffSec = Math.floor((now - lastUpdateAt) / 1000);
        if (diffSec < ECONOMY_PRICE_CHANGE_COOLDOWN_SEC && request.user.role !== 'admin') {
          return reply.code(429).send({
            error: `Price change cooldown active. Try again in ${ECONOMY_PRICE_CHANGE_COOLDOWN_SEC - diffSec}s`,
          });
        }
      }

      // Listing fee: charge on setting/changing a price (non-admin bypasses)
      if (isPriceChange && body.price && request.user.role !== 'admin') {
        const feeAmount = ECONOMY_LISTING_FEE[body.price.currency] ?? 0;
        if (feeAmount > 0) {
          try {
            currencyService.withdraw(
              request.user.id,
              { currency: body.price.currency, amount: feeAmount },
              'Listing fee'
            );
          } catch (e) {
            return reply.code(400).send({ error: 'Insufficient balance for listing fee' });
          }
        }
      }

      const updatedItem = await marketplaceStorage.updateItem(id, {
        ...(body.price && { price: body.price }),
      });

      if (!updatedItem) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      reply.send(updatedItem);
    } catch (error) {
      console.error('Update marketplace price error:', error);
      reply.code(500).send({
        error: 'Failed to update price',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/marketplace/:id/resale
   * List current secondary resale listings for a marketplace item.
   */
  app.get('/:id/resale', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }
      const listings = resaleListings.get(id) ?? [];
      reply.send({ listings });
    } catch (error) {
      console.error('List resale error:', error);
      reply.code(500).send({ error: 'Failed to list resale' });
    }
  });

  /**
   * POST /api/marketplace/:id/resale
   * Create or update a secondary resale listing for the current user.
   */
  app.post(
    '/:id/resale',
    {
      preHandler: [
    authMiddleware,
        // Rate limiting will be handled by registering plugin at route level if needed
        // For now, economyLimiter is a config object, not a plugin instance
    validateParams(marketplaceItemIdParamSchema),
    validateBody(resaleListingSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
        const { id } = (request.params as { id?: string });
        if (!id) {
          return reply.code(400).send({ error: 'Item ID required' });
        }
        const body = request.body as { price: { currency: string; amount: number } };
        const item = await marketplaceStorage.getItem(id);
        if (!item) return reply.code(404).send({ error: 'Item not found' });

        // Must own the item to list it for resale
        const owns = await (purchaseStorage as any).isOwned(request.user.id, id, 'marketplace-item');
        if (!owns) return reply.code(403).send({ error: 'You do not own this item' });

        // Price floor
        const min = ECONOMY_MIN_PRICE[body.price.currency] ?? 0;
        if (!(Number.isFinite(body.price.amount) && body.price.amount >= min)) {
          return reply.code(400).send({
            error: `Price below minimum for ${body.price.currency}: ${min}`,
          });
        }

        const list = resaleListings.get(id) ?? [];
        const idx = list.findIndex((l) => l.sellerId === request.user!.id);
        const newListing = { sellerId: request.user.id, price: body.price, createdAt: Date.now() };
        if (idx >= 0) list[idx] = newListing;
        else list.push(newListing);
        resaleListings.set(id, list);
        reply.send({ success: true, listing: newListing });
      } catch (error) {
        console.error('Create resale error:', error);
        reply.code(500).send({ error: 'Failed to create resale listing' });
      }
    }
  );

  /**
   * POST /api/marketplace/:id/buy-resale
   * Buy a resale listing from a specific seller.
   */
  app.post(
    '/:id/buy-resale',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) return reply.code(401).send({ error: 'Unauthorized' });
        const buyerId = request.user.id;
        const { id } = (request.params as { id?: string });
        if (!id) {
          return reply.code(400).send({ error: 'Item ID required' });
        }
        const body = request.body as { sellerId: string };
        if (!body?.sellerId || body.sellerId === buyerId) {
          return reply.code(400).send({ error: 'Invalid seller' });
        }

        const item = await marketplaceStorage.getItem(id);
        if (!item) return reply.code(404).send({ error: 'Item not found' });

        // Find listing
        const list = resaleListings.get(id) ?? [];
        const listing = list.find((l) => l.sellerId === body.sellerId);
        if (!listing) return reply.code(404).send({ error: 'Listing not found' });

        // Validate seller still owns the item
        const sellerOwns = await (purchaseStorage as any).isOwned(
          body.sellerId,
          id,
          'marketplace-item'
        );
        if (!sellerOwns) return reply.code(400).send({ error: 'Seller no longer owns item' });

        // Check buyer balance and withdraw
        try {
          currencyService.withdraw(buyerId, listing.price, `Secondary purchase ${id}`);
        } catch (e) {
          return reply.code(400).send({ error: 'Insufficient balance' });
        }

        // Compute fees: platform fee + creator royalty (10%)
        const royaltyBps = 1000; // 10%
        const platformFeeBps = ECONOMY_PLATFORM_FEE_BPS;
        const amount = listing.price.amount;
        const currency = listing.price.currency;
        const royalty = Math.round(((amount * royaltyBps) / 10000) * 100) / 100;
        const platformFee = Math.round(((amount * platformFeeBps) / 10000) * 100) / 100;
        const sellerProceeds = Math.max(
          0,
          Math.round((amount - royalty - platformFee) * 100) / 100
        );

        // Payouts
        if (royalty > 0)
          currencyService.deposit(
            item.authorId,
            { currency, amount: royalty },
            `Secondary royalty ${id}`
          );
        if (platformFee > 0)
          currencyService.deposit(
            'platform',
            { currency, amount: platformFee },
            `Secondary platform fee ${id}`
          );
        if (sellerProceeds > 0)
          currencyService.deposit(
            body.sellerId,
            { currency, amount: sellerProceeds },
            `Secondary sale proceeds ${id}`
          );

        // Transfer ownership
        if ('transferOwnership' in (purchaseStorage as any)) {
          const ok = await (purchaseStorage as any).transferOwnership(
            id,
            'marketplace-item',
            body.sellerId,
            buyerId
          );
          if (!ok) {
            return reply.code(400).send({ error: 'Ownership transfer failed' });
          }
        }

        // Remove listing
        const newList = (resaleListings.get(id) ?? []).filter((l) => l.sellerId !== body.sellerId);
        resaleListings.set(id, newList);

        reply.send({ success: true });
      } catch (error) {
        console.error('Buy resale error:', error);
        reply.code(500).send({ error: 'Failed to buy resale listing' });
      }
    }
  );

  /**
   * GET /api/marketplace/avatars
   * List marketplace avatars.
   */
  app.get('/avatars', async (request, reply) => {
    try {
      const query = request.query as {
        limit?: number | string;
        offset?: number | string;
        sortBy?: 'newest' | 'popular' | 'downloads' | 'likes';
      };
      const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
      const offset = query.offset ? parseInt(String(query.offset), 10) : 0;
      const sortBy = query.sortBy;

      const items = await marketplaceStorage.getItems({
        type: 'avatar',
        public: true,
        limit,
        offset,
        sortBy: sortBy ?? 'newest',
      });

      // Add online player count and liked status for each item
      const userId = await getUserIdFromToken(request.headers.authorization);
      const itemsWithMetadata = await Promise.all(
        items.map(async (item) => {
          const playersOnline = gameSessionTracker.getPlayerCount(item.id);
          let liked: boolean | undefined;
          if (userId) {
            liked = await likesStorage.isLiked(item.id, userId);
          }
          return {
            ...item,
            playersOnline,
            ...(liked !== undefined && { liked }),
          };
        })
      );

      reply.send({
        items: itemsWithMetadata,
        total: items.length,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get marketplace avatars error:', error);
      reply.code(500).send({
        error: 'Failed to get avatars',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/marketplace/search
   * Search marketplace items with full-text search.
   */
  app.get(
    '/search',
    {
      preHandler: [
    validateQuery(
      searchQuerySchema
        .partial()
        .extend({ q: z.string().min(1, 'Query parameter "q" is required') })
    ),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as z.infer<typeof searchQuerySchema> & { q: string };
        const q = query.q;
        const type = query.type;
        const tags = query.tags;
        const limit = query.limit ?? 50;
        const offset = (query as { offset?: number }).offset ?? 0;
        const sortByValue = query.sortBy;
        // Map 'recent' to 'newest' for compatibility, filter out 'price' (not supported)
        let sortBy: 'newest' | 'popular' | 'downloads' | 'likes' | undefined = 'newest';
        if (sortByValue === 'recent') {
          sortBy = 'newest';
        } else if (sortByValue && sortByValue !== 'price') {
          const validSortBy = sortByValue as string;
          if (
            validSortBy === 'newest' ||
            validSortBy === 'popular' ||
            validSortBy === 'downloads' ||
            validSortBy === 'likes'
          ) {
            sortBy = validSortBy;
          }
        }

        const items = await marketplaceStorage.getItems({
          ...(type && { type }),
          tags: tags ?? [],
          search: q.trim(),
          public: true,
          limit,
          offset,
          sortBy,
        });

        // Add online player count and liked status for each item
        const userId = await getUserIdFromToken(request.headers.authorization);
        const itemsWithMetadata = await Promise.all(
          items.map(async (item) => {
            const playersOnline = gameSessionTracker.getPlayerCount(item.id);
            let liked: boolean | undefined;
            if (userId) {
              liked = await likesStorage.isLiked(item.id, userId);
            }
            return {
              ...item,
              playersOnline,
              ...(liked !== undefined && { liked }),
            };
          })
        );

        reply.send({
          items: itemsWithMetadata,
          total: items.length,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          query: q.trim(),
        });
      } catch (error) {
        console.error('Search marketplace error:', error);
        reply.code(500).send({
          error: 'Failed to search marketplace',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/marketplace/:id
   * Get marketplace item details.
   */
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }
      const item = await marketplaceStorage.getItem(id);

      if (!item) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      // Add online player count
      const playersOnline = gameSessionTracker.getPlayerCount(id);

      // Add liked status if user is authenticated
      const userId = await getUserIdFromToken(request.headers.authorization);
      let liked: boolean | undefined;
      if (userId) {
        liked = await likesStorage.isLiked(id, userId);
      }

      reply.send({
        ...item,
        playersOnline,
        ...(liked !== undefined && { liked }),
      });
    } catch (error) {
      console.error('Get marketplace item error:', error);
      reply.code(500).send({
        error: 'Failed to get item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/marketplace/:id/players-online
   * Get number of active players in a game.
   */
  app.get('/:id/players-online', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }
      const playerCount = gameSessionTracker.getPlayerCount(id);

      reply.send({ gameId: id, playersOnline: playerCount });
    } catch (error) {
      console.error('Get players online error:', error);
      reply.code(500).send({
        error: 'Failed to get players online',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/marketplace/thumbnails/:id
   * Serve thumbnail image for a marketplace item.
   * If thumbnail doesn't exist, generate it on-demand.
   */
  app.get('/thumbnails/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }

      const thumbnailPath = path.join(THUMBNAIL_DIR, `${id}.svg`);

      // Check if thumbnail exists
      let thumbnailExists = false;
      try {
        await fs.access(thumbnailPath);
        thumbnailExists = true;
      } catch {
        // Thumbnail doesn't exist - try to generate it
        try {
          const item = await marketplaceStorage.getItem(id);
          if (item) {
            await generateAndSaveThumbnail(THUMBNAIL_DIR, item.id, item.title, item.tags);
            // Update item with thumbnail URL if missing
            if (!item.thumbnailUrl) {
              await marketplaceStorage.updateItem(item.id, {
                thumbnailUrl: `/api/marketplace/thumbnails/${item.id}`,
              });
            }
            thumbnailExists = true;
          }
        } catch (genError) {
          console.warn(`Failed to generate thumbnail for ${id}:`, genError);
        }
      }

      if (thumbnailExists) {
        try {
          reply.header('Content-Type', 'image/svg+xml');
          reply.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
          const svg = await fs.readFile(thumbnailPath, 'utf-8');
          reply.send(svg);
        } catch (readError) {
          console.error(`Failed to read thumbnail ${id}:`, readError);
          reply.code(500).send({ error: 'Failed to read thumbnail' });
        }
      } else {
        // Still doesn't exist after attempting generation
        reply.code(404).send({ error: 'Thumbnail not found' });
      }
    } catch (error) {
      console.error('Get thumbnail error:', error);
      reply.code(500).send({
        error: 'Failed to get thumbnail',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/marketplace/:id/build
   * Get build data for a marketplace item (like Kogama).
   * Returns the actual build/scene data that can be loaded in the editor.
   */
  app.get('/:id/build', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }

      const item = await marketplaceStorage.getItem(id);
      if (!item) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      if (item.type !== 'build') {
        return reply.code(400).send({ error: 'Item is not a build' });
      }

      // Load build data from storage if available
      if (buildStorage) {
        const buildData = await buildStorage.getBuild(id);
        if (buildData) {
          return reply.send(buildData);
        }
        // If no build data found, fall through to mock data
      }

      // Fallback: return minimal mock ProjectData structure
      // This maintains backward compatibility if build storage is not available
      const mockBuildData: ProjectData = {
        metadata: {
          id: item.id,
          name: item.title,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          ...(item.thumbnailUrl && { thumbnail: item.thumbnailUrl }),
        },
        scene: {
          name: item.title,
          entities: [], // Minimal scene - will be replaced with actual build storage
        },
      };

      reply.send(mockBuildData);
    } catch (error) {
      console.error('Get build data error:', error);
      reply.code(500).send({
        error: 'Failed to get build data',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/marketplace/:id/join
   * Join a game (start playing).
   */
  app.post('/:id/join', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }
      const item = await marketplaceStorage.getItem(id);

      if (!item) {
        return reply.code(404).send({ error: 'Game not found' });
      }

      gameSessionTracker.joinGame(id, request.user.id);
      const playerCount = gameSessionTracker.getPlayerCount(id);

      reply.send({ success: true, playersOnline: playerCount });
    } catch (error) {
      console.error('Join game error:', error);
      reply.code(500).send({
        error: 'Failed to join game',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/marketplace/:id/leave
   * Leave a game (stop playing).
   */
  app.post('/:id/leave', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }
      gameSessionTracker.leaveGame(id, request.user.id);
      const playerCount = gameSessionTracker.getPlayerCount(id);

      reply.send({ success: true, playersOnline: playerCount });
    } catch (error) {
      console.error('Leave game error:', error);
      reply.code(500).send({
        error: 'Failed to leave game',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/marketplace
   * Publish item to marketplace (auth required).
   */
  app.post(
    '/',
    {
      preHandler: [
    authMiddleware,
    bodySizeLimit(BodySizeLimits.MARKETPLACE_PUBLISH),
    validateBody(publishItemSchema),
        // Rate limiting will be handled by registering plugin at route level if needed
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Sanitize the body (HTML content)
        const sanitizedBody = sanitizeMarketplacePublishRequest(
          request.body as Record<string, unknown>
        );

        const body = sanitizedBody as z.infer<typeof publishItemSchema> & {
          thumbnailUrl?: string;
          buildData?: ProjectData;
        };

        const user = await authManager.getUserById(request.user.id);

        // Use transaction if database is available
        if (dbPool && marketplaceStorage instanceof MarketplaceStorageDB) {
          try {
            // Use Prisma transaction
            const item = await dbPool.$transaction(
              async (tx: Parameters<Parameters<typeof dbPool.$transaction>[0]>[0]) => {
                // Create marketplace item within transaction
                const createdItem = await marketplaceStorage.createItem(
                  {
                    type: body.type,
                    title: body.title,
                    description: body.description ?? '',
                    authorId: request.user!.id,
                    authorName: user?.email ?? '',
                    thumbnailUrl: body.thumbnailUrl ?? '',
                    fileUrl: body.fileUrl,
                    tags: body.tags ?? [],
                    public: true,
                  },
                  tx as any
                );

                // Save build data within transaction if provided
                if (body.type === 'build' && body.buildData && buildStorage) {
                  await buildStorage.saveBuild(createdItem.id, body.buildData);
                }

                return createdItem;
              }
            );

            // Track warnings for partial failures (with transactions, should be empty)
            const warnings: string[] = [];

            // Create forum thread outside transaction (JSON storage, not transactional)
            // This is error-tolerant - if forum creation fails, item is still published
            try {
              const showcaseCategory = await forumStorage.getCategory('cat_showcase');
              if (showcaseCategory && !showcaseCategory.isLocked) {
                const threadContent = `${body.description || `Check out my new ${body.type === 'build' ? 'build' : 'avatar'}!`}\n\n[View in Marketplace](/marketplace/${item.id})`;

                const forumThread = await forumStorage.createThread({
                  categoryId: 'cat_showcase',
                  authorId: request.user.id,
                  title: `[Marketplace] ${body.title}`,
                  content: threadContent,
                  isPinned: false,
                  isLocked: false,
                  tags: body.tags || [],
                  marketplaceItemId: item.id,
                });

                // Update marketplace item with forum thread link (outside transaction, but safe)
                await marketplaceStorage.updateItem(item.id, {
                  forumThreadId: forumThread.id,
                });

                // Broadcast new thread via WebSocket
                await forumHandler.handleThreadCreated(forumThread, 'cat_showcase', request.user.id);
              }
            } catch (error) {
              console.error('Failed to create forum thread for marketplace item:', error);
              warnings.push('Forum thread was not created');
            }

            reply.code(201).send({
              ...item,
              warnings: warnings.length > 0 ? warnings : undefined,
            });
          } catch (error) {
            // Wrap database errors in DatabaseError
            if (
              error instanceof Error &&
              !(
                error instanceof ValidationErrorClass ||
                error instanceof BuildDataErrorClass ||
                error instanceof PayloadTooLargeErrorClass
              )
            ) {
              throw new DatabaseErrorClass('Database transaction failed', error);
            }
            throw error;
          }
        } else {
          // Fallback for non-DB storage (JSON file)
          const item = await marketplaceStorage.createItem({
            type: body.type,
            title: body.title,
            description: body.description ?? '',
            authorId: request.user.id,
            authorName: user?.email ?? '',
            thumbnailUrl: body.thumbnailUrl ?? '',
            fileUrl: body.fileUrl,
            tags: body.tags ?? [],
            public: true,
          });

          // Track warnings for partial failures
          const warnings: string[] = [];

          // Save build data if provided and storage is available
          if (body.type === 'build' && body.buildData && buildStorage) {
            try {
              await buildStorage.saveBuild(item.id, body.buildData);
            } catch (error) {
              console.error('Failed to save build data:', error);
              warnings.push('Build data was not saved');
            }
          }

          // Automatically create forum thread in showcase category
          try {
            const showcaseCategory = await forumStorage.getCategory('cat_showcase');
            if (showcaseCategory && !showcaseCategory.isLocked) {
              const threadContent = `${body.description || `Check out my new ${body.type === 'build' ? 'build' : 'avatar'}!`}\n\n[View in Marketplace](/marketplace/${item.id})`;

              const forumThread = await forumStorage.createThread({
                categoryId: 'cat_showcase',
                authorId: request.user.id,
                title: `[Marketplace] ${body.title}`,
                content: threadContent,
                isPinned: false,
                isLocked: false,
                tags: body.tags || [],
                marketplaceItemId: item.id,
              });

              // Update marketplace item with forum thread link
              await marketplaceStorage.updateItem(item.id, {
                forumThreadId: forumThread.id,
              });

              // Broadcast new thread via WebSocket
              await forumHandler.handleThreadCreated(forumThread, 'cat_showcase', request.user.id);
            }
          } catch (error) {
            console.error('Failed to create forum thread for marketplace item:', error);
            warnings.push('Forum thread was not created');
          }

          reply.code(201).send({
            ...item,
            warnings: warnings.length > 0 ? warnings : undefined,
          });
        }
      } catch (error) {
        console.error('Publish marketplace item error:', error);

        // Structured error handling
        if (error instanceof ValidationErrorClass) {
          return reply.code(400).send({
            error: 'Validation failed',
            message: error.message,
            errors: error.errors,
          });
        }

        if (error instanceof PayloadTooLargeErrorClass) {
          return reply.code(413).send({
            error: 'Payload too large',
            message: error.message,
          });
        }

        if (error instanceof BuildDataErrorClass) {
          return reply.code(400).send({
            error: 'Invalid build data',
            message: error.message,
          });
        }

        if (error instanceof DatabaseErrorClass) {
          // Log internal error details but don't expose them
          console.error('Database error details:', error.originalError);
          return reply.code(500).send({
            error: 'Database error occurred',
            message: 'Failed to publish item due to database error',
          });
        }

        // Generic error fallback - don't expose internal details
        console.error('Unexpected error:', error);
        return reply.code(500).send({
          error: 'Internal server error',
          message: 'Failed to publish item',
        });
      }
    }
  );

  /**
   * POST /api/marketplace/:id/like
   * Toggle like/unlike for a marketplace item (auth required).
   */
  app.post('/:id/like', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }

      const item = await marketplaceStorage.getItem(id);
      if (!item) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      const isLiked = await likesStorage.isLiked(id, request.user.id);

      if (isLiked) {
        await likesStorage.unlikeItem(id, request.user.id);
      } else {
        await likesStorage.likeItem(id, request.user.id);
      }

      // Get updated like count
      const updatedItem = await marketplaceStorage.getItem(id);
      const liked = !isLiked;

      reply.send({
        liked,
        likes: updatedItem?.likes ?? 0,
      });
    } catch (error) {
      console.error('Like item error:', error);
      reply.code(500).send({
        error: 'Failed to like/unlike item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/marketplace/:id/likes
   * Get like count and status for a marketplace item.
   */
  app.get('/:id/likes', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }

      const item = await marketplaceStorage.getItem(id);
      if (!item) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      const likes = item.likes;

      // If user is authenticated, include liked status
      const userId = await getUserIdFromToken(request.headers.authorization);
      let liked: boolean | undefined;
      if (userId) {
        liked = await likesStorage.isLiked(id, userId);
      }

      reply.send({
        likes,
        ...(liked !== undefined && { liked }),
      });
    } catch (error) {
      console.error('Get likes error:', error);
      reply.code(500).send({
        error: 'Failed to get likes',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/marketplace/:id/forum-thread
   * Get or create forum thread for marketplace item.
   */
  app.get('/:id/forum-thread', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }
      const item = await marketplaceStorage.getItem(id);

      if (!item) {
        return reply.code(404).send({ error: 'Marketplace item not found' });
      }

      // Check if thread already exists
      if (item.forumThreadId) {
        const thread = await forumStorage.getThread(item.forumThreadId);
        if (thread) {
          return reply.send({ threadId: thread.id });
        }
      }

      // Create new thread if it doesn't exist
      const showcaseCategory = await forumStorage.getCategory('cat_showcase');
      if (!showcaseCategory || showcaseCategory.isLocked) {
        return reply.code(400).send({ error: 'Cannot create forum thread for this item' });
      }

      const threadContent = `${item.description || `Check out this ${item.type === 'build' ? 'build' : 'avatar'}!`}\n\n[View in Marketplace](/marketplace/${item.id})`;

      const forumThread = await forumStorage.createThread({
        categoryId: 'cat_showcase',
        authorId: item.authorId,
        title: `[Marketplace] ${item.title}`,
        content: threadContent,
        isPinned: false,
        isLocked: false,
        tags: item.tags || [],
        marketplaceItemId: item.id,
      });

      // Update marketplace item with forum thread link
      await marketplaceStorage.updateItem(item.id, {
        forumThreadId: forumThread.id,
      });

      reply.send({ threadId: forumThread.id });
    } catch (error) {
      console.error('Get or create forum thread error:', error);
      reply.code(500).send({
        error: 'Failed to get or create forum thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /api/marketplace/:id
   * Delete marketplace item (own items only).
   */
  app.delete('/:id', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }
      const deleted = await marketplaceStorage.deleteItem(id, request.user.id);

      if (!deleted) {
        return reply.code(404).send({ error: 'Item not found or unauthorized' });
      }

      reply.code(204).send();
    } catch (error) {
      console.error('Delete marketplace item error:', error);
      reply.code(500).send({
        error: 'Failed to delete item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

}


