import type { LoadingContext, LoadingStep } from '../../core/LoadingStep';

export class BuildWorldStep implements LoadingStep {
  readonly name = 'Build runtime world';
  readonly weight = 5;
  readonly canRetry = true;
  readonly critical = true;

  async execute(context: LoadingContext): Promise<void> {
    // If chunked build is available, prefer it; otherwise, fall back to sync build
    const anyWorldManager = context.worldManager as unknown as {
      buildRuntimeWorldChunked?: (manifest: unknown, onProgress: (progress: number) => void) => Promise<unknown>;
      buildRuntimeWorld: (manifest: unknown) => unknown;
    };

    const onProgress = (ratio: number) => {
      if (context.cancelToken?.isCancelled()) {
        throw new Error('Cancelled');
      }
      const clamped = Math.max(0, Math.min(1, ratio));
      context.emitProgress({
        step: this.name,
        current: Math.floor(clamped * 100),
        total: 100,
        percentage: Math.floor(clamped * 100),
        message: 'Cloning entities...',
      });
    };

    if (typeof anyWorldManager.buildRuntimeWorldChunked === 'function') {
      await anyWorldManager.buildRuntimeWorldChunked(context.manifest, onProgress);
    } else {
      anyWorldManager.buildRuntimeWorld(context.manifest);
      onProgress(1);
    }
  }
}


