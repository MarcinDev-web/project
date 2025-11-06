import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import {
  getCorsConfig,
  isOriginAllowed,
  describeAllowedOrigins,
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
} from '@shared/config/cors';
import { getPrismaClient, ensureSchema, disconnectPrisma } from './lib/db.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerSessionRoutes } from './routes/session.js';
import { createWsServer } from './ws/server.js';
import { createWebRTCServer, stopWebRTCServer } from './webrtc/server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const WEBRTC_SIGNALING_PORT = process.env.WEBRTC_SIGNALING_PORT
  ? parseInt(process.env.WEBRTC_SIGNALING_PORT, 10)
  : 8080;

async function main(): Promise<void> {
  const app = Fastify({ logger: true });
  const corsConfig = getCorsConfig();
  const allowedOriginsDescription = describeAllowedOrigins(corsConfig);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (isOriginAllowed(origin, corsConfig)) return cb(null, true);
      app.log.warn({ origin }, `Blocked CORS origin. Allowed: ${allowedOriginsDescription}`);
      cb(new Error('Not allowed'), false);
    },
    credentials: true,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    methods: CORS_ALLOWED_METHODS,
    maxAge: 86400,
  });

  await app.register(websocket);

  await ensureSchema();
  const prisma = await getPrismaClient();

  registerAuthRoutes(app, prisma);
  registerSessionRoutes(app, prisma);
  createWsServer(app, prisma, corsConfig);
  
  // Start WebRTC signaling server
  await createWebRTCServer(WEBRTC_SIGNALING_PORT);

  app.get('/health', () => ({ status: 'ok' }));

  // Graceful shutdown
  app.addHook('onClose', async () => {
    await stopWebRTCServer();
    await disconnectPrisma();
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
}

void main();
