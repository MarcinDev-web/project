import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@engine/database';
import type { RawData, WebSocket } from 'ws';
import {
  type CorsConfig,
  isOriginAllowed,
  describeAllowedOrigins,
  getCorsConfig,
} from '@shared/config/cors';
import {
  handleMessage,
  cleanupConnection,
  type ConnectionMeta,
  type WsMessage,
  WsMessageSchema,
} from '../shared/messageRouter.js';
import { GameServerDiscovery } from '../services/GameServerDiscovery.js';

// Re-export for backward compatibility
export { broadcastToSession } from '../shared/messageRouter.js';

export function createWsServer(
  app: FastifyInstance,
  _prisma: PrismaClient,
  corsConfig?: CorsConfig
): void {
  const resolvedCorsConfig = corsConfig ?? getCorsConfig();
  const allowedOriginsDescription = describeAllowedOrigins(resolvedCorsConfig);
  
  // Initialize GameServerDiscovery
  const discovery = new GameServerDiscovery(process.env.REDIS_URL || 'redis://localhost:6379');

  // Endpoint to get available game server
  app.post('/api/matchmaking/find', async (_req, reply) => {
    const bestServer = await discovery.findBestServer();
    if (!bestServer) {
      return reply.status(503).send({ error: 'No game servers available' });
    }
    
    // Return server info and a temporary token (mocked for now)
    return {
      host: bestServer.host,
      port: bestServer.port,
      // wsUrl: `ws://${bestServer.host}:${bestServer.port}/ws`, // In prod use wss
      wsUrl: `ws://localhost:${bestServer.port}/ws`, // Localhost for dev
      token: 'mock-zone-token' // In real impl, generate JWT signed by shared secret
    };
  });

  // @fastify/websocket v11 handler signature: (socket, request)
  app.get('/ws', { websocket: true }, (socket, req) => {
    const ws = socket as unknown as WebSocket;
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (origin && !isOriginAllowed(origin, resolvedCorsConfig)) {
      req.log.warn({ origin }, `Blocked WebSocket origin. Allowed: ${allowedOriginsDescription}`);
      ws.close(1008, 'Origin not allowed');
      return;
    }
    const meta: ConnectionMeta = {
      userId: null,
      sessionId: null,
      connectionType: 'websocket',
      connection: ws,
    };

    ws.on('message', (raw: RawData) => {
      try {
        let text: string;
        if (typeof raw === 'string') {
          text = raw;
        } else if (Buffer.isBuffer(raw)) {
          text = raw.toString('utf-8');
        } else if (Array.isArray(raw)) {
          // Handle Buffer[] case
          text = Buffer.concat(raw).toString('utf-8');
        } else {
          // Handle ArrayBuffer or ArrayBufferView
          const buffer = raw as ArrayBuffer | ArrayBufferView;
          text = Buffer.from(buffer as ArrayBuffer).toString('utf-8');
        }
        const json = JSON.parse(text);
        const result = WsMessageSchema.safeParse(json);

        if (result.success) {
          handleWsMessage(ws, result.data);
        } else {
           // Optionally log validation errors in debug mode
           // console.debug('Invalid WS message structure:', result.error);
        }
      } catch {
        // ignore invalid
      }
    });

    ws.on('close', () => {
      cleanupConnection(meta);
    });

    function handleWsMessage(ws: WebSocket, msg: WsMessage): void {
      const send = (data: Record<string, unknown>): void => {
        try {
          ws.send(JSON.stringify(data));
        } catch {
          // ignore
        }
      };

      handleMessage(msg, meta, send);
    }
  });
}
