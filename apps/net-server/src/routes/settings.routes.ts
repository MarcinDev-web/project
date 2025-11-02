import { Router } from 'express';
import type { Response } from 'express';
import type { RouteDependencies } from './index';
import type { AuthRequest } from '../auth/middleware';

/**
 * Create settings routes
 */
export function createSettingsRoutes(deps: RouteDependencies): ReturnType<typeof Router> {
  const router = Router();
  const {
    authMiddleware,
    userSettingsStorage,
  } = deps;

  /**
   * GET /api/settings
   * Get user settings.
   */
  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const settings = await userSettingsStorage.getSettings(req.user.id);
      res.json(settings);
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({
        error: 'Failed to get settings',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/settings
   * Update user settings.
   */
  router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const updates = req.body as {
        notificationPreferences?: Partial<import('../storage/UserSettingsStorage').NotificationPreferences>
      };

      // Convert Partial<NotificationPreferences> to proper format for updateSettings
      const settingsUpdate: Partial<import('../storage/UserSettingsStorage').UserSettings> = {};
      if (updates.notificationPreferences) {
        settingsUpdate.notificationPreferences = {
          ...(await userSettingsStorage.getSettings(req.user.id)).notificationPreferences,
          ...updates.notificationPreferences,
        };
      }

      const settings = await userSettingsStorage.updateSettings(req.user.id, settingsUpdate);
      res.json(settings);
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({
        error: 'Failed to update settings',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

