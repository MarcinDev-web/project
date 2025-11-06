import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RouteDependencies } from './index.js';
import type { ShareProjectRequest, ShareProjectResponse, ShareMetadataResponse } from '../types.js';

/**
 * Create share routes for Fastify
 */
export async function createShareRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const { storage, FRONTEND_URL } = opts.dependencies;

  /**
   * POST /api/share
   * Share a project and get a shareable link.
   */
  app.post('/', async (request: FastifyRequest<{ Body: ShareProjectRequest }>, reply: FastifyReply) => {
    try {
      const body = request.body;

      // Validate request
      if (!body.projectId || typeof body.projectId !== 'string') {
        return reply.code(400).send({ error: 'Invalid projectId' });
      }

      if (!body.projectData || typeof body.projectData !== 'object') {
        return reply.code(400).send({ error: 'Invalid projectData' });
      }

      const projectData = body.projectData;

      // Validate project data structure
      if (
        !projectData.metadata ||
        !projectData.scene ||
        typeof projectData.metadata.id !== 'string' ||
        typeof projectData.metadata.name !== 'string'
      ) {
        return reply.code(400).send({ error: 'Invalid project data structure' });
      }

      // Save to storage (no expiry for now)
      const token = await storage.save(projectData);

      // Generate share URL (assume frontend URL from config or request)
      const shareUrl = `${FRONTEND_URL}/?share=${token}`;

      const response: ShareProjectResponse = {
        token,
        url: shareUrl,
      };

      reply.send(response);
    } catch (error) {
      console.error('Error sharing project:', error);
      reply.code(500).send({
        error: 'Failed to share project',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/share/:token
   * Load a shared project by token.
   */
  app.get('/:token', async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    try {
      const { token } = request.params;

      if (!token || typeof token !== 'string') {
        return reply.code(400).send({ error: 'Invalid token' });
      }

      const share = await storage.load(token);

      if (!share) {
        return reply.code(404).send({ error: 'Shared project not found' });
      }

      reply.send(share.projectData);
    } catch (error) {
      console.error('Error loading shared project:', error);
      reply.code(500).send({
        error: 'Failed to load shared project',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/share/:token/metadata
   * Get metadata for a shared project (without loading full data).
   */
  app.get(
    '/:token/metadata',
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      try {
        const { token } = request.params;

        if (!token || typeof token !== 'string') {
          return reply.code(400).send({ error: 'Invalid token' });
        }

        const share = await storage.load(token);

        if (!share) {
          return reply.code(404).send({ error: 'Shared project not found' });
        }

        const response: ShareMetadataResponse = {
          token,
          projectId: share.projectData.metadata.id,
          name: share.projectData.metadata.name,
          createdAt: share.createdAt,
          ...(share.expiresAt !== undefined && { expiresAt: share.expiresAt }),
        };

        reply.send(response);
      } catch (error) {
        console.error('Error loading shared project metadata:', error);
        reply.code(500).send({
          error: 'Failed to load shared project metadata',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * DELETE /api/share/:token
   * Revoke (delete) a share link.
   */
  app.delete(
    '/:token',
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      try {
        const { token } = request.params;

        if (!token || typeof token !== 'string') {
          return reply.code(400).send({ error: 'Invalid token' });
        }

        const deleted = await storage.delete(token);

        if (!deleted) {
          return reply.code(404).send({ error: 'Shared project not found' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Error revoking share:', error);
        reply.code(500).send({
          error: 'Failed to revoke share',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}

