/**
 * Forum endpoint validation schemas.
 */

import { z } from 'zod';
import { uuidSchema, trimmedStringSchema } from './base.js';

/**
 * Create forum thread schema.
 */
export const createThreadSchema = z.object({
  title: trimmedStringSchema(200).min(1, 'Title is required'),
  content: trimmedStringSchema(10000).min(1, 'Content is required'),
  category: z.string().min(1, 'Category is required'),
});

/**
 * Update forum thread schema.
 */
export const updateThreadSchema = z.object({
  title: trimmedStringSchema(200).optional(),
  content: trimmedStringSchema(10000).optional(),
  category: z.string().min(1).optional(),
});

/**
 * Create forum post schema.
 */
export const createPostSchema = z.object({
  content: trimmedStringSchema(10000).min(1, 'Content is required'),
});

/**
 * Update forum post schema.
 */
export const updatePostSchema = z.object({
  content: trimmedStringSchema(10000).min(1, 'Content is required'),
});

/**
 * Create forum category schema (admin only).
 */
export const createCategorySchema = z.object({
  name: trimmedStringSchema(100).min(1, 'Name is required'),
  description: trimmedStringSchema(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
    .optional(),
});

/**
 * Update forum category schema (admin only).
 */
export const updateCategorySchema = z.object({
  name: trimmedStringSchema(100).optional(),
  description: trimmedStringSchema(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
    .optional(),
});

/**
 * Add reaction schema.
 */
export const addReactionSchema = z.object({
  emoji: trimmedStringSchema(10).min(1, 'Emoji is required'),
});

/**
 * Forum thread/post ID param schema.
 */
export const forumItemIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Forum reaction param schema.
 */
export const forumReactionParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
  emoji: z.string().min(1),
});

/**
 * Type exports.
 */
export type CreateThreadRequest = z.infer<typeof createThreadSchema>;
export type UpdateThreadRequest = z.infer<typeof updateThreadSchema>;
export type CreatePostRequest = z.infer<typeof createPostSchema>;
export type UpdatePostRequest = z.infer<typeof updatePostSchema>;
export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategorySchema>;
export type AddReactionRequest = z.infer<typeof addReactionSchema>;
export type ForumItemIdParam = z.infer<typeof forumItemIdParamSchema>;
export type ForumReactionParam = z.infer<typeof forumReactionParamSchema>;

