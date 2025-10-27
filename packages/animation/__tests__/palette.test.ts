import { describe, it, expect } from 'vitest';
import { computeJointPalette } from '../src/skin/JointPalette';
import { createPose } from '../src/core/Pose';
import { createSkeleton } from '../src/core/Skeleton';

describe('Joint palette', () => {
  it('identity pose with identity inverseBind yields identity palette', () => {
    const joints = [{ name: 'root' }];
    const parents = new Int16Array([ -1 ]);
    const inverseBind = new Float32Array(16);
    // identity mat4
    inverseBind[0] = 1; inverseBind[5] = 1; inverseBind[10] = 1; inverseBind[15] = 1;
    const skeleton = createSkeleton(joints, parents, inverseBind);
    const pose = createPose(1);
    const out = new Float32Array(16);
    computeJointPalette(out, skeleton, pose);
    expect(Array.from(out)).toEqual([
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,1,
    ]);
  });
});


