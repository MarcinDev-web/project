import type { LoadingStep, LoadingContext } from './LoadingStep';
import type { ProgressCallback } from './LoadingProgress';

export interface RetryPolicy {
  /** Maximum attempts including the first try */
  maxAttempts: number;
  /** Base backoff in milliseconds */
  backoffMs: number;
  /** When true, uses exponential backoff (backoffMs * 2^(attempt-1)) */
  exponential: boolean;
}

export const DefaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  backoffMs: 150,
  exponential: true,
};

export class LoadingErrorRecovery {
  async executeWithRetry(
    step: LoadingStep,
    context: LoadingContext,
    policy: RetryPolicy = DefaultRetryPolicy,
    onRetry?: (attempt: number, error: unknown) => void,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < policy.maxAttempts) {
      attempt += 1;
      try {
        const run = step.execute(context, onProgress);
        await this.withOptionalTimeout(run, step.timeoutMs);
        return; // success
      } catch (error) {
        lastError = error;
        if (attempt >= policy.maxAttempts || !step.canRetry) {
          throw error;
        }
        onRetry?.(attempt, error);
        await this.backoff(policy, attempt);
      }
    }

    // Should not reach here, but throw last error as a safeguard
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw lastError ?? new Error('Unknown error during step execution');
  }

  private async backoff(policy: RetryPolicy, attempt: number): Promise<void> {
    const factor = policy.exponential ? Math.pow(2, attempt - 1) : 1;
    const delay = Math.max(0, Math.floor(policy.backoffMs * factor));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async withOptionalTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    if (timeoutMs === undefined || timeoutMs <= 0) {
      return promise;
    }
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error('Step timed out')), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }
}


