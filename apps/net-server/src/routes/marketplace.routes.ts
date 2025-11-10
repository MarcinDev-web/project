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
  marketplaceQuerySchema,
} from '../validation/schemas/marketplace.js';
import { bodySizeLimit, BodySizeLimits } from '../middleware/bodySizeLimit.js';
import { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB.js';
import type { ProjectData } from '../types.js';
import type { MarketplaceItem } from '../storage/MarketplaceStorage.js';
import type { GameSessionTracker } from '../websocket/GameSessionTracker.js';
import type { LikesStorage } from '../storage/LikesStorage.js';
import type { CurrencyAmount } from '@engine/economy';
import NodeCache from 'node-cache';

/**
 * Helper function to enrich marketplace items with metadata (players online, liked status)
 * This avoids N+1 queries by batch fetching user likes
 */
async function enrichItemsWithMetadata(
  items: MarketplaceItem[],
  userId: string | null,
  gameSessionTracker: GameSessionTracker,
  likesStorage: LikesStorage
): Promise<Array<MarketplaceItem & { playersOnline: number; liked?: boolean }>> {
  // Batch fetch all likes for user (single query instead of N queries)
  const likedItemIds = userId 
    ? new Set(await likesStorage.getUserLikes(userId))
    : new Set<string>();
  
  return items.map((item) => {
    const playersOnline = gameSessionTracker.getPlayerCount(item.id);
    const liked = userId ? likedItemIds.has(item.id) : undefined;
    
    return {
      ...item,
      playersOnline,
      ...(liked !== undefined && { liked }),
    };
  });
}

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
    marketplaceLikeLimiter,
    dbPool,
    path,
    fs,
    resaleListings,
    resaleStorage,
    ECONOMY_MIN_PRICE,
    ECONOMY_PRICE_CHANGE_COOLDOWN_SEC,
    ECONOMY_LISTING_FEE,
    ECONOMY_PLATFORM_FEE_BPS,
    sanitizeMarketplacePublishRequest,
    ValidationError: ValidationErrorClass,
    BuildDataError: BuildDataErrorClass,
    PayloadTooLargeError: PayloadTooLargeErrorClass,
    DatabaseError: DatabaseErrorClass,
    isProduction,
  } = opts.dependencies;

  // Register rate limiters for specific endpoints using scope registration
  // Note: Fastify rate-limit plugin must be registered per route scope

  // Cache for popular marketplace items (5 minute TTL)
  const itemCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

  /**
   * Helper function to invalidate cache for a marketplace item
   */
  function invalidateItemCache(itemId: string): void {
    itemCache.del(`item:${itemId}`);
  }

  /**
   * GET /api/marketplace/builds
   * List marketplace builds (paginated).
   */
  app.get('/builds', {
    preHandler: [validateQuery(marketplaceQuerySchema)],
  }, async (request, reply) => {
    try {
      const query = request.query as z.infer<typeof marketplaceQuerySchema> & {
        tags?: string;
      };

      const type = query.type;
      const tags = query.tags ? (Array.isArray(query.tags) ? query.tags : String(query.tags).split(',')) : undefined;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const items = await marketplaceStorage.getItems({
        type: type ?? 'build',
        tags: tags ?? [],
        public: true,
        limit,
        offset,
      });

      // Add online player count and liked status for each item (batch fetch to avoid N+1)
      const userId = await getUserIdFromToken(request.headers.authorization);
      const itemsWithMetadata = await enrichItemsWithMetadata(
        items,
        userId,
        gameSessionTracker,
        likesStorage
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
  app.get('/paid', {
    preHandler: [validateQuery(marketplaceQuerySchema.pick({ type: true, limit: true, offset: true }))],
  }, async (request, reply) => {
    try {
      const query = request.query as z.infer<typeof marketplaceQuerySchema> & {
        type?: 'build' | 'avatar';
      };

      const type = query.type;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

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
  // Register rate limiter for price endpoint
  await app.register(async function (fastify) {
    if (isProduction) {
      await fastify.register(rateLimit, economyLimiter);
    }
    fastify.put('/:id/price', { preHandler: [authMiddleware] }, async (request, reply) => {
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

      // Invalidate cache
      invalidateItemCache(id);

      reply.send(updatedItem);
    } catch (error) {
      console.error('Update marketplace price error:', error);
      reply.code(500).send({
        error: 'Failed to update price',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
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
      
      // Use resaleStorage if available, otherwise fallback to in-memory Map
      if (resaleStorage) {
        const listings = await resaleStorage.getListings(id);
        reply.send({ listings });
      } else {
        const listings = resaleListings.get(id) ?? [];
        reply.send({ listings });
      }
    } catch (error) {
      console.error('List resale error:', error);
      reply.code(500).send({ error: 'Failed to list resale' });
    }
  });

  /**
   * POST /api/marketplace/:id/resale
   * Create or update a secondary resale listing for the current user.
   */
  // Register rate limiter for resale endpoint
  await app.register(async function (fastify) {
    if (isProduction) {
      await fastify.register(rateLimit, economyLimiter);
    }
    fastify.post(
      '/:id/resale',
      {
        preHandler: [
          authMiddleware,
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

        // Use resaleStorage if available, otherwise fallback to in-memory Map
        if (resaleStorage) {
          const listing = await resaleStorage.createListing(id, request.user.id, body.price);
          reply.send({ success: true, listing });
        } else {
          const list = resaleListings.get(id) ?? [];
          const idx = list.findIndex((l) => l.sellerId === request.user!.id);
          const newListing = { sellerId: request.user.id, price: body.price, createdAt: Date.now() };
          if (idx >= 0) list[idx] = newListing;
          else list.push(newListing);
          resaleListings.set(id, list);
          reply.send({ success: true, listing: newListing });
        }
      } catch (error) {
        console.error('Create resale error:', error);
        reply.code(500).send({ error: 'Failed to create resale listing' });
      }
    }
  );
  });

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

        // Find listing - use resaleStorage if available, otherwise fallback to in-memory Map
        let listing: { sellerId: string; price: CurrencyAmount; createdAt: number } | null = null;
        if (resaleStorage) {
          const dbListing = await resaleStorage.getListing(id, body.sellerId);
          if (dbListing) {
            listing = {
              sellerId: dbListing.sellerId,
              price: dbListing.price,
              createdAt: dbListing.createdAt,
            };
          }
        } else {
          const list = resaleListings.get(id) ?? [];
          listing = list.find((l) => l.sellerId === body.sellerId) ?? null;
        }
        
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

        // Remove listing - use resaleStorage if available, otherwise fallback to in-memory Map
        if (resaleStorage) {
          await resaleStorage.deleteListing(id, body.sellerId);
        } else {
          const newList = (resaleListings.get(id) ?? []).filter((l) => l.sellerId !== body.sellerId);
          resaleListings.set(id, newList);
        }

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
  app.get('/avatars', {
    preHandler: [validateQuery(marketplaceQuerySchema.pick({ limit: true, offset: true, sortBy: true }))],
  }, async (request, reply) => {
    try {
      const query = request.query as z.infer<typeof marketplaceQuerySchema>;
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const sortBy = query.sortBy;

      const items = await marketplaceStorage.getItems({
        type: 'avatar',
        public: true,
        limit,
        offset,
        sortBy: sortBy ?? 'newest',
      });

      // Add online player count and liked status for each item (batch fetch to avoid N+1)
      const userId = await getUserIdFromToken(request.headers.authorization);
      const itemsWithMetadata = await enrichItemsWithMetadata(
        items,
        userId,
        gameSessionTracker,
        likesStorage
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

        // Add online player count and liked status for each item (batch fetch to avoid N+1)
        const userId = await getUserIdFromToken(request.headers.authorization);
        const itemsWithMetadata = await enrichItemsWithMetadata(
          items,
          userId,
          gameSessionTracker,
          likesStorage
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
   * GET /api/marketplace/:id/download
   * Download free marketplace item (no price required).
   * For paid items, use shop checkout API.
   * NOTE: This route must be registered BEFORE /:id to avoid routing conflicts.
   */
  app.get('/:id/download', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }

      const item = await marketplaceStorage.getItem(id);
      if (!item) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      // Only allow download for free items (no price)
      if (item.price) {
        return reply.code(403).send({ 
          error: 'This item is not free. Please purchase it through the shop.' 
        });
      }

      // Increment download count
      const currentDownloads = item.downloads ?? 0;
      await marketplaceStorage.updateItem(id, {
        downloads: currentDownloads + 1,
      });

      // Invalidate cache after download count update
      invalidateItemCache(id);

      // Return file URL for download
      reply.send({ 
        fileUrl: item.fileUrl,
        itemId: item.id,
        title: item.title,
      });
    } catch (error) {
      console.error('Download marketplace item error:', error);
      reply.code(500).send({
        error: 'Failed to download item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/marketplace/:id
   * Get marketplace item details (cached for 5 minutes).
   */
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }

      // Check cache first
      const cacheKey = `item:${id}`;
      const cached = itemCache.get<MarketplaceItem & { playersOnline: number; liked?: boolean }>(cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        return reply.send(cached);
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

      const response = {
        ...item,
        playersOnline,
        ...(liked !== undefined && { liked }),
      };

      // Cache the response (exclude user-specific liked status from cache key if needed)
      // For simplicity, we cache with user-specific data, but TTL is short
      itemCache.set(cacheKey, response);

      reply.header('X-Cache', 'MISS');
      reply.send(response);
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

      // Try to find thumbnail with different extensions (uploaded images take priority)
      const possibleExtensions = ['png', 'jpg', 'jpeg', 'svg'];
      let thumbnailPath = '';
      let thumbnailExists = false;
      
      for (const ext of possibleExtensions) {
        const testPath = path.join(THUMBNAIL_DIR, `${id}.${ext}`);
        try {
          await fs.access(testPath);
          thumbnailPath = testPath;
          thumbnailExists = true;
          break;
        } catch {
          // File doesn't exist, try next extension
        }
      }
      
      if (!thumbnailExists) {
        // Thumbnail doesn't exist - try to generate it
        try {
          const item = await marketplaceStorage.getItem(id);
          if (item) {
            await generateAndSaveThumbnail(THUMBNAIL_DIR, item.id, item.title, item.tags, item.type);
            // Update item with thumbnail URL if missing
            if (!item.thumbnailUrl) {
              await marketplaceStorage.updateItem(item.id, {
                thumbnailUrl: `/api/marketplace/thumbnails/${item.id}`,
              });
            }
            // Set path to generated SVG
            thumbnailPath = path.join(THUMBNAIL_DIR, `${id}.svg`);
            thumbnailExists = true;
          }
        } catch (genError) {
          console.warn(`Failed to generate thumbnail for ${id}:`, genError);
        }
      }

      if (thumbnailExists) {
        try {
          // Determine content type based on file extension
          const ext = path.extname(thumbnailPath).toLowerCase();
          let contentType = 'image/svg+xml';
          
          if (ext === '.png') {
            contentType = 'image/png';
          } else if (ext === '.jpg' || ext === '.jpeg') {
            contentType = 'image/jpeg';
          }
          
          reply.header('Content-Type', contentType);
          reply.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
          
          // For SVG, read as text; for images, read as buffer
          if (ext === '.svg') {
            const svg = await fs.readFile(thumbnailPath, 'utf-8');
            reply.send(svg);
          } else {
            const buffer = await fs.readFile(thumbnailPath);
            reply.send(buffer);
          }
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
   * POST /api/marketplace/:id/thumbnail
   * Upload custom thumbnail for marketplace item
   * Requires auth - only item owner can upload thumbnail
   */
  app.post(
    '/:id/thumbnail',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id?: string };
        if (!id) {
          return reply.code(400).send({ error: 'Item ID required' });
        }

        // Verify item exists and user is owner
        const item = await marketplaceStorage.getItem(id);
        if (!item) {
          return reply.code(404).send({ error: 'Item not found' });
        }

        if (item.authorId !== request.user!.id) {
          return reply.code(403).send({ error: 'Only item owner can upload thumbnail' });
        }

        // Get uploaded file
        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ error: 'No file uploaded' });
        }

        // Validate file type
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedMimeTypes.includes(data.mimetype)) {
          return reply.code(400).send({
            error: 'Invalid file type. Only JPEG and PNG images are allowed.',
          });
        }

        // Read file buffer
        const buffer = await data.toBuffer();

        // Validate file size (already enforced by multipart plugin, but double-check)
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (buffer.length > maxSize) {
          return reply.code(400).send({
            error: 'File too large. Maximum size is 2MB.',
          });
        }

        // Save thumbnail to disk
        await fs.mkdir(THUMBNAIL_DIR, { recursive: true });

        // Determine extension from mimetype
        const ext = data.mimetype === 'image/png' ? 'png' : 'jpg';
        const filename = `${id}.${ext}`;
        const filepath = path.join(THUMBNAIL_DIR, filename);

        await fs.writeFile(filepath, buffer);

        // Update item with new thumbnail URL
        const thumbnailUrl = `/api/marketplace/thumbnails/${id}`;
        await marketplaceStorage.updateItem(id, {
          thumbnailUrl,
        });

        reply.send({
          success: true,
          thumbnailUrl,
          message: 'Thumbnail uploaded successfully',
        });
      } catch (error) {
        console.error('Upload thumbnail error:', error);
        reply.code(500).send({
          error: 'Failed to upload thumbnail',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/marketplace/avatars/:id
   * Get avatar data for a marketplace item.
   * Returns the AvatarLoadout data that can be used to create an avatar.
   * NOTE: This route must be registered BEFORE /:id/build to avoid routing conflicts.
   */
  app.get('/avatars/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as { id?: string });
      if (!id) {
        return reply.code(400).send({ error: 'Item ID required' });
      }

      const item = await marketplaceStorage.getItem(id);
      if (!item) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      if (item.type !== 'avatar') {
        return reply.code(400).send({ error: 'Item is not an avatar' });
      }

      // Load avatar data from database
      if (dbPool) {
        const avatarData = await dbPool.marketplaceAvatar.findUnique({
          where: { marketplaceId: id },
        });

        if (avatarData) {
          const jsonData = avatarData.avatarData.toString('utf-8');
          const loadout = JSON.parse(jsonData) as Record<string, unknown>;
          return reply.send(loadout);
        }
      }

      return reply.code(404).send({ error: 'Avatar data not found' });
    } catch (error) {
      console.error('Get avatar data error:', error);
      reply.code(500).send({
        error: 'Failed to get avatar data',
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
  // Register rate limiter for publish endpoint
  await app.register(async function (fastify) {
    if (isProduction) {
      await fastify.register(rateLimit, publishLimiter);
    }
    fastify.post(
      '/',
      {
        preHandler: [
          authMiddleware,
          bodySizeLimit(BodySizeLimits.MARKETPLACE_PUBLISH),
          validateBody(publishItemSchema),
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
                    authorName: user?.username || user?.email || '',
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

                // Invalidate cache
                invalidateItemCache(item.id);

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
            authorName: user?.username || user?.email || '',
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
  });

  /**
   * POST /api/marketplace/:id/like
   * Toggle like/unlike for a marketplace item (auth required).
   */
  // Register rate limiter for like endpoint
  await app.register(async function (fastify) {
    if (isProduction) {
      await fastify.register(rateLimit, marketplaceLikeLimiter);
    }
    fastify.post('/:id/like', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
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

      // Invalidate cache after like/unlike
      invalidateItemCache(id);

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

      // Invalidate cache
      invalidateItemCache(item.id);

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
   * Performs cascade delete: likes, build data, forum threads, resale listings.
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

      // Get item first to check ownership and get related data
      const item = await marketplaceStorage.getItem(id);
      if (!item) {
        return reply.code(404).send({ error: 'Item not found' });
      }

      // Check authorization (author or admin)
      if (item.authorId !== request.user.id && request.user.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Cascade delete: resale listings
      if (resaleStorage) {
        await resaleStorage.deleteListings(id);
      } else {
        resaleListings.delete(id);
      }

      // Cascade delete: forum thread (if exists)
      if (item.forumThreadId) {
        try {
          await forumStorage.deleteThread(item.forumThreadId, request.user.id);
        } catch (error) {
          // Log but don't fail if thread deletion fails
          console.warn(`Failed to delete forum thread ${item.forumThreadId}:`, error);
        }
      }

      // Cascade delete: build data (handled by Prisma cascade if using DB)
      if (buildStorage) {
        try {
          await buildStorage.deleteBuild(id);
        } catch (error) {
          // Log but don't fail if build deletion fails
          console.warn(`Failed to delete build data for ${id}:`, error);
        }
      }

      // Cascade delete: likes (handled by Prisma cascade if using DB)
      // For JSON storage, likesStorage doesn't have a delete method, but it's okay
      // as likes are not critical for item deletion

      // Finally, delete the marketplace item
      const deleted = await marketplaceStorage.deleteItem(id, request.user.id);

      if (!deleted) {
        return reply.code(404).send({ error: 'Item not found or unauthorized' });
      }

      // Invalidate cache after deletion
      invalidateItemCache(id);

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


