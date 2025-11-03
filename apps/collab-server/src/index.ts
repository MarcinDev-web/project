import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { getPrismaClient, ensureSchema, disconnectPrisma } from './lib/db.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerSessionRoutes } from './routes/session.js';
import { createWsServer } from './ws/server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed'), false);
    },
    credentials: true,
  });

  await app.register(websocket);

  await ensureSchema();
  const prisma = await getPrismaClient();

  registerAuthRoutes(app, prisma);
  registerSessionRoutes(app, prisma);
  createWsServer(app, prisma);

  app.get('/health', () => ({ status: 'ok' }));

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await disconnectPrisma();
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
}

void main();
