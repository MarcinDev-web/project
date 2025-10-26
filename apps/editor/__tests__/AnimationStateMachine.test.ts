import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnimationController } from '@engine/stdlib/Animation';
import { AnimationStateMachine } from '@engine/stdlib/Animation';
import type { AnimationTransitionConfig } from '@engine/stdlib/Animation';
import { createTestClip } from './helpers/animationTestUtils';

let stateMachine: AnimationStateMachine;

beforeEach(() => {
  stateMachine = new AnimationStateMachine();
});

describe('AnimationStateMachine', () => {
  it('adds states and sets the first as current without playing by default', () => {
    const clip = createTestClip('Idle');
    const controller = new AnimationController({ clip, loop: true, speed: 1 });
    const playSpy = vi.spyOn(controller, 'play');

    stateMachine.addState({ name: 'Idle', controller });

    expect(stateMachine.hasState('Idle')).toBe(true);
    expect(stateMachine.getCurrentStateName()).toBe('Idle');
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('setState resets time and optionally plays or pauses', () => {
    const clip = createTestClip('Run');
    const controller = new AnimationController({ clip, loop: true, speed: 1 });
    stateMachine.addState({ name: 'Run', controller });

    controller.time.value = 0.5;
    stateMachine.setState('Run', { resetTime: true, autoPlay: true });
    expect(controller.time.value).toBe(0);
    expect(controller.playing.value).toBe(true);

    stateMachine.setState('Run', { resetTime: false, autoPlay: false });
    expect(controller.playing.value).toBe(false);
  });

  it('runs transitions based on conditions with blending', () => {
    const clipIdle = createTestClip('Idle');
    const clipJump = createTestClip('Jump');
    const idle = new AnimationController({ clip: clipIdle });
    const jump = new AnimationController({ clip: clipJump });

    stateMachine.addState({
      name: 'Idle',
      controller: idle,
      transitions: [
        {
          to: 'Jump',
          condition: () => true,
          blendDuration: 0.5,
        },
      ],
    });
    stateMachine.addState({ name: 'Jump', controller: jump });
    stateMachine.setState('Idle', { resetTime: true, autoPlay: true });

    const idlePauseSpy = vi.spyOn(idle, 'pause');
    stateMachine.update(0.25);

    const samples = stateMachine.getSamples();
    expect(samples.secondary).toBe(jump);
    expect(samples.blendWeight).toBeGreaterThan(0);

    stateMachine.update(0.25);
    expect(stateMachine.getCurrentStateName()).toBe('Jump');
    expect(idlePauseSpy).toHaveBeenCalled();
  });

  it('throws when setting unknown state', () => {
    expect(() => stateMachine.setState('Unknown')).toThrow();
  });

  it('supports parameter-driven transitions and triggers', () => {
    const clipIdle = createTestClip('Idle');
    const clipRun = createTestClip('Run');
    const idle = new AnimationController({ clip: clipIdle });
    const run = new AnimationController({ clip: clipRun });

    stateMachine.setParameterDefinitions([
      { name: 'speed', type: 'number', defaultValue: 0 },
      { name: 'jump', type: 'trigger' },
    ]);

    stateMachine.addState({
      name: 'Idle',
      controller: idle,
      transitions: [
        {
          to: 'Run',
          blendDuration: 0.2,
          conditions: [{ parameter: 'speed', operator: '>', value: 0.5 }],
        },
      ],
    });
    stateMachine.addState({ name: 'Run', controller: run });
    stateMachine.setState('Idle', { resetTime: true, autoPlay: true });

    stateMachine.update(0.016);
    expect(stateMachine.getCurrentStateName()).toBe('Idle');

    stateMachine.setParam('speed', 0.6);
    stateMachine.update(0.016);
    expect(stateMachine.getCurrentStateName()).toBe('Idle');

    stateMachine.update(0.25);
    expect(stateMachine.getCurrentStateName()).toBe('Run');

    stateMachine.replaceStates([
      {
        name: 'Run',
        controller: run,
        transitions: [
          {
            to: 'Idle',
            blendDuration: 0,
            conditions: [{ parameter: 'jump', operator: 'triggered' }],
          },
        ],
      },
      {
        name: 'Idle',
        controller: idle,
      },
    ]);

    stateMachine.setState('Run', { resetTime: true, autoPlay: true });
    expect(stateMachine.getCurrentStateName()).toBe('Run');

    stateMachine.setTrigger('jump');
    expect(stateMachine.getParam('jump')).toBe(true);
    stateMachine.update(0.016);
    expect(stateMachine.getCurrentStateName()).toBe('Idle');
    expect(stateMachine.getParam('jump')).toBeNull();
  });
});
