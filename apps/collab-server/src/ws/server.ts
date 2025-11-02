import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { RawData, WebSocket } from 'ws';

type PublicUser = {
  id: string;
  email: string;
  createdAt: number;
};

type WsMessage =
  | { type: 'join'; sessionId: string; token: string }
  | { type: 'join-session'; sessionId: string; token: string }
  | { type: 'cursor-update'; sessionId: string; userId?: string; position: [number, number, number]; rotation?: [number, number, number, number] }
  | { type: 'operation'; sessionId: string; userId?: string; operation: Record<string, unknown> }
  | { type: 'presence:update'; sessionId: string; userId?: string; data: unknown }
  | { type: 'selection:update'; sessionId: string; userId?: string; data: unknown }
  | { type: 'transform:begin' | 'transform:update' | 'transform:end'; sessionId: string; userId?: string; entityId: string; data: unknown }
  | { type: 'chat:message'; sessionId: string; userId?: string; message: string }
  | { type: 'lock:acquire' | 'lock:release'; sessionId: string; userId?: string; entityId: string }
  | { type: 'play-mode-request'; sessionId: string; userId?: string; requestId: string; fromUser: PublicUser }
  | { type: 'play-mode-response'; sessionId: string; userId?: string; requestId: string; accepted: boolean }
  | { type: 'ping' };

interface ConnectionMeta {
  userId: string | null;
  sessionId: string | null;
}

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
import jwt from 'jsonwebtoken';

const rooms = new Map<string, Set<WebSocket>>();
const locks = new Map<string, string>(); // key: `${sessionId}:${entityId}` -> userId

// Map to store userId -> WebSocket for each session (for selective broadcasting)
const userSessions = new Map<string, Map<string, WebSocket>>(); // sessionId -> userId -> WebSocket

interface PlayModeRequest {
  requestId: string;
  fromUserId: string;
  fromUser: PublicUser;
  sessionId: string;
  responses: Map<string, boolean>; // userId -> accepted
  timeout: ReturnType<typeof setTimeout>;
  createdAt: number;
}

const activePlayModeRequests = new Map<string, PlayModeRequest>(); // requestId -> PlayModeRequest

export function broadcastToSession(sessionId: string, data: Record<string, unknown>, except?: WebSocket): void {
  const conns = rooms.get(sessionId);
  if (!conns) return;
  const payload = JSON.stringify(data);
  for (const ws of conns) {
    if (ws === except) continue;
    try {
      ws.send(payload);
    } catch {
      // ignore
    }
  }
}

/**
 * Broadcast message to specific users in a session.
 */
function broadcastToUsers(sessionId: string, userIds: Set<string>, data: Record<string, unknown>): void {
  const sessionUsers = userSessions.get(sessionId);
  if (!sessionUsers) return;
  const payload = JSON.stringify(data);
  for (const userId of userIds) {
    const ws = sessionUsers.get(userId);
    if (ws) {
      try {
        ws.send(payload);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Get all user IDs in a session.
 */
function getUsersInSession(sessionId: string): Set<string> {
  const sessionUsers = userSessions.get(sessionId);
  if (!sessionUsers) return new Set();
  return new Set(sessionUsers.keys());
}

/**
 * Check if all users responded and start Play Mode if ready.
 */
function checkAndStartPlayMode(requestId: string, sessionId: string, forceTimeout = false): void {
  const request = activePlayModeRequests.get(requestId);
  if (!request || request.sessionId !== sessionId) {
    return;
  }
  
  const allUsers = getUsersInSession(sessionId);
  const otherUsers = new Set(allUsers);
  otherUsers.delete(request.fromUserId); // Remove initiator
  
  // If no other users, start immediately (initiator only)
  if (otherUsers.size === 0) {
    // Start for initiator only
    const initiatorWs = userSessions.get(sessionId)?.get(request.fromUserId);
    if (initiatorWs) {
      try {
        initiatorWs.send(JSON.stringify({
          type: 'play-mode-start',
          timestamp: Date.now(),
          requestId,
          fromUser: request.fromUser,
          sessionId,
        }));
      } catch {
        // ignore
      }
    }
    activePlayModeRequests.delete(requestId);
    clearTimeout(request.timeout);
    return;
  }
  
  // Collect accepted users (initiator is always accepted)
  const acceptedUsers = new Set<string>([request.fromUserId]);
  
  let allResponded = true;
  for (const userId of otherUsers) {
    const response = request.responses.get(userId);
    if (response === undefined) {
      allResponded = false;
    } else if (response === true) {
      acceptedUsers.add(userId);
    }
  }
  
  // Start if:
  // 1. All users responded (forceTimeout = false), OR
  // 2. Force timeout (forceTimeout = true) and at least someone accepted
  if ((allResponded || forceTimeout) && acceptedUsers.size > 0) {
    // Send start message to all accepted users
    broadcastToUsers(sessionId, acceptedUsers, {
      type: 'play-mode-start',
      timestamp: Date.now(),
      requestId,
      fromUser: request.fromUser,
      sessionId,
    });
    
    // Cleanup
    activePlayModeRequests.delete(requestId);
    clearTimeout(request.timeout);
  }
}

export function createWsServer(app: FastifyInstance, _pool: Pool): void {

  // @fastify/websocket v11 handler signature: (socket, request)
  app.get('/ws', { websocket: true }, (socket /*, req */) => {
    const ws = socket as unknown as WebSocket;
    const meta: ConnectionMeta = { userId: null, sessionId: null };

    ws.on('message', (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString('utf-8')) as WsMessage;
        handleMessage(ws, msg);
      } catch {
        // ignore invalid
      }
    });

    ws.on('close', () => {
      if (meta.sessionId && rooms.has(meta.sessionId)) {
        rooms.get(meta.sessionId)!.delete(ws);
        
        // Remove from userSessions
        if (meta.userId && userSessions.has(meta.sessionId)) {
          userSessions.get(meta.sessionId)!.delete(meta.userId);
        }
        
        // Cleanup any active Play Mode requests where this user was involved
        if (meta.sessionId) {
          for (const [requestId, request] of activePlayModeRequests.entries()) {
            if (request.sessionId === meta.sessionId) {
              // If the initiator disconnected, cancel the request
              if (request.fromUserId === meta.userId) {
                clearTimeout(request.timeout);
                activePlayModeRequests.delete(requestId);
              } else {
                // If a responder disconnected, treat as rejected
                request.responses.set(meta.userId || '', false);
                checkAndStartPlayMode(requestId, meta.sessionId);
              }
            }
          }
        }
        
        // Broadcast user-left
        broadcastToSession(meta.sessionId, {
          type: 'user-left',
          timestamp: Date.now(),
          userId: meta.userId,
        } as unknown as Record<string, unknown>);
      }
    });

    function handleMessage(ws: WebSocket, msg: WsMessage): void {
      if (msg.type === 'join' || msg.type === 'join-session') {
        try {
          const payload = jwt.verify(msg.token, JWT_SECRET) as { userId: string };
          meta.userId = payload.userId;
          meta.sessionId = msg.sessionId;
          if (!rooms.has(msg.sessionId)) rooms.set(msg.sessionId, new Set());
          rooms.get(msg.sessionId)!.add(ws);
          
          // Track userId -> WebSocket mapping for this session
          if (!userSessions.has(msg.sessionId)) {
            userSessions.set(msg.sessionId, new Map());
          }
          userSessions.get(msg.sessionId)!.set(meta.userId, ws);
          
          // Acknowledge
          send(ws, { type: 'connected', timestamp: Date.now(), userId: meta.userId });
          // Notify others
          broadcastToSession(msg.sessionId, {
            type: 'user-joined',
            timestamp: Date.now(),
            userId: meta.userId,
            user: { id: meta.userId },
          } as unknown as Record<string, unknown>, ws);
        } catch {
          send(ws, { type: 'error', timestamp: Date.now(), error: 'Unauthorized' });
          ws.close();
        }
        return;
      }

      // Require join
      if (!meta.sessionId || !meta.userId) return;

      switch (msg.type) {
        case 'cursor-update':
          broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId });
          break;
        case 'operation':
          broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId });
          break;
        case 'presence:update':
        case 'selection:update':
          broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId });
          break;
        case 'transform:begin':
        case 'transform:update':
        case 'transform:end':
          broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId });
          break;
        case 'chat:message':
          broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId });
          break;
        case 'lock:acquire': {
          const key = `${meta.sessionId}:${msg.entityId}`;
          if (!locks.has(key)) {
            locks.set(key, meta.userId);
            broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId });
          } else {
            send(ws, { type: 'error', timestamp: Date.now(), error: 'Entity locked' });
          }
          break;
        }
        case 'lock:release': {
          const key = `${meta.sessionId}:${msg.entityId}`;
          if (locks.get(key) === meta.userId) {
            locks.delete(key);
            broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId });
          }
          break;
        }
        case 'play-mode-request': {
          // Cancel any existing pending request for this session
          for (const [requestId, req] of activePlayModeRequests.entries()) {
            if (req.sessionId === meta.sessionId) {
              clearTimeout(req.timeout);
              activePlayModeRequests.delete(requestId);
            }
          }
          
          // Create new Play Mode request
          const requestId = msg.requestId;
          const timeout = setTimeout(() => {
            const request = activePlayModeRequests.get(requestId);
            if (request && meta.sessionId) {
              // Timeout: start Play Mode for accepted users only
              checkAndStartPlayMode(requestId, meta.sessionId, true);
              activePlayModeRequests.delete(requestId);
            }
          }, 30000); // 30 seconds
          
          const request: PlayModeRequest = {
            requestId,
            fromUserId: meta.userId,
            fromUser: msg.fromUser,
            sessionId: meta.sessionId,
            responses: new Map(),
            timeout,
            createdAt: Date.now(),
          };
          
          activePlayModeRequests.set(requestId, request);
          
          // Broadcast request to all other users in session
          broadcastToSession(meta.sessionId, {
            type: 'play-mode-request',
            timestamp: Date.now(),
            requestId,
            fromUser: msg.fromUser,
            sessionId: meta.sessionId,
          } as unknown as Record<string, unknown>, ws);
          
          // Check if there are any other users to wait for
          const allUsers = getUsersInSession(meta.sessionId);
          if (allUsers.size <= 1) {
            // Only initiator in session, start immediately
            checkAndStartPlayMode(requestId, meta.sessionId, true);
            activePlayModeRequests.delete(requestId);
            clearTimeout(timeout);
          }
          break;
        }
        case 'play-mode-response': {
          const request = activePlayModeRequests.get(msg.requestId);
          if (!request) {
            // Request doesn't exist or already processed
            break;
          }
          
          // Don't allow response from initiator (they're auto-accepted)
          if (msg.userId === request.fromUserId) {
            break;
          }
          
          // Update response (allow overwriting previous response)
          request.responses.set(msg.userId || '', msg.accepted);
          
          // Check if we should start Play Mode
          checkAndStartPlayMode(msg.requestId, meta.sessionId);
          break;
        }
        case 'ping':
          send(ws, { type: 'pong', timestamp: Date.now() });
          break;
        default:
          // ignore
          break;
      }
    }

    function send(ws: WebSocket, data: unknown): void {
      try {
        ws.send(JSON.stringify(data));
      } catch {
        // ignore
      }
    }

  });
}


