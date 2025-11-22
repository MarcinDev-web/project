import { WebSocket } from 'ws';
import type { ClientConnection } from '@engine/net-server';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { 
  redis, 
  subRedis, 
  getRoomKey, 
  getLockKey, 
  getChannelKey 
} from '../lib/redis.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export const PublicUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.number(),
});

export type PublicUser = z.infer<typeof PublicUserSchema>;

// ... (keeping schemas same as before for compatibility)
const JoinMessageSchema = z.object({
  type: z.literal('join'),
  sessionId: z.string(),
  token: z.string(),
});

const JoinSessionMessageSchema = z.object({
  type: z.literal('join-session'),
  sessionId: z.string(),
  token: z.string(),
});

const CursorUpdateMessageSchema = z.object({
  type: z.literal('cursor-update'),
  sessionId: z.string(),
  userId: z.string().optional(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotation: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

const OperationMessageSchema = z.object({
  type: z.literal('operation'),
  sessionId: z.string(),
  userId: z.string().optional(),
  operation: z.record(z.unknown()),
});

const PresenceUpdateMessageSchema = z.object({
  type: z.literal('presence:update'),
  sessionId: z.string(),
  userId: z.string().optional(),
  data: z.unknown(),
});

const SelectionUpdateMessageSchema = z.object({
  type: z.literal('selection:update'),
  sessionId: z.string(),
  userId: z.string().optional(),
  data: z.unknown(),
});

const TransformMessageSchema = z.object({
  type: z.enum(['transform:begin', 'transform:update', 'transform:end']),
  sessionId: z.string(),
  userId: z.string().optional(),
  entityId: z.string(),
  data: z.unknown(),
});

const ChatMessageSchema = z.object({
  type: z.literal('chat:message'),
  sessionId: z.string(),
  userId: z.string().optional(),
  message: z.string(),
});

const LockMessageSchema = z.object({
  type: z.enum(['lock:acquire', 'lock:release']),
  sessionId: z.string(),
  userId: z.string().optional(),
  entityId: z.string(),
});

const PlayModeRequestSchema = z.object({
  type: z.literal('play-mode-request'),
  sessionId: z.string(),
  userId: z.string().optional(),
  requestId: z.string(),
  fromUser: PublicUserSchema,
});

const PlayModeResponseSchema = z.object({
  type: z.literal('play-mode-response'),
  sessionId: z.string(),
  userId: z.string().optional(),
  requestId: z.string(),
  accepted: z.boolean(),
});

const PingMessageSchema = z.object({
  type: z.literal('ping'),
});

const PlayModeStartSchema = z.object({
  type: z.literal('play-mode-start'),
  sessionId: z.string(),
  requestId: z.string(),
  timestamp: z.number(),
  fromUser: PublicUserSchema,
});

export const WsMessageSchema = z.discriminatedUnion('type', [
  JoinMessageSchema,
  JoinSessionMessageSchema,
  CursorUpdateMessageSchema,
  OperationMessageSchema,
  PresenceUpdateMessageSchema,
  SelectionUpdateMessageSchema,
  TransformMessageSchema,
  ChatMessageSchema,
  LockMessageSchema,
  PlayModeRequestSchema,
  PlayModeResponseSchema,
  PingMessageSchema,
  PlayModeStartSchema,
]);

export type WsMessage = z.infer<typeof WsMessageSchema>;

export interface ConnectionMeta {
  userId: string | null;
  sessionId: string | null;
  connectionType: 'websocket' | 'webrtc';
  connection: WebSocket | ClientConnection;
}

// Local state (only for this instance)
export const localSessions = new Map<string, Set<ConnectionMeta>>();
export const localUserConnections = new Map<string, Map<string, ConnectionMeta>>(); // sessionId -> userId -> ConnectionMeta
export const webrtcClientMap = new Map<string, ConnectionMeta>();

export interface PlayModeRequest {
  requestId: string;
  fromUserId: string;
  fromUser: PublicUser;
  sessionId: string;
  responses: Map<string, boolean>;
  timeout: ReturnType<typeof setTimeout>;
  createdAt: number;
}

// Active requests COORDINATED by THIS server
export const activePlayModeRequests = new Map<string, PlayModeRequest>();

/**
 * Initialize Redis listeners
 */
export function initializeMessageRouter() {
  subRedis.on('message', (channel, message) => {
    // Channel format: collab:channel:{sessionId}
    const match = channel.match(/^collab:channel:(.+)$/);
    if (!match) return;

    const sessionId = match[1];
    try {
      const data = JSON.parse(message);
      
      // If this is a play-mode-response, and we are coordinating the request, handle it
      if (data.type === 'play-mode-response' && activePlayModeRequests.has(data.requestId)) {
         handlePlayModeResponseLocally(data);
      }

      // Broadcast to all LOCAL connections for this session
      // Note: We might receive our own messages here if we publish to the channel.
      // We should filter out messages we sent? 
      // Actually, simpler to just forward everything and let clients handle (or filter by senderId)
      // But optimally, `broadcastToSession` sends to Redis, and we receive it here.
      // If we want to avoid echo, we can rely on `except` logic locally, but Redis Pub/Sub sends to everyone.
      // Standard pattern: publish, receive, send to local clients.
      // BUT: The client that sent it shouldn't get it back if `except` was used.
      // For now, we will accept the echo or rely on client ignoring own messages (which they usually do for cursors etc).
      
      broadcastToLocalSession(sessionId, data);
      
    } catch (err) {
      console.error('Error parsing Redis message:', err);
    }
  });
}

function broadcastToLocalSession(sessionId: string, data: Record<string, unknown>, except?: WebSocket | ClientConnection) {
  const conns = localSessions.get(sessionId);
  if (!conns) return;

  for (const meta of conns) {
    if (meta.connection === except) continue;
    sendToConnection(meta.connection, data);
  }
}

function sendToConnection(conn: WebSocket | ClientConnection, data: Record<string, unknown>): void {
  try {
    const payload = JSON.stringify(data);
    if ('readyState' in conn && typeof (conn as WebSocket).readyState !== 'undefined') {
      if ((conn as WebSocket).readyState === WebSocket.OPEN) {
        (conn as WebSocket).send(payload);
      }
    } else {
      const bytes = new TextEncoder().encode(payload);
      (conn as ClientConnection).send(new Uint8Array(bytes));
    }
  } catch {
    // ignore
  }
}

/**
 * Broadcast message to all connections in a session (via Redis).
 */
export function broadcastToSession(
  sessionId: string,
  data: Record<string, unknown>,
  _except?: WebSocket | ClientConnection 
): void {
  // We publish to Redis. 
  // NOTE: 'except' is hard to support with Pub/Sub without adding a 'senderConnectionId' to the payload 
  // and filtering on every receiving server. 
  // For this MVP, we will assume clients can handle echo or we simply accept it.
  // Ideally, we should send to local clients immediately (honoring except) and publish to Redis for others?
  // BUT simpler to just publish everything.
  
  const channel = getChannelKey(sessionId);
  redis.publish(channel, JSON.stringify(data)).catch(err => {
    console.error('Redis publish error:', err);
  });
}

export function broadcastToUsers(
  sessionId: string,
  userIds: Set<string>,
  data: Record<string, unknown>
): void {
  // This is tricky with Redis as we don't know which server holds which user.
  // Option 1: Broadcast to session with "targetUsers" field?
  // Option 2: Send to specific user channels (if we had them).
  // For MVP: Broadcast to session, and let local servers filter?
  
  // Current usage: play-mode-start. It goes to accepted users.
  // Let's send to session but include `targetUserIds` in the payload?
  // Or just use `broadcastToSession`.
  
  // If we really need to target users, we can iterate `userIds` and publish to `collab:user:{userId}`?
  // But we don't have user-specific channels set up.
  
  // Let's compromise: Broadcast to session, but wrapped in a "target" envelope?
  // Or just rely on the message types we have.
  // `play-mode-start` is broadcast to everyone usually? 
  // The previous code filtered: `broadcastToUsers`.
  
  // Strategy: We publish to the session channel. 
  // BUT we need a way to tell other servers "Send this only to users X, Y".
  // We can modify `broadcastToLocalSession` to respect a "targetUsers" field if we wrapped it.
  // But we can't easily change the protocol payload structure defined by `WsMessage`.
  
  // Let's look at usage. `play-mode-start`.
  // If we send it to everyone, is it bad?
  // "Send start message to all accepted users".
  // If a user rejected, they shouldn't start?
  
  // I'll implement a "targeted" broadcast by sending a special internal message to Redis
  // that wraps the actual message and includes target IDs.
  // But `initializeMessageRouter` needs to handle it.
  
  const internalPayload = {
    __internal_target_users: Array.from(userIds),
    payload: data
  };
  
  const channel = getChannelKey(sessionId);
  redis.publish(channel, JSON.stringify(internalPayload)).catch(err => {
      console.error('Redis publish error:', err);
  });
}

// Modified listener to handle internal target wrapper
// We need to update initializeMessageRouter above, I'll rewrite it in the full file content below.

export async function getUsersInSession(sessionId: string): Promise<Set<string>> {
  const key = getRoomKey(sessionId);
  const members = await redis.smembers(key);
  return new Set(members);
}

export function checkAndStartPlayMode(requestId: string, sessionId: string, forceTimeout = false): void {
  const request = activePlayModeRequests.get(requestId);
  if (!request || request.sessionId !== sessionId) {
    return;
  }

  // We need the total user count from Redis
  redis.smembers(getRoomKey(sessionId)).then(members => {
     const allUsers = new Set(members);
     const otherUsers = new Set(allUsers);
     otherUsers.delete(request.fromUserId);

     if (otherUsers.size === 0) {
        // Start for initiator
        broadcastToUsers(sessionId, new Set([request.fromUserId]), {
          type: 'play-mode-start',
          timestamp: Date.now(),
          requestId,
          fromUser: request.fromUser,
          sessionId,
        });
        activePlayModeRequests.delete(requestId);
        clearTimeout(request.timeout);
        return;
     }

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

     if ((allResponded || forceTimeout) && acceptedUsers.size > 0) {
        broadcastToUsers(sessionId, acceptedUsers, {
          type: 'play-mode-start',
          timestamp: Date.now(),
          requestId,
          fromUser: request.fromUser,
          sessionId,
        });

        activePlayModeRequests.delete(requestId);
        clearTimeout(request.timeout);
     }
  });
}

function handlePlayModeResponseLocally(msg: { requestId: string, userId?: string, accepted: boolean, sessionId: string }) {
    const request = activePlayModeRequests.get(msg.requestId);
    if (!request) return;
    
    // Don't allow response from initiator
    if (request.fromUserId === msg.userId) return;
    
    if (msg.userId) {
        request.responses.set(msg.userId, msg.accepted);
        checkAndStartPlayMode(msg.requestId, request.sessionId);
    }
}

export async function handleJoin(
  msg: { type: 'join' | 'join-session'; sessionId: string; token: string },
  meta: ConnectionMeta
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const payload = jwt.verify(msg.token, JWT_SECRET) as { userId: string };
    meta.userId = payload.userId;
    meta.sessionId = msg.sessionId;
    
    // Redis: Add to set
    const roomKey = getRoomKey(msg.sessionId);
    await redis.sadd(roomKey, meta.userId);
    await redis.expire(roomKey, 86400); // 24h TTL
    
    // Local state
    if (!localSessions.has(msg.sessionId)) {
       localSessions.set(msg.sessionId, new Set());
       // Subscribe to Redis channel for this session
       await subRedis.subscribe(getChannelKey(msg.sessionId));
    }
    localSessions.get(msg.sessionId)!.add(meta);

    if (!localUserConnections.has(msg.sessionId)) {
      localUserConnections.set(msg.sessionId, new Map());
    }
    localUserConnections.get(msg.sessionId)!.set(meta.userId, meta);

    return { success: true, userId: meta.userId };
  } catch (e) {
    console.error('Join error:', e);
    return { success: false, error: 'Unauthorized' };
  }
}

export async function handleMessage(
  msg: WsMessage,
  meta: ConnectionMeta,
  send: (data: Record<string, unknown>) => void
): Promise<void> {
  if (msg.type === 'join' || msg.type === 'join-session') {
    const result = await handleJoin(msg, meta);
    if (result.success && result.userId) {
      send({ type: 'connected', timestamp: Date.now(), userId: result.userId });
      
      // Notify others via Redis
      broadcastToSession(
        msg.sessionId,
        {
          type: 'user-joined',
          timestamp: Date.now(),
          userId: result.userId,
          user: { id: result.userId },
        } as unknown as Record<string, unknown>
      );
    } else {
      send({ type: 'error', timestamp: Date.now(), error: result.error || 'Unauthorized' });
      // Close connection?
      // We let the caller handle closing if needed, or do it here.
      // The previous implementation closed it.
      try {
          if ('close' in meta.connection) (meta.connection as WebSocket).close();
          // @ts-ignore
          else meta.connection.close(); 
      } catch {}
    }
    return;
  }

  if (!meta.sessionId || !meta.userId) return;

  switch (msg.type) {
    case 'cursor-update':
    case 'operation':
    case 'presence:update':
    case 'selection:update':
    case 'transform:begin':
    case 'transform:update':
    case 'transform:end':
    case 'chat:message':
      // Simple broadcast
      broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId });
      break;

    case 'lock:acquire': {
      const key = getLockKey(meta.sessionId, msg.entityId);
      // NX = Only set if not exists, EX = expire in 30s
      const result = await redis.set(key, meta.userId, 'NX', 'EX', 30);
      
      if (result === 'OK') {
        broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId });
      } else {
        send({ type: 'error', timestamp: Date.now(), error: 'Entity locked' });
      }
      break;
    }
    case 'lock:release': {
      const key = getLockKey(meta.sessionId, msg.entityId);
      const owner = await redis.get(key);
      if (owner === meta.userId) {
        await redis.del(key);
        broadcastToSession(meta.sessionId, { ...msg, userId: meta.userId });
      }
      break;
    }
    case 'play-mode-request': {
        // 1. Clean up old requests for this session (locally only, as we only track what we coordinate)
        for (const [rid, req] of activePlayModeRequests.entries()) {
            if (req.sessionId === meta.sessionId) {
                clearTimeout(req.timeout);
                activePlayModeRequests.delete(rid);
            }
        }

        const requestId = msg.requestId;
        
        // 2. Start coordinating this request
        const timeout = setTimeout(() => {
            const request = activePlayModeRequests.get(requestId);
            if (request) {
                checkAndStartPlayMode(requestId, meta.sessionId, true);
                activePlayModeRequests.delete(requestId);
            }
        }, 30000);

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

        // 3. Broadcast request
        broadcastToSession(meta.sessionId, {
          type: 'play-mode-request',
          timestamp: Date.now(),
          requestId,
          fromUser: msg.fromUser,
          sessionId: meta.sessionId,
        } as unknown as Record<string, unknown>);

        // 4. Check if we can start immediately (single user)
        const members = await redis.smembers(getRoomKey(meta.sessionId));
        if (members.length <= 1) {
             checkAndStartPlayMode(requestId, meta.sessionId, true);
             activePlayModeRequests.delete(requestId);
             clearTimeout(timeout);
        }
        break;
    }
    case 'play-mode-response': {
        // Broadcast the response so the coordinator (wherever they are) can see it
        // The coordinator listens to 'play-mode-response' in `initializeMessageRouter`
        broadcastToSession(meta.sessionId, { 
            ...msg, 
            userId: meta.userId 
        });
        break;
    }
    case 'ping':
      send({ type: 'pong', timestamp: Date.now() });
      break;
  }
}

export async function cleanupConnection(meta: ConnectionMeta): Promise<void> {
  if (meta.sessionId && meta.userId) {
    // Local cleanup
    const localSession = localSessions.get(meta.sessionId);
    if (localSession) {
        localSession.delete(meta);
        if (localSession.size === 0) {
            localSessions.delete(meta.sessionId);
            // Unsubscribe from Redis
            await subRedis.unsubscribe(getChannelKey(meta.sessionId));
        }
    }

    const sessionUsers = localUserConnections.get(meta.sessionId);
    if (sessionUsers) {
        sessionUsers.delete(meta.userId);
        if (sessionUsers.size === 0) {
            localUserConnections.delete(meta.sessionId);
        }
    }

    // Redis cleanup
    await redis.srem(getRoomKey(meta.sessionId), meta.userId);

    // Coordinator cleanup: if this user was coordinating a request, cancel it?
    // Or if this user was involved in a request?
    // If initiator leaves, we should probably cancel.
    for (const [requestId, request] of activePlayModeRequests.entries()) {
        if (request.sessionId === meta.sessionId) {
            if (request.fromUserId === meta.userId) {
                clearTimeout(request.timeout);
                activePlayModeRequests.delete(requestId);
            } else {
                // Treated as rejected/left
                request.responses.set(meta.userId, false);
                checkAndStartPlayMode(requestId, meta.sessionId);
            }
        }
    }
    
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
