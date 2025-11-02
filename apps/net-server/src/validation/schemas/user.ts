/**
 * User endpoint validation schemas.
 */

import { z } from 'zod';
import { uuidSchema, trimmedStringSchema } from './base';

/**
 * Avatar loadout schema (flexible structure for avatar customization).
 */
const avatarLoadoutSchema = z.record(z.unknown());

/**
 * Update profile schema.
 */
export const updateProfileSchema = z.object({
  displayName: trimmedStringSchema(100).optional(),
  bio: trimmedStringSchema(5000).optional(),
  avatarUrl: z.string().url().optional().or(z.string().startsWith('/').optional()),
  website: z.string().url().optional(),
  socialLinks: z
    .object({
      twitter: z.string().url().optional(),
      discord: z.string().optional(),
      github: z.string().url().optional(),
    })
    .optional(),
});

/**
 * Update avatar loadout schema.
 */
export const updateAvatarLoadoutSchema = z.object({
  loadout: avatarLoadoutSchema,
});

/**
 * Path parameter schema for user ID.
 */
export const userIdParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Type exports.
 */
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type UpdateAvatarLoadoutRequest = z.infer<typeof updateAvatarLoadoutSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;

