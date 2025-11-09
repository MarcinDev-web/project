import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ForumCategory } from '../storage/ForumStorage.js';
import type { RouteDependencies } from './index.js';

/**
 * Create admin and moderator routes for Fastify
 */
export async function createAdminRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
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
  } = opts.dependencies;

  // ========================================
  // ADMIN API ENDPOINTS
  // ========================================

  // ADMIN USERS
  app.get('/admin/users', { preHandler: [authMiddleware, requireAdmin()] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const query = request.query as {
        limit?: string | number;
        offset?: string | number;
        search?: string;
        role?: string;
        active?: string;
      };
      const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
      const offset = query.offset ? parseInt(String(query.offset), 10) : 0;
      const search = query.search;
      const role = query.role;
      const active = query.active === undefined ? undefined : query.active === 'true';

      const allUsers = await authManager['userStorage'].getAllUsers();
      let filtered = allUsers;

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter((u) => u.email.toLowerCase().includes(searchLower));
      }

      if (role) {
        filtered = filtered.filter((u) => u.role === role);
      }

      if (active !== undefined) {
        filtered = filtered.filter((u) => (u.active ?? true) === active);
      }

      filtered.sort((a, b) => b.createdAt - a.createdAt);

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      const users = paginated.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        active: u.active ?? true,
        role: u.role ?? 'user',
      }));

      reply.send({
        users,
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      });
    } catch (error) {
      console.error('Get admin users error:', error);
      reply.code(500).send({
        error: 'Failed to get users',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get<{ Params: { id: string } }>(
    '/admin/users/:id',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

      const user = await authManager['userStorage'].findUserById(id);

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const profile = await profileStorage.getProfile(id);

      reply.send({
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
        reply.code(500).send({
          error: 'Failed to get user',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.put<{ Params: { id: string } }>(
    '/admin/users/:id',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        if (!id) {
          return reply.code(400).send({ error: 'User ID required' });
        }

        const { active, role } = request.body as { active?: boolean; role?: string };

        if (role && id === request.user.id && role !== request.user.role) {
          return reply.code(400).send({ error: 'Cannot change your own role' });
        }

        // Check if trying to modify a root user
        const targetUser = await authManager['userStorage'].findUserById(id);
        if (targetUser && targetUser.role === 'root' && request.user.role !== 'root') {
          return reply.code(403).send({ error: 'Cannot modify root users' });
        }

        const updates: { active?: boolean; role?: 'user' | 'moderator' | 'admin' | 'root' } = {};
        if (active !== undefined) updates.active = active;
        if (role && ['user', 'moderator', 'admin', 'root'].includes(role)) {
          // Only root can assign root role
          if (role === 'root' && request.user.role !== 'root') {
            return reply.code(403).send({ error: 'Only root users can assign root role' });
          }
          updates.role = role as 'user' | 'moderator' | 'admin' | 'root';
        }

        const updated = await authManager['userStorage'].updateUserById(id, updates);

      reply.send({
        id: updated.id,
        email: updated.email,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        active: updated.active ?? true,
        role: updated.role ?? 'user',
      });
      } catch (error) {
        console.error('Update admin user error:', error);
        reply.code(500).send({
          error: 'Failed to update user',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // ADMIN STATS
  app.get('/admin/stats', { preHandler: [authMiddleware, requireAdmin()] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const allUsers = await authManager['userStorage'].getAllUsers();
      const allItems = await marketplaceStorage.getItems({ limit: 10000 });
      const allProjects: unknown[] = [];
      const forumStats = await forumStorage.getForumStats();

      const stats = {
        users: {
          total: allUsers.length,
          active: allUsers.filter((u) => u.active !== false).length,
          inactive: allUsers.filter((u) => u.active === false).length,
          byRole: {
            user: allUsers.filter((u) => (u.role ?? 'user') === 'user').length,
            moderator: allUsers.filter((u) => u.role === 'moderator').length,
            admin: allUsers.filter((u) => u.role === 'admin').length,
            root: allUsers.filter((u) => u.role === 'root').length,
          },
        },
        marketplace: {
          total: allItems.length,
          builds: allItems.filter((i) => i.type === 'build').length,
          avatars: allItems.filter((i) => i.type === 'avatar').length,
          public: allItems.filter((i) => i.public).length,
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

      reply.send(stats);
    } catch (error) {
      console.error('Get admin stats error:', error);
      reply.code(500).send({
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ADMIN MARKETPLACE
  app.get(
    '/admin/marketplace',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const query = request.query as { limit?: string | number; offset?: string | number; type?: string };
        const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
        const offset = query.offset ? parseInt(String(query.offset), 10) : 0;
        const type = query.type as 'build' | 'avatar' | undefined;

        const items = await marketplaceStorage.getItems({
          ...(type && { type }),
          limit: 10000,
        });

        const total = items.length;
        const paginated = items.slice(offset, offset + limit);

        reply.send({
          items: paginated,
          total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
        });
      } catch (error) {
        console.error('Get admin marketplace error:', error);
        reply.code(500).send({
          error: 'Failed to get marketplace items',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/admin/marketplace/:id',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

        const item = await marketplaceStorage.getItem(id);
        if (!item) {
          return reply.code(404).send({ error: 'Item not found' });
        }

        const deleted = await marketplaceStorage.deleteItem(id, item.authorId);

        if (!deleted) {
          return reply.code(404).send({ error: 'Failed to delete item' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Delete admin marketplace item error:', error);
        reply.code(500).send({
          error: 'Failed to delete item',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // ADMIN PROJECTS
  app.get('/admin/projects', { preHandler: [authMiddleware, requireAdmin()] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const allProjects = storage['storage'] ? Array.from(storage['storage'].values()) : [];

      reply.send({
        projects: allProjects.map((p) => ({
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
      reply.code(500).send({
        error: 'Failed to get projects',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete<{ Params: { token: string } }>(
    '/admin/projects/:token',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { token } = request.params;

        const deleted = await storage.delete(token);

        if (!deleted) {
          return reply.code(404).send({ error: 'Project not found' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Delete admin project error:', error);
        reply.code(500).send({
          error: 'Failed to delete project',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // ========================================
  // MODERATOR API ENDPOINTS
  // ========================================

  // MODERATOR MARKETPLACE
  app.get(
    '/api/moderator/marketplace/pending',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const items = await marketplaceStorage.getItems({ limit: 100 });

        reply.send({
          items,
          total: items.length,
        });
      } catch (error) {
        console.error('Get moderator pending items error:', error);
        reply.code(500).send({
          error: 'Failed to get pending items',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/moderator/marketplace/:id/approve',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

        const item = await marketplaceStorage.getItem(id);

        if (!item) {
          return reply.code(404).send({ error: 'Item not found' });
        }

        if (!item.public) {
          await marketplaceStorage.updateItem(id, { public: true });
        }

        reply.send({ success: true, message: 'Item approved' });
      } catch (error) {
        console.error('Approve marketplace item error:', error);
        reply.code(500).send({
          error: 'Failed to approve item',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/moderator/marketplace/:id/reject',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

        const { reason } = request.body as { reason?: string };

        const item = await marketplaceStorage.getItem(id);

        if (!item) {
          return reply.code(404).send({ error: 'Item not found' });
        }

        await marketplaceStorage.updateItem(id, { public: false });

        reply.send({ success: true, message: 'Item rejected', reason });
      } catch (error) {
        console.error('Reject marketplace item error:', error);
        reply.code(500).send({
          error: 'Failed to reject item',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/moderator/marketplace/:id',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

        const item = await marketplaceStorage.getItem(id);
        if (!item) {
          return reply.code(404).send({ error: 'Item not found' });
        }

        const deleted = await marketplaceStorage.deleteItem(id, item.authorId);

        if (!deleted) {
          return reply.code(404).send({ error: 'Failed to delete item' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Delete moderator marketplace item error:', error);
        reply.code(500).send({
          error: 'Failed to delete item',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // MODERATOR USERS
  app.get(
    '/api/moderator/users/reported',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        reply.send({
          users: [],
          total: 0,
        });
      } catch (error) {
        console.error('Get reported users error:', error);
        reply.code(500).send({
          error: 'Failed to get reported users',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.put<{ Params: { id: string } }>(
    '/api/moderator/users/:id/ban',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

        const { reason } = request.body as { reason?: string };

        const user = await authManager['userStorage'].findUserById(id);
        if (user && (user.role === 'admin' || user.role === 'root')) {
          return reply.code(403).send({ error: 'Cannot ban admin or root users' });
        }

        const updated = await authManager['userStorage'].updateUserById(id, { active: false });

        reply.send({
          id: updated.id,
          email: updated.email,
          active: false,
          banned: true,
          reason,
        });
      } catch (error) {
        console.error('Ban user error:', error);
        reply.code(500).send({
          error: 'Failed to ban user',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.put<{ Params: { id: string } }>(
    '/api/moderator/users/:id/warn',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

        const { reason } = request.body as { reason?: string };

        reply.send({
          success: true,
          message: 'User warned',
          userId: id,
          reason,
        });
      } catch (error) {
        console.error('Warn user error:', error);
        reply.code(500).send({
          error: 'Failed to warn user',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // MODERATOR MESSAGES
  app.get<{ Params: { conversationId: string } }>(
    '/api/moderator/messages/:conversationId',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { conversationId } = request.params;

        const query = request.query as { limit?: string | number };
        const limit = query.limit ? parseInt(String(query.limit), 10) : 100;

        const messages = await messagesStorage.getMessages(conversationId, limit);

        reply.send(messages);
      } catch (error) {
        console.error('Get moderator messages error:', error);
        reply.code(500).send({
          error: 'Failed to get messages',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // MODERATOR FORUM
  app.get(
    '/api/moderator/forum/threads',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const query = request.query as {
          limit?: string | number;
          offset?: string | number;
          categoryId?: string;
          authorId?: string;
          search?: string;
        };
        const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
        const offset = query.offset ? parseInt(String(query.offset), 10) : 0;
        const categoryId = query.categoryId;
        const authorId = query.authorId;
        const search = query.search;

        const filter: {
          limit?: number;
          offset?: number;
          categoryId?: string;
          authorId?: string;
          search?: string;
        } = { limit, offset };
        if (categoryId !== undefined) filter.categoryId = categoryId;
        if (authorId !== undefined) filter.authorId = authorId;
        if (search !== undefined) filter.search = search;

        const result = await forumStorage.getAllThreads(filter);

        reply.send({
          threads: result.threads,
          total: result.total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
        });
      } catch (error) {
        console.error('Get moderator forum threads error:', error);
        reply.code(500).send({
          error: 'Failed to get forum threads',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/moderator/forum/threads/:id',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        if (!id || typeof id !== 'string') {
          return reply.code(400).send({ error: 'Thread ID is required' });
        }
        const thread = await forumStorage.getThread(id);
        if (!thread) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        const deleted = await forumStorage.deleteThread(id, request.user.id, true);
        if (!deleted) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        await forumHandler.handleThreadDeleted(id, thread.categoryId);
        reply.code(204).send();
      } catch (error) {
        console.error('Moderator delete forum thread error:', error);
        reply.code(500).send({
          error: 'Failed to delete forum thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/moderator/forum/threads/:id/approve',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        if (!id) {
          return reply.code(400).send({ error: 'Missing id parameter' });
        }
        const thread = await forumStorage.getThread(id);
        if (!thread) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        reply.send({ success: true, message: 'Thread approved' });
      } catch (error) {
        console.error('Approve forum thread error:', error);
        reply.code(500).send({
          error: 'Failed to approve forum thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/moderator/forum/threads/:id/reject',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        const { reason } = request.body;

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({ error: 'Thread ID is required' });
        }

        const thread = await forumStorage.getThread(id);
        if (!thread) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        const deleted = await forumStorage.deleteThread(id, request.user.id, true);
        if (!deleted) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        await forumHandler.handleThreadDeleted(id, thread.categoryId);
        reply.send({ success: true, message: 'Thread rejected and deleted', reason });
      } catch (error) {
        console.error('Reject forum thread error:', error);
        reply.code(500).send({
          error: 'Failed to reject forum thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/moderator/forum/threads/:id/warn',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        const { reason } = request.body;

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({ error: 'Thread ID is required' });
        }

        const thread = await forumStorage.getThread(id);
        if (!thread) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        reply.send({ success: true, message: 'Author warned', reason, authorId: thread.authorId });
      } catch (error) {
        console.error('Warn thread author error:', error);
        reply.code(500).send({
          error: 'Failed to warn thread author',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get(
    '/api/moderator/forum/posts',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const query = request.query as {
          limit?: string | number;
          offset?: string | number;
          threadId?: string;
          authorId?: string;
          search?: string;
        };
        const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
        const offset = query.offset ? parseInt(String(query.offset), 10) : 0;
        const threadId = query.threadId;
        const authorId = query.authorId;
        const search = query.search;

        const result = await forumStorage.getAllPosts({
          limit,
          offset,
          ...(threadId !== undefined && { threadId }),
          ...(authorId !== undefined && { authorId }),
          ...(search !== undefined && { search }),
        });

        reply.send({
          posts: result.posts,
          total: result.total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
        });
      } catch (error) {
        console.error('Get moderator forum posts error:', error);
        reply.code(500).send({
          error: 'Failed to get forum posts',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/moderator/forum/posts/:id',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({ error: 'Post ID is required' });
        }

        const post = await forumStorage.getPost(id);
        if (!post) {
          return reply.code(404).send({ error: 'Post not found' });
        }

        const deleted = await forumStorage.deletePost(id, request.user.id, true);
        if (!deleted) {
          return reply.code(404).send({ error: 'Post not found' });
        }

        await forumHandler.handlePostDeleted(id, post.threadId);
        reply.code(204).send();
      } catch (error) {
        console.error('Moderator delete forum post error:', error);
        reply.code(500).send({
          error: 'Failed to delete forum post',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/moderator/forum/posts/:id/warn',
    { preHandler: [authMiddleware, requireModerator()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        const { reason } = request.body;

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({ error: 'Post ID is required' });
        }

        const post = await forumStorage.getPost(id);
        if (!post) {
          return reply.code(404).send({ error: 'Post not found' });
        }

        reply.send({ success: true, message: 'Author warned', reason, authorId: post.authorId });
      } catch (error) {
        console.error('Warn post author error:', error);
        reply.code(500).send({
          error: 'Failed to warn post author',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // ========================================
  // ADMIN SHOP & FORUM ENDPOINTS
  // ========================================

  app.get('/admin/shop/stats', { preHandler: [authMiddleware, requireAdmin()] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const allItems = await shopStorage.getItems({ limit: 10000 });
      const availableItems = allItems.filter((item) => item.available);
      const outOfStockItems = allItems.filter((item) => item.stock === 0);

      const allAssets = await assetStorage.getAssets({ limit: 10000 });
      const availableAssets = allAssets.filter((asset) => asset.available);

      const allPurchases = await purchaseStorage.getPurchases({ limit: 10000 });
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentPurchases = allPurchases.filter((p) => p.createdAt >= thirtyDaysAgo);

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

      reply.send({
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
      reply.code(500).send({
        error: 'Failed to get shop stats',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get(
    '/forum/stats',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const stats = await forumStorage.getForumStats();
        reply.send(stats);
      } catch (error) {
        console.error('Get forum stats error:', error);
        reply.code(500).send({
          error: 'Failed to get forum stats',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get(
    '/forum/categories',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const categories = await forumStorage.getCategories();
        reply.send(categories);
      } catch (error) {
        console.error('Get forum categories error:', error);
        reply.code(500).send({
          error: 'Failed to get forum categories',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.put<{ Params: { id: string }; Body: Partial<ForumCategory> }>(
    '/forum/categories/:id',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        if (!id || typeof id !== 'string') {
          return reply.code(400).send({ error: 'Category ID is required' });
        }
        const updates = request.body;

        const updated = await forumStorage.updateCategory(id, updates);
        if (!updated) {
          return reply.code(404).send({ error: 'Category not found' });
        }

        reply.send(updated);
      } catch (error) {
        console.error('Update forum category error:', error);
        reply.code(500).send({
          error: 'Failed to update forum category',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/forum/categories/:id',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({ error: 'Category ID is required' });
        }

        const deleted = await forumStorage.deleteCategory(id);
        if (!deleted) {
          return reply.code(404).send({ error: 'Category not found' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Delete forum category error:', error);
        if (error instanceof Error && error.message.includes('Cannot delete')) {
          return reply.code(400).send({
            error: error.message,
          });
        }
        reply.code(500).send({
          error: 'Failed to delete forum category',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get(
    '/forum/threads',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const query = request.query as {
          limit?: string | number;
          offset?: string | number;
          categoryId?: string;
          authorId?: string;
          search?: string;
        };
        const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
        const offset = query.offset ? parseInt(String(query.offset), 10) : 0;
        const categoryId = query.categoryId;
        const authorId = query.authorId;
        const search = query.search;

        const filter: {
          limit?: number;
          offset?: number;
          categoryId?: string;
          authorId?: string;
          search?: string;
        } = { limit, offset };
        if (categoryId !== undefined) filter.categoryId = categoryId;
        if (authorId !== undefined) filter.authorId = authorId;
        if (search !== undefined) filter.search = search;

        const result = await forumStorage.getAllThreads(filter);

        reply.send({
          threads: result.threads,
          total: result.total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
        });
      } catch (error) {
        console.error('Get forum threads error:', error);
        reply.code(500).send({
          error: 'Failed to get forum threads',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/forum/threads/:id',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        if (!id) {
          return reply.code(400).send({ error: 'Missing id parameter' });
        }
        const thread = await forumStorage.getThread(id);
        if (!thread) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        const deleted = await forumStorage.deleteThread(id, request.user.id, true);
        if (!deleted) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        await forumHandler.handleThreadDeleted(id, thread.categoryId);
        reply.code(204).send();
      } catch (error) {
        console.error('Admin delete forum thread error:', error);
        reply.code(500).send({
          error: 'Failed to delete forum thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get(
    '/forum/posts',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const query = request.query as {
          limit?: string | number;
          offset?: string | number;
          threadId?: string;
          authorId?: string;
          search?: string;
        };
        const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
        const offset = query.offset ? parseInt(String(query.offset), 10) : 0;
        const threadId = query.threadId;
        const authorId = query.authorId;
        const search = query.search;

        const result = await forumStorage.getAllPosts({
          limit,
          offset,
          ...(threadId !== undefined && { threadId }),
          ...(authorId !== undefined && { authorId }),
          ...(search !== undefined && { search }),
        });

        reply.send({
          posts: result.posts,
          total: result.total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
        });
      } catch (error) {
        console.error('Get forum posts error:', error);
        reply.code(500).send({
          error: 'Failed to get forum posts',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/forum/posts/:id',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({ error: 'Post ID is required' });
        }

        const post = await forumStorage.getPost(id);
        if (!post) {
          return reply.code(404).send({ error: 'Post not found' });
        }

        const deleted = await forumStorage.deletePost(id, request.user.id, true);
        if (!deleted) {
          return reply.code(404).send({ error: 'Post not found' });
        }

        await forumHandler.handlePostDeleted(id, post.threadId);
        reply.code(204).send();
      } catch (error) {
        console.error('Admin delete forum post error:', error);
        reply.code(500).send({
          error: 'Failed to delete forum post',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // PURGE ALL FORUM DATA
  app.post(
    '/forum/purge',
    { preHandler: [authMiddleware, requireAdmin()] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Check if using database or JSON storage
        if (process.env.DATABASE_URL) {
          // Use Prisma to delete all threads (cascades to posts, reactions, votes)
          const { getPrismaClient } = await import('../lib/db.js');
          const prisma = await getPrismaClient();
          try {
            const { count } = await prisma.forumThread.deleteMany({});
            reply.send({
              success: true,
              message: `Deleted ${count} forum threads (posts/reactions/votes cascaded)`,
              deletedThreads: count,
            });
          } finally {
            // Don't disconnect - Prisma client is shared and reused
            // await disconnectPrisma();
          }
        } else {
          // Use JSON storage - delete all threads
          const threads = await forumStorage.getAllThreads({ limit: 100000 });
          let deletedCount = 0;
          for (const thread of threads.threads) {
            const deleted = await forumStorage.deleteThread(thread.id, request.user.id, true);
            if (deleted) {
              deletedCount++;
              await forumHandler.handleThreadDeleted(thread.id, thread.categoryId);
            }
          }
          reply.send({
            success: true,
            message: `Deleted ${deletedCount} forum threads`,
            deletedThreads: deletedCount,
          });
        }
      } catch (error) {
        console.error('Admin purge forum error:', error);
        reply.code(500).send({
          error: 'Failed to purge forum',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

}

