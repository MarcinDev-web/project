import { Router, type Request, type Response } from 'express';
import type { RouteDependencies } from './index';
import type { AuthRequest } from '../auth/middleware';

/**
 * Create forum routes
 */
export function createForumRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const {
    authMiddleware,
    requireAdmin,
    requireModerator,
    forumStorage,
    forumHandler,
    marketplaceStorage,
    storage,
    getUserIdFromToken,
  } = deps;

  // CATEGORIES
  router.get('/api/forum/categories', async (_req: Request, res: Response) => {
    try {
      const categories = await forumStorage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({
        error: 'Failed to get categories',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/api/forum/categories/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Category ID required' });
      }
      const category = await forumStorage.getCategory(id);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
      const threads = await forumStorage.getThreads(id, (req.query.sort as 'hot' | 'new' | 'top') || 'hot');
      res.json({ category, threads });
    } catch (error) {
      console.error('Get category error:', error);
      res.status(500).json({
        error: 'Failed to get category',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/forum/categories', authMiddleware, requireAdmin(), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, description, icon, color, order, isLocked } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Category name is required' });
      }

      const category = await forumStorage.createCategory({
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name,
        description: description || '',
        icon,
        color,
        order: order || 999,
        isLocked: isLocked || false,
      });

      res.status(201).json(category);
    } catch (error) {
      console.error('Create category error:', error);
      res.status(500).json({
        error: 'Failed to create category',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // THREADS
  router.get('/api/forum/threads/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Thread ID required' });
      }
      const thread = await forumStorage.getThread(id);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }
      const sortBy = (req.query.sort as 'new' | 'top') || 'new';
      const posts = await forumStorage.getPosts(id, sortBy);
      
      const userId = await getUserIdFromToken(req.headers.authorization);
      let userVote: 'up' | 'down' | null = null;
      if (userId) {
        userVote = await forumStorage.getThreadVote(id, userId);
      }
      
      res.json({ thread, posts, userVote });
    } catch (error) {
      console.error('Get thread error:', error);
      res.status(500).json({
        error: 'Failed to get thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/forum/threads', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { categoryId, title, content, tags } = req.body;
      
      if (!categoryId || typeof categoryId !== 'string') {
        return res.status(400).json({ error: 'Category ID is required' });
      }
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Thread title is required' });
      }
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Thread content is required' });
      }

      const thread = await forumStorage.createThread({
        categoryId,
        authorId: req.user.id,
        title: title.trim(),
        content: content.trim(),
        isPinned: false,
        isLocked: false,
        tags: Array.isArray(tags) ? tags : [],
      });

      res.status(201).json(thread);
    } catch (error) {
      console.error('Create thread error:', error);
      res.status(500).json({
        error: 'Failed to create thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.put('/api/forum/threads/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Thread ID required' });
      }
      const { title, content, tags } = req.body;
      
      const thread = await forumStorage.getThread(id);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }
      
      const isModerator = req.user.role === 'admin' || req.user.role === 'moderator';
      if (thread.authorId !== req.user.id && !isModerator) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updates: Partial<typeof thread> = {};
      if (title !== undefined) updates.title = title.trim();
      if (content !== undefined) updates.content = content.trim();
      if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : [];

      const updated = await forumStorage.updateThread(id, updates, req.user.id);
      if (!updated) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      await forumHandler.handleThreadUpdated(updated, req.user.id);

      res.json(updated);
    } catch (error) {
      console.error('Update thread error:', error);
      res.status(500).json({
        error: 'Failed to update thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/forum/threads/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Thread ID required' });
      }
      const thread = await forumStorage.getThread(id);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }
      
      const isModerator = req.user.role === 'admin' || req.user.role === 'moderator';
      if (thread.authorId !== req.user.id && !isModerator) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const deleted = await forumStorage.deleteThread(id, req.user.id, isModerator);
      if (!deleted) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      if (thread.categoryId) {
        await forumHandler.handleThreadDeleted(id, thread.categoryId);
      }

      res.status(204).send();
    } catch (error) {
      console.error('Delete thread error:', error);
      res.status(500).json({
        error: 'Failed to delete thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POSTS
  router.post('/api/forum/threads/:id/posts', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id: threadId } = req.params;
      if (!threadId) {
        return res.status(400).json({ error: 'Thread ID required' });
      }
      const { content } = req.body;
      
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Post content is required' });
      }

      const mentionPattern = /@(\w+)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionPattern.exec(content)) !== null) {
        if (match[1]) {
          mentions.push(match[1]);
        }
      }

      const post = await forumStorage.createPost({
        threadId,
        authorId: req.user.id,
        content: content.trim(),
        reactions: [],
        mentions: mentions,
        createdAt: Date.now(),
      });

      await forumHandler.handlePostCreated(post, threadId, req.user.id);

      res.status(201).json(post);
    } catch (error) {
      console.error('Create post error:', error);
      const status = error instanceof Error && error.message.includes('locked') ? 403 : 500;
      res.status(status).json({
        error: 'Failed to create post',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.put('/api/forum/posts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Post ID required' });
      }
      const { content } = req.body;
      
      const post = await forumStorage.getPost(id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      const isModerator = req.user.role === 'admin' || req.user.role === 'moderator';
      if (post.authorId !== req.user.id && !isModerator) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Post content is required' });
      }

      const mentionPattern = /@(\w+)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionPattern.exec(content)) !== null) {
        if (match[1]) {
          mentions.push(match[1]);
        }
      }

      const updated = await forumStorage.updatePost(id, { content: content.trim(), mentions }, req.user.id);
      if (!updated) {
        return res.status(404).json({ error: 'Post not found' });
      }

      await forumHandler.handlePostUpdated(updated, updated.threadId, req.user.id);

      res.json(updated);
    } catch (error) {
      console.error('Update post error:', error);
      res.status(500).json({
        error: 'Failed to update post',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/forum/posts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Missing id parameter' });
      }
      const post = await forumStorage.getPost(id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const isModerator = req.user.role === 'admin' || req.user.role === 'moderator';
      if (post.authorId !== req.user.id && !isModerator) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const deleted = await forumStorage.deletePost(id, req.user.id, isModerator);
      if (!deleted) {
        return res.status(404).json({ error: 'Post not found' });
      }

      await forumHandler.handlePostDeleted(id, post.threadId);

      res.status(204).send();
    } catch (error) {
      console.error('Delete post error:', error);
      res.status(500).json({
        error: 'Failed to delete post',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // REACTIONS
  router.post('/api/forum/threads/:id/reactions', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { emoji } = req.body;
      
      if (!emoji || typeof emoji !== 'string') {
        return res.status(400).json({ error: 'Emoji is required' });
      }

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Thread ID is required' });
      }

      const thread = await forumStorage.getThread(id);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const success = await forumStorage.addReaction(id, null, emoji, req.user.id);
      if (!success) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      const updatedThread = await forumStorage.getThread(id);
      if (updatedThread) {
        const reaction = updatedThread.reactions.find(r => r.userId === req.user!.id && r.emoji === emoji);
        if (reaction) {
          await forumHandler.handleReactionAdded(id, null, reaction, req.user!.id);
        }
      }

      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Add reaction error:', error);
      res.status(500).json({
        error: 'Failed to add reaction',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/forum/threads/:id/reactions/:emoji', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id, emoji } = req.params;
      
      if (!id || typeof id !== 'string' || !emoji || typeof emoji !== 'string') {
        return res.status(400).json({ error: 'Thread ID and emoji are required' });
      }
      
      const success = await forumStorage.removeReaction(id, null, emoji, req.user.id);
      if (!success) {
        return res.status(404).json({ error: 'Thread or reaction not found' });
      }

      await forumHandler.handleReactionRemoved(id, null, emoji, req.user.id);

      res.status(204).send();
    } catch (error) {
      console.error('Remove reaction error:', error);
      res.status(500).json({
        error: 'Failed to remove reaction',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/forum/posts/:id/reactions', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { emoji } = req.body;
      
      if (!emoji || typeof emoji !== 'string') {
        return res.status(400).json({ error: 'Emoji is required' });
      }

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Post ID is required' });
      }

      const post = await forumStorage.getPost(id);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const success = await forumStorage.addReaction(null, id, emoji, req.user.id);
      if (!success) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const updatedPost = await forumStorage.getPost(id);
      if (updatedPost && req.user) {
        const reaction = updatedPost.reactions.find(r => r.userId === req.user!.id && r.emoji === emoji);
        if (reaction) {
          await forumHandler.handleReactionAdded(null, id, reaction, req.user.id);
        }
      }

      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Add reaction error:', error);
      res.status(500).json({
        error: 'Failed to add reaction',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/forum/posts/:id/reactions/:emoji', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id, emoji } = req.params;
      
      if (!id || typeof id !== 'string' || !emoji || typeof emoji !== 'string') {
        return res.status(400).json({ error: 'Post ID and emoji are required' });
      }
      
      const success = await forumStorage.removeReaction(null, id, emoji, req.user.id);
      if (!success) {
        return res.status(404).json({ error: 'Post or reaction not found' });
      }

      await forumHandler.handleReactionRemoved(null, id, emoji, req.user.id);

      res.status(204).send();
    } catch (error) {
      console.error('Remove reaction error:', error);
      res.status(500).json({
        error: 'Failed to remove reaction',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // VOTES
  router.post('/api/forum/threads/:id/vote', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { vote } = req.body;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Thread ID is required' });
      }
      
      if (!vote || (vote !== 'up' && vote !== 'down')) {
        return res.status(400).json({ error: 'Vote must be "up" or "down"' });
      }

      const result = await forumStorage.voteThread(id, req.user.id, vote);
      
      await forumHandler.handleVoteChanged(id, null, result.score, result.upvotes, result.downvotes);
      
      res.json(result);
    } catch (error) {
      console.error('Vote thread error:', error);
      res.status(500).json({
        error: 'Failed to vote on thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/forum/threads/:id/vote', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Thread ID is required' });
      }
      
      const result = await forumStorage.removeThreadVote(id, req.user.id);
      
      await forumHandler.handleVoteChanged(id, null, result.score, result.upvotes, result.downvotes);
      
      res.json(result);
    } catch (error) {
      console.error('Remove vote error:', error);
      res.status(500).json({
        error: 'Failed to remove vote',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/forum/posts/:id/vote', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { vote } = req.body;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Post ID is required' });
      }
      
      if (!vote || (vote !== 'up' && vote !== 'down')) {
        return res.status(400).json({ error: 'Vote must be "up" or "down"' });
      }

      const result = await forumStorage.votePost(id, req.user.id, vote);
      
      await forumHandler.handleVoteChanged(null, id, result.score, result.upvotes, result.downvotes);
      
      res.json(result);
    } catch (error) {
      console.error('Vote post error:', error);
      res.status(500).json({
        error: 'Failed to vote on post',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/forum/posts/:id/vote', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Post ID is required' });
      }
      
      const result = await forumStorage.removePostVote(id, req.user.id);
      
      await forumHandler.handleVoteChanged(null, id, result.score, result.upvotes, result.downvotes);
      
      res.json(result);
    } catch (error) {
      console.error('Remove vote error:', error);
      res.status(500).json({
        error: 'Failed to remove vote',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // MODERATOR ACTIONS
  router.post('/api/forum/threads/:id/pin', authMiddleware, requireModerator(), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Thread ID is required' });
      }
      
      const success = await forumStorage.pinThread(id);
      if (!success) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Pin thread error:', error);
      res.status(500).json({
        error: 'Failed to pin thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/forum/threads/:id/pin', authMiddleware, requireModerator(), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Thread ID is required' });
      }
      
      const success = await forumStorage.unpinThread(id);
      if (!success) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Unpin thread error:', error);
      res.status(500).json({
        error: 'Failed to unpin thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/forum/threads/:id/lock', authMiddleware, requireModerator(), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Thread ID is required' });
      }
      
      const success = await forumStorage.lockThread(id);
      if (!success) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Lock thread error:', error);
      res.status(500).json({
        error: 'Failed to lock thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete('/api/forum/threads/:id/lock', authMiddleware, requireModerator(), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Thread ID is required' });
      }
      
      const success = await forumStorage.unlockThread(id);
      if (!success) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Unlock thread error:', error);
      res.status(500).json({
        error: 'Failed to unlock thread',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // SEARCH & UTILITIES
  router.get('/api/forum/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string | undefined;
      
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const threads = await forumStorage.searchThreads(query.trim());
      const posts = await forumStorage.searchPosts(query.trim());
      
      res.json({ threads, posts });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        error: 'Failed to search',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/api/forum/preview-marketplace/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Item ID is required' });
      }
      const item = await marketplaceStorage.getItem(id);
      
      if (!item) {
        return res.status(404).json({ error: 'Marketplace item not found' });
      }

      res.json({
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
      res.status(500).json({
        error: 'Failed to get marketplace preview',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/api/projects/:token/preview', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Token is required' });
      }
      const share = await storage.load(token);
      
      if (!share) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({
        token,
        createdAt: share.createdAt,
        title: (share.projectData as { title?: string } | undefined)?.title || 'Shared Project',
      });
    } catch (error) {
      console.error('Get project preview error:', error);
      res.status(500).json({
        error: 'Failed to get project preview',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/api/forum/share-project', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const body = req.body as {
        projectToken: string;
        categoryId?: string;
        title?: string;
        description?: string;
      };

      if (!body.projectToken) {
        return res.status(400).json({ error: 'projectToken is required' });
      }

      const share = await storage.load(body.projectToken);
      if (!share) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const categoryId = body.categoryId || 'cat_showcase';
      const category = await forumStorage.getCategory(categoryId);
      if (!category || category.isLocked) {
        return res.status(400).json({ error: 'Invalid or locked category' });
      }

      const threadTitle = body.title || 'Shared Project';
      const threadContent = `${body.description || 'Check out this project!'}\n\n[Open in Editor](/projects/${body.projectToken})`;
      
      const forumThread = await forumStorage.createThread({
        categoryId,
        authorId: req.user.id,
        title: threadTitle,
        content: threadContent,
        isPinned: false,
        isLocked: false,
        tags: [],
        projectToken: body.projectToken,
      });

      await forumHandler.handleThreadCreated(forumThread, categoryId, req.user.id);

      res.status(201).json(forumThread);
    } catch (error) {
      console.error('Share project to forum error:', error);
      res.status(500).json({
        error: 'Failed to share project to forum',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

