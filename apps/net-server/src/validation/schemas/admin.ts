/**
 * Admin endpoint validation schemas.
 */

import { z } from 'zod';
import { uuidSchema, userRoleSchema } from './base';

/**
 * Update user role schema.
 */
export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
});

/**
 * Update user schema (admin can update any field).
 */
export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  role: userRoleSchema.optional(),
  active: z.boolean().optional(),
});

/**
 * Admin user ID param schema.
 */
export const adminUserIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Admin marketplace item ID param schema.
 */
export const adminMarketplaceItemIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Admin project token param schema.
 */
export const adminProjectTokenParamSchema = z.object({
  token: z.string().min(1),
});

/**
 * Type exports.
 */
export type UpdateUserRoleRequest = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type AdminUserIdParam = z.infer<typeof adminUserIdParamSchema>;
export type AdminMarketplaceItemIdParam = z.infer<typeof adminMarketplaceItemIdParamSchema>;
export type AdminProjectTokenParam = z.infer<typeof adminProjectTokenParamSchema>;
