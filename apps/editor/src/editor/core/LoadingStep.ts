import type { WorldManager } from './WorldManager';
import type { PlayManifest } from './PlayManifest';
import type { LoadingProgress, ProgressCallback } from './LoadingProgress';
import type { CancellationToken } from './cancellation/CancellationToken';

export interface LoadingContext {
  /** World separation and cloning operations */
  worldManager: WorldManager;
  /** Runtime configuration built during preflight */
  manifest: PlayManifest;
  /** Shared data between steps */
  data: Map<string, unknown>;
  /** Optional cancellation token to allow aborting long-running steps */
  cancelToken?: CancellationToken;
  /** Per-step dependencies provided by the caller */
  deps: {
    setupPhysics: () => void | Promise<void>;
    updateSceneBuffers: () => void | Promise<void>;
    prewarmPipelines?: () => Promise<void>;
  };
  /** Emit user-visible progress updates */
  emitProgress: (p: LoadingProgress) => void;
}

export interface LoadingStep {
  /** Step name, user-visible */
  readonly name: string;
  /** Weight used for aggregated percentage (relative to other steps) */
  readonly weight: number;
  /** Whether this step can be retried on failure */
  readonly canRetry: boolean;
  /** Whether this step is critical for successful loading */
  readonly critical: boolean;
  /** Optional timeout in milliseconds for this step */
  readonly timeoutMs?: number;

  /** Execute the step. Throw to indicate failure. */
  execute(context: LoadingContext, onProgress?: ProgressCallback): Promise<void>;
  /** Optional rollback used if a later critical step fails and we want to clean up. */
  rollback?(context: LoadingContext): Promise<void>;
}


