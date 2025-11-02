/**
 * Friends endpoint validation schemas.
 */

import { z } from 'zod';
import { uuidSchema, emailSchema } from './base';

/**
 * Friend request schema (can use userId or email).
 */
export const friendRequestSchema = z
  .object({
    userId: uuidSchema.optional(),
    email: emailSchema.optional(),
  })
  .refine((data) => data.userId || data.email, {
    message: 'Either userId or email must be provided',
  });

/**
 * Accept friend request schema.
 */
export const acceptFriendRequestSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

/**
 * Friend request ID param schema.
 */
export const friendRequestIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Friend ID param schema.
 */
export const friendIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Type exports.
 */
export type FriendRequest = z.infer<typeof friendRequestSchema>;
export type AcceptFriendRequest = z.infer<typeof acceptFriendRequestSchema>;
export type FriendRequestIdParam = z.infer<typeof friendRequestIdParamSchema>;
export type FriendIdParam = z.infer<typeof friendIdParamSchema>;

