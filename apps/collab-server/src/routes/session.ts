import type { FastifyInstance } from 'fastify';
import type { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
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

export function registerSessionRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.post('/session', async (req, reply) => {
    const auth = verifyJwtFromRequest(req);
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' });
    try {
      const body = createSessionSchema.parse(req.body);
      const sessionId = body.sessionId ?? randomUUID();

      // Create session and ensure membership in transaction
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.session.upsert({
          where: { id: sessionId },
          update: {},
          create: {
            id: sessionId,
            projectId: body.projectId,
            createdBy: auth.userId,
          },
        });

        // Ensure membership
        await tx.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: body.projectId,
              userId: auth.userId,
            },
          },
          update: {},
          create: {
            projectId: body.projectId,
            userId: auth.userId,
            role: 'editor',
          },
        });
      });

      return reply.send({ sessionId });
    } catch {
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

      await prisma.sceneSnapshot.create({
        data: {
          id: snapshotId,
          projectId: body.projectId,
          sessionId: body.sessionId,
          createdBy: auth.userId,
          payload: payloadBuffer,
        },
      });

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

  app.get<{ Querystring: { projectId?: string } }>('/load', async (req, reply) => {
    const auth = verifyJwtFromRequest(req);
    if (!auth) return reply.status(401).send({ error: 'Unauthorized' });
    try {
      const projectId = req.query.projectId ?? '';
      if (!projectId) return reply.status(400).send({ error: 'projectId required' });

      const snapshot = await prisma.sceneSnapshot.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { payload: true },
      });

      if (!snapshot) return reply.status(404).send({ error: 'Not found' });

      const payload = JSON.parse(Buffer.from(snapshot.payload).toString('utf-8')) as unknown;
      return reply.send({ payload });
    } catch {
      return reply.status(500).send({ error: 'Failed to load snapshot' });
    }
  });
}
