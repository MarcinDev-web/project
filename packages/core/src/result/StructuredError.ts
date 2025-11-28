/**
 * Base class for structured errors across the engine.
 * 
 * Provides consistent error structure with:
 * - Error codes for programmatic handling
 * - Optional context for debugging
 * - Retryable flag for automatic retry logic
 * - Timestamp for error tracking
 * 
 * Packages should extend this for their specific error types.
 * 
 * @example
 * ```typescript
 * // Define domain-specific errors
 * export class AssetLoadError extends StructuredError<'NETWORK' | 'PARSE' | 'NOT_FOUND'> {
 *   constructor(code: 'NETWORK' | 'PARSE' | 'NOT_FOUND', message: string, context?: ErrorContext) {
 *     super('AssetLoadError', code, message, { 
 *       ...context,
 *       retryable: code === 'NETWORK' 
 *     });
 *   }
 * }
 * 
 * // Use in result
 * async function loadModel(url: string): Promise<Result<Model, AssetLoadError>> {
 *   const response = await fetch(url);
 *   if (!response.ok) {
 *     return Result.err(new AssetLoadError('NETWORK', `Failed to fetch: ${url}`, { url }));
 *   }
 *   // ...
 * }
 * ```
 */

export interface ErrorContext {
  /** Additional data for debugging */
  [key: string]: unknown;
  /** Whether operation can be retried */
  retryable?: boolean;
  /** Original error that caused this */
  cause?: Error;
}

export class StructuredError<TCode extends string = string> extends Error {
  public readonly code: TCode;
  public readonly context: ErrorContext;
  public readonly retryable: boolean;
  public readonly timestamp: number;

  constructor(
    name: string,
    code: TCode,
    message: string,
    context: ErrorContext = {}
  ) {
    super(message, { cause: context.cause });
    this.name = name;
    this.code = code;
    this.context = context;
    this.retryable = context.retryable ?? false;
    this.timestamp = Date.now();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StructuredError);
    }
  }

  /**
   * Convert to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }

  /**
   * Create a string representation for logging
   */
  toString(): string {
    return `[${this.name}] ${this.code}: ${this.message}`;
  }
}

// Common error codes that can be reused across packages
export type CommonErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVALID_STATE'
  | 'PERMISSION_DENIED'
  | 'RESOURCE_EXHAUSTED'
  | 'INTERNAL_ERROR'
  | 'CANCELLED'
  | 'ALREADY_EXISTS';

/**
 * Generic engine error for common cases
 */
export class EngineError extends StructuredError<CommonErrorCode> {
  constructor(
    code: CommonErrorCode,
    message: string,
    context: ErrorContext = {}
  ) {
    // Network and timeout errors are typically retryable
    const retryable = context.retryable ?? 
      (code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code === 'RESOURCE_EXHAUSTED');
    
    super('EngineError', code, message, { ...context, retryable });
  }

  // Factory methods for common errors
  static networkError(message: string, context?: ErrorContext): EngineError {
    return new EngineError('NETWORK_ERROR', message, { ...context, retryable: true });
  }

  static timeout(operation: string, timeoutMs: number, context?: ErrorContext): EngineError {
    return new EngineError('TIMEOUT', `${operation} timed out after ${timeoutMs}ms`, {
      ...context,
      operation,
      timeoutMs,
      retryable: true,
    });
  }

  static notFound(resource: string, context?: ErrorContext): EngineError {
    return new EngineError('NOT_FOUND', `Resource not found: ${resource}`, {
      ...context,
      resource,
      retryable: false,
    });
  }

  static invalidInput(message: string, context?: ErrorContext): EngineError {
    return new EngineError('INVALID_INPUT', message, { ...context, retryable: false });
  }

  static invalidState(message: string, context?: ErrorContext): EngineError {
    return new EngineError('INVALID_STATE', message, { ...context, retryable: false });
  }

  static internal(message: string, cause?: Error): EngineError {
    return new EngineError('INTERNAL_ERROR', message, { ...(cause && { cause }), retryable: false });
  }

  static cancelled(operation: string): EngineError {
    return new EngineError('CANCELLED', `Operation cancelled: ${operation}`, { retryable: false });
  }
}

