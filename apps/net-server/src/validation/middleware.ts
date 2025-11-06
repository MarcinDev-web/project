/**
 * Validation utilities for Fastify endpoints.
 * Note: Fastify with @fastify/type-provider-zod handles validation automatically in route definitions.
 * These are helper functions for edge cases or manual validation.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { securityLogger } from '../logging/SecurityLogger.js';
import { FileUploadValidator } from '../security/FileUploadValidator.js';

/**
 * Validation error interface.
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Format Zod errors into user-friendly format.
 */
function formatZodErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map((err) => {
    const field = err.path.join('.');
    return {
      field: field || 'unknown',
      message: err.message || 'Invalid value',
    };
  });
}

/**
 * Validate request body using Zod schema (helper for Fastify).
 * Note: In Fastify routes, use @fastify/type-provider-zod schemas directly.
 * This is mainly for edge cases or manual validation.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const result = await schema.parseAsync(request.body);
      // Replace body with validated and transformed data
      (request as any).body = result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error);

        // Log validation failure
        const ip = request.ip || 'unknown';
        securityLogger.logSuspiciousActivity(
          undefined,
          `Validation failed for ${request.url}: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`,
          ip
        );

        reply.code(400).send({
          error: 'Validation failed',
          errors,
        });
        return;
      }

      // Unexpected error
      console.error('Validation hook error:', error);
      reply.code(500).send({
        error: 'Validation error',
        message: 'An unexpected error occurred during validation',
      });
    }
  };
}

/**
 * Validate query parameters using Zod schema (helper for Fastify).
 * Note: In Fastify routes, use @fastify/type-provider-zod schemas directly.
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const result = await schema.parseAsync(request.query);
      // Replace query with validated and transformed data
      (request as any).query = result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error);

        // Log validation failure
        const ip = request.ip || 'unknown';
        securityLogger.logSuspiciousActivity(
          undefined,
          `Query validation failed for ${request.url}: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`,
          ip
        );

        reply.code(400).send({
          error: 'Validation failed',
          errors,
        });
        return;
      }

      console.error('Query validation hook error:', error);
      reply.code(500).send({
        error: 'Validation error',
        message: 'An unexpected error occurred during validation',
      });
    }
  };
}

/**
 * Validate path parameters using Zod schema (helper for Fastify).
 * Note: In Fastify routes, use @fastify/type-provider-zod schemas directly.
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const result = await schema.parseAsync(request.params);
      // Replace params with validated data
      (request as any).params = result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error);

        // Log validation failure
        const ip = request.ip || 'unknown';
        securityLogger.logSuspiciousActivity(
          undefined,
          `Path parameter validation failed for ${request.url}: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`,
          ip
        );

        reply.code(400).send({
          error: 'Validation failed',
          errors,
        });
        return;
      }

      console.error('Params validation hook error:', error);
      reply.code(500).send({
        error: 'Validation error',
        message: 'An unexpected error occurred during validation',
      });
    }
  };
}

/**
 * Validate request (body, query, and params) using schemas (helper for Fastify).
 * Note: In Fastify routes, use @fastify/type-provider-zod schemas directly.
 */
export function validateRequest<
  TBody extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TParams extends z.ZodTypeAny,
>(options: { body?: TBody; query?: TQuery; params?: TParams }) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      // Validate body if schema provided
      if (options.body) {
        (request as any).body = await options.body.parseAsync(request.body);
      }

      // Validate query if schema provided
      if (options.query) {
        (request as any).query = await options.query.parseAsync(request.query);
      }

      // Validate params if schema provided
      if (options.params) {
        (request as any).params = await options.params.parseAsync(request.params);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error);

        // Log validation failure
        const ip = request.ip || 'unknown';
        securityLogger.logSuspiciousActivity(
          undefined,
          `Request validation failed for ${request.url}: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`,
          ip
        );

        reply.code(400).send({
          error: 'Validation failed',
          errors,
        });
        return;
      }

      console.error('Request validation hook error:', error);
      reply.code(500).send({
        error: 'Validation error',
        message: 'An unexpected error occurred during validation',
      });
    }
  };
}

/**
 * Validate file upload for Fastify (@fastify/multipart).
 * Checks file size, MIME type, and content (magic bytes).
 */
export function validateFileUpload(
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[]; // MIME types
    required?: boolean;
    fieldName?: string; // Default: 'file'
  } = {}
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const fieldName = options.fieldName || 'file';
    // Fastify multipart stores files in request.parts() or request.file()
    const file = (request as any).file || (request as any).files?.[fieldName];

    if (options.required && !file) {
      reply.code(400).send({
        error: 'Validation failed',
        errors: [{ field: fieldName, message: 'File is required' }],
      });
      return;
    }

    if (!file) {
      return;
    }

    // Check file size
    if (options.maxSize && file.bytesRead > options.maxSize) {
      const ip = request.ip || 'unknown';
      securityLogger.logFileUploadFailure(
        (request as any).user?.id || 'unknown',
        file.filename || 'unknown',
        `File size ${file.bytesRead} exceeds maximum ${options.maxSize}`,
        ip
      );

      reply.code(400).send({
        error: 'Validation failed',
        errors: [
          { field: fieldName, message: `File size exceeds maximum of ${options.maxSize} bytes` },
        ],
      });
      return;
    }

    // Check MIME type
    const mimeType = file.mimetype || file.type;
    if (options.allowedTypes && mimeType && !options.allowedTypes.includes(mimeType)) {
      const ip = request.ip || 'unknown';
      securityLogger.logFileUploadFailure(
        (request as any).user?.id || 'unknown',
        file.filename || 'unknown',
        `Invalid MIME type: ${mimeType}`,
        ip
      );

      reply.code(400).send({
        error: 'Validation failed',
        errors: [
          {
            field: fieldName,
            message: `Invalid file type. Allowed: ${options.allowedTypes.join(', ')}`,
          },
        ],
      });
      return;
    }

    // Validate file content (magic bytes) for images
    if (mimeType?.startsWith('image/')) {
      // Fastify multipart provides file as stream, need to read buffer
      const chunks: Buffer[] = [];
      for await (const chunk of file.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      if (!buffer || !FileUploadValidator.isValidImage(buffer)) {
        const ip = request.ip || 'unknown';
        securityLogger.logFileUploadFailure(
          (request as any).user?.id || 'unknown',
          file.filename || 'unknown',
          'Invalid image content (magic bytes check failed)',
          ip
        );

        reply.code(400).send({
          error: 'Validation failed',
          errors: [{ field: fieldName, message: 'Invalid image file' }],
        });
        return;
      }

      // Store buffer back in file object
      (file as any).buffer = buffer;
    }

    // Generate safe filename
    if (file.filename) {
      (file as any).safeFilename = FileUploadValidator.generateSafeFilename(file.filename);
    }
  };
}

