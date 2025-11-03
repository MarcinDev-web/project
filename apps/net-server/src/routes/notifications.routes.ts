import { Router, type Response } from 'express';
import type { RouteDependencies } from './index';
import type { AuthRequest } from '../auth/middleware';

/**
 * Create notifications routes
 */
export function createNotificationsRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const { authMiddleware, notificationsStorage } = deps;

  /**
   * GET /api/notifications
   * Get user's notifications.
   */
  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const notifications = await notificationsStorage.getNotifications(req.user.id, limit);
      res.json(notifications);
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        error: 'Failed to get notifications',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count.
   */
  router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const count = await notificationsStorage.getUnreadCount(req.user.id);
      res.json({ count });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        error: 'Failed to get unread count',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/notifications/:id/read
   * Mark notification as read.
   */
  router.put('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Notification ID required' });
      }

      if (!req.user.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const marked = await notificationsStorage.markAsRead(id, req.user.id);

      if (!marked) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({
        error: 'Failed to mark notification as read',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/notifications/read-all
   * Mark all notifications as read.
   */
  router.put('/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await notificationsStorage.markAllAsRead(req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      res.status(500).json({
        error: 'Failed to mark all notifications as read',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /api/notifications/:id
   * Delete notification.
   */
  router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Notification ID required' });
      }

      if (!req.user.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const deleted = await notificationsStorage.deleteNotification(id, req.user.id);

      if (!deleted) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        error: 'Failed to delete notification',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
