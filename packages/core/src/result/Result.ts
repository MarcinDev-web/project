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
export const Result = {
  /**
   * Create a success result
   */
  ok<T>(value: T): Ok<T> {
    return { ok: true, value };
  },

  /**
   * Create an error result
   */
  err<E>(error: E): Err<E> {
    return { ok: false, error };
  },

  /**
   * Check if result is Ok
   */
  isOk<T, E>(result: Result<T, E>): result is Ok<T> {
    return result.ok;
  },

  /**
   * Check if result is Err
   */
  isErr<T, E>(result: Result<T, E>): result is Err<E> {
    return !result.ok;
  },

  /**
   * Unwrap value or throw if error
   * Use sparingly - prefer pattern matching
   */
  unwrap<T, E>(result: Result<T, E>): T {
    if (result.ok) {
      return result.value;
    }
    throw result.error instanceof Error
      ? result.error
      : new Error(String(result.error));
  },

  /**
   * Unwrap value or return default
   */
  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    return result.ok ? result.value : defaultValue;
  },

  /**
   * Unwrap error or throw if ok
   */
  unwrapErr<T, E>(result: Result<T, E>): E {
    if (!result.ok) {
      return result.error;
    }
    throw new Error('Called unwrapErr on Ok result');
  },

  /**
   * Pattern match on result
   */
  match<T, E, U>(
    result: Result<T, E>,
    handlers: {
      ok: (value: T) => U;
      err: (error: E) => U;
    }
  ): U {
    return result.ok ? handlers.ok(result.value) : handlers.err(result.error);
  },

  /**
   * Map value if Ok, pass through Err
   */
  map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return result.ok ? Result.ok(fn(result.value)) : result;
  },

  /**
   * Map error if Err, pass through Ok
   */
  mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return result.ok ? result : Result.err(fn(result.error));
  },

  /**
   * Chain operations that return Results (flatMap/bind)
   */
  andThen<T, E, U>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E> {
    return result.ok ? fn(result.value) : result;
  },

  /**
   * Recover from error with fallback operation
   */
  orElse<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => Result<T, F>
  ): Result<T, F> {
    return result.ok ? result : fn(result.error);
  },

  /**
   * Wrap a promise that might throw into a Result
   */
  async fromPromise<T, E = Error>(
    promise: Promise<T>,
    mapError?: (error: unknown) => E
  ): Promise<Result<T, E>> {
    try {
      const value = await promise;
      return Result.ok(value);
    } catch (error) {
      const mappedError = mapError
        ? mapError(error)
        : (error as E);
      return Result.err(mappedError);
    }
  },

  /**
   * Wrap a sync function that might throw into a Result
   */
  fromTry<T, E = Error>(
    fn: () => T,
    mapError?: (error: unknown) => E
  ): Result<T, E> {
    try {
      return Result.ok(fn());
    } catch (error) {
      const mappedError = mapError
        ? mapError(error)
        : (error as E);
      return Result.err(mappedError);
    }
  },

  /**
   * Collect array of Results into Result of array
   * Returns first error encountered or Ok with all values
   */
  all<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (!result.ok) {
        return result;
      }
      values.push(result.value);
    }
    return Result.ok(values);
  },

  /**
   * Collect array of Results, separating successes and failures
   */
  partition<T, E>(results: Result<T, E>[]): { ok: T[]; err: E[] } {
    const ok: T[] = [];
    const err: E[] = [];
    for (const result of results) {
      if (result.ok) {
        ok.push(result.value);
      } else {
        err.push(result.error);
      }
    }
    return { ok, err };
  },
};

/**
 * Type helper: Extract value type from Result
 */
export type ResultValue<R> = R extends Result<infer T, unknown> ? T : never;

/**
 * Type helper: Extract error type from Result
 */
export type ResultError<R> = R extends Result<unknown, infer E> ? E : never;

