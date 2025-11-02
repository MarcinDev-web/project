import type { IPlayModeState, PlayModeContext, PlayModeStateType } from '../core/PlayModeStateMachine';
import { PlayModeStateType as StateType } from '../core/PlayModeStateMachine';
import { Logger } from '../../utils/logger';
import type { WorldManager } from '../core/WorldManager';
import type { PlayManifest } from '../core/PlayManifest';
import type { LoadingProgress, ProgressCallback } from '../core/LoadingProgress';
import type { RetryPolicy } from '../core/ErrorRecovery';
import { DefaultRetryPolicy, LoadingErrorRecovery } from '../core/ErrorRecovery';
import { SnapshotStep } from '../core/steps/SnapshotStep';
import { BuildWorldStep } from '../core/steps/BuildWorldStep';
import { LightSetupStep } from '../core/steps/LightSetupStep';
import { PhysicsSetupStep } from '../core/steps/PhysicsSetupStep';
import { BufferUpdateStep } from '../core/steps/BufferUpdateStep';
import { PipelineWarmupStep } from '../core/steps/PipelineWarmupStep';
import type { CancellationToken } from '../core/cancellation/CancellationToken';
import { LoadingStepsRegistry, DefaultLoadingStepIds } from '../core/LoadingStepsRegistry';

/**
 * Dependencies for LOADING state
 */
export interface LoadingStateDeps {
  /** World manager for authoring/runtime separation */
  worldManager: WorldManager;
  /** Pre-warm WebGPU pipelines */
  prewarmPipelines?: () => Promise<void>;
  /** Setup physics systems */
  setupPhysics: () => void;
  /** Update scene buffers */
  updateSceneBuffers: () => void;
  /** Called when loading starts (for UI) */
  onStarted?: () => void;
  /** Progress callback for UI */
  onProgress?: ProgressCallback;
  /** Called on step error */
  onStepError?: (error: string, stepName: string, canRetry: boolean, attempt: number, maxAttempts: number) => void;
  /** Called when loading completes */
  onCompleted?: (success: boolean) => void;
  /** Default retry policy */
  retryPolicy?: RetryPolicy;
  /** Per-step retry overrides */
  perStepPolicies?: Record<string, RetryPolicy>;
  /** Provide a cancellation token to allow early abort */
  getCancellationToken?: () => CancellationToken;
  /** Optional pluggable steps registry to extend/override loading pipeline order */
  stepsRegistry?: LoadingStepsRegistry;
}

/**
 * LOADING State - Build runtime world
 * 
 * Responsibilities:
 * - Create authoring snapshot
 * - Clone authoring → runtime world with manifest filter
 * - Pre-warm WebGPU pipelines (avoid first-frame stutter)
 * - Setup physics/simulation systems for runtime
 * - Auto-transition to PLAY_INTRO when ready
 */
export class LoadingState implements IPlayModeState {
  readonly type = StateType.LOADING;
  
  private deps: LoadingStateDeps;
  private loadingComplete = false;
  private loadingSuccess = false;
  private started = false;
  private readonly errorRecovery = new LoadingErrorRecovery();
  private cancelToken: CancellationToken | null = null;

  constructor(deps: LoadingStateDeps) {
    this.deps = deps;
  }

  onEnter(_context: PlayModeContext): void {
    Logger.debug('Entering LOADING state');
    this.loadingComplete = false;
    this.loadingSuccess = false;
    this.started = false;
    // UI hook
    try { this.deps.onStarted?.(); } catch { /* ignore */ }
  }

  onExit(_context: PlayModeContext): void {
    Logger.debug('Exiting LOADING state');
  }

  onUpdate(_deltaTime: number, context: PlayModeContext): PlayModeStateType | null {
    if (!this.started) {
      this.started = true;
      void this.startAsyncLoading(context);
    }

    if (!this.loadingComplete) {
      return null; // Still loading
    }

    if (this.loadingSuccess) {
      return StateType.PLAY_INTRO; // Proceed to intro/handoff
    }
    return StateType.RETURN; // Failed, return to edit
  }

  canTransitionTo(target: PlayModeStateType): boolean {
    // Can transition to PLAY_INTRO (success) or RETURN (failure)
    return target === StateType.PLAY_INTRO || target === StateType.RETURN;
  }

  private async startAsyncLoading(context: PlayModeContext): Promise<void> {
    const manifest = context.manifest as PlayManifest | null;
    if (!manifest) {
      context.errors.push('Loading failed: No manifest available');
      this.finish(false, context);
      return;
    }

    this.cancelToken = this.deps.getCancellationToken?.() ?? null;

    const defaultRegs = [
      { id: DefaultLoadingStepIds.snapshot, create: () => new SnapshotStep() },
      { id: DefaultLoadingStepIds.buildWorld, create: () => new BuildWorldStep() },
      { id: DefaultLoadingStepIds.lightSetup, create: () => new LightSetupStep() },
      { id: DefaultLoadingStepIds.physicsSetup, create: () => new PhysicsSetupStep() },
      { id: DefaultLoadingStepIds.bufferUpdate, create: () => new BufferUpdateStep() },
      { id: DefaultLoadingStepIds.pipelineWarmup, create: () => new PipelineWarmupStep() },
    ] as const;

    const steps = this.deps.stepsRegistry
      ? this.deps.stepsRegistry.getSteps(defaultRegs as unknown as Array<{ id: string; create: () => any }>)
      : defaultRegs.map((r) => r.create());

    const totalWeight = steps.reduce((acc, s) => acc + s.weight, 0);
    let completedWeight = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) {
        Logger.warn(`Step at index ${i} is undefined, skipping`);
        continue;
      }

      const stepBase = completedWeight;
      const stepMax = stepBase + step.weight;
      const onProgress: ProgressCallback = (p: LoadingProgress) => {
        const localRatio = p.total > 0 ? p.current / p.total : 1;
        const aggregate = ((stepBase + step.weight * localRatio) / totalWeight) * 100;
        this.reportProgress(step.name, p.current, p.total, aggregate, p.message);
      };

      const policy = this.deps.perStepPolicies?.[step.name] ?? this.deps.retryPolicy ?? DefaultRetryPolicy;
      try {
        await this.errorRecovery.executeWithRetry(
          step as any,
          {
            worldManager: this.deps.worldManager,
            manifest,
            data: context.data,
            ...(this.cancelToken && { cancelToken: this.cancelToken }),
            deps: {
              setupPhysics: this.deps.setupPhysics,
              updateSceneBuffers: this.deps.updateSceneBuffers,
              ...(this.deps.prewarmPipelines && { prewarmPipelines: this.deps.prewarmPipelines }),
            },
            emitProgress: (p) => onProgress(p),
          },
          policy,
          (attempt, err) => {
            try { this.deps.onStepError?.(this.stringifyError(err), step.name, step.canRetry, attempt, policy.maxAttempts); } catch { /* ignore */ }
          },
          onProgress,
        );
      } catch (err) {
        const errMsg = this.stringifyError(err);
        Logger.error(`Step failed: ${step.name}:`, err as Error);
        context.errors.push(`${step.name} failed: ${errMsg}`);
        if (step.critical) {
          this.finish(false, context);
          return;
        }
      }

      // Mark step as fully complete
      completedWeight = stepMax;
      this.reportProgress(step.name, 1, 1, (completedWeight / totalWeight) * 100);
    }

    this.finish(true, context);
  }

  private reportProgress(step: string, current: number, total: number, percentage: number, message = ''): void {
    try {
      this.deps.onProgress?.({ step, current, total, percentage: Math.round(Math.max(0, Math.min(100, percentage))), message });
    } catch { /* ignore */ }
  }

  private finish(success: boolean, context: PlayModeContext): void {
    this.loadingSuccess = success;
    this.loadingComplete = true;
    try { this.deps.onCompleted?.(success); } catch { /* ignore */ }
    if (success) {
      Logger.info('Runtime world loaded successfully');
    } else {
      if (context.errors.length === 0) {
        context.errors.push('Loading failed');
      }
    }
  }

  private stringifyError(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}

