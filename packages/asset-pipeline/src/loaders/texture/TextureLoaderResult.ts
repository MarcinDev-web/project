/**
 * Result-based texture loading utilities.
 * 
 * This module provides Result<T, E> based alternatives to the throwing
 * methods in TextureLoader. Use these when you want explicit error handling.
 * 
 * @example
 * ```typescript
 * import { TextureLoader } from './TextureLoader';
 * import { loadTextureResult, loadBatchTextureResults } from './TextureLoaderResult';
 * import { Result } from '@engine/core';
 * 
 * const loader = new TextureLoader();
 * 
 * // Single texture with explicit error handling
 * const result = await loadTextureResult(loader, 'texture.png');
 * if (result.ok) {
 *   console.log('Loaded:', result.value.width, 'x', result.value.height);
 * } else {
 *   if (result.error.retryable) {
 *     console.log('Retryable error:', result.error.code);
 *   } else {
 *     console.error('Fatal error:', result.error.message);
 *   }
 * }
 * 
 * // Batch loading with partial success
 * const urls = ['a.png', 'b.png', 'c.png'];
 * const results = await loadBatchTextureResults(loader, urls);
 * const { ok: loaded, err: failed } = Result.partition(results);
 * console.log(`Loaded ${loaded.length}, failed ${failed.length}`);
 * ```
 */

import { Result, type Err } from '@engine/core';
import type { TextureLoader, TextureLoadOptions, RawTexture } from './TextureLoader.js';
import { TextureLoadError } from './TextureLoaderErrors.js';

export type TextureResult = Result<RawTexture, TextureLoadError>;

/**
 * Load texture with Result return type instead of throwing.
 */
export async function loadTextureResult(
  loader: TextureLoader,
  url: string,
  options: TextureLoadOptions = {}
): Promise<TextureResult> {
  // Validate URL first
  if (!url || url.trim() === '') {
    return Result.err(TextureLoadError.invalidUrl(url));
  }

  try {
    const texture = await loader.load(url, options);
    return Result.ok(texture);
  } catch (error) {
    // Map the error to appropriate TextureLoadError
    const mapped = mapErrorToTextureLoadError(url, error);
    return Result.err(mapped);
  }
}

/**
 * Load multiple textures, returning individual Results for each.
 * Unlike loadBatch(), this doesn't fail-fast and returns all results.
 */
export async function loadBatchTextureResults(
  loader: TextureLoader,
  urls: string[],
  options: TextureLoadOptions = {}
): Promise<TextureResult[]> {
  const promises = urls.map(url => loadTextureResult(loader, url, options));
  return Promise.all(promises);
}

/**
 * Load multiple textures with timeout.
 */
export async function loadTextureWithTimeout(
  loader: TextureLoader,
  url: string,
  timeoutMs: number,
  options: TextureLoadOptions = {}
): Promise<TextureResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      loadTextureResult(loader, url, options),
      new Promise<Err<TextureLoadError>>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(Result.err(TextureLoadError.timeout(url, timeoutMs)));
        });
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Load texture with automatic retry on retryable errors.
 */
export async function loadTextureWithRetry(
  loader: TextureLoader,
  url: string,
  options: TextureLoadOptions = {},
  retryOptions: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: TextureLoadError) => void;
  } = {}
): Promise<TextureResult> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
    onRetry,
  } = retryOptions;

  let lastError: TextureLoadError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await loadTextureResult(loader, url, options);
    
    if (result.ok) {
      return result;
    }

    lastError = result.error;

    // Don't retry non-retryable errors
    if (!lastError.retryable) {
      return result;
    }

    // Last attempt - return error
    if (attempt >= maxAttempts - 1) {
      return result;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      initialDelayMs * Math.pow(backoffMultiplier, attempt),
      maxDelayMs
    );

    onRetry?.(attempt + 1, lastError);

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Should never reach here
  return Result.err(lastError!);
}

/**
 * Map unknown error to TextureLoadError
 */
function mapErrorToTextureLoadError(url: string, error: unknown): TextureLoadError {
  if (error instanceof TextureLoadError) {
    return error;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  // Try to categorize the error
  if (errorMessage.includes('network') || errorMessage.includes('fetch') || 
      errorMessage.includes('Failed to load')) {
    return TextureLoadError.networkError(url, cause);
  }

  if (errorMessage.includes('decode') || errorMessage.includes('corrupt')) {
    return TextureLoadError.decodeError(url, cause);
  }

  if (errorMessage.includes('context') || errorMessage.includes('2D')) {
    return TextureLoadError.contextError(url);
  }

  if (errorMessage.includes('format') || errorMessage.includes('unsupported')) {
    return new TextureLoadError(
      'INVALID_FORMAT',
      errorMessage,
      url,
      { ...(cause && { cause }), retryable: false }
    );
  }

  // Default to network error (most common case for loading)
  return TextureLoadError.networkError(url, cause);
}

