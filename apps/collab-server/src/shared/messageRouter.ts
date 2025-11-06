import { WebSocket } from 'ws';
import type { ClientConnection } from '@engine/net-server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export type PublicUser = {
  id: string;
  email: string;
  createdAt: number;
};

export type WsMessage =
  | { type: 'join'; sessionId: string; token: string }
  | { type: 'join-session'; sessionId: string; token: string }
  | {
      type: 'cursor-update';
      sessionId: string;
      userId?: string;
      position: [number, number, number];
      rotation?: [number, number, number, number];
    }
  | { type: 'operation'; sessionId: string; userId?: string; operation: Record<string, unknown> }
  | { type: 'presence:update'; sessionId: string; userId?: string; data: unknown }
  | { type: 'selection:update'; sessionId: string; userId?: string; data: unknown }
  | {
      type: 'transform:begin' | 'transform:update' | 'transform:end';
      sessionId: string;
      userId?: string;
      entityId: string;
      data: unknown;
    }
  | { type: 'chat:message'; sessionId: string; userId?: string; message: string }
  | { type: 'lock:acquire' | 'lock:release'; sessionId: string; userId?: string; entityId: string }
  | {
      type: 'play-mode-request';
      sessionId: string;
      userId?: string;
      requestId: string;
      fromUser: PublicUser;
    }
  | {
      type: 'play-mode-response';
      sessionId: string;
      userId?: string;
      requestId: string;
      accepted: boolean;
    }
  | { type: 'ping' };

export interface ConnectionMeta {
  userId: string | null;
  sessionId: string | null;
  connectionType: 'websocket' | 'webrtc';
  connection: WebSocket | ClientConnection;
}

// Shared state for all connection types
export const rooms = new Map<string, Set<WebSocket | ClientConnection>>();
export const locks = new Map<string, string>(); // key: `${sessionId}:${entityId}` -> userId
export const userSessions = new Map<string, Map<string, WebSocket | ClientConnection>>(); // sessionId -> userId -> Connection
export const webrtcClientMap = new Map<string, ConnectionMeta>(); // clientId -> ConnectionMeta

export interface PlayModeRequest {
  requestId: string;
  fromUserId: string;
  fromUser: PublicUser;
  sessionId: string;
  responses: Map<string, boolean>; // userId -> accepted
  timeout: ReturnType<typeof setTimeout>;
  createdAt: number;
}

export const activePlayModeRequests = new Map<string, PlayModeRequest>(); // requestId -> PlayModeRequest

/**
 * Send message to a connection (WebSocket or WebRTC).
 */
function sendToConnection(conn: WebSocket | ClientConnection, data: Record<string, unknown>): void {
  try {
    const payload = JSON.stringify(data);
    // Check if it's a WebSocket (has readyState property)
    if ('readyState' in conn && typeof (conn as WebSocket).readyState !== 'undefined') {
      // WebSocket - send string directly
      (conn as WebSocket).send(payload);
    } else {
      // ClientConnection (WebRTC) - send as Uint8Array
      const bytes = new TextEncoder().encode(payload);
      (conn as ClientConnection).send(new Uint8Array(bytes));
    }
  } catch {
    // ignore
  }
}

/**
 * Broadcast message to all connections in a session.
 */
export function broadcastToSession(
  sessionId: string,
  data: Record<string, unknown>,
  except?: WebSocket | ClientConnection
): void {
  const conns = rooms.get(sessionId);
  if (!conns) return;
  
  for (const conn of conns) {
    if (conn === except) continue;
    sendToConnection(conn, data);
  }
}

/**
 * Broadcast message to specific users in a session.
 */
export function broadcastToUsers(
  sessionId: string,
  userIds: Set<string>,
  data: Record<string, unknown>
): void {
  const sessionUsers = userSessions.get(sessionId);
  if (!sessionUsers) return;
  
  for (const userId of userIds) {
    const conn = sessionUsers.get(userId);
    if (conn) {
      sendToConnection(conn, data);
    }
  }
}

/**
 * Get all user IDs in a session.
 */
export function getUsersInSession(sessionId: string): Set<string> {
  const sessionUsers = userSessions.get(sessionId);
  if (!sessionUsers) return new Set();
  return new Set(sessionUsers.keys());
}

/**
 * Check if all users responded and start Play Mode if ready.
 */
export function checkAndStartPlayMode(requestId: string, sessionId: string, forceTimeout = false): void {
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
    const initiatorConn = userSessions.get(sessionId)?.get(request.fromUserId);
    if (initiatorConn) {
      sendToConnection(initiatorConn, {
        type: 'play-mode-start',
        timestamp: Date.now(),
        requestId,
        fromUser: request.fromUser,
        sessionId,
      });
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

/**
 * Handle join message and authenticate user.
 */
export function handleJoin(
  msg: { type: 'join' | 'join-session'; sessionId: string; token: string },
  meta: ConnectionMeta
): { success: boolean; userId?: string; error?: string } {
  try {
    const payload = jwt.verify(msg.token, JWT_SECRET) as { userId: string };
    meta.userId = payload.userId;
    meta.sessionId = msg.sessionId;
    
    if (!rooms.has(msg.sessionId)) {
      rooms.set(msg.sessionId, new Set());
    }
    rooms.get(msg.sessionId)!.add(meta.connection);

    // Track userId -> Connection mapping for this session
    if (!userSessions.has(msg.sessionId)) {
      userSessions.set(msg.sessionId, new Map());
    }
    userSessions.get(msg.sessionId)!.set(meta.userId, meta.connection);

    return { success: true, userId: meta.userId };
  } catch {
    return { success: false, error: 'Unauthorized' };
  }
}

/**
 * Handle incoming message from any connection type.
 */
export function handleMessage(
  msg: WsMessage,
  meta: ConnectionMeta,
  send: (data: Record<string, unknown>) => void
): void {
  if (msg.type === 'join' || msg.type === 'join-session') {
    const result = handleJoin(msg, meta);
    if (result.success && result.userId) {
      // Acknowledge
      send({ type: 'connected', timestamp: Date.now(), userId: result.userId });
      // Notify others
      broadcastToSession(
        msg.sessionId,
        {
          type: 'user-joined',
          timestamp: Date.now(),
          userId: result.userId,
          user: { id: result.userId },
        } as unknown as Record<string, unknown>,
        meta.connection
      );
    } else {
      send({ type: 'error', timestamp: Date.now(), error: result.error || 'Unauthorized' });
      if (meta.connection instanceof WebSocket) {
        meta.connection.close();
      } else {
        meta.connection.close();
      }
    }
    return;
  }

  // Require join
  if (!meta.sessionId || !meta.userId) return;

  switch (msg.type) {
    case 'cursor-update':
      broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId }, meta.connection);
      break;
    case 'operation':
      broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId }, meta.connection);
      break;
    case 'presence:update':
    case 'selection:update':
      broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId }, meta.connection);
      break;
    case 'transform:begin':
    case 'transform:update':
    case 'transform:end':
      broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId }, meta.connection);
      break;
    case 'chat:message':
      broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId }, meta.connection);
      break;
    case 'lock:acquire': {
      const key = `${meta.sessionId}:${msg.entityId}`;
      if (!locks.has(key)) {
        locks.set(key, meta.userId);
        broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId }, meta.connection);
      } else {
        send({ type: 'error', timestamp: Date.now(), error: 'Entity locked' });
      }
      break;
    }
    case 'lock:release': {
      const key = `${meta.sessionId}:${msg.entityId}`;
      if (locks.get(key) === meta.userId) {
        locks.delete(key);
        broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId }, meta.connection);
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
      broadcastToSession(
        meta.sessionId,
        {
          type: 'play-mode-request',
          timestamp: Date.now(),
          requestId,
          fromUser: msg.fromUser,
          sessionId: meta.sessionId,
        } as unknown as Record<string, unknown>,
        meta.connection
      );

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
      if (meta.userId === request.fromUserId) {
        break;
      }

      // Update response (allow overwriting previous response)
      request.responses.set(meta.userId || '', msg.accepted);

      // Check if we should start Play Mode
      checkAndStartPlayMode(msg.requestId, meta.sessionId);
      break;
    }
    case 'ping':
      send({ type: 'pong', timestamp: Date.now() });
      break;
    default:
      // ignore
      break;
  }
}

/**
 * Cleanup connection on disconnect.
 */
export function cleanupConnection(meta: ConnectionMeta): void {
  if (meta.sessionId && rooms.has(meta.sessionId)) {
    rooms.get(meta.sessionId)!.delete(meta.connection);

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
    broadcastToSession(
      meta.sessionId,
      {
        type: 'user-left',
        timestamp: Date.now(),
        userId: meta.userId,
      } as unknown as Record<string, unknown>
    );
  }
}

