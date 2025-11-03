/**
 * WebSocket message validation schemas.
 */

import { z } from 'zod';
import { uuidSchema } from './base';

/**
 * Position schema (3D vector).
 */
const positionSchema = z.tuple([z.number(), z.number(), z.number()]);

/**
 * Rotation schema (quaternion - 4 numbers).
 */
const rotationSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

/**
 * Operation schema (flexible structure for scene operations).
 */
const operationSchema = z
  .object({
    type: z.string(),
    entityId: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  })
  .catchall(z.unknown());

/**
 * Join session message schema.
 */
export const joinSessionMessageSchema = z.object({
  type: z.literal('join-session'),
  sessionId: z.string().min(1, 'Session ID is required'),
  token: z.string().min(1, 'Token is required'),
  timestamp: z.number().int().nonnegative().optional(),
});

/**
 * Leave session message schema.
 */
export const leaveSessionMessageSchema = z.object({
  type: z.literal('leave-session'),
  sessionId: z.string().min(1, 'Session ID is required'),
  timestamp: z.number().int().nonnegative().optional(),
});

/**
 * Operation message schema.
 */
export const operationMessageSchema = z.object({
  type: z.literal('operation'),
  operation: operationSchema,
  sessionId: z.string().min(1).optional(),
  timestamp: z.number().int().nonnegative().optional(),
});

/**
 * Player update message schema.
 */
export const playerUpdateMessageSchema = z.object({
  type: z.literal('player-update'),
  playerId: z.string().min(1).optional(),
  position: positionSchema,
  rotation: rotationSchema.optional(),
  velocity: positionSchema.optional(),
  state: z.record(z.unknown()).optional(),
  timestamp: z.number().int().nonnegative().optional(),
});

/**
 * Cursor update message schema.
 */
export const cursorUpdateMessageSchema = z.object({
  type: z.literal('cursor-update'),
  position: positionSchema,
  rotation: rotationSchema.optional(),
  timestamp: z.number().int().nonnegative().optional(),
});

/**
 * Ping message schema.
 */
export const pingMessageSchema = z.object({
  type: z.literal('ping'),
  timestamp: z.number().int().nonnegative().optional(),
});

/**
 * Message typing indicator schema.
 */
export const messageTypingSchema = z.object({
  type: z.literal('message:typing'),
  conversationId: uuidSchema.or(z.string().min(1)),
  typing: z.boolean(),
  timestamp: z.number().int().nonnegative().optional(),
});

/**
 * Union schema for all WebSocket message types.
 */
export const websocketMessageSchema = z.discriminatedUnion('type', [
  joinSessionMessageSchema,
  leaveSessionMessageSchema,
  operationMessageSchema,
  playerUpdateMessageSchema,
  cursorUpdateMessageSchema,
  pingMessageSchema,
  messageTypingSchema,
]);

/**
 * Type exports.
 */
export type JoinSessionMessageRequest = z.infer<typeof joinSessionMessageSchema>;
export type LeaveSessionMessageRequest = z.infer<typeof leaveSessionMessageSchema>;
export type OperationMessageRequest = z.infer<typeof operationMessageSchema>;
export type PlayerUpdateMessageRequest = z.infer<typeof playerUpdateMessageSchema>;
export type CursorUpdateMessageRequest = z.infer<typeof cursorUpdateMessageSchema>;
export type PingMessageRequest = z.infer<typeof pingMessageSchema>;
export type MessageTypingRequest = z.infer<typeof messageTypingSchema>;
export type WebSocketMessageRequest = z.infer<typeof websocketMessageSchema>;
