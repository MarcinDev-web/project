/**
 * Base validation schemas and utilities.
 * Reusable schemas for common validation patterns.
 */

import { z } from 'zod';

/**
 * Email validation schema.
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .min(3, 'Email is too short')
  .max(255, 'Email is too long')
  .toLowerCase();

/**
 * UUID validation schema (hex string, typically 32 chars).
 */
export const uuidSchema = z
  .string()
  .regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, 'Invalid UUID format')
  .or(z.string().regex(/^[a-f0-9]{32}$/i, 'Invalid ID format')); // Also accept 32-char hex IDs

/**
 * Pagination query schema.
 */
export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().positive().max(100).optional()),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().nonnegative().optional()),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
});

/**
 * Create a non-empty string schema with optional max length.
 */
export function nonEmptyStringSchema(
  fieldName = 'Field',
  maxLength?: number,
  minLength = 1
): z.ZodString {
  let schema = z.string().min(minLength, `${fieldName} cannot be empty`);

  if (maxLength) {
    schema = schema.max(maxLength, `${fieldName} must be at most ${maxLength} characters`);
  }

  return schema;
}

/**
 * Positive integer schema.
 */
export const positiveIntegerSchema = z
  .number()
  .int()
  .positive('Must be a positive integer')
  .or(
    z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive())
  );

/**
 * Non-negative integer schema.
 */
export const nonNegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative('Must be a non-negative integer')
  .or(
    z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().nonnegative())
  );

/**
 * Positive number schema (can be decimal).
 */
export const positiveNumberSchema = z
  .number()
  .positive('Must be a positive number')
  .or(
    z
      .string()
      .transform((val) => parseFloat(val))
      .pipe(z.number().positive('Must be a positive number'))
  );

/**
 * Array schema with optional max length.
 */
export function arraySchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  maxLength?: number,
  minLength = 0
): z.ZodArray<T> {
  let schema = z.array(itemSchema);

  if (minLength > 0) {
    schema = schema.min(minLength, `Array must have at least ${minLength} items`);
  }

  if (maxLength) {
    schema = schema.max(maxLength, `Array must have at most ${maxLength} items`);
  }

  return schema;
}

/**
 * URL validation schema.
 */
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'URL must use http, https, ws, or wss protocol' }
  );

/**
 * File URL schema (can be relative path or absolute URL).
 */
export const fileUrlSchema = z
  .string()
  .min(1, 'File URL cannot be empty')
  .refine(
    (url) => {
      // Allow relative paths starting with /
      if (url.startsWith('/')) {
        return true;
      }
      // Allow http/https URLs
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    { message: 'File URL must be a relative path (/) or absolute URL (http/https)' }
  );

/**
 * Currency code schema.
 */
export const currencySchema = z.enum(['credits', 'tokens', 'coins']).or(z.string().min(1).max(10));

/**
 * User role schema.
 */
export const userRoleSchema = z.enum(['user', 'moderator', 'admin', 'root']);

/**
 * ISO 8601 date string schema.
 */
export const isoDateStringSchema = z.string().datetime('Invalid date format');

/**
 * Timestamp schema (number or ISO string).
 */
export const timestampSchema = z
  .number()
  .int()
  .nonnegative()
  .or(
    z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().nonnegative())
  )
  .or(isoDateStringSchema.transform((val) => new Date(val).getTime()));

/**
 * Boolean string schema (transforms "true"/"false" strings to booleans).
 */
export const booleanStringSchema = z
  .string()
  .transform((val) => val === 'true')
  .pipe(z.boolean())
  .or(z.boolean());

/**
 * Optional string schema (empty string becomes undefined).
 */
export const optionalStringSchema = z
  .string()
  .optional()
  .transform((val) => (val === '' ? undefined : val));

/**
 * Trimmed string schema (automatically trims whitespace).
 */
export function trimmedStringSchema(maxLength?: number, minLength = 0): z.ZodString {
  let schema = z.string().trim();

  if (minLength > 0) {
    schema = schema.min(minLength, `Must be at least ${minLength} characters`);
  }

  if (maxLength) {
    schema = schema.max(maxLength, `Must be at most ${maxLength} characters`);
  }

  return schema;
}

