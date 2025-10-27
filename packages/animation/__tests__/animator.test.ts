import { describe, it, expect } from 'vitest';
import { Animator } from '../src/runtime/Animator';
import { AnimatorController } from '../src/runtime/AnimatorController';
import { createClip } from '../src/core/AnimationClip';
import { createPose } from '../src/core/Pose';

function makeConstantClip(name: string, jointIndex: number, tx: number): ReturnType<typeof createClip> {
  const times = new Float32Array([0]);
  const values = new Float32Array([tx, 0, 0]);
  return createClip(name, [{ kind: 'translation', jointIndex, times, values, interpolation: 'step' } as any]);
}

describe('Animator FSM + Crossfade', () => {
  it('crossfades between two states', () => {
    const ctrl = new AnimatorController();
    const clipA = makeConstantClip('A', 0, 0);
    const clipB = makeConstantClip('B', 0, 10);
    ctrl.addState('Idle', clipA);
    ctrl.addState('Run', clipB);
    ctrl.addTransition({ from: 'Idle', to: 'Run', duration: 0.2, condition: (p) => Boolean(p['go']) });

    const animator = new Animator(ctrl, 1);
    const pose = createPose(1);

    // Initially at Idle
    animator.sample(pose);
    expect(pose.localTranslations[0]).toBeCloseTo(0);

    // Trigger transition
    animator.setParameter('go', true);
    animator.update(0.1);
    animator.sample(pose);
    // Mid-fade ~0.5 weight → around 5
    expect(pose.localTranslations[0]).toBeGreaterThan(1);
    expect(pose.localTranslations[0]).toBeLessThan(9);

    // Finish fade
    animator.update(0.2);
    animator.sample(pose);
    expect(pose.localTranslations[0]).toBeCloseTo(10);
  });
});


