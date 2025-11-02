/**
 * Types for real-time replication and collaboration.
 * Compatible with server-side WebSocket message types.
 */

/**
 * WebSocket message types (client-side).
 */
export type WebSocketMessageType =
  | 'join-session'
  | 'leave-session'
  | 'operation'
  | 'snapshot'
  | 'player-update'
  | 'cursor-update'
  | 'input' // Input events for gameplay
  | 'physics-state' // Physics state synchronization
  | 'user-joined'
  | 'user-left'
  | 'error'
  | 'ping'
  | 'pong'
  | 'connected'
  | 'play-mode-request' // Play Mode synchronization request
  | 'play-mode-response' // Response to Play Mode request
  | 'play-mode-start' // Start Play Mode for accepted users
  | 'play-mode-end'; // Notification of user exiting Play Mode

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
 * Player update message (bidirectional).
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
 * User joined notification (server -> client).
 */
export interface UserJoinedMessage extends WebSocketMessage {
  type: 'user-joined';
  user: PublicUser;
}

/**
 * User left notification (server -> client).
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
 * Connected message (server -> client on connect).
 */
export interface ConnectedMessage extends WebSocketMessage {
  type: 'connected';
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
 * Play Mode request message (client -> server -> clients).
 * Sent by a user who wants to start Play Mode collaboratively.
 */
export interface PlayModeRequestMessage extends WebSocketMessage {
  type: 'play-mode-request';
  requestId: string; // Unique request ID
  fromUser: PublicUser; // User who initiated the request
}

/**
 * Play Mode response message (client -> server).
 * Sent by users responding to a Play Mode request.
 */
export interface PlayModeResponseMessage extends WebSocketMessage {
  type: 'play-mode-response';
  requestId: string; // Request ID being responded to
  accepted: boolean; // Whether the user accepted the request
}

/**
 * Play Mode start message (server -> clients).
 * Sent to all users who accepted a Play Mode request to start Play Mode simultaneously.
 */
export interface PlayModeStartMessage extends WebSocketMessage {
  type: 'play-mode-start';
  requestId: string; // Request ID that triggered this start
  fromUser: PublicUser; // User who initiated the original request
}

/**
 * Play Mode end message (client -> server -> clients).
 * Notification when a user exits Play Mode (for UI updates, optional).
 */
export interface PlayModeEndMessage extends WebSocketMessage {
  type: 'play-mode-end';
  userId: string; // User who exited Play Mode
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
 * Public user information.
 */
export interface PublicUser {
  id: string;
  email: string;
  createdAt: number;
}

/**
 * Replication client connection state.
 */
export enum ReplicationState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Joined = 'joined',
  Error = 'error',
}

