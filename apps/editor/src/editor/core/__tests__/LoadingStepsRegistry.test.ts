import { describe, it, expect } from 'vitest';
import { LoadingStepsRegistry, DefaultLoadingStepIds, type LoadingStepRegistration } from '../../core/LoadingStepsRegistry';
import type { LoadingStep, LoadingContext } from '../../core/LoadingStep';

function makeStep(name: string): LoadingStep {
  return {
    name,
    weight: 1,
    canRetry: true,
    critical: false,
    async execute(_context: LoadingContext): Promise<void> { /* no-op */ },
  };
}

describe('LoadingStepsRegistry', () => {
  it('orders steps with before/after constraints while preserving defaults', () => {
    const registry = new LoadingStepsRegistry();

    const regs: LoadingStepRegistration[] = [
      { id: 'pluginEarly', create: () => makeStep('pluginEarly'), before: DefaultLoadingStepIds.snapshot },
      { id: 'pluginA', create: () => makeStep('pluginA'), after: DefaultLoadingStepIds.snapshot, before: DefaultLoadingStepIds.buildWorld },
      { id: 'pluginB', create: () => makeStep('pluginB'), after: DefaultLoadingStepIds.bufferUpdate, before: DefaultLoadingStepIds.pipelineWarmup },
      { id: 'pluginLate', create: () => makeStep('pluginLate'), after: DefaultLoadingStepIds.pipelineWarmup },
    ];
    registry.registerMany(regs);

    const defaults = [
      { id: DefaultLoadingStepIds.snapshot, create: () => makeStep('snapshot') },
      { id: DefaultLoadingStepIds.buildWorld, create: () => makeStep('buildWorld') },
      { id: DefaultLoadingStepIds.lightSetup, create: () => makeStep('lightSetup') },
      { id: DefaultLoadingStepIds.physicsSetup, create: () => makeStep('physicsSetup') },
      { id: DefaultLoadingStepIds.bufferUpdate, create: () => makeStep('bufferUpdate') },
      { id: DefaultLoadingStepIds.pipelineWarmup, create: () => makeStep('pipelineWarmup') },
    ];

    const steps = registry.getSteps(defaults);
    const order = steps.map((s) => s.name);

    expect(order).toEqual([
      'pluginEarly',
      'snapshot',
      'pluginA',
      'buildWorld',
      'lightSetup',
      'physicsSetup',
      'bufferUpdate',
      'pluginB',
      'pipelineWarmup',
      'pluginLate',
    ]);
  });
});


