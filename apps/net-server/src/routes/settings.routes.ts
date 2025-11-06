import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RouteDependencies } from './index.js';

/**
 * Create settings routes for Fastify
 */
export async function createSettingsRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const { authMiddleware, userSettingsStorage } = opts.dependencies;

  /**
   * GET /api/settings
   * Get user settings.
   */
  app.get('/', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const settings = await userSettingsStorage.getSettings(request.user.id);
      reply.send(settings);
    } catch (error) {
      console.error('Get settings error:', error);
      reply.code(500).send({
        error: 'Failed to get settings',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/settings
   * Update user settings.
   */
  app.put(
    '/',
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: 'object',
          properties: {
            notificationPreferences: {
              type: 'object',
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const updates = request.body as {
          notificationPreferences?: Partial<
            import('../storage/UserSettingsStorage').NotificationPreferences
          >;
        };

        // Convert Partial<NotificationPreferences> to proper format for updateSettings
        const settingsUpdate: Partial<import('../storage/UserSettingsStorage').UserSettings> = {};
        if (updates.notificationPreferences) {
          settingsUpdate.notificationPreferences = {
            ...(await userSettingsStorage.getSettings(request.user.id)).notificationPreferences,
            ...updates.notificationPreferences,
          };
        }

        const settings = await userSettingsStorage.updateSettings(request.user.id, settingsUpdate);
        reply.send(settings);
      } catch (error) {
        console.error('Update settings error:', error);
        reply.code(500).send({
          error: 'Failed to update settings',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}

