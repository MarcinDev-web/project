import { Router } from 'express';
import type { RouteDependencies } from './index';
import type { AuthRequest } from '../auth/middleware';

/**
 * Create admin and moderator routes
 */
export function createAdminRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const {
    authMiddleware,
    requireAdmin,
    requireModerator,
    authManager,
    profileStorage,
    marketplaceStorage,
    storage,
    forumStorage,
    forumHandler,
    messagesStorage,
    sessionManager,
    shopStorage,
    assetStorage,
    purchaseStorage,
  } = deps;

  // ========================================
  // ADMIN API ENDPOINTS
  // ========================================

  // ADMIN USERS
  router.get('/api/admin/users', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const search = req.query.search as string | undefined;
      const role = req.query.role as string | undefined;
      const active = req.query.active === undefined ? undefined : req.query.active === 'true';

      const allUsers = await authManager['userStorage'].getAllUsers();
      let filtered = allUsers;

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(u => u.email.toLowerCase().includes(searchLower));
      }

      if (role) {
        filtered = filtered.filter(u => u.role === role);
      }

      if (active !== undefined) {
        filtered = filtered.filter(u => (u.active ?? true) === active);
      }

      filtered.sort((a, b) => b.createdAt - a.createdAt);

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      const users = paginated.map(u => ({
        id: u.id,
        email: u.email,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        active: u.active ?? true,
        role: u.role ?? 'user',
      }));

      res.json({
        users,
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get admin users error:', error);
      res.status(500).json({
        error: 'Failed to get users',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/api/admin/users/:id', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const user = await authManager['userStorage'].findUserById(id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const profile = await profileStorage.getProfile(id);

      res.json({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        active: user.active ?? true,
        role: user.role ?? 'user',
        profile: profile ?? null,
      });
    } catch (error) {
      console.error('Get admin user error:', error);
      res.status(500).json({
        error: 'Failed to get user',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.put('/api/admin/users/:id', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const { active, role } = req.body as { active?: boolean; role?: string };

      if (role && id === req.user.id && role !== req.user.role) {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }

      const updates: { active?: boolean; role?: 'user' | 'moderator' | 'admin' } = {};
      if (active !== undefined) updates.active = active;
      if (role && ['user', 'moderator', 'admin'].includes(role)) {
        updates.role = role as 'user' | 'moderator' | 'admin';
      }

      const updated = await authManager['userStorage'].updateUserById(id, updates);

      res.json({
        id: updated.id,
        email: updated.email,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        active: updated.active ?? true,
        role: updated.role ?? 'user',
      });
    } catch (error) {
      console.error('Update admin user error:', error);
      res.status(500).json({
        error: 'Failed to update user',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ADMIN STATS
  router.get('/api/admin/stats', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const allUsers = await authManager['userStorage'].getAllUsers();
      const allItems = await marketplaceStorage.getItems({ limit: 10000 });
      const allProjects: unknown[] = [];
      const forumStats = await forumStorage.getForumStats();

      const stats = {
        users: {
          total: allUsers.length,
          active: allUsers.filter(u => u.active !== false).length,
          inactive: allUsers.filter(u => u.active === false).length,
          byRole: {
            user: allUsers.filter(u => (u.role ?? 'user') === 'user').length,
            moderator: allUsers.filter(u => u.role === 'moderator').length,
            admin: allUsers.filter(u => u.role === 'admin').length,
          },
        },
        marketplace: {
          total: allItems.length,
          builds: allItems.filter(i => i.type === 'build').length,
          avatars: allItems.filter(i => i.type === 'avatar').length,
          public: allItems.filter(i => i.public).length,
          totalLikes: allItems.reduce((sum, i) => sum + (i.likes ?? 0), 0),
          totalDownloads: allItems.reduce((sum, i) => sum + (i.downloads ?? 0), 0),
        },
        projects: {
          total: Array.isArray(allProjects) ? allProjects.length : 0,
        },
        forum: forumStats,
        activity: {
          onlineUsers: sessionManager['sessions'].size,
        },
      };

      res.json(stats);
    } catch (error) {
      console.error('Get admin stats error:', error);
      res.status(500).json({
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ADMIN MARKETPLACE
  router.get('/api/admin/marketplace', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const type = req.query.type as 'build' | 'avatar' | undefined;

      const items = await marketplaceStorage.getItems({
        ...(type && { type }),
        limit: 10000,
      });

      const total = items.length;
      const paginated = items.slice(offset, offset + limit);

      res.json({
        items: paginated,
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get admin marketplace error:', error);
      res.status(500).json({
        error: 'Failed to get marketplace items',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/admin/marketplace/:id', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Item ID required' });
      }
      
      const item = await marketplaceStorage.getItem(id);
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      const deleted = await marketplaceStorage.deleteItem(id, item.authorId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Failed to delete item' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Delete admin marketplace item error:', error);
      res.status(500).json({
        error: 'Failed to delete item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ADMIN PROJECTS
  router.get('/api/admin/projects', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const allProjects = storage['storage'] ? Array.from(storage['storage'].values()) : [];

      res.json({
        projects: allProjects.map(p => ({
          token: p.token,
          createdAt: p.createdAt,
          expiresAt: p.expiresAt,
          projectId: p.projectData.metadata.id,
          projectName: p.projectData.metadata.name,
        })),
        total: allProjects.length,
      });
    } catch (error) {
      console.error('Get admin projects error:', error);
      res.status(500).json({
        error: 'Failed to get projects',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/admin/projects/:token', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: 'Token required' });
      }

      const deleted = await storage.delete(token);

      if (!deleted) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Delete admin project error:', error);
      res.status(500).json({
        error: 'Failed to delete project',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ========================================
  // MODERATOR API ENDPOINTS
  // ========================================

  // MODERATOR MARKETPLACE
  router.get('/api/moderator/marketplace/pending', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const items = await marketplaceStorage.getItems({ limit: 100 });

      res.json({
        items,
        total: items.length,
      });
    } catch (error) {
      console.error('Get moderator pending items error:', error);
      res.status(500).json({
        error: 'Failed to get pending items',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/moderator/marketplace/:id/approve', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Item ID required' });
      }

      const item = await marketplaceStorage.getItem(id);

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      if (!item.public) {
        await marketplaceStorage.updateItem(id, { public: true });
      }

      res.json({ success: true, message: 'Item approved' });
    } catch (error) {
      console.error('Approve marketplace item error:', error);
      res.status(500).json({
        error: 'Failed to approve item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/moderator/marketplace/:id/reject', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Item ID required' });
      }

      const { reason } = req.body as { reason?: string };

      const item = await marketplaceStorage.getItem(id);

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      await marketplaceStorage.updateItem(id, { public: false });

      res.json({ success: true, message: 'Item rejected', reason });
    } catch (error) {
      console.error('Reject marketplace item error:', error);
      res.status(500).json({
        error: 'Failed to reject item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/moderator/marketplace/:id', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Item ID required' });
      }
      
      const item = await marketplaceStorage.getItem(id);
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      const deleted = await marketplaceStorage.deleteItem(id, item.authorId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Failed to delete item' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Delete moderator marketplace item error:', error);
      res.status(500).json({
        error: 'Failed to delete item',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // MODERATOR USERS
  router.get('/api/moderator/users/reported', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      res.json({
        users: [],
        total: 0,
      });
    } catch (error) {
      console.error('Get reported users error:', error);
      res.status(500).json({
        error: 'Failed to get reported users',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.put('/api/moderator/users/:id/ban', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const { reason } = req.body as { reason?: string };

      const user = await authManager['userStorage'].findUserById(id);
      if (user && user.role === 'admin') {
        return res.status(403).json({ error: 'Cannot ban admin users' });
      }

      const updated = await authManager['userStorage'].updateUserById(id, { active: false });

      res.json({
        id: updated.id,
        email: updated.email,
        active: false,
        banned: true,
        reason,
      });
    } catch (error) {
      console.error('Ban user error:', error);
      res.status(500).json({
        error: 'Failed to ban user',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.put('/api/moderator/users/:id/warn', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const { reason } = req.body as { reason?: string };

      res.json({
        success: true,
        message: 'User warned',
        reason,
      });
    } catch (error) {
      console.error('Warn user error:', error);
      res.status(500).json({
        error: 'Failed to warn user',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // MODERATOR MESSAGES
  router.get('/api/moderator/messages/:conversationId', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { conversationId } = req.params;
      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID required' });
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;

      const messages = await messagesStorage.getMessages(conversationId, limit);

      res.json(messages);
    } catch (error) {
      console.error('Get moderator messages error:', error);
      res.status(500).json({
        error: 'Failed to get messages',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // MODERATOR FORUM
  router.get('/api/moderator/forum/threads', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const categoryId = req.query.categoryId as string | undefined;
      const authorId = req.query.authorId as string | undefined;
      const search = req.query.search as string | undefined;

      const filter: { limit?: number; offset?: number; categoryId?: string; authorId?: string; search?: string } = { limit, offset };
      if (categoryId !== undefined) filter.categoryId = categoryId;
      if (authorId !== undefined) filter.authorId = authorId;
      if (search !== undefined) filter.search = search;

      const result = await forumStorage.getAllThreads(filter);

      res.json({
        threads: result.threads,
        total: result.total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get moderator forum threads error:', error);
      res.status(500).json({
        error: 'Failed to get forum threads',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/moderator/forum/threads/:id', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Thread ID is required' });
      }
      const thread = await forumStorage.getThread(id);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      const deleted = await forumStorage.deleteThread(id, req.user.id, true);
      if (!deleted) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      await forumHandler.handleThreadDeleted(id, thread.categoryId);
      res.status(204).send();
    } catch (error) {
      console.error('Moderator delete forum thread error:', error);
      res.status(500).json({
        error: 'Failed to delete forum thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/moderator/forum/threads/:id/approve', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Missing id parameter' });
      }
      const thread = await forumStorage.getThread(id);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json({ success: true, message: 'Thread approved' });
    } catch (error) {
      console.error('Approve forum thread error:', error);
      res.status(500).json({
        error: 'Failed to approve forum thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/moderator/forum/threads/:id/reject', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { reason } = req.body;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Thread ID is required' });
      }
      
      const thread = await forumStorage.getThread(id);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      const deleted = await forumStorage.deleteThread(id, req.user.id, true);
      if (!deleted) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      await forumHandler.handleThreadDeleted(id, thread.categoryId);
      res.json({ success: true, message: 'Thread rejected and deleted', reason });
    } catch (error) {
      console.error('Reject forum thread error:', error);
      res.status(500).json({
        error: 'Failed to reject forum thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/moderator/forum/threads/:id/warn', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { reason } = req.body;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Thread ID is required' });
      }
      
      const thread = await forumStorage.getThread(id);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json({ success: true, message: 'Author warned', reason, authorId: thread.authorId });
    } catch (error) {
      console.error('Warn thread author error:', error);
      res.status(500).json({
        error: 'Failed to warn thread author',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/api/moderator/forum/posts', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const threadId = req.query.threadId as string | undefined;
      const authorId = req.query.authorId as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await forumStorage.getAllPosts({
        limit,
        offset,
        ...(threadId !== undefined && { threadId }),
        ...(authorId !== undefined && { authorId }),
        ...(search !== undefined && { search }),
      });

      res.json({
        posts: result.posts,
        total: result.total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get moderator forum posts error:', error);
      res.status(500).json({
        error: 'Failed to get forum posts',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/moderator/forum/posts/:id', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Post ID is required' });
      }
      
      const post = await forumStorage.getPost(id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const deleted = await forumStorage.deletePost(id, req.user.id, true);
      if (!deleted) {
        return res.status(404).json({ error: 'Post not found' });
      }

      await forumHandler.handlePostDeleted(id, post.threadId);
      res.status(204).send();
    } catch (error) {
      console.error('Moderator delete forum post error:', error);
      res.status(500).json({
        error: 'Failed to delete forum post',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/moderator/forum/posts/:id/warn', authMiddleware, requireModerator(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { reason } = req.body;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Post ID is required' });
      }
      
      const post = await forumStorage.getPost(id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      res.json({ success: true, message: 'Author warned', reason, authorId: post.authorId });
    } catch (error) {
      console.error('Warn post author error:', error);
      res.status(500).json({
        error: 'Failed to warn post author',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ========================================
  // ADMIN SHOP & FORUM ENDPOINTS
  // ========================================

  router.get('/api/admin/shop/stats', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const allItems = await shopStorage.getItems({ limit: 10000 });
      const availableItems = allItems.filter(item => item.available);
      const outOfStockItems = allItems.filter(item => item.stock === 0);

      const allAssets = await assetStorage.getAssets({ limit: 10000 });
      const availableAssets = allAssets.filter(asset => asset.available);

      const allPurchases = await purchaseStorage.getPurchases({ limit: 10000 });
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const recentPurchases = allPurchases.filter(p => p.createdAt >= thirtyDaysAgo);

      const revenueMap = new Map<string, number>();
      for (const purchase of allPurchases) {
        if (purchase.status === 'completed') {
          const current = revenueMap.get(purchase.totalCost.currency) || 0;
          revenueMap.set(purchase.totalCost.currency, current + purchase.totalCost.amount);
        }
      }

      const revenue = Array.from(revenueMap.entries()).map(([currency, amount]) => ({
        currency,
        amount,
      }));

      res.json({
        shopItems: {
          total: allItems.length,
          available: availableItems.length,
          outOfStock: outOfStockItems.length,
        },
        assets: {
          total: allAssets.length,
          available: availableAssets.length,
        },
        purchases: {
          total: allPurchases.length,
          last30Days: recentPurchases.length,
        },
        revenue,
      });
    } catch (error) {
      console.error('Get shop stats error:', error);
      res.status(500).json({
        error: 'Failed to get shop stats',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/api/admin/forum/stats', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const stats = await forumStorage.getForumStats();
      res.json(stats);
    } catch (error) {
      console.error('Get forum stats error:', error);
      res.status(500).json({
        error: 'Failed to get forum stats',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/api/admin/forum/categories', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const categories = await forumStorage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error('Get forum categories error:', error);
      res.status(500).json({
        error: 'Failed to get forum categories',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.put('/api/admin/forum/categories/:id', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Category ID is required' });
      }
      const updates = req.body;

      const updated = await forumStorage.updateCategory(id, updates);
      if (!updated) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Update forum category error:', error);
      res.status(500).json({
        error: 'Failed to update forum category',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/admin/forum/categories/:id', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Category ID is required' });
      }

      const deleted = await forumStorage.deleteCategory(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Delete forum category error:', error);
      if (error instanceof Error && error.message.includes('Cannot delete')) {
        return res.status(400).json({
          error: error.message,
        });
      }
      res.status(500).json({
        error: 'Failed to delete forum category',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/api/admin/forum/threads', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const categoryId = req.query.categoryId as string | undefined;
      const authorId = req.query.authorId as string | undefined;
      const search = req.query.search as string | undefined;

      const filter: { limit?: number; offset?: number; categoryId?: string; authorId?: string; search?: string } = { limit, offset };
      if (categoryId !== undefined) filter.categoryId = categoryId;
      if (authorId !== undefined) filter.authorId = authorId;
      if (search !== undefined) filter.search = search;

      const result = await forumStorage.getAllThreads(filter);

      res.json({
        threads: result.threads,
        total: result.total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get forum threads error:', error);
      res.status(500).json({
        error: 'Failed to get forum threads',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/admin/forum/threads/:id', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Missing id parameter' });
      }
      const thread = await forumStorage.getThread(id);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      const deleted = await forumStorage.deleteThread(id, req.user.id, true);
      if (!deleted) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      await forumHandler.handleThreadDeleted(id, thread.categoryId);
      res.status(204).send();
    } catch (error) {
      console.error('Admin delete forum thread error:', error);
      res.status(500).json({
        error: 'Failed to delete forum thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/api/admin/forum/posts', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
      const threadId = req.query.threadId as string | undefined;
      const authorId = req.query.authorId as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await forumStorage.getAllPosts({
        limit,
        offset,
        ...(threadId !== undefined && { threadId }),
        ...(authorId !== undefined && { authorId }),
        ...(search !== undefined && { search }),
      });

      res.json({
        posts: result.posts,
        total: result.total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get forum posts error:', error);
      res.status(500).json({
        error: 'Failed to get forum posts',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/admin/forum/posts/:id', authMiddleware, requireAdmin(), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Post ID is required' });
      }
      
      const post = await forumStorage.getPost(id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const deleted = await forumStorage.deletePost(id, req.user.id, true);
      if (!deleted) {
        return res.status(404).json({ error: 'Post not found' });
      }

      await forumHandler.handlePostDeleted(id, post.threadId);
      res.status(204).send();
    } catch (error) {
      console.error('Admin delete forum post error:', error);
      res.status(500).json({
        error: 'Failed to delete forum post',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

