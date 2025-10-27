import { describe, it, expect, vi } from 'vitest';
import { LoadingState } from '../../states/LoadingState';
import { PlayModeStateType } from '../../core/PlayModeStateMachine';
import { createDefaultManifest, type PlayManifest } from '../../core/PlayManifest';
import type { WorldManager } from '../../core/WorldManager';
import { CancellationToken } from '../../core/cancellation/CancellationToken';

function createContext(manifest?: PlayManifest) {
  return {
    authoringSnapshot: null,
    selectionPath: null,
    manifest: manifest ?? createDefaultManifest(),
    errors: [],
    warnings: [],
    data: new Map<string, any>(),
  };
}

describe('LoadingState (async)', () => {
  it('emits progress and transitions to PLAY_INTRO on success', async () => {
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

    const state = new LoadingState({
      worldManager: worldManager as any,
      setupPhysics: () => {},
      updateSceneBuffers: () => {},
      onProgress,
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

    expect(onProgress).toHaveBeenCalled();
    const last = onProgress.mock.calls.at(-1)?.[0];
    expect(last?.percentage).toBe(100);
    expect(next).toBe(PlayModeStateType.PLAY_INTRO);
  });

  it('supports cancellation and returns RETURN state', async () => {
    const onProgress = vi.fn();
    const token = new CancellationToken();
    const worldManager: Partial<WorldManager> & { buildRuntimeWorldChunked: any } = {
      snapshotAuthoring: vi.fn(() => 'snapshot'),
      buildRuntimeWorldChunked: vi.fn(async (_manifest, cb: (p: number) => void) => {
        for (let i = 1; i <= 10; i++) {
          cb(i / 10);
          if (i === 5) token.cancel();
          await Promise.resolve();
        }
      }),
      getRuntimeWorld: vi.fn(() => null),
    } as any;

    const state = new LoadingState({
      worldManager: worldManager as any,
      setupPhysics: () => {},
      updateSceneBuffers: () => {},
      onProgress,
      getCancellationToken: () => token,
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

    expect(next).toBe(PlayModeStateType.RETURN);
    expect(context.errors.some((e) => /failed|Cancelled/i.test(e))).toBe(true);
  });
});


