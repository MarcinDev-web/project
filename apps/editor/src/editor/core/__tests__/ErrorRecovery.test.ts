import { describe, it, expect } from 'vitest';
import { LoadingErrorRecovery, DefaultRetryPolicy } from '../../core/ErrorRecovery';
import type { LoadingContext, LoadingStep } from '../../core/LoadingStep';

describe('LoadingErrorRecovery', () => {
  it('retries failing steps according to policy and eventually succeeds', async () => {
    const recovery = new LoadingErrorRecovery();
    const attempts: number[] = [];

    const step: LoadingStep = {
      name: 'Flaky step',
      weight: 1,
      canRetry: true,
      critical: true,
      async execute() {
        attempts.push(Date.now());
        if (attempts.length < 2) {
          throw new Error('Transient');
        }
      },
    };

    const context = {
      worldManager: {} as any,
      manifest: {} as any,
      data: new Map<string, unknown>(),
      deps: {
        setupPhysics: () => {},
        updateSceneBuffers: () => {},
      },
      emitProgress: () => {},
    } satisfies LoadingContext;

    await recovery.executeWithRetry(step, context, { ...DefaultRetryPolicy, backoffMs: 1 });
    expect(attempts.length).toBe(2);
  });
});


