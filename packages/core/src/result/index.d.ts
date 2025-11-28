/**
 * Result type and structured error handling utilities.
 *
 * Use Result<T, E> for operations where errors are expected and should be
 * handled explicitly. This is ideal for:
 * - Async operations (loading, networking)
 * - User input validation
 * - External API calls
 * - File I/O
 *
 * For hot paths (render loops, physics), stick to traditional error handling
 * to avoid allocation overhead.
 *
 * @module
 */
export { Result, type Ok, type Err, type ResultValue, type ResultError, } from './Result.js';
export { StructuredError, EngineError, type ErrorContext, type CommonErrorCode, } from './StructuredError.js';
//# sourceMappingURL=index.d.ts.map