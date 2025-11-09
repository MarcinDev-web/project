/**
 * Marketplace endpoint validation schemas.
 */

import { z } from 'zod';
import {
  uuidSchema,
  fileUrlSchema,
  trimmedStringSchema,
  arraySchema,
  positiveNumberSchema,
  currencySchema,
} from './base.js';

/**
 * Marketplace item type.
 */
const marketplaceItemTypeSchema = z.enum(['build', 'avatar']);

/**
 * Tag schema (max 50 chars per tag).
 */
const tagSchema = trimmedStringSchema(50).min(1, 'Tag cannot be empty');

/**
 * Build data schema (validates structure, not content size - that's done in refine).
 */
const buildDataSchema = z
  .object({
    metadata: z.object({
      id: z.string(),
      name: z.string(),
    }),
    scene: z.record(z.unknown()),
  })
  .catchall(z.unknown());

/**
 * Publish marketplace item schema.
 */
export const publishItemSchema = z
  .object({
    type: marketplaceItemTypeSchema,
    title: trimmedStringSchema(200).min(1, 'Title is required'),
    description: trimmedStringSchema(5000).optional(),
    tags: arraySchema(tagSchema, 20).optional(),
    fileUrl: fileUrlSchema,
    buildData: buildDataSchema.optional(),
    priceCurrency: currencySchema.optional(),
    priceAmount: positiveNumberSchema.optional(),
  })
  .refine(
    (data) => {
      // Build data can only be provided for builds
      if (data.buildData && data.type !== 'build') {
        return false;
      }
      return true;
    },
    { message: 'Build data can only be provided for builds', path: ['buildData'] }
  )
  .refine(
    (data) => {
      // Validate build data size (max 10MB when stringified)
      if (data.buildData) {
        try {
          const jsonString = JSON.stringify(data.buildData);
          const sizeMB = Buffer.byteLength(jsonString, 'utf-8') / (1024 * 1024);
          if (sizeMB > 10) {
            return false;
          }
        } catch {
          return false;
        }
      }
      return true;
    },
    { message: 'Build data too large (max 10MB)', path: ['buildData'] }
  );

/**
 * Update price schema.
 */
export const updatePriceSchema = z.object({
  priceCurrency: currencySchema,
  priceAmount: positiveNumberSchema,
});

/**
 * Resale listing schema.
 */
export const resaleListingSchema = z.object({
  priceCurrency: currencySchema,
  priceAmount: positiveNumberSchema,
});

/**
 * Buy resale schema.
 */
export const buyResaleSchema = z.object({
  listingId: z.string().min(1, 'Listing ID is required'),
});

/**
 * Search query schema.
 */
export const searchQuerySchema = z.object({
  query: trimmedStringSchema(200).optional(),
  type: marketplaceItemTypeSchema.optional(),
  tags: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((t) => t.trim()) : undefined))
    .pipe(arraySchema(tagSchema, 20).optional()),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().positive().max(100).optional()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().positive().max(100).optional()),
  sortBy: z.enum(['recent', 'popular', 'downloads', 'likes', 'price']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  minPrice: positiveNumberSchema.optional(),
  maxPrice: positiveNumberSchema.optional(),
});

/**
 * Update marketplace item schema (for updateItem method).
 */
export const updateItemSchema = z.object({
  title: trimmedStringSchema(200).min(1).optional(),
  description: trimmedStringSchema(5000).optional(),
  authorName: trimmedStringSchema(100).optional(),
  thumbnailUrl: fileUrlSchema.optional(),
  fileUrl: fileUrlSchema.optional(),
  tags: arraySchema(tagSchema, 20).optional(),
  downloads: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  public: z.boolean().optional(),
  price: z
    .object({
      currency: currencySchema,
      amount: positiveNumberSchema,
    })
    .optional()
    .nullable(),
  forumThreadId: uuidSchema.or(z.string().min(1)).optional().nullable(),
});

/**
 * Marketplace query params schema (for list endpoints).
 */
export const marketplaceQuerySchema = z.object({
  type: marketplaceItemTypeSchema.optional(),
  tags: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((t) => t.trim()) : undefined))
    .pipe(arraySchema(tagSchema, 20).optional()),
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
  sortBy: z.enum(['newest', 'popular', 'downloads', 'likes']).optional(),
});

/**
 * Marketplace item ID param schema.
 */
export const marketplaceItemIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Type exports.
 */
export type PublishItemRequest = z.infer<typeof publishItemSchema>;
export type UpdatePriceRequest = z.infer<typeof updatePriceSchema>;
export type ResaleListingRequest = z.infer<typeof resaleListingSchema>;
export type BuyResaleRequest = z.infer<typeof buyResaleSchema>;
export type SearchQueryRequest = z.infer<typeof searchQuerySchema>;
export type UpdateItemRequest = z.infer<typeof updateItemSchema>;
export type MarketplaceItemIdParam = z.infer<typeof marketplaceItemIdParamSchema>;

