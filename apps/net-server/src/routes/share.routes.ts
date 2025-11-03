import { Router, type Request, type Response } from 'express';
import type { RouteDependencies } from './index';
import type {
  ShareProjectRequest,
  ShareProjectResponse,
  ShareMetadataResponse,
} from '../types';

/**
 * Create share routes
 */
export function createShareRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const { storage, FRONTEND_URL } = deps;

  /**
   * POST /api/share
   * Share a project and get a shareable link.
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = req.body as ShareProjectRequest;

      // Validate request
      if (!body.projectId || typeof body.projectId !== 'string') {
        return res.status(400).json({ error: 'Invalid projectId' });
      }

      if (!body.projectData || typeof body.projectData !== 'object') {
        return res.status(400).json({ error: 'Invalid projectData' });
      }

      const projectData = body.projectData;

      // Validate project data structure
      if (
        !projectData.metadata ||
        !projectData.scene ||
        typeof projectData.metadata.id !== 'string' ||
        typeof projectData.metadata.name !== 'string'
      ) {
        return res.status(400).json({ error: 'Invalid project data structure' });
      }

      // Save to storage (no expiry for now)
      const token = await storage.save(projectData);

      // Generate share URL (assume frontend URL from config or request)
      const shareUrl = `${FRONTEND_URL}/?share=${token}`;

      const response: ShareProjectResponse = {
        token,
        url: shareUrl,
      };

      res.json(response);
    } catch (error) {
      console.error('Error sharing project:', error);
      res.status(500).json({
        error: 'Failed to share project',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/share/:token
   * Load a shared project by token.
   */
  router.get('/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Invalid token' });
      }

      const share = await storage.load(token);

      if (!share) {
        return res.status(404).json({ error: 'Shared project not found' });
      }

      res.json(share.projectData);
    } catch (error) {
      console.error('Error loading shared project:', error);
      res.status(500).json({
        error: 'Failed to load shared project',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/share/:token/metadata
   * Get metadata for a shared project (without loading full data).
   */
  router.get('/:token/metadata', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Invalid token' });
      }

      const share = await storage.load(token);

      if (!share) {
        return res.status(404).json({ error: 'Shared project not found' });
      }

      const response: ShareMetadataResponse = {
        token,
        projectId: share.projectData.metadata.id,
        name: share.projectData.metadata.name,
        createdAt: share.createdAt,
        ...(share.expiresAt !== undefined && { expiresAt: share.expiresAt }),
      };

      res.json(response);
    } catch (error) {
      console.error('Error loading shared project metadata:', error);
      res.status(500).json({
        error: 'Failed to load shared project metadata',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /api/share/:token
   * Revoke (delete) a share link.
   */
  router.delete('/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Invalid token' });
      }

      const deleted = await storage.delete(token);

      if (!deleted) {
        return res.status(404).json({ error: 'Shared project not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error revoking share:', error);
      res.status(500).json({
        error: 'Failed to revoke share',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
