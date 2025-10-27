import type { LoadingContext, LoadingStep } from '../../core/LoadingStep';

export class SnapshotStep implements LoadingStep {
  readonly name = 'Create snapshot';
  readonly weight = 1;
  readonly canRetry = true;
  readonly critical = true;

  async execute(context: LoadingContext): Promise<void> {
    const snapshot = context.worldManager.snapshotAuthoring();
    context.emitProgress({ step: this.name, current: 1, total: 1, percentage: 0, message: 'Snapshot created' });
    context.data.set('authoringSnapshot', snapshot);
  }
}


