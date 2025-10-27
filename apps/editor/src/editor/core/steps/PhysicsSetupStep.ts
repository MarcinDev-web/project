import type { LoadingContext, LoadingStep } from '../../core/LoadingStep';

export class PhysicsSetupStep implements LoadingStep {
  readonly name = 'Setup physics';
  readonly weight = 2;
  readonly canRetry = true;
  readonly critical = false;

  async execute(context: LoadingContext): Promise<void> {
    await Promise.resolve(context.deps.setupPhysics());
  }
}


