import type { Skeleton } from '../core/Skeleton';
import type { Pose } from '../core/Pose';
import type { Mat4, Vec3, Quat } from '@engine/core';
import { mat4FromQuatTranslationScale, mat4Multiply } from '@engine/core';

export type JointPaletteScratch = {
  globalMatrices: Float32Array; // length = jointCount * 16
  computed: Uint8Array; // length = jointCount (0/1 flags)
  tmpMat: Float32Array; // length = 16
  tmpT: Float32Array; // length = 3
  tmpR: Float32Array; // length = 4
  tmpS: Float32Array; // length = 3
};

export function ensureScratch(jointCount: number, scratch?: JointPaletteScratch): JointPaletteScratch {
  if (scratch && scratch.globalMatrices.length >= jointCount * 16 && scratch.computed.length >= jointCount) {
    scratch.computed.fill(0);
    return scratch;
  }
  return {
    globalMatrices: new Float32Array(jointCount * 16),
    computed: new Uint8Array(jointCount),
    tmpMat: new Float32Array(16),
    tmpT: new Float32Array(3),
    tmpR: new Float32Array(4),
    tmpS: new Float32Array(3),
  };
}

/**
 * Computes the joint palette (global * inverseBind) for the provided skeleton and pose.
 * outPalette length must be jointCount * 16 (mat4, column-major).
 */
export function computeJointPalette(
  outPalette: Float32Array,
  skeleton: Skeleton,
  pose: Pose,
  scratch?: JointPaletteScratch
): Float32Array {
  const jc = skeleton.jointCount;
  if (outPalette.length < jc * 16) {
    throw new Error(`outPalette must have length >= ${jc * 16}`);
  }
  const s = ensureScratch(jc, scratch);
  // Compute global matrices
  for (let i = 0; i < jc; i++) {
    computeGlobalForJoint(i, skeleton, pose, s);
  }
  // Multiply by inverseBind to produce palette
  for (let i = 0; i < jc; i++) {
    const go = i * 16;
    const ibo = i * 16;
    // out = global * inverseBind
    mat4Multiply(
      (outPalette.subarray(go, go + 16) as unknown) as Mat4,
      (s.globalMatrices.subarray(go, go + 16) as unknown) as Mat4,
      (skeleton.inverseBindMatrices.subarray(ibo, ibo + 16) as unknown) as Mat4
    );
  }
  return outPalette;
}

function computeGlobalForJoint(index: number, skeleton: Skeleton, pose: Pose, s: JointPaletteScratch): void {
  if (s.computed[index]) return;
  const parent = skeleton.parents[index]!;
  // Build local matrix
  const to = index * 3;
  const ro = index * 4;
  s.tmpT[0] = pose.localTranslations[to + 0]!;
  s.tmpT[1] = pose.localTranslations[to + 1]!;
  s.tmpT[2] = pose.localTranslations[to + 2]!;
  s.tmpR[0] = pose.localRotations[ro + 0]!;
  s.tmpR[1] = pose.localRotations[ro + 1]!;
  s.tmpR[2] = pose.localRotations[ro + 2]!;
  s.tmpR[3] = pose.localRotations[ro + 3]!;
  s.tmpS[0] = pose.localScales[to + 0]!;
  s.tmpS[1] = pose.localScales[to + 1]!;
  s.tmpS[2] = pose.localScales[to + 2]!;
  mat4FromQuatTranslationScale(s.tmpMat as unknown as Mat4, s.tmpR as unknown as Quat, s.tmpT as unknown as Vec3, s.tmpS as unknown as Vec3);

  const outSlice = s.globalMatrices.subarray(index * 16, index * 16 + 16) as unknown as Mat4;
  if (parent === -1) {
    // root
    // copy tmpMat into global
    for (let k = 0; k < 16; k++) outSlice[k] = s.tmpMat[k]!;
  } else {
    if (!s.computed[parent]) computeGlobalForJoint(parent, skeleton, pose, s);
    const parentSlice = s.globalMatrices.subarray(parent * 16, parent * 16 + 16) as unknown as Mat4;
    mat4Multiply(outSlice, parentSlice, s.tmpMat as unknown as Mat4);
  }
  s.computed[index] = 1;
}


