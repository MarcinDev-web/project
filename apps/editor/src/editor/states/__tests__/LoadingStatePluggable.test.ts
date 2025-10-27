import { describe, it, expect, vi } from 'vitest';
import { LoadingState } from '../../states/LoadingState';
import { PlayModeStateType } from '../../core/PlayModeStateMachine';
import { createDefaultManifest } from '../../core/PlayManifest';
import type { WorldManager } from '../../core/WorldManager';
import type { LoadingContext, LoadingStep } from '../../core/LoadingStep';
import { LoadingStepsRegistry, DefaultLoadingStepIds } from '../../core/LoadingStepsRegistry';

function createContext() {
  return {
    authoringSnapshot: null,
    selectionPath: null,
    manifest: createDefaultManifest(),
    errors: [],
    warnings: [],
    data: new Map<string, any>(),
  };
}

function makePluginStep(name: string): LoadingStep {
  return {
    name,
    weight: 3,
    canRetry: true,
    critical: false,
    async execute(ctx: LoadingContext): Promise<void> {
      ctx.emitProgress({ step: name, current: 1, total: 1, percentage: 100, message: 'done' });
      ctx.data.set(name, true);
    },
  };
}

describe('LoadingState with pluggable steps', () => {
  it('executes registered steps in correct order and transitions on success', async () => {
    const onProgress = vi.fn();

    const worldManager: Partial<WorldManager> & { buildRuntimeWorldChunked: any } = {
      snapshotAuthoring: vi.fn(() => 'snapshot'),
      buildRuntimeWorldChunked: vi.fn(async (_manifest, cb: (p: number) => void) => {
        for (let i = 1; i <= 5; i++) {
          cb(i / 5);
          await Promise.resolve();
        }
      }),
      getRuntimeWorld: vi.fn(() => null),
      clearRuntimeWorld: vi.fn(),
    } as any;

    const registry = new LoadingStepsRegistry();
    registry.register({
      id: 'postBuild',
      create: () => makePluginStep('postBuild'),
      after: DefaultLoadingStepIds.buildWorld,
      before: DefaultLoadingStepIds.lightSetup,
    });

    const state = new LoadingState({
      worldManager: worldManager as any,
      setupPhysics: () => {},
      updateSceneBuffers: () => {},
      onProgress,
      stepsRegistry: registry,
    });

    const context = createContext();
    state.onEnter(context as any);

    // Pump updates until transition ready
    let next: PlayModeStateType | null = null;
    for (let i = 0; i < 50; i++) {
      next = state.onUpdate(0, context as any);
      await Promise.resolve();
      if (next !== null) break;
    }

    expect(next).toBe(PlayModeStateType.PLAY_INTRO);
    // Ensure plugin executed
    expect(context.data.get('postBuild')).toBe(true);

    // Verify order via first-seen step names from progress callbacks
    const seenOrder: string[] = [];
    for (const call of onProgress.mock.calls) {
      const stepName = call[0]?.step as string;
      if (stepName && !seenOrder.includes(stepName)) seenOrder.push(stepName);
    }
    const idxSnapshot = seenOrder.indexOf('Create snapshot');
    const idxBuild = seenOrder.indexOf('Build runtime world');
    const idxPlugin = seenOrder.indexOf('postBuild');
    const idxLight = seenOrder.indexOf('Ensure scene lighting');

    expect(idxSnapshot).toBeGreaterThanOrEqual(0);
    expect(idxBuild).toBeGreaterThan(idxSnapshot);
    expect(idxPlugin).toBeGreaterThan(idxBuild);
    expect(idxLight).toBeGreaterThan(idxPlugin);

    // Last reported progress should be 100
    const last = onProgress.mock.calls.at(-1)?.[0];
    expect(last?.percentage).toBe(100);
  });
});


