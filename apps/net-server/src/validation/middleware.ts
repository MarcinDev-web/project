/**
 * Validation middleware for Express endpoints.
 * Validates request body, query parameters, and path parameters using Zod schemas.
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { securityLogger } from '../logging/SecurityLogger';
import { FileUploadValidator } from '../security/FileUploadValidator';

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
 * Validate request body using Zod schema.
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await schema.parseAsync(req.body);
      // Replace body with validated and transformed data
      req.body = result;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error);
        
        // Log validation failure
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        securityLogger.logSuspiciousActivity(
          undefined,
          `Validation failed for ${req.path}: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
          ip
        );

        res.status(400).json({
          error: 'Validation failed',
          errors,
        });
        return;
      }
      
      // Unexpected error
      console.error('Validation middleware error:', error);
      res.status(500).json({
        error: 'Validation error',
        message: 'An unexpected error occurred during validation',
      });
    }
  };
}

/**
 * Validate query parameters using Zod schema.
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await schema.parseAsync(req.query);
      // Replace query with validated and transformed data
      req.query = result as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error);
        
        // Log validation failure
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        securityLogger.logSuspiciousActivity(
          undefined,
          `Query validation failed for ${req.path}: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
          ip
        );

        res.status(400).json({
          error: 'Validation failed',
          errors,
        });
        return;
      }
      
      console.error('Query validation middleware error:', error);
      res.status(500).json({
        error: 'Validation error',
        message: 'An unexpected error occurred during validation',
      });
    }
  };
}

/**
 * Validate path parameters using Zod schema.
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await schema.parseAsync(req.params);
      // Replace params with validated data
      req.params = result as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error);
        
        // Log validation failure
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        securityLogger.logSuspiciousActivity(
          undefined,
          `Path parameter validation failed for ${req.path}: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
          ip
        );

        res.status(400).json({
          error: 'Validation failed',
          errors,
        });
        return;
      }
      
      console.error('Params validation middleware error:', error);
      res.status(500).json({
        error: 'Validation error',
        message: 'An unexpected error occurred during validation',
      });
    }
  };
}

/**
 * Validate request (body, query, and params) using schemas.
 */
export function validateRequest<TBody extends z.ZodTypeAny, TQuery extends z.ZodTypeAny, TParams extends z.ZodTypeAny>(options: {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate body if schema provided
      if (options.body) {
        req.body = await options.body.parseAsync(req.body);
      }

      // Validate query if schema provided
      if (options.query) {
        req.query = await options.query.parseAsync(req.query) as any;
      }

      // Validate params if schema provided
      if (options.params) {
        req.params = await options.params.parseAsync(req.params) as any;
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = formatZodErrors(error);
        
        // Log validation failure
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        securityLogger.logSuspiciousActivity(
          undefined,
          `Request validation failed for ${req.path}: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
          ip
        );

        res.status(400).json({
          error: 'Validation failed',
          errors,
        });
        return;
      }
      
      console.error('Request validation middleware error:', error);
      res.status(500).json({
        error: 'Validation error',
        message: 'An unexpected error occurred during validation',
      });
    }
  };
}

/**
 * Validate file upload.
 * Requires multer or similar middleware to have processed files first.
 * Checks file size, MIME type, and content (magic bytes).
 */
export function validateFileUpload(options: {
  maxSize?: number; // in bytes
  allowedTypes?: string[]; // MIME types
  required?: boolean;
  fieldName?: string; // Default: 'file'
} = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const fieldName = options.fieldName || 'file';
    const file = (req as any).file || (req as any).files?.[fieldName];

    if (options.required && !file) {
      res.status(400).json({
        error: 'Validation failed',
        errors: [{ field: fieldName, message: 'File is required' }],
      });
      return;
    }

    if (!file) {
      next();
      return;
    }

    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      securityLogger.logFileUploadFailure(
        (req as any).user?.id || 'unknown',
        file.originalname || 'unknown',
        `File size ${file.size} exceeds maximum ${options.maxSize}`,
        ip
      );

      res.status(400).json({
        error: 'Validation failed',
        errors: [{ field: fieldName, message: `File size exceeds maximum of ${options.maxSize} bytes` }],
      });
      return;
    }

    // Check MIME type
    if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      securityLogger.logFileUploadFailure(
        (req as any).user?.id || 'unknown',
        file.originalname || 'unknown',
        `Invalid MIME type: ${file.mimetype}`,
        ip
      );

      res.status(400).json({
        error: 'Validation failed',
        errors: [{ field: fieldName, message: `Invalid file type. Allowed: ${options.allowedTypes.join(', ')}` }],
      });
      return;
    }

    // Validate file content (magic bytes) for images
    if (file.mimetype?.startsWith('image/')) {
      if (!file.buffer || !FileUploadValidator.isValidImage(file.buffer)) {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        securityLogger.logFileUploadFailure(
          (req as any).user?.id || 'unknown',
          file.originalname || 'unknown',
          'Invalid image content (magic bytes check failed)',
          ip
        );

        res.status(400).json({
          error: 'Validation failed',
          errors: [{ field: fieldName, message: 'Invalid image file' }],
        });
        return;
      }
    }

    // Generate safe filename
    if (file.originalname) {
      file.safeFilename = FileUploadValidator.generateSafeFilename(file.originalname);
    }

    next();
  };
}
