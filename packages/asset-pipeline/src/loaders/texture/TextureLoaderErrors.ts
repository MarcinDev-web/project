/**
 * Structured errors for TextureLoader.
 * 
 * These errors provide explicit error codes and context for better
 * error handling in consuming code.
 */
import { StructuredError, type ErrorContext } from '@engine/core';

/**
 * Error codes for texture loading operations.
 */
export type TextureErrorCode = 
  | 'NETWORK_ERROR'      // Failed to fetch
  | 'DECODE_ERROR'       // Failed to decode image data
  | 'INVALID_FORMAT'     // Unsupported or invalid format
  | 'CONTEXT_ERROR'      // Failed to create 2D context
  | 'TIMEOUT'            // Loading timed out
  | 'CANCELLED'          // Loading was cancelled
  | 'INVALID_URL';       // Malformed or empty URL

/**
 * Texture loading error with structured information.
 */
export class TextureLoadError extends StructuredError<TextureErrorCode> {
  public readonly url: string;

  constructor(
    code: TextureErrorCode,
    message: string,
    url: string,
    context: ErrorContext = {}
  ) {
    // Network errors and timeouts are retryable
    const retryable = context.retryable ?? 
      (code === 'NETWORK_ERROR' || code === 'TIMEOUT');
    
    super('TextureLoadError', code, message, { ...context, url, retryable });
    this.url = url;
  }

  // Factory methods for common errors
  static networkError(url: string, cause?: Error): TextureLoadError {
    return new TextureLoadError(
      'NETWORK_ERROR',
      `Failed to load image: ${url}`,
      url,
      { ...(cause && { cause }), retryable: true }
    );
  }

  static decodeError(url: string, cause?: Error): TextureLoadError {
    return new TextureLoadError(
      'DECODE_ERROR',
      `Failed to decode image: ${url}`,
      url,
      { ...(cause && { cause }), retryable: false }
    );
  }

  static invalidFormat(url: string, format: string): TextureLoadError {
    return new TextureLoadError(
      'INVALID_FORMAT',
      `Unsupported texture format: ${format}`,
      url,
      { format, retryable: false }
    );
  }

  static contextError(url: string): TextureLoadError {
    return new TextureLoadError(
      'CONTEXT_ERROR',
      'Failed to get 2D canvas context',
      url,
      { retryable: false }
    );
  }

  static timeout(url: string, timeoutMs: number): TextureLoadError {
    return new TextureLoadError(
      'TIMEOUT',
      `Texture loading timed out after ${timeoutMs}ms`,
      url,
      { timeoutMs, retryable: true }
    );
  }

  static cancelled(url: string): TextureLoadError {
    return new TextureLoadError(
      'CANCELLED',
      `Texture loading cancelled: ${url}`,
      url,
      { retryable: false }
    );
  }

  static invalidUrl(url: string): TextureLoadError {
    return new TextureLoadError(
      'INVALID_URL',
      `Invalid texture URL: ${url || '(empty)'}`,
      url,
      { retryable: false }
    );
  }
}

