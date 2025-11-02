/**
 * Messages endpoint validation schemas.
 */

import { z } from 'zod';
import { uuidSchema, trimmedStringSchema, arraySchema } from './base';

/**
 * Create message schema.
 */
export const createMessageSchema = z.object({
  conversationId: uuidSchema.or(z.string().min(1)),
  content: trimmedStringSchema(10000).min(1, 'Message content is required'),
  attachments: arraySchema(
    z.object({
      type: z.enum(['image', 'file', 'link']),
      url: z.string().url(),
      name: z.string().optional(),
    }),
    10
  ).optional(),
});

/**
 * Create conversation (group) schema.
 */
export const createConversationSchema = z.object({
  recipientId: uuidSchema.or(z.string().min(1)).optional(),
  recipientIds: arraySchema(uuidSchema.or(z.string().min(1)), 50).optional(),
  name: trimmedStringSchema(200).optional(),
  initialMessage: trimmedStringSchema(10000).optional(),
});

/**
 * Update group conversation schema.
 */
export const updateGroupSchema = z.object({
  name: trimmedStringSchema(200).optional(),
  description: trimmedStringSchema(500).optional(),
});

/**
 * Add group members schema.
 */
export const addGroupMembersSchema = z.object({
  userIds: arraySchema(uuidSchema.or(z.string().min(1)), 50).min(1, 'At least one user ID is required'),
});

/**
 * Conversation ID param schema.
 */
export const conversationIdParamSchema = z.object({
  conversationId: uuidSchema.or(z.string().min(1)),
});

/**
 * Group ID param schema.
 */
export const groupIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Message ID param schema.
 */
export const messageIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Type exports.
 */
export type CreateMessageRequest = z.infer<typeof createMessageSchema>;
export type CreateConversationRequest = z.infer<typeof createConversationSchema>;
export type UpdateGroupRequest = z.infer<typeof updateGroupSchema>;
export type AddGroupMembersRequest = z.infer<typeof addGroupMembersSchema>;
export type ConversationIdParam = z.infer<typeof conversationIdParamSchema>;
export type GroupIdParam = z.infer<typeof groupIdParamSchema>;
export type MessageIdParam = z.infer<typeof messageIdParamSchema>;

