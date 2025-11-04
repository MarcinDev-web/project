import type { FastifyInstance } from 'fastify';
import type { RouteDependencies } from './index';

/**
 * Create shop routes for Fastify
 */
export async function createShopRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const {
    authMiddleware,
    requireAdmin,
    shopStorage,
    assetStorage,
    purchaseStorage,
    purchaseService,
    currencyService,
    userCarts,
  } = opts.dependencies;

  type ShopItemsQuery = {
    category?: string;
    currency?: string;
    available?: string;
    limit?: number | string;
    offset?: number | string;
    search?: string;
  };

  /**
   * GET /api/shop/items
   * Get list of shop items with optional filters
   */
  app.get<{ Querystring: ShopItemsQuery }>(
    '/items',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            currency: { type: 'string' },
            available: { type: 'string' },
            limit: { type: 'number' },
            offset: { type: 'number' },
            search: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = request.query as ShopItemsQuery;
        const category = query.category;
        const currency = query.currency;
        const available =
          query.available === undefined ? true : query.available === 'true' || query.available === '1';
        const limit = query.limit ? Number(query.limit) : 50;
        const offset = query.offset ? Number(query.offset) : 0;
        const search = query.search;

        const filter: {
          category?: 'consumable' | 'cosmetic' | 'upgrade' | 'collectible';
          currency?: string;
          available: boolean;
          limit?: number;
          offset?: number;
          search?: string;
        } = { available, limit, offset };
        if (category !== undefined)
          filter.category = category as 'consumable' | 'cosmetic' | 'upgrade' | 'collectible';
        if (currency !== undefined) filter.currency = currency;
        if (search !== undefined) filter.search = search;

        const items = await shopStorage.getItems(filter);

        const countFilter: {
          category?: 'consumable' | 'cosmetic' | 'upgrade' | 'collectible';
          currency?: string;
          available: boolean;
          search?: string;
        } = { available };
        if (category !== undefined)
          countFilter.category = category as 'consumable' | 'cosmetic' | 'upgrade' | 'collectible';
        if (currency !== undefined) countFilter.currency = currency;
        if (search !== undefined) countFilter.search = search;

        const total = await shopStorage.getItemsCount(countFilter);

        reply.send({
          items,
          total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
        });
      } catch (error) {
        console.error('Get shop items error:', error);
        reply.code(500).send({
          error: 'Failed to get shop items',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/shop/items/:id
   * Get shop item details
   */
  type AssetQuery = {
    type?: 'material' | 'model' | 'texture' | 'script';
    category?: string;
    authorId?: string;
    available?: string;
    limit?: number | string;
    offset?: number | string;
    search?: string;
  };

  type PurchasesQuery = {
    limit?: number | string;
    offset?: number | string;
    status?: 'pending' | 'completed' | 'failed';
  };

  type IdParams = { id: string };

  app.get<{ Params: IdParams }>(
    '/items/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as IdParams;
        const item = await shopStorage.getItem(id);

        if (!item) {
          return reply.code(404).send({ error: 'Item not found' });
        }

        reply.send(item);
      } catch (error) {
        console.error('Get shop item error:', error);
        reply.code(500).send({
          error: 'Failed to get shop item',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * POST /api/shop/items
   * Create shop item (admin only)
   */
  app.post(
    '/items',
    {
      preHandler: [authMiddleware, requireAdmin()],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'category', 'price'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string', enum: ['consumable', 'cosmetic', 'upgrade', 'collectible'] },
            price: {
              type: 'object',
              required: ['currency', 'amount'],
              properties: {
                currency: { type: 'string' },
                amount: { type: 'number' },
              },
            },
            imageUrl: { type: 'string' },
            available: { type: 'boolean' },
            stock: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const body = request.body as {
          name: string;
          description?: string;
          category: 'consumable' | 'cosmetic' | 'upgrade' | 'collectible';
          price: { currency: string; amount: number };
          imageUrl?: string;
          available?: boolean;
          stock?: number;
        };

        if (!body.name || !body.category || !body.price) {
          return reply.code(400).send({ error: 'Missing required fields' });
        }

        const item = await shopStorage.createItem({
          name: body.name,
          category: body.category,
          price: body.price,
          available: body.available ?? true,
          ...(body.description !== undefined && { description: body.description }),
          ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
          ...(body.stock !== undefined && { stock: body.stock }),
        });

        reply.code(201).send(item);
      } catch (error) {
        console.error('Create shop item error:', error);
        reply.code(500).send({
          error: 'Failed to create shop item',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * PUT /api/shop/items/:id
   * Update shop item (admin only)
   */
  app.put<{ Params: IdParams }>(
    '/items/:id',
    {
      preHandler: [authMiddleware, requireAdmin()],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string', enum: ['consumable', 'cosmetic', 'upgrade', 'collectible'] },
            price: {
              type: 'object',
              properties: {
                currency: { type: 'string' },
                amount: { type: 'number' },
              },
            },
            imageUrl: { type: 'string' },
            available: { type: 'boolean' },
            stock: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as IdParams;
        const updates = request.body as Partial<{
          name: string;
          description: string;
          category: 'consumable' | 'cosmetic' | 'upgrade' | 'collectible';
          price: { currency: string; amount: number };
          imageUrl: string;
          available: boolean;
          stock: number;
        }>;

        const item = await shopStorage.updateItem(id, updates);

        if (!item) {
          return reply.code(404).send({ error: 'Item not found' });
        }

        reply.send(item);
      } catch (error) {
        console.error('Update shop item error:', error);
        reply.code(500).send({
          error: 'Failed to update shop item',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * DELETE /api/shop/items/:id
   * Delete shop item (admin only)
   */
  app.delete<{ Params: IdParams }>(
    '/items/:id',
    {
      preHandler: [authMiddleware, requireAdmin()],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = (request.params as IdParams);
        const deleted = await shopStorage.deleteItem(id);

        if (!deleted) {
          return reply.code(404).send({ error: 'Item not found' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Delete shop item error:', error);
        reply.code(500).send({
          error: 'Failed to delete shop item',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/shop/cart
   * Get user's cart
   */
  app.get('/cart', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const cart = userCarts.get(request.user.id) ?? [];
      reply.send({ items: cart });
    } catch (error) {
      console.error('Get cart error:', error);
      reply.code(500).send({
        error: 'Failed to get cart',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/shop/cart
   * Add item to cart
   */
  app.post(
    '/cart',
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: 'object',
          required: ['itemId', 'type'],
          properties: {
            itemId: { type: 'string' },
            type: { type: 'string', enum: ['shop-item', 'asset', 'marketplace-item'] },
            quantity: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const body = request.body as {
          itemId: string;
          type: 'shop-item' | 'asset' | 'marketplace-item';
          quantity?: number;
        };

        const quantity = body.quantity ?? 1;
        const cart = userCarts.get(request.user.id) ?? [];

        // Check if item already in cart
        const existingIndex = cart.findIndex(
          (item) => item.itemId === body.itemId && item.type === body.type
        );

        if (existingIndex >= 0) {
          cart[existingIndex]!.quantity += quantity;
        } else {
          cart.push({
            itemId: body.itemId,
            type: body.type,
            quantity,
          });
        }

        userCarts.set(request.user.id, cart);
        reply.send({ items: cart });
      } catch (error) {
        console.error('Add to cart error:', error);
        reply.code(500).send({
          error: 'Failed to add to cart',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * DELETE /api/shop/cart/:itemId
   * Remove item from cart
   */
  app.delete(
    '/cart/:itemId',
    {
      preHandler: [authMiddleware],
      schema: {
        params: {
          type: 'object',
          required: ['itemId'],
          properties: {
            itemId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          required: ['type'],
          properties: {
            type: { type: 'string', enum: ['shop-item', 'asset', 'marketplace-item'] },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { itemId } = request.params as { itemId?: string };
        const { type: itemType } = request.query as {
          type?: 'shop-item' | 'asset' | 'marketplace-item';
        };

        if (!itemId || !itemType) {
          return reply.code(400).send({ error: 'itemId and type are required' });
        }

        const cart = userCarts.get(request.user.id) ?? [];
        const filtered = cart.filter((item) => !(item.itemId === itemId && item.type === itemType));

        userCarts.set(request.user.id, filtered);
        reply.send({ items: filtered });
      } catch (error) {
        console.error('Remove from cart error:', error);
        reply.code(500).send({
          error: 'Failed to remove from cart',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * POST /api/shop/cart/clear
   * Clear cart
   */
  app.post('/cart/clear', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      userCarts.set(request.user.id, []);
      reply.send({ items: [] });
    } catch (error) {
      console.error('Clear cart error:', error);
      reply.code(500).send({
        error: 'Failed to clear cart',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/shop/checkout
   * Process checkout
   */
  app.post('/checkout', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const cart = userCarts.get(request.user.id) ?? [];

      if (cart.length === 0) {
        return reply.code(400).send({ error: 'Cart is empty' });
      }

      // Simple A/B tuning via header: X-AB-Group: 'A' | 'B'
      const abGroup = (request.headers['x-ab-group'] as string | undefined)?.toUpperCase();
      const overrideMultiplier =
        abGroup === 'B'
          ? parseFloat(String(process.env.ECONOMY_PRICE_MULTIPLIER_B ?? '1'))
          : undefined;
      const result = await purchaseService.checkout(
        request.user.id,
        { items: cart },
        overrideMultiplier
      );

      if (result.success && result.purchaseId) {
        // Clear cart on success
        userCarts.set(request.user.id, []);
        reply.send(result);
      } else {
        reply.code(400).send(result);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      reply.code(500).send({
        error: 'Checkout failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/shop/assets
   * Get list of assets
   */
  app.get(
    '/assets',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['material', 'model', 'texture', 'script'] },
            category: { type: 'string' },
            authorId: { type: 'string' },
            available: { type: 'string' },
            limit: { type: 'number' },
            offset: { type: 'number' },
            search: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = request.query as AssetQuery;
        const { type, category, authorId, search } = query;
        const available =
          query.available === undefined ? true : query.available === 'true' || query.available === '1';
        const limit = query.limit ? Number(query.limit) : 50;
        const offset = query.offset ? Number(query.offset) : 0;

        const filter: {
          type?: 'material' | 'model' | 'texture' | 'script';
          category?: string;
          authorId?: string;
          available: boolean;
          limit?: number;
          offset?: number;
          search?: string;
        } = { available, limit, offset };
        if (type !== undefined) filter.type = type;
        if (category !== undefined) filter.category = category;
        if (authorId !== undefined) filter.authorId = authorId;
        if (search !== undefined) filter.search = search;

        const assets = await assetStorage.getAssets(filter);

        const countFilter: {
          type?: 'material' | 'model' | 'texture' | 'script';
          category?: string;
          authorId?: string;
          available: boolean;
          search?: string;
        } = { available };
        if (type !== undefined) countFilter.type = type;
        if (category !== undefined) countFilter.category = category;
        if (authorId !== undefined) countFilter.authorId = authorId;
        if (search !== undefined) countFilter.search = search;

        const total = await assetStorage.getAssetsCount(countFilter);

        reply.send({
          items: assets,
          total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
        });
      } catch (error) {
        console.error('Get assets error:', error);
        reply.code(500).send({
          error: 'Failed to get assets',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/shop/assets/:id
   * Get asset details
   */
  app.get<{ Params: IdParams }>(
    '/assets/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = (request.params as IdParams);
        const asset = await assetStorage.getAsset(id);

        if (!asset) {
          return reply.code(404).send({ error: 'Asset not found' });
        }

        reply.send(asset);
      } catch (error) {
        console.error('Get asset error:', error);
        reply.code(500).send({
          error: 'Failed to get asset',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/shop/assets/:id/download
   * Download asset file (only if owned)
   */
  app.get<{ Params: IdParams }>(
    '/assets/:id/download',
    {
      preHandler: [authMiddleware],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = (request.params as IdParams);
        const asset = await assetStorage.getAsset(id);

        if (!asset) {
          return reply.code(404).send({ error: 'Asset not found' });
        }

        // Check ownership
        const isOwned = await purchaseStorage.isOwned(request.user.id, id, 'asset');
        if (!isOwned) {
          return reply.code(403).send({ error: 'You do not own this asset' });
        }

        // For now, return file URL
        // In production, you'd want to serve files securely
        reply.send({ fileUrl: asset.fileUrl });
      } catch (error) {
        console.error('Download asset error:', error);
        reply.code(500).send({
          error: 'Failed to download asset',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * PUT /api/shop/assets/:id
   * Update asset (admin only)
   */
  app.put<{ Params: IdParams }>(
    '/assets/:id',
    {
      preHandler: [authMiddleware, requireAdmin()],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = (request.params as IdParams);
        const updates = request.body as Partial<
          Omit<import('../storage/AssetStorage').Asset, 'id' | 'createdAt' | 'authorId'>
        >;

        const asset = await assetStorage.updateAsset(id, updates);

        if (!asset) {
          return reply.code(404).send({ error: 'Asset not found' });
        }

        reply.send(asset);
      } catch (error) {
        console.error('Update asset error:', error);
        reply.code(500).send({
          error: 'Failed to update asset',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * DELETE /api/shop/assets/:id
   * Delete asset (admin only)
   */
  app.delete<{ Params: IdParams }>(
    '/assets/:id',
    {
      preHandler: [authMiddleware, requireAdmin()],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = (request.params as IdParams);
        const deleted = await assetStorage.deleteAsset(id);

        if (!deleted) {
          return reply.code(404).send({ error: 'Asset not found' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Delete asset error:', error);
        reply.code(500).send({
          error: 'Failed to delete asset',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * POST /api/shop/assets
   * Create asset (auth required, can be creator)
   */
  app.post(
    '/assets',
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'type', 'price', 'fileUrl'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['material', 'model', 'texture', 'script'] },
            category: { type: 'string' },
            price: {
              type: 'object',
              required: ['currency', 'amount'],
              properties: {
                currency: { type: 'string' },
                amount: { type: 'number' },
              },
            },
            previewUrl: { type: 'string' },
            fileUrl: { type: 'string' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const body = request.body as {
          name: string;
          description?: string;
          type: 'material' | 'model' | 'texture' | 'script';
          category?: string;
          price: { currency: string; amount: number };
          previewUrl?: string;
          fileUrl: string;
          metadata?: Record<string, unknown>;
        };

        if (!body.name || !body.type || !body.price || !body.fileUrl) {
          return reply.code(400).send({ error: 'Missing required fields' });
        }

        const asset = await assetStorage.createAsset({
          name: body.name,
          type: body.type,
          price: body.price,
          fileUrl: body.fileUrl,
          metadata: body.metadata ?? {},
          authorId: request.user.id,
          available: true,
          ...(body.description !== undefined && { description: body.description }),
          ...(body.category !== undefined && { category: body.category }),
          ...(body.previewUrl !== undefined && { previewUrl: body.previewUrl }),
        });

        reply.code(201).send(asset);
      } catch (error) {
        console.error('Create asset error:', error);
        reply.code(500).send({
          error: 'Failed to create asset',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/shop/purchases
   * Get user's purchase history
   */
  app.get(
    '/purchases',
    {
      preHandler: [authMiddleware],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
            offset: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'completed', 'failed'] },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const query = request.query as PurchasesQuery;
        const limit = query.limit ? Number(query.limit) : 50;
        const offset = query.offset ? Number(query.offset) : 0;
        const status = query.status;

        const purchases = await purchaseStorage.getPurchases({
          userId: request.user.id,
          ...(status !== undefined && { status }),
          limit,
          offset,
        });

        reply.send({ purchases });
      } catch (error) {
        console.error('Get purchases error:', error);
        reply.code(500).send({
          error: 'Failed to get purchases',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/shop/purchases/:id
   * Get purchase details
   */
  app.get<{ Params: IdParams }>(
    '/purchases/:id',
    {
      preHandler: [authMiddleware],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = (request.params as IdParams);
        const purchase = await purchaseStorage.getPurchase(id);

        if (!purchase) {
          return reply.code(404).send({ error: 'Purchase not found' });
        }

        // Verify ownership
        if (purchase.userId !== request.user.id) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        reply.send(purchase);
      } catch (error) {
        console.error('Get purchase error:', error);
        reply.code(500).send({
          error: 'Failed to get purchase',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/shop/owned
   * Get user's owned items
   */
  app.get('/owned', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const owned = await purchaseStorage.getOwnedItems(request.user.id);
      reply.send({ items: owned });
    } catch (error) {
      console.error('Get owned items error:', error);
      reply.code(500).send({
        error: 'Failed to get owned items',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/shop/wallet
   * Get user's wallet balance
   */
  app.get('/wallet', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const balances = currencyService.getAllBalances(request.user.id);
      const balanceArray = Array.from(balances.entries()).map(([currency, balance]) => ({
        currency,
        balance,
      }));

      reply.send({ balances: balanceArray });
    } catch (error) {
      console.error('Get wallet error:', error);
      reply.code(500).send({
        error: 'Failed to get wallet',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}




