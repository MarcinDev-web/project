import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { RouteDependencies } from './index';
import { updateProfileSchema, userIdParamSchema } from '../validation/schemas/user';
import { validateBody, validateParams } from '../validation/middleware';

/**
 * Create users routes for Fastify
 */
export async function createUsersRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const { authMiddleware, profileStorage, marketplaceStorage } = opts.dependencies;

  /**
   * GET /api/users/:id
   * Get user profile by ID.
   */
  app.get(
    '/:id',
    {
      preHandler: [validateParams(userIdParamSchema)],
    },
    async (request: FastifyRequest<{ Params: z.infer<typeof userIdParamSchema> }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const profile = await profileStorage.getProfile(id);

        if (!profile) {
          return reply.code(404).send({ error: 'User not found' });
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
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof userIdParamSchema>;
        Body: z.infer<typeof updateProfileSchema>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        if (!request.user || request.user.id !== id) {
          return reply.code(403).send({ error: 'Forbidden' });
        }

        const updates = request.body;
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
    async (request: FastifyRequest<{ Params: z.infer<typeof userIdParamSchema> }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
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
    async (request: FastifyRequest<{ Params: z.infer<typeof userIdParamSchema> }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

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
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof userIdParamSchema>;
        Body: { version: number; parts: Record<string, unknown> };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        if (!request.user || request.user.id !== id) {
          return reply.code(403).send({ error: 'Forbidden' });
        }

        const loadout = request.body;

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
}
