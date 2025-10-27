import type { Mat4 } from '@engine/core';

export type Joint = {
  name: string;
};

export type Skeleton = {
  joints: Joint[];
  parents: Int16Array; // parent index per joint, -1 for root
  inverseBindMatrices: Float32Array; // length = jointCount * 16 (mat4, column-major)
  jointCount: number;
};

export function createSkeleton(
  joints: Joint[],
  parents: Int16Array,
  inverseBindMatrices: Float32Array
): Skeleton {
  const jointCount = joints.length;
  if (parents.length !== jointCount) {
    throw new Error(`parents length (${parents.length}) must equal joints length (${jointCount})`);
  }
  if (inverseBindMatrices.length !== jointCount * 16) {
    throw new Error(
      `inverseBindMatrices length (${inverseBindMatrices.length}) must be jointCount * 16 (${jointCount * 16})`
    );
  }
  // Validate parent indices
  for (let i = 0; i < jointCount; i++) {
    const p = parents[i]!;
    if (p === -1) continue; // root
    if (!(p >= 0 && p < jointCount)) {
      throw new RangeError(`parents[${i}] = ${p} is out of range [0, ${jointCount - 1}] or -1`);
    }
  }
  return { joints, parents, inverseBindMatrices, jointCount };
}

export function getInverseBindMatrix(out: Mat4, skeleton: Skeleton, jointIndex: number): Mat4 {
  const { jointCount, inverseBindMatrices } = skeleton;
  if (!(jointIndex >= 0 && jointIndex < jointCount)) {
    throw new RangeError(`jointIndex ${jointIndex} out of range [0, ${jointCount - 1}]`);
  }
  const offset = jointIndex * 16;
  for (let i = 0; i < 16; i++) out[i] = inverseBindMatrices[offset + i]!;
  return out;
}


