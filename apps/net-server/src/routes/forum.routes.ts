import type { FastifyInstance } from 'fastify';
import type { RouteDependencies } from './index.js';

/**
 * Create forum routes for Fastify
 */
export async function createForumRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const {
    authMiddleware,
    requireAdmin,
    requireModerator,
    forumStorage,
    forumHandler,
    marketplaceStorage,
    storage,
    getUserIdFromToken,
  } = opts.dependencies;

  type CategoryParams = { id: string };
  type CategoryQuery = { sort?: 'hot' | 'new' | 'top' };
  type CreateCategoryBody = {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    order?: number;
    isLocked?: boolean;
  };
  type CreateThreadBody = {
    categoryId: string;
    title: string;
    content: string;
    tags?: string[];
  };
  type UpdateThreadBody = {
    title?: string;
    content?: string;
    tags?: string[];
  };
  type CreatePostBody = { content: string };
  type UpdatePostBody = { content?: string };
  type ReactionBody = { emoji: string };
  type VoteBody = { vote: 'up' | 'down' };
  type ShareProjectBody = {
    projectToken: string;
    categoryId?: string;
    title?: string;
    description?: string;
  };

  // CATEGORIES
  app.get('/categories', async (_request, reply) => {
    try {
      const categories = await forumStorage.getCategories();
      reply.send(categories);
    } catch (error) {
      console.error('Get categories error:', error);
      reply.code(500).send({
        error: 'Failed to get categories',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get<{ Params: CategoryParams; Querystring: CategoryQuery }>(
    '/categories/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            sort: { type: 'string', enum: ['hot', 'new', 'top'] },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const category = await forumStorage.getCategory(id);
        if (!category) {
          return reply.code(404).send({ error: 'Category not found' });
        }
        const threads = await forumStorage.getThreads(id, request.query.sort ?? 'hot');
        reply.send({ category, threads });
      } catch (error) {
        console.error('Get category error:', error);
        reply.code(500).send({
          error: 'Failed to get category',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Body: CreateCategoryBody }>(
    '/categories',
    {
      preHandler: [authMiddleware, requireAdmin()],
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            icon: { type: 'string' },
            color: { type: 'string' },
            order: { type: 'number' },
            isLocked: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { name, description, icon, color, order, isLocked } = request.body;

        if (!name || typeof name !== 'string') {
          return reply.code(400).send({ error: 'Category name is required' });
        }

        const category = await forumStorage.createCategory({
          id: `cat_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          name,
          description: description ?? '',
          order: order ?? 999,
          isLocked: isLocked ?? false,
          ...(icon !== undefined ? { icon } : {}),
          ...(color !== undefined ? { color } : {}),
        });

        reply.code(201).send(category);
      } catch (error) {
        console.error('Create category error:', error);
        reply.code(500).send({
          error: 'Failed to create category',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // THREADS
  app.get<{ Params: { id: string }; Querystring: { sort?: 'new' | 'top' } }>(
    '/threads/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            sort: { type: 'string', enum: ['new', 'top'] },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const thread = await forumStorage.getThread(id);
        if (!thread) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        const sortBy = request.query.sort ?? 'new';
        const posts = await forumStorage.getPosts(id, sortBy);

        const userId = await getUserIdFromToken(request.headers.authorization);
        let userVote: 'up' | 'down' | null = null;
        if (userId) {
          userVote = await forumStorage.getThreadVote(id, userId);
        }

        reply.send({ thread, posts, userVote });
      } catch (error) {
        console.error('Get thread error:', error);
        reply.code(500).send({
          error: 'Failed to get thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Body: CreateThreadBody }>('/threads', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { categoryId, title, content, tags } = request.body;

      if (!categoryId || typeof categoryId !== 'string') {
        return reply.code(400).send({ error: 'Category ID is required' });
      }
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return reply.code(400).send({ error: 'Thread title is required' });
      }
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return reply.code(400).send({ error: 'Thread content is required' });
      }

      const thread = await forumStorage.createThread({
        categoryId,
        authorId: request.user.id,
        title: title.trim(),
        content: content.trim(),
        isPinned: false,
        isLocked: false,
        tags: Array.isArray(tags) ? tags : [],
      });

      reply.code(201).send(thread);
    } catch (error) {
      console.error('Create thread error:', error);
      reply.code(500).send({
        error: 'Failed to create thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.put<{ Params: { id: string }; Body: UpdateThreadBody }>(
    '/threads/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        if (!id) {
          return reply.code(400).send({ error: 'Thread ID required' });
        }
        const { title, content, tags } = request.body;

        const thread = await forumStorage.getThread(id);
        if (!thread) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        const isModerator = request.user.role === 'admin' || request.user.role === 'moderator';
        if (thread.authorId !== request.user.id && !isModerator) {
          return reply.code(403).send({ error: 'Forbidden' });
        }

        const updates: Partial<typeof thread> = {};
        if (typeof title === 'string') updates.title = title.trim();
        if (typeof content === 'string') updates.content = content.trim();
        if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : [];

        const updated = await forumStorage.updateThread(id, updates, request.user.id);
        if (!updated) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        await forumHandler.handleThreadUpdated(updated, request.user.id);

        reply.send(updated);
      } catch (error) {
        console.error('Update thread error:', error);
        reply.code(500).send({
          error: 'Failed to update thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/threads/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        if (!id) {
          return reply.code(400).send({ error: 'Thread ID required' });
        }
        const thread = await forumStorage.getThread(id);
        if (!thread) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        const isModerator = request.user.role === 'admin' || request.user.role === 'moderator';
        if (thread.authorId !== request.user.id && !isModerator) {
          return reply.code(403).send({ error: 'Forbidden' });
        }

        const deleted = await forumStorage.deleteThread(id, request.user.id, isModerator);
        if (!deleted) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        if (thread.categoryId) {
          await forumHandler.handleThreadDeleted(id, thread.categoryId);
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Delete thread error:', error);
        reply.code(500).send({
          error: 'Failed to delete thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // POSTS
  app.post<{ Params: { id: string }; Body: CreatePostBody }>(
    '/threads/:id/posts',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id: threadId } = request.params;
        if (!threadId) {
          return reply.code(400).send({ error: 'Thread ID required' });
        }
        const { content } = request.body;

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
          return reply.code(400).send({ error: 'Post content is required' });
        }

        const mentionPattern = /@(\w+)/g;
        const mentions: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = mentionPattern.exec(content)) !== null) {
          if (match[1]) {
            mentions.push(match[1]);
          }
        }

        const post = await forumStorage.createPost({
          threadId,
          authorId: request.user.id,
          content: content.trim(),
          reactions: [],
          mentions,
          createdAt: Date.now(),
        });

        await forumHandler.handlePostCreated(post, threadId, request.user.id);

        reply.code(201).send(post);
      } catch (error) {
        console.error('Create post error:', error);
        const status = error instanceof Error && error.message.includes('locked') ? 403 : 500;
        reply.code(status).send({
          error: 'Failed to create post',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.put<{ Params: { id: string }; Body: UpdatePostBody }>(
    '/posts/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params;
      if (!id) {
        return reply.code(400).send({ error: 'Post ID required' });
      }
      const { content } = request.body;

      const post = await forumStorage.getPost(id);
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      const isModerator = request.user.role === 'admin' || request.user.role === 'moderator';
      if (post.authorId !== request.user.id && !isModerator) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return reply.code(400).send({ error: 'Post content is required' });
      }

      const mentionPattern = /@(\w+)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionPattern.exec(content)) !== null) {
        if (match[1]) {
          mentions.push(match[1]);
        }
      }

      const updated = await forumStorage.updatePost(
        id,
        { content: content.trim(), mentions },
        request.user.id
      );
      if (!updated) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      await forumHandler.handlePostUpdated(updated, updated.threadId, request.user.id);

      reply.send(updated);
    } catch (error) {
      console.error('Update post error:', error);
      reply.code(500).send({
        error: 'Failed to update post',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete<{ Params: { id: string } }>(
    '/posts/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params;
      if (!id) {
        return reply.code(400).send({ error: 'Missing id parameter' });
      }
      const post = await forumStorage.getPost(id);
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const isModerator = request.user.role === 'admin' || request.user.role === 'moderator';
      if (post.authorId !== request.user.id && !isModerator) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const deleted = await forumStorage.deletePost(id, request.user.id, isModerator);
      if (!deleted) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      await forumHandler.handlePostDeleted(id, post.threadId);

      reply.code(204).send();
    } catch (error) {
      console.error('Delete post error:', error);
      reply.code(500).send({
        error: 'Failed to delete post',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // REACTIONS
  app.post<{ Params: { id: string }; Body: ReactionBody }>(
    '/threads/:id/reactions',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        const { emoji } = request.body;

        if (!emoji || typeof emoji !== 'string') {
          return reply.code(400).send({ error: 'Emoji is required' });
        }

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({ error: 'Thread ID is required' });
        }

        const thread = await forumStorage.getThread(id);
        if (!thread) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        const success = await forumStorage.addReaction(id, null, emoji, request.user.id);
        if (!success) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        const updatedThread = await forumStorage.getThread(id);
        if (updatedThread) {
          const reaction = updatedThread.reactions.find(
            (r) => r.userId === request.user!.id && r.emoji === emoji
          );
          if (reaction) {
            await forumHandler.handleReactionAdded(id, null, reaction, request.user.id);
          }
        }

        reply.code(201).send({ success: true });
      } catch (error) {
        console.error('Add reaction error:', error);
        reply.code(500).send({
          error: 'Failed to add reaction',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string; emoji: string } }>(
    '/threads/:id/reactions/:emoji',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id, emoji } = request.params;

        if (!id || !emoji) {
          return reply.code(400).send({ error: 'Thread ID and emoji are required' });
        }

        const success = await forumStorage.removeReaction(id, null, emoji, request.user.id);
        if (!success) {
          return reply.code(404).send({ error: 'Thread or reaction not found' });
        }

        await forumHandler.handleReactionRemoved(id, null, emoji, request.user.id);

        reply.code(204).send();
      } catch (error) {
        console.error('Remove reaction error:', error);
        reply.code(500).send({
          error: 'Failed to remove reaction',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Params: { id: string }; Body: ReactionBody }>(
    '/posts/:id/reactions',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        const { emoji } = request.body;

        if (!emoji || typeof emoji !== 'string') {
          return reply.code(400).send({ error: 'Emoji is required' });
        }

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({ error: 'Post ID is required' });
        }

        const post = await forumStorage.getPost(id);
        if (!post) {
          return reply.code(404).send({ error: 'Post not found' });
        }

        const success = await forumStorage.addReaction(null, id, emoji, request.user.id);
        if (!success) {
          return reply.code(404).send({ error: 'Post not found' });
        }

        const updatedPost = await forumStorage.getPost(id);
        if (updatedPost) {
          const reaction = updatedPost.reactions.find(
            (r) => r.userId === request.user!.id && r.emoji === emoji
          );
          if (reaction) {
            await forumHandler.handleReactionAdded(null, id, reaction, request.user.id);
          }
        }

        reply.code(201).send({ success: true });
      } catch (error) {
        console.error('Add reaction error:', error);
        reply.code(500).send({
          error: 'Failed to add reaction',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string; emoji: string } }>(
    '/posts/:id/reactions/:emoji',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id, emoji } = request.params;

        if (!id || !emoji) {
          return reply.code(400).send({ error: 'Post ID and emoji are required' });
        }

        const success = await forumStorage.removeReaction(null, id, emoji, request.user.id);
        if (!success) {
          return reply.code(404).send({ error: 'Post or reaction not found' });
        }

        await forumHandler.handleReactionRemoved(null, id, emoji, request.user.id);

        reply.code(204).send();
      } catch (error) {
        console.error('Remove reaction error:', error);
        reply.code(500).send({
          error: 'Failed to remove reaction',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // VOTES
  app.post<{ Params: { id: string }; Body: VoteBody }>(
    '/threads/:id/vote',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params;
      const { vote } = request.body;

      if (!id || typeof id !== 'string') {
        return reply.code(400).send({ error: 'Thread ID is required' });
      }

      if (!vote || (vote !== 'up' && vote !== 'down')) {
        return reply.code(400).send({ error: 'Vote must be "up" or "down"' });
      }

      const result = await forumStorage.voteThread(id, request.user.id, vote);

      await forumHandler.handleVoteChanged(
        id,
        null,
        result.score,
        result.upvotes,
        result.downvotes
      );

      reply.send(result);
    } catch (error) {
      console.error('Vote thread error:', error);
      reply.code(500).send({
        error: 'Failed to vote on thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete<{ Params: { id: string } }>(
    '/threads/:id/vote',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params;

      if (!id || typeof id !== 'string') {
        return reply.code(400).send({ error: 'Thread ID is required' });
      }

      const result = await forumStorage.removeThreadVote(id, request.user.id);

      await forumHandler.handleVoteChanged(
        id,
        null,
        result.score,
        result.upvotes,
        result.downvotes
      );

      reply.send(result);
    } catch (error) {
      console.error('Remove vote error:', error);
      reply.code(500).send({
        error: 'Failed to remove vote',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post<{ Params: { id: string }; Body: VoteBody }>(
    '/posts/:id/vote',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params;
      const { vote } = request.body;

      if (!id || typeof id !== 'string') {
        return reply.code(400).send({ error: 'Post ID is required' });
      }

      if (!vote || (vote !== 'up' && vote !== 'down')) {
        return reply.code(400).send({ error: 'Vote must be "up" or "down"' });
      }

      const result = await forumStorage.votePost(id, request.user.id, vote);

      await forumHandler.handleVoteChanged(
        null,
        id,
        result.score,
        result.upvotes,
        result.downvotes
      );

      reply.send(result);
    } catch (error) {
      console.error('Vote post error:', error);
      reply.code(500).send({
        error: 'Failed to vote on post',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete<{ Params: { id: string } }>(
    '/posts/:id/vote',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params;

      if (!id || typeof id !== 'string') {
        return reply.code(400).send({ error: 'Post ID is required' });
      }

      const result = await forumStorage.removePostVote(id, request.user.id);

      await forumHandler.handleVoteChanged(
        null,
        id,
        result.score,
        result.upvotes,
        result.downvotes
      );

      reply.send(result);
    } catch (error) {
      console.error('Remove vote error:', error);
      reply.code(500).send({
        error: 'Failed to remove vote',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // MODERATOR ACTIONS
  app.post<{ Params: { id: string } }>(
    '/threads/:id/pin',
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

        const success = await forumStorage.pinThread(id);
        if (!success) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        reply.send({ success: true });
      } catch (error) {
        console.error('Pin thread error:', error);
        reply.code(500).send({
          error: 'Failed to pin thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/threads/:id/pin',
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

        const success = await forumStorage.unpinThread(id);
        if (!success) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        reply.send({ success: true });
      } catch (error) {
        console.error('Unpin thread error:', error);
        reply.code(500).send({
          error: 'Failed to unpin thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Params: { id: string } }>(
    '/threads/:id/lock',
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

        const success = await forumStorage.lockThread(id);
        if (!success) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        reply.send({ success: true });
      } catch (error) {
        console.error('Lock thread error:', error);
        reply.code(500).send({
          error: 'Failed to lock thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/threads/:id/lock',
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

        const success = await forumStorage.unlockThread(id);
        if (!success) {
          return reply.code(404).send({ error: 'Thread not found' });
        }

        reply.send({ success: true });
      } catch (error) {
        console.error('Unlock thread error:', error);
        reply.code(500).send({
          error: 'Failed to unlock thread',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // SEARCH & UTILITIES
  app.get<{ Querystring: { q?: string } }>('/search', async (request, reply) => {
    try {
      const { q } = request.query;

      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return reply.code(400).send({ error: 'Search query is required' });
      }

      const trimmedQuery = q.trim();
      const threads = await forumStorage.searchThreads(trimmedQuery);
      const posts = await forumStorage.searchPosts(trimmedQuery);

      reply.send({ threads, posts });
    } catch (error) {
      console.error('Search error:', error);
      reply.code(500).send({
        error: 'Failed to search',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get<{ Params: { id: string } }>('/preview-marketplace/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      if (!id) {
        return reply.code(400).send({ error: 'Item ID is required' });
      }
      const item = await marketplaceStorage.getItem(id);

      if (!item) {
        return reply.code(404).send({ error: 'Marketplace item not found' });
      }

      reply.send({
        id: item.id,
        title: item.title,
        description: item.description,
        authorName: item.authorName,
        thumbnailUrl: item.thumbnailUrl,
        type: item.type,
        tags: item.tags,
        createdAt: item.createdAt,
      });
    } catch (error) {
      console.error('Get marketplace preview error:', error);
      reply.code(500).send({
        error: 'Failed to get marketplace preview',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post<{ Body: ShareProjectBody }>(
    '/share-project',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { projectToken, categoryId, title, description } = request.body;

        if (!projectToken) {
          return reply.code(400).send({ error: 'projectToken is required' });
        }

        const share = await storage.load(projectToken);
        if (!share) {
          return reply.code(404).send({ error: 'Project not found' });
        }

        const resolvedCategoryId = categoryId || 'cat_showcase';
        const category = await forumStorage.getCategory(resolvedCategoryId);
        if (!category || category.isLocked) {
          return reply.code(400).send({ error: 'Invalid or locked category' });
        }

        const threadTitle = title || 'Shared Project';
        const threadContent = `${description || 'Check out this project!'}\n\n[Open in Editor](/projects/${projectToken})`;

        const forumThread = await forumStorage.createThread({
          categoryId: resolvedCategoryId,
          authorId: request.user.id,
          title: threadTitle,
          content: threadContent,
          isPinned: false,
          isLocked: false,
          tags: [],
          projectToken,
        });

        await forumHandler.handleThreadCreated(forumThread, resolvedCategoryId, request.user.id);

        reply.code(201).send(forumThread);
      } catch (error) {
        console.error('Share project to forum error:', error);
        reply.code(500).send({
          error: 'Failed to share project to forum',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

}

