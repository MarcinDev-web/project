/**
 * WebSocket message types for real-time collaboration.
 */

import type { PublicUser } from './auth.js';

/**
 * Re-export PublicUser for convenience.
 */
export type { PublicUser };

/**
 * WebSocket message types.
 */
export type WebSocketMessageType =
  | 'join-session'
  | 'leave-session'
  | 'operation'
  | 'snapshot'
  | 'player-update'
  | 'input' // Input events for gameplay
  | 'physics-state' // Physics state synchronization
  | 'cursor-update'
  | 'user-joined'
  | 'user-left'
  | 'error'
  | 'ping'
  | 'pong'
  | 'message:new'
  | 'message:read'
  | 'message:typing'
  | 'presence:online'
  | 'presence:offline'
  | 'notification:new'
  | 'forum:thread:new'
  | 'forum:thread:updated'
  | 'forum:thread:deleted'
  | 'forum:post:new'
  | 'forum:post:updated'
  | 'forum:post:deleted'
  | 'forum:reaction:new'
  | 'forum:reaction:removed'
  | 'forum:vote:changed'
  | 'auth:refresh'
  | 'auth:refresh-success';

/**
 * Base WebSocket message structure.
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  timestamp: number;
  sessionId?: string;
  userId?: string;
}

/**
 * Join session message (client -> server).
 */
export interface JoinSessionMessage extends WebSocketMessage {
  type: 'join-session';
  sessionId: string;
  token: string; // JWT token for authentication
}

/**
 * Leave session message (client -> server).
 */
export interface LeaveSessionMessage extends WebSocketMessage {
  type: 'leave-session';
  sessionId: string;
}

/**
 * Operation message (bidirectional).
 * Represents a scene operation (edit or gameplay action).
 */
export interface OperationMessage extends WebSocketMessage {
  type: 'operation';
  operation: Operation;
}

/**
 * Snapshot message (server -> client).
 * Full scene state for initial sync or recovery.
 */
export interface SnapshotMessage extends WebSocketMessage {
  type: 'snapshot';
  snapshot: SceneSnapshot;
}

/**
 * Player update message (client -> server, server -> clients).
 * Position and state of a player in gameplay mode.
 */
export interface PlayerUpdateMessage extends WebSocketMessage {
  type: 'player-update';
  playerId: string;
  position: [number, number, number];
  rotation?: [number, number, number, number]; // quaternion
  velocity?: [number, number, number];
  state?: Record<string, unknown>; // Additional player state
}

/**
 * Input message (bidirectional).
 * Player input events for gameplay replication.
 */
export interface InputMessage extends WebSocketMessage {
  type: 'input';
  sequence: number; // Sequence number for ordering
  inputType: 'move' | 'jump' | 'sprint' | 'sprint-end';
  moveDirection?: [number, number]; // [forward, right] normalized
  cameraForward?: [number, number, number];
  cameraRight?: [number, number, number];
  actorId?: string;
  intentSignature?: string;
  intentDeltaMs?: number;
}

/**
 * Physics state message (bidirectional).
 * Synchronization of dynamic rigid body states.
 */
export interface PhysicsStateMessage extends WebSocketMessage {
  type: 'physics-state';
  frameNumber: number; // Frame number for deterministic simulation
  bodies: RigidBodyState[];
}

/**
 * Rigid body state for physics synchronization.
 */
export interface RigidBodyState {
  entityId: string;
  position: [number, number, number];
  rotation: [number, number, number, number]; // quaternion
  velocity?: [number, number, number];
  angularVelocity?: [number, number, number];
  timestamp: number;
}

/**
 * Cursor update message (client -> server, server -> clients).
 * Camera/cursor position of another user (for visual indicators).
 */
export interface CursorUpdateMessage extends WebSocketMessage {
  type: 'cursor-update';
  position: [number, number, number];
  rotation?: [number, number, number, number]; // camera rotation
}

/**
 * User joined notification (server -> clients).
 */
export interface UserJoinedMessage extends WebSocketMessage {
  type: 'user-joined';
  user: PublicUser;
}

/**
 * User left notification (server -> clients).
 */
export interface UserLeftMessage extends WebSocketMessage {
  type: 'user-left';
  userId: string;
}

/**
 * Error message (server -> client).
 */
export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  error: string;
  code?: string;
}

/**
 * Ping message (server -> client, client -> server).
 */
export interface PingMessage extends WebSocketMessage {
  type: 'ping';
}

/**
 * Pong message (response to ping).
 */
export interface PongMessage extends WebSocketMessage {
  type: 'pong';
}

/**
 * New message notification (server -> client).
 */
export interface MessageNewMessage extends WebSocketMessage {
  type: 'message:new';
  message: {
    id: string;
    conversationId: string;
    fromUserId: string;
    toUserId: string;
    content: string;
    read: boolean;
    createdAt: number;
  };
}

/**
 * Message read notification (server -> client).
 */
export interface MessageReadMessage extends WebSocketMessage {
  type: 'message:read';
  messageId: string;
  conversationId: string;
  userId: string;
}

/**
 * Typing indicator (bidirectional).
 */
export interface MessageTypingMessage extends WebSocketMessage {
  type: 'message:typing';
  conversationId: string;
  userId: string;
  typing: boolean; // true = started typing, false = stopped typing
}

/**
 * Presence online notification (server -> client).
 */
export interface PresenceOnlineMessage extends WebSocketMessage {
  type: 'presence:online';
  userId: string;
}

/**
 * Presence offline notification (server -> client).
 */
export interface PresenceOfflineMessage extends WebSocketMessage {
  type: 'presence:offline';
  userId: string;
}

/**
 * New notification (server -> client).
 */
export interface NotificationNewMessage extends WebSocketMessage {
  type: 'notification:new';
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    createdAt: number;
    link?: string;
  };
}

/**
 * Scene operation types.
 */
export type OperationType =
  | 'entity-create'
  | 'entity-delete'
  | 'transform-update'
  | 'component-update'
  | 'selection-change';

/**
 * Base operation structure.
 */
export interface Operation {
  id: string; // Unique operation ID
  type: OperationType;
  entityId?: string;
  timestamp: number;
  userId: string;
  data: Record<string, unknown>; // Operation-specific data
}

/**
 * Scene snapshot structure.
 */
export interface SceneSnapshot {
  sceneData: unknown; // SceneData from @engine/world
  timestamp: number;
  version: number; // Incremental version for conflict resolution
}

/**
 * New forum thread notification (server -> client).
 */
export interface ForumThreadNewMessage extends WebSocketMessage {
  type: 'forum:thread:new';
  thread: {
    id: string;
    categoryId: string;
    authorId: string;
    title: string;
    content: string;
    postCount: number;
    lastPostAt: number;
    lastPostBy: string;
    isPinned: boolean;
    isLocked: boolean;
    createdAt: number;
    updatedAt: number;
    score: number;
    upvotes: number;
    downvotes: number;
    tags: string[];
  };
  categoryId: string;
}

/**
 * Forum thread updated notification (server -> client).
 */
export interface ForumThreadUpdatedMessage extends WebSocketMessage {
  type: 'forum:thread:updated';
  thread: {
    id: string;
    categoryId: string;
    title?: string;
    content?: string;
    tags?: string[];
    isPinned?: boolean;
    isLocked?: boolean;
    updatedAt: number;
  };
}

/**
 * Forum thread deleted notification (server -> client).
 */
export interface ForumThreadDeletedMessage extends WebSocketMessage {
  type: 'forum:thread:deleted';
  threadId: string;
  categoryId: string;
}

/**
 * New forum post notification (server -> client).
 */
export interface ForumPostNewMessage extends WebSocketMessage {
  type: 'forum:post:new';
  post: {
    id: string;
    threadId: string;
    authorId: string;
    content: string;
    reactions: Array<{ emoji: string; userId: string; createdAt: number }>;
    mentions: string[];
    createdAt: number;
  };
  threadId: string;
}

/**
 * Forum post updated notification (server -> client).
 */
export interface ForumPostUpdatedMessage extends WebSocketMessage {
  type: 'forum:post:updated';
  post: {
    id: string;
    threadId: string;
    content: string;
    editedAt: number;
  };
}

/**
 * Forum post deleted notification (server -> client).
 */
export interface ForumPostDeletedMessage extends WebSocketMessage {
  type: 'forum:post:deleted';
  postId: string;
  threadId: string;
}

/**
 * Forum reaction added notification (server -> client).
 */
export interface ForumReactionNewMessage extends WebSocketMessage {
  type: 'forum:reaction:new';
  threadId?: string;
  postId?: string;
  reaction: {
    emoji: string;
    userId: string;
    createdAt: number;
  };
}

/**
 * Forum reaction removed notification (server -> client).
 */
export interface ForumReactionRemovedMessage extends WebSocketMessage {
  type: 'forum:reaction:removed';
  threadId?: string;
  postId?: string;
  emoji: string;
  userId: string;
}

/**
 * Forum vote changed notification (server -> client).
 */
export interface ForumVoteChangedMessage extends WebSocketMessage {
  type: 'forum:vote:changed';
  threadId?: string;
  postId?: string;
  score: number;
  upvotes: number;
  downvotes: number;
}

/**
 * Auth refresh message (client -> server).
 */
export interface AuthRefreshMessage extends WebSocketMessage {
  type: 'auth:refresh';
  token: string;
}

/**
 * Auth refresh success message (server -> client).
 */
export interface AuthRefreshSuccessMessage extends WebSocketMessage {
  type: 'auth:refresh-success';
}

/**
 * Collaboration session data.
 */
export interface CollaborationSession {
  id: string;
  projectId: string;
  ownerId: string;
  createdAt: number;
  users: Map<string, PublicUser>; // userId -> user
  maxPlayers?: number;
  allowJoinInProgress?: boolean;
}
