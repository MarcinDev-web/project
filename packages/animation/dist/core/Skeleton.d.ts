import type { Mat4 } from '@engine/core';
export type Joint = {
    name: string;
};
export type Skeleton = {
    joints: Joint[];
    parents: Int16Array;
    inverseBindMatrices: Float32Array;
    jointCount: number;
};
export declare function createSkeleton(joints: Joint[], parents: Int16Array, inverseBindMatrices: Float32Array): Skeleton;
export declare function getInverseBindMatrix(out: Mat4, skeleton: Skeleton, jointIndex: number): Mat4;
//# sourceMappingURL=Skeleton.d.ts.map