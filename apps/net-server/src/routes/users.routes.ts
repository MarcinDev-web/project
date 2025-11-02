import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { RouteDependencies } from './index';
import type { AuthRequest } from '../auth/middleware';
import { validateBody, validateParams } from '../validation/middleware';
import { updateProfileSchema, userIdParamSchema } from '../validation/schemas/user';

/**
 * Create users routes
 */
export function createUsersRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const {
    authMiddleware,
    profileStorage,
    marketplaceStorage,
  } = deps;

  /**
   * GET /api/users/:id
   * Get user profile by ID.
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }
      const profile = await profileStorage.getProfile(id);

      if (!profile) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(profile);
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({
        error: 'Failed to get user profile',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/users/:id
   * Update user profile (own profile only).
   */
  router.put('/:id',
    authMiddleware,
    validateParams(userIdParamSchema),
    validateBody(updateProfileSchema),
    async (req: AuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        if (!req.user || req.user.id !== id) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const updates = req.body as z.infer<typeof updateProfileSchema>;
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

        const profile = await profileStorage.updateProfile(req.user.id, cleanUpdates);

        res.json(profile);
      } catch (error) {
        console.error('Update profile error:', error);

        // Handle profile not found error
        if (error instanceof Error && error.message.includes('Profile not found')) {
          return res.status(404).json({
            error: 'Profile not found',
            message: error.message,
          });
        }

        res.status(500).json({
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
  router.get('/:id/builds', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }
      const items = await marketplaceStorage.getItems({
        authorId: id,
        type: 'build',
        public: true,
      });

      res.json(items);
    } catch (error) {
      console.error('Get user builds error:', error);
      res.status(500).json({
        error: 'Failed to get builds',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/users/:id/avatar-loadout
   * Get user's avatar loadout.
   */
  router.get('/:id/avatar-loadout', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const profile = await profileStorage.getProfile(id);

      if (!profile) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!profile.avatarLoadout) {
        return res.status(404).json({ error: 'Avatar loadout not found' });
      }

      res.json(profile.avatarLoadout);
    } catch (error) {
      console.error('Get avatar loadout error:', error);
      res.status(500).json({
        error: 'Failed to get avatar loadout',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/users/:id/avatar-loadout
   * Save user's avatar loadout (own profile only).
   */
  router.put('/:id/avatar-loadout', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'User ID required' });
      }
      if (!req.user || req.user.id !== id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const loadout = req.body as { version: number; parts: Record<string, unknown> };

      // Basic validation
      if (!loadout || typeof loadout !== 'object' || typeof loadout.version !== 'number') {
        return res.status(400).json({ error: 'Invalid loadout format' });
      }

      // Convert parts to proper type structure
      const typedLoadout: { version: number; parts: Record<string, { mesh: string; mat?: string; material?: string; colors?: Record<string, [number, number, number, number]> }> } = {
        version: loadout.version,
        parts: Object.fromEntries(
          Object.entries(loadout.parts).map(([key, value]) => [
            key,
            typeof value === 'object' && value !== null && 'mesh' in value
              ? (value as { mesh: string; mat?: string; material?: string; colors?: Record<string, [number, number, number, number]> })
              : { mesh: String(value) }
          ])
        )
      };

      const profile = await profileStorage.updateProfile(req.user.id, {
        avatarLoadout: typedLoadout,
      });

      res.json(profile.avatarLoadout);
    } catch (error) {
      console.error('Save avatar loadout error:', error);

      // Handle profile not found error
      if (error instanceof Error && error.message.includes('Profile not found')) {
        return res.status(404).json({
          error: 'Profile not found',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Failed to save avatar loadout',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

