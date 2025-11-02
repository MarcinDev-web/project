import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { verifyJwtFromRequest } from './auth.js';
import { broadcastToSession } from '../ws/server.js';

const createSessionSchema = z.object({
  projectId: z.string().min(1),
  sessionId: z.string().optional(),
});

const saveSchema = z.object({
  projectId: z.string().min(1),
  sessionId: z.string().min(1),
  payload: z.any(),
});

export function registerSessionRoutes(app: FastifyInstance, pool: Pool): void {
  app.post('/session', async (req, reply) => {
    const auth = verifyJwtFromRequest(req);
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' });
    try {
      const body = createSessionSchema.parse(req.body);
      const sessionId = body.sessionId ?? randomUUID();
      await pool.query(
        'INSERT INTO sessions (id, project_id, created_by) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [sessionId, body.projectId, auth.userId]
      );
      // Ensure membership
      await pool.query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [body.projectId, auth.userId, 'editor']
      );
      return reply.send({ sessionId });
    } catch (err) {
      return reply.status(400).send({ error: 'Invalid request' });
    }
  });

  app.post('/save', async (req, reply) => {
    const auth = verifyJwtFromRequest(req);
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' });
    try {
      const body = saveSchema.parse(req.body);
      const snapshotId = randomUUID();
      const payloadBuffer = Buffer.from(JSON.stringify(body.payload), 'utf-8');
      await pool.query(
        'INSERT INTO scene_snapshots (id, project_id, session_id, created_by, payload) VALUES ($1, $2, $3, $4, $5)',
        [snapshotId, body.projectId, body.sessionId, auth.userId, payloadBuffer]
      );
      // Notify collaborators in session
      broadcastToSession(body.sessionId, {
        type: 'checkpoint:saved',
        timestamp: Date.now(),
        snapshotId,
        projectId: body.projectId,
        sessionId: body.sessionId,
        userId: auth.userId,
      });
      return reply.send({ snapshotId });
    } catch {
      return reply.status(400).send({ error: 'Invalid request' });
    }
  });

  app.get('/load', async (req, reply) => {
    const auth = verifyJwtFromRequest(req);
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' });
    try {
      const q = req.query as { projectId?: string };
      const projectId = q.projectId ?? '';
      if (!projectId) return reply.status(400).send({ error: 'projectId required' });
      const { rows } = await pool.query(
        'SELECT payload FROM scene_snapshots WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1',
        [projectId]
      );
      if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
      const payload = JSON.parse(Buffer.from(rows[0].payload).toString('utf-8')) as unknown;
      return reply.send({ payload });
    } catch {
      return reply.status(500).send({ error: 'Failed to load snapshot' });
    }
  });
}


