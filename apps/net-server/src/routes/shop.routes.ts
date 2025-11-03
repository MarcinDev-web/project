import { Router, type Request, type Response } from 'express';
import type { RouteDependencies } from './index';
import type { AuthRequest } from '../auth/middleware';

/**
 * Create shop routes
 */
export function createShopRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const {
    authMiddleware,
    requireAdmin,
    shopStorage,
    assetStorage,
    purchaseStorage,
    purchaseService,
    currencyService,
    userCarts,
  } = deps;

  /**
   * GET /api/shop/items
   * Get list of shop items with optional filters
   */
  router.get('/items', async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const currency = req.query.currency as string | undefined;
      const available = req.query.available === undefined ? true : req.query.available === 'true';
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const search = req.query.search as string | undefined;

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

      res.json({
        items,
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get shop items error:', error);
      res.status(500).json({
        error: 'Failed to get shop items',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/shop/items/:id
   * Get shop item details
   */
  router.get('/items/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Item ID is required' });
      }
      const item = await shopStorage.getItem(id);

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json(item);
    } catch (error) {
      console.error('Get shop item error:', error);
      res.status(500).json({
        error: 'Failed to get shop item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/shop/items
   * Create shop item (admin only)
   */
  router.post('/items', authMiddleware, requireAdmin(), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const body = req.body as {
        name: string;
        description?: string;
        category: 'consumable' | 'cosmetic' | 'upgrade' | 'collectible';
        price: { currency: string; amount: number };
        imageUrl?: string;
        available?: boolean;
        stock?: number;
      };

      if (!body.name || !body.category || !body.price) {
        return res.status(400).json({ error: 'Missing required fields' });
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

      res.status(201).json(item);
    } catch (error) {
      console.error('Create shop item error:', error);
      res.status(500).json({
        error: 'Failed to create shop item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/shop/items/:id
   * Update shop item (admin only)
   */
  router.put(
    '/items/:id',
    authMiddleware,
    requireAdmin(),
    async (req: AuthRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Item ID is required' });
        }
        const updates = req.body as Partial<{
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
          return res.status(404).json({ error: 'Item not found' });
        }

        res.json(item);
      } catch (error) {
        console.error('Update shop item error:', error);
        res.status(500).json({
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
  router.delete(
    '/items/:id',
    authMiddleware,
    requireAdmin(),
    async (req: AuthRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Item ID is required' });
        }
        const deleted = await shopStorage.deleteItem(id);

        if (!deleted) {
          return res.status(404).json({ error: 'Item not found' });
        }

        res.status(204).send();
      } catch (error) {
        console.error('Delete shop item error:', error);
        res.status(500).json({
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
  router.get('/cart', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const cart = userCarts.get(req.user.id) ?? [];
      res.json({ items: cart });
    } catch (error) {
      console.error('Get cart error:', error);
      res.status(500).json({
        error: 'Failed to get cart',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/shop/cart
   * Add item to cart
   */
  router.post('/cart', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const body = req.body as {
        itemId: string;
        type: 'shop-item' | 'asset' | 'marketplace-item';
        quantity?: number;
      };

      if (!body.itemId || !body.type) {
        return res.status(400).json({ error: 'Missing itemId or type' });
      }

      const quantity = body.quantity ?? 1;
      const cart = userCarts.get(req.user.id) ?? [];

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

      userCarts.set(req.user.id, cart);
      res.json({ items: cart });
    } catch (error) {
      console.error('Add to cart error:', error);
      res.status(500).json({
        error: 'Failed to add to cart',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /api/shop/cart/:itemId
   * Remove item from cart
   */
  router.delete('/cart/:itemId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { itemId } = req.params;
      const itemType = req.query.type as 'shop-item' | 'asset' | 'marketplace-item' | undefined;

      if (!itemType) {
        return res.status(400).json({ error: 'Item type required' });
      }

      const cart = userCarts.get(req.user.id) ?? [];
      const filtered = cart.filter((item) => !(item.itemId === itemId && item.type === itemType));

      userCarts.set(req.user.id, filtered);
      res.json({ items: filtered });
    } catch (error) {
      console.error('Remove from cart error:', error);
      res.status(500).json({
        error: 'Failed to remove from cart',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/shop/cart/clear
   * Clear cart
   */
  router.post('/cart/clear', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      userCarts.set(req.user.id, []);
      res.json({ items: [] });
    } catch (error) {
      console.error('Clear cart error:', error);
      res.status(500).json({
        error: 'Failed to clear cart',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/shop/checkout
   * Process checkout
   */
  router.post('/checkout', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const cart = userCarts.get(req.user.id) ?? [];

      if (cart.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      // Simple A/B tuning via header: X-AB-Group: 'A' | 'B'
      const abGroup = (req.headers['x-ab-group'] as string | undefined)?.toUpperCase();
      const overrideMultiplier =
        abGroup === 'B'
          ? parseFloat(String(process.env.ECONOMY_PRICE_MULTIPLIER_B ?? '1'))
          : undefined;
      const result = await purchaseService.checkout(
        req.user.id,
        { items: cart },
        overrideMultiplier
      );

      if (result.success && result.purchaseId) {
        // Clear cart on success
        userCarts.set(req.user.id, []);
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      res.status(500).json({
        error: 'Checkout failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/shop/assets
   * Get list of assets
   */
  router.get('/assets', async (req: Request, res: Response) => {
    try {
      const type = req.query.type as 'material' | 'model' | 'texture' | 'script' | undefined;
      const category = req.query.category as string | undefined;
      const authorId = req.query.authorId as string | undefined;
      const available = req.query.available === undefined ? true : req.query.available === 'true';
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const search = req.query.search as string | undefined;

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

      res.json({
        items: assets,
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get assets error:', error);
      res.status(500).json({
        error: 'Failed to get assets',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/shop/assets/:id
   * Get asset details
   */
  router.get('/assets/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Asset ID is required' });
      }
      const asset = await assetStorage.getAsset(id);

      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      res.json(asset);
    } catch (error) {
      console.error('Get asset error:', error);
      res.status(500).json({
        error: 'Failed to get asset',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/shop/assets/:id/download
   * Download asset file (only if owned)
   */
  router.get('/assets/:id/download', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Asset ID is required' });
      }
      const asset = await assetStorage.getAsset(id);

      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      // Check ownership
      const isOwned = await purchaseStorage.isOwned(req.user.id, id, 'asset');
      if (!isOwned) {
        return res.status(403).json({ error: 'You do not own this asset' });
      }

      // For now, return file URL
      // In production, you'd want to serve files securely
      res.json({ fileUrl: asset.fileUrl });
    } catch (error) {
      console.error('Download asset error:', error);
      res.status(500).json({
        error: 'Failed to download asset',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/shop/assets/:id
   * Update asset (admin only)
   */
  router.put(
    '/assets/:id',
    authMiddleware,
    requireAdmin(),
    async (req: AuthRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Asset ID is required' });
        }
        const updates = req.body as Partial<
          Omit<import('../storage/AssetStorage').Asset, 'id' | 'createdAt' | 'authorId'>
        >;

        const asset = await assetStorage.updateAsset(id, updates);

        if (!asset) {
          return res.status(404).json({ error: 'Asset not found' });
        }

        res.json(asset);
      } catch (error) {
        console.error('Update asset error:', error);
        res.status(500).json({
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
  router.delete(
    '/assets/:id',
    authMiddleware,
    requireAdmin(),
    async (req: AuthRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Asset ID is required' });
        }
        const deleted = await assetStorage.deleteAsset(id);

        if (!deleted) {
          return res.status(404).json({ error: 'Asset not found' });
        }

        res.status(204).send();
      } catch (error) {
        console.error('Delete asset error:', error);
        res.status(500).json({
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
  router.post('/assets', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const body = req.body as {
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
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const asset = await assetStorage.createAsset({
        name: body.name,
        type: body.type,
        price: body.price,
        fileUrl: body.fileUrl,
        metadata: body.metadata ?? {},
        authorId: req.user.id,
        available: true,
        ...(body.description !== undefined && { description: body.description }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.previewUrl !== undefined && { previewUrl: body.previewUrl }),
      });

      res.status(201).json(asset);
    } catch (error) {
      console.error('Create asset error:', error);
      res.status(500).json({
        error: 'Failed to create asset',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/shop/purchases
   * Get user's purchase history
   */
  router.get('/purchases', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const status = req.query.status as 'pending' | 'completed' | 'failed' | undefined;

      const purchases = await purchaseStorage.getPurchases({
        userId: req.user.id,
        ...(status !== undefined && { status }),
        limit,
        offset,
      });

      res.json({ purchases });
    } catch (error) {
      console.error('Get purchases error:', error);
      res.status(500).json({
        error: 'Failed to get purchases',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/shop/purchases/:id
   * Get purchase details
   */
  router.get('/purchases/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Purchase ID is required' });
      }
      const purchase = await purchaseStorage.getPurchase(id);

      if (!purchase) {
        return res.status(404).json({ error: 'Purchase not found' });
      }

      // Verify ownership
      if (purchase.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(purchase);
    } catch (error) {
      console.error('Get purchase error:', error);
      res.status(500).json({
        error: 'Failed to get purchase',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/shop/owned
   * Get user's owned items
   */
  router.get('/owned', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const owned = await purchaseStorage.getOwnedItems(req.user.id);
      res.json({ items: owned });
    } catch (error) {
      console.error('Get owned items error:', error);
      res.status(500).json({
        error: 'Failed to get owned items',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/shop/wallet
   * Get user's wallet balance
   */
  router.get('/wallet', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const balances = currencyService.getAllBalances(req.user.id);
      const balanceArray = Array.from(balances.entries()).map(([currency, balance]) => ({
        currency,
        balance,
      }));

      res.json({ balances: balanceArray });
    } catch (error) {
      console.error('Get wallet error:', error);
      res.status(500).json({
        error: 'Failed to get wallet',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
