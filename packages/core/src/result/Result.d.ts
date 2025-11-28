/**
 * Result type for explicit error handling in async operations.
 *
 * Inspired by Rust's Result<T, E> but adapted for TypeScript/JavaScript.
 * Use this for operations where failures are expected and should be handled
 * explicitly rather than thrown as exceptions.
 *
 * @example
 * ```typescript
 * // Returning results
 * async function loadAsset(url: string): Promise<Result<Asset, AssetError>> {
 *   try {
 *     const data = await fetch(url);
 *     return Result.ok(parseAsset(data));
 *   } catch (e) {
 *     return Result.err(new AssetError('LOAD_FAILED', url, e));
 *   }
 * }
 *
 * // Consuming results
 * const result = await loadAsset('model.glb');
 * if (result.isOk()) {
 *   console.log('Loaded:', result.value);
 * } else {
 *   console.error('Failed:', result.error.code);
 * }
 *
 * // Or with match pattern
 * result.match({
 *   ok: (asset) => render(asset),
 *   err: (error) => showError(error.message),
 * });
 * ```
 *
 * @packageDocumentation
 */
/**
 * Success variant of Result
 */
export interface Ok<T> {
    readonly ok: true;
    readonly value: T;
}
/**
 * Error variant of Result
 */
export interface Err<E> {
    readonly ok: false;
    readonly error: E;
}
/**
 * Result type - either Ok<T> or Err<E>
 */
export type Result<T, E> = Ok<T> | Err<E>;
/**
 * Result namespace with factory functions and utilities
 */
export declare const Result: {
    /**
     * Create a success result
     */
    ok<T>(value: T): Ok<T>;
    /**
     * Create an error result
     */
    err<E>(error: E): Err<E>;
    /**
     * Check if result is Ok
     */
    isOk<T, E>(result: Result<T, E>): result is Ok<T>;
    /**
     * Check if result is Err
     */
    isErr<T, E>(result: Result<T, E>): result is Err<E>;
    /**
     * Unwrap value or throw if error
     * Use sparingly - prefer pattern matching
     */
    unwrap<T, E>(result: Result<T, E>): T;
    /**
     * Unwrap value or return default
     */
    unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T;
    /**
     * Unwrap error or throw if ok
     */
    unwrapErr<T, E>(result: Result<T, E>): E;
    /**
     * Pattern match on result
     */
    match<T, E, U>(result: Result<T, E>, handlers: {
        ok: (value: T) => U;
        err: (error: E) => U;
    }): U;
    /**
     * Map value if Ok, pass through Err
     */
    map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
    /**
     * Map error if Err, pass through Ok
     */
    mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>;
    /**
     * Chain operations that return Results (flatMap/bind)
     */
    andThen<T, E, U>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>;
    /**
     * Recover from error with fallback operation
     */
    orElse<T, E, F>(result: Result<T, E>, fn: (error: E) => Result<T, F>): Result<T, F>;
    /**
     * Wrap a promise that might throw into a Result
     */
    fromPromise<T, E = Error>(promise: Promise<T>, mapError?: (error: unknown) => E): Promise<Result<T, E>>;
    /**
     * Wrap a sync function that might throw into a Result
     */
    fromTry<T, E = Error>(fn: () => T, mapError?: (error: unknown) => E): Result<T, E>;
    /**
     * Collect array of Results into Result of array
     * Returns first error encountered or Ok with all values
     */
    all<T, E>(results: Result<T, E>[]): Result<T[], E>;
    /**
     * Collect array of Results, separating successes and failures
     */
    partition<T, E>(results: Result<T, E>[]): {
        ok: T[];
        err: E[];
    };
};
/**
 * Type helper: Extract value type from Result
 */
export type ResultValue<R> = R extends Result<infer T, unknown> ? T : never;
/**
 * Type helper: Extract error type from Result
 */
export type ResultError<R> = R extends Result<unknown, infer E> ? E : never;
//# sourceMappingURL=Result.d.ts.map