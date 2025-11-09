/**
 * Authentication endpoint validation schemas.
 */

import { z } from 'zod';
import { emailSchema } from './base.js';

/**
 * Password validation schema.
 * Requirements: min 8 chars, at least one uppercase, one digit.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one digit')
  .max(128, 'Password is too long');

/**
 * Username validation schema.
 * Requirements: 3-20 chars, only letters, digits, underscores.
 */
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters long')
  .max(20, 'Username must be at most 20 characters long')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

/**
 * Register request schema.
 */
export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});

/**
 * Login request schema.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Refresh token request schema.
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Logout request schema (refresh token optional).
 */
export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

/**
 * Type exports for TypeScript inference.
 */
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
export type LogoutRequest = z.infer<typeof logoutSchema>;

