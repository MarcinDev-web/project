import type { FastifyInstance } from 'fastify';
import type { RouteDependencies } from './index';

/**
 * Create notifications routes for Fastify
 */
export async function createNotificationsRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const { authMiddleware, notificationsStorage } = opts.dependencies;

  type ListQuery = { limit?: number | string };
  type NotificationParams = { id: string };

  /**
   * GET /api/notifications
   * Get user's notifications.
   */
  app.get('/', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const query = request.query as ListQuery;
      const limit = query.limit ? parseInt(String(query.limit), 10) : 50;
      const notifications = await notificationsStorage.getNotifications(request.user.id, limit);
      reply.send(notifications);
    } catch (error) {
      console.error('Get notifications error:', error);
      reply.code(500).send({
        error: 'Failed to get notifications',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count.
   */
  app.get('/unread-count', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const count = await notificationsStorage.getUnreadCount(request.user.id);
      reply.send({ count });
    } catch (error) {
      console.error('Get unread count error:', error);
      reply.code(500).send({
        error: 'Failed to get unread count',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/notifications/:id/read
   * Mark notification as read.
   */
  app.put(
    '/:id/read',
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

        const { id } = request.params as NotificationParams;
        const marked = await notificationsStorage.markAsRead(id, request.user.id);

        if (!marked) {
          return reply.code(404).send({ error: 'Notification not found' });
        }

        reply.send({ success: true });
      } catch (error) {
        console.error('Mark notification read error:', error);
        reply.code(500).send({
          error: 'Failed to mark notification as read',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * PUT /api/notifications/read-all
   * Mark all notifications as read.
   */
  app.put('/read-all', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      await notificationsStorage.markAllAsRead(request.user.id);
      reply.send({ success: true });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      reply.code(500).send({
        error: 'Failed to mark all notifications as read',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /api/notifications/:id
   * Delete notification.
   */
  app.delete(
    '/:id',
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

        const { id } = request.params as NotificationParams;
        const deleted = await notificationsStorage.deleteNotification(id, request.user.id);

        if (!deleted) {
          return reply.code(404).send({ error: 'Notification not found' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Delete notification error:', error);
        reply.code(500).send({
          error: 'Failed to delete notification',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}
