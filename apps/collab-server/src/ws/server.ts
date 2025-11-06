import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
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
} from '../shared/messageRouter.js';

// Re-export for backward compatibility
export { broadcastToSession } from '../shared/messageRouter.js';

export function createWsServer(
  app: FastifyInstance,
  _prisma: PrismaClient,
  corsConfig?: CorsConfig
): void {
  const resolvedCorsConfig = corsConfig ?? getCorsConfig();
  const allowedOriginsDescription = describeAllowedOrigins(resolvedCorsConfig);
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
        const msg = JSON.parse(text) as WsMessage;
        handleWsMessage(ws, msg);
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
