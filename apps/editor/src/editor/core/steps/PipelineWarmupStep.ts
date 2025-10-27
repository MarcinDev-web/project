import type { LoadingContext, LoadingStep } from '../../core/LoadingStep';

export class PipelineWarmupStep implements LoadingStep {
  readonly name = 'Pre-warm pipelines';
  readonly weight = 1;
  readonly canRetry = false;
  readonly critical = false;

  async execute(context: LoadingContext): Promise<void> {
    if (context.deps.prewarmPipelines) {
      await context.deps.prewarmPipelines();
    }
  }
}


