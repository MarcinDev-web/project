import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { RouteDependencies } from './index.js';
import { updateProfileSchema, userIdParamSchema } from '../validation/schemas/user.js';
import { validateBody, validateParams } from '../validation/middleware.js';

/**
 * Create users routes for Fastify
 */
export async function createUsersRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const {
    authMiddleware,
    profileStorage,
    marketplaceStorage,
    authManager,
    friendsStorage,
    forumStorage,
    avatarStorage,
    studioProjectsStorage,
  } = opts.dependencies;

  type UserIdParams = z.infer<typeof userIdParamSchema>;
  type UpdateProfileBody = z.infer<typeof updateProfileSchema>;

  /**
   * GET /api/users/:id
   * Get user profile by ID.
   */
  app.get(
    '/:id',
    {
      preHandler: [validateParams(userIdParamSchema)],
    },
    async (request, reply) => {
      try {
        const { id } = (request.params as UserIdParams);
        const profile = await profileStorage.getProfile(id);
        
        // If profile doesn't exist, try to get basic user data
        if (!profile) {
          const user = await authManager.getUserById(id);
          if (!user) {
            return reply.code(404).send({ error: 'User not found' });
          }
          // Return basic user data (PublicUser) as fallback
          return reply.send(user);
        }

        reply.send(profile);
      } catch (error) {
        console.error('Get user profile error:', error);
        reply.code(500).send({
          error: 'Failed to get user profile',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * PUT /api/users/:id
   * Update user profile (own profile only).
   */
  app.put(
    '/:id',
    {
      preHandler: [validateParams(userIdParamSchema), validateBody(updateProfileSchema), authMiddleware],
    },
    async (request, reply) => {
      try {
        const { id } = (request.params as UserIdParams);
        if (!request.user || request.user.id !== id) {
          return reply.code(403).send({ error: 'Forbidden' });
        }

        const updates = request.body as UpdateProfileBody;
        // Filter out undefined values to match exactOptionalPropertyTypes
        const cleanUpdates: {
          displayName?: string;
          bio?: string;
          avatarUrl?: string;
          website?: string;
          socialLinks?: { twitter?: string; discord?: string; github?: string };
        } = {};
        if (updates.displayName !== undefined) cleanUpdates.displayName = updates.displayName;
        if (updates.bio !== undefined) cleanUpdates.bio = updates.bio;
        if (updates.avatarUrl !== undefined) cleanUpdates.avatarUrl = updates.avatarUrl;
        if (updates.website !== undefined) cleanUpdates.website = updates.website;
        if (updates.socialLinks) {
          const socialLinks: { twitter?: string; discord?: string; github?: string } = {};
          if (updates.socialLinks.twitter) socialLinks.twitter = updates.socialLinks.twitter;
          if (updates.socialLinks.discord) socialLinks.discord = updates.socialLinks.discord;
          if (updates.socialLinks.github) socialLinks.github = updates.socialLinks.github;
          cleanUpdates.socialLinks = socialLinks;
        }

        const profile = await profileStorage.updateProfile(request.user.id, cleanUpdates);

        reply.send(profile);
      } catch (error) {
        console.error('Update profile error:', error);

        // Handle profile not found error
        if (error instanceof Error && error.message.includes('Profile not found')) {
          return reply.code(404).send({
            error: 'Profile not found',
            message: error.message,
          });
        }

        reply.code(500).send({
          error: 'Failed to update profile',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/users/:id/builds
   * Get user's published builds.
   */
  app.get(
    '/:id/builds',
    {
      preHandler: [validateParams(userIdParamSchema)],
    },
    async (request, reply) => {
      try {
        const { id } = (request.params as UserIdParams);
        const items = await marketplaceStorage.getItems({
          authorId: id,
          type: 'build',
          public: true,
        });

        reply.send(items);
      } catch (error) {
        console.error('Get user builds error:', error);
        reply.code(500).send({
          error: 'Failed to get builds',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/users/:id/avatar-loadout
   * Get user's avatar loadout.
   */
  app.get(
    '/:id/avatar-loadout',
    {
      preHandler: [validateParams(userIdParamSchema)],
    },
    async (request, reply) => {
      try {
        const { id } = (request.params as UserIdParams);

        const profile = await profileStorage.getProfile(id);

        if (!profile) {
          return reply.code(404).send({ error: 'User not found' });
        }

        if (!profile.avatarLoadout) {
          return reply.code(404).send({ error: 'Avatar loadout not found' });
        }

        reply.send(profile.avatarLoadout);
      } catch (error) {
        console.error('Get avatar loadout error:', error);
        reply.code(500).send({
          error: 'Failed to get avatar loadout',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * PUT /api/users/:id/avatar-loadout
   * Save user's avatar loadout (own profile only).
   */
  app.put(
    '/:id/avatar-loadout',
    {
      preHandler: [validateParams(userIdParamSchema), authMiddleware],
    },
    async (request, reply) => {
      try {
        const { id } = (request.params as UserIdParams);
        if (!request.user || request.user.id !== id) {
          return reply.code(403).send({ error: 'Forbidden' });
        }

        const loadout = request.body as { version: number; parts: Record<string, unknown> };

        // Basic validation
        if (!loadout || typeof loadout !== 'object' || typeof loadout.version !== 'number') {
          return reply.code(400).send({ error: 'Invalid loadout format' });
        }

        // Convert parts to proper type structure
        const typedLoadout: {
          version: number;
          parts: Record<
            string,
            {
              mesh: string;
              mat?: string;
              material?: string;
              colors?: Record<string, [number, number, number, number]>;
            }
          >;
        } = {
          version: loadout.version,
          parts: Object.fromEntries(
            Object.entries(loadout.parts).map(([key, value]) => [
              key,
              typeof value === 'object' && value !== null && 'mesh' in value
                ? (value as {
                    mesh: string;
                    mat?: string;
                    material?: string;
                    colors?: Record<string, [number, number, number, number]>;
                  })
                : { mesh: String(value) },
            ])
          ),
        };

        const profile = await profileStorage.updateProfile(request.user.id, {
          avatarLoadout: typedLoadout,
        });

        reply.send(profile.avatarLoadout);
      } catch (error) {
        console.error('Save avatar loadout error:', error);

        // Handle profile not found error
        if (error instanceof Error && error.message.includes('Profile not found')) {
          return reply.code(404).send({
            error: 'Profile not found',
            message: error.message,
          });
        }

        reply.code(500).send({
          error: 'Failed to save avatar loadout',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/users/:id/social-stats
   * Get social statistics for a user profile (own profile only).
   */
  app.get(
    '/:id/social-stats',
    {
      preHandler: [validateParams(userIdParamSchema), authMiddleware],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as UserIdParams;
        
        // Only allow users to see their own stats
        if (!request.user || request.user.id !== id) {
          return reply.code(403).send({ error: 'Forbidden - can only view own stats' });
        }

        const userId = id;

        // Get friends count
        const friends = await friendsStorage.getFriends(userId);
        const friendsCount = friends.length;

        // Get forum stats
        const { threads: userThreads } = await forumStorage.getAllThreads({ authorId: userId });
        const { posts: userPosts } = await forumStorage.getAllPosts({ authorId: userId });
        const forumThreadsCount = userThreads.length;
        const forumPostsCount = userPosts.length;

        // Get marketplace stats
        const allItems = await marketplaceStorage.getItems({ authorId: userId });
        const builds = allItems.filter((item) => item.type === 'build' && item.public);
        const avatars = allItems.filter((item) => item.type === 'avatar' && item.public);
        
        const marketplaceBuildsCount = builds.length;
        const marketplaceLikesCount = allItems.reduce((sum, item) => sum + item.likes, 0);
        const marketplaceDownloadsCount = allItems.reduce((sum, item) => sum + item.downloads, 0);

        // Extended stats (only for own profile)
        // Get avatar presets
        const avatarPresets = await avatarStorage.getPresets(userId, true);
        const savedPresets = avatarPresets.filter((p) => !p.isPublished).length;
        const publishedAvatars = avatars.length;
        const avatarsTotalDownloads = avatars.reduce((sum, item) => sum + item.downloads, 0);
        const avatarsTotalLikes = avatars.reduce((sum, item) => sum + item.likes, 0);

        // Get blocks stats (from studio projects)
        // Note: Blocks are stored within projects, so we count projects with blocks
        const projects = await studioProjectsStorage.listProjects(userId, { limit: 10000, offset: 0 });
        // Estimate blocks count from projects (each project may have blocks)
        // For now, we'll use project count as a proxy, but ideally we'd count actual blocks
        const savedBlocks = projects.length; // This is an approximation
        const publishedBlocks = 0; // Blocks aren't published separately, they're part of builds
        const totalUses = 0; // Would need to track block usage separately

        // Marketplace detailed stats
        const buildsLikes = builds.reduce((sum, item) => sum + item.likes, 0);
        const buildsDownloads = builds.reduce((sum, item) => sum + item.downloads, 0);

        const stats = {
          friendsCount,
          forumThreadsCount,
          forumPostsCount,
          marketplaceBuildsCount,
          marketplaceLikesCount,
          marketplaceDownloadsCount,
          blocksStats: {
            saved: savedBlocks,
            published: publishedBlocks,
            totalUses,
          },
          avatarsStats: {
            savedPresets,
            published: publishedAvatars,
            totalDownloads: avatarsTotalDownloads,
            totalLikes: avatarsTotalLikes,
          },
          marketplaceStats: {
            buildsCount: builds.length,
            avatarsCount: avatars.length,
            buildsLikes,
            buildsDownloads,
            avatarsLikes: avatarsTotalLikes,
            avatarsDownloads: avatarsTotalDownloads,
          },
        };

        reply.send(stats);
      } catch (error) {
        console.error('Get social stats error:', error);
        reply.code(500).send({
          error: 'Failed to get social stats',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/users/:id/forum-activity
   * Get user's forum activity (recent posts and threads).
   */
  app.get(
    '/:id/forum-activity',
    {
      preHandler: [validateParams(userIdParamSchema)],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as UserIdParams;
        const query = request.query as { limit?: string };
        const limit = query.limit ? parseInt(query.limit, 10) : 10;

        // Get user's threads
        const { threads: userThreads } = await forumStorage.getAllThreads({
          authorId: id,
          limit,
        });

        // Get user's posts
        const { posts: userPosts } = await forumStorage.getAllPosts({
          authorId: id,
          limit,
        });

        // Get categories for thread category names
        const categories = await forumStorage.getCategories();
        const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

        // Format recent threads
        const recentThreads = userThreads.slice(0, limit).map((thread) => ({
          id: thread.id,
          title: thread.title,
          categoryId: thread.categoryId,
          categoryName: categoryMap.get(thread.categoryId),
          postCount: thread.postCount,
          createdAt: thread.createdAt,
          lastPostAt: thread.lastPostAt,
        }));

        // Format recent posts (need to get thread info for each post)
        const threadIds = [...new Set(userPosts.map((p) => p.threadId))];
        const threads = await Promise.all(
          threadIds.map((threadId) => forumStorage.getThread(threadId))
        );
        const threadMap = new Map(
          threads.filter((t): t is NonNullable<typeof t> => t !== null).map((t) => [t.id, t])
        );

        const recentPosts = userPosts.slice(0, limit).map((post) => {
          const thread = threadMap.get(post.threadId);
          return {
            id: post.id,
            threadId: post.threadId,
            threadTitle: thread?.title || 'Unknown thread',
            content: post.content.substring(0, 500), // Truncate for preview
            createdAt: post.createdAt,
            score: post.reactions?.length || 0, // Simple score based on reactions count
          };
        });

        reply.send({
          recentThreads,
          recentPosts,
        });
      } catch (error) {
        console.error('Get forum activity error:', error);
        reply.code(500).send({
          error: 'Failed to get forum activity',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}






