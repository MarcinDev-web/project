import type { LoadingContext, LoadingStep } from '../../core/LoadingStep';

export class BufferUpdateStep implements LoadingStep {
  readonly name = 'Update scene buffers';
  readonly weight = 1;
  readonly canRetry = true;
  readonly critical = true;

  async execute(context: LoadingContext): Promise<void> {
    await Promise.resolve(context.deps.updateSceneBuffers());
  }
}


