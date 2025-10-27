import { describe, it, expect } from 'vitest';
import { blendPoseLinear } from '../src/core/Blend';
import { createPose } from '../src/core/Pose';

describe('Blend', () => {
  it('blends pose linearly (translation/scale) and slerp (rotation)', () => {
    const a = createPose(1);
    const b = createPose(1);
    // a: T(0,0,0), R identity, S(1,1,1)
    // b: T(2,0,0), R 180deg Y, S(3,1,1)
    b.localTranslations.set([2, 0, 0]);
    b.localRotations.set([0, 1, 0, 0]);
    b.localScales.set([3, 1, 1]);
    const out = createPose(1);
    blendPoseLinear(out, a, b, 0.5);
    expect(out.localTranslations[0]).toBeCloseTo(1);
    expect(out.localScales[0]).toBeCloseTo(2);
    // rotation halfway (90deg around Y) => y and w around 0.707
    expect(out.localRotations[1]).toBeGreaterThan(0.6);
    expect(out.localRotations[3]).toBeGreaterThan(0.6);
  });
});


