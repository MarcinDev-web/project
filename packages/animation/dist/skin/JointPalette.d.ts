import type { Skeleton } from '../core/Skeleton';
import type { Pose } from '../core/Pose';
export type JointPaletteScratch = {
    globalMatrices: Float32Array;
    computed: Uint8Array;
    tmpMat: Float32Array;
    tmpT: Float32Array;
    tmpR: Float32Array;
    tmpS: Float32Array;
};
export declare function ensureScratch(jointCount: number, scratch?: JointPaletteScratch): JointPaletteScratch;
/**
 * Computes the joint palette (global * inverseBind) for the provided skeleton and pose.
 * outPalette length must be jointCount * 16 (mat4, column-major).
 */
export declare function computeJointPalette(outPalette: Float32Array, skeleton: Skeleton, pose: Pose, scratch?: JointPaletteScratch): Float32Array;
//# sourceMappingURL=JointPalette.d.ts.map