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
export declare class StructuredError<TCode extends string = string> extends Error {
    readonly code: TCode;
    readonly context: ErrorContext;
    readonly retryable: boolean;
    readonly timestamp: number;
    constructor(name: string, code: TCode, message: string, context?: ErrorContext);
    /**
     * Convert to JSON for logging/serialization
     */
    toJSON(): Record<string, unknown>;
    /**
     * Create a string representation for logging
     */
    toString(): string;
}
export type CommonErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_STATE' | 'PERMISSION_DENIED' | 'RESOURCE_EXHAUSTED' | 'INTERNAL_ERROR' | 'CANCELLED' | 'ALREADY_EXISTS';
/**
 * Generic engine error for common cases
 */
export declare class EngineError extends StructuredError<CommonErrorCode> {
    constructor(code: CommonErrorCode, message: string, context?: ErrorContext);
    static networkError(message: string, context?: ErrorContext): EngineError;
    static timeout(operation: string, timeoutMs: number, context?: ErrorContext): EngineError;
    static notFound(resource: string, context?: ErrorContext): EngineError;
    static invalidInput(message: string, context?: ErrorContext): EngineError;
    static invalidState(message: string, context?: ErrorContext): EngineError;
    static internal(message: string, cause?: Error): EngineError;
    static cancelled(operation: string): EngineError;
}
//# sourceMappingURL=StructuredError.d.ts.map