import type { Vec3, Quat } from '@engine/core/math';
export interface Bone {
    name: string;
    parentIndex: number;
    bindPosition: Vec3;
    bindRotation: Quat;
    bindScale: Vec3;
}
export interface PoseBone {
    position: Vec3;
    rotation: Quat;
    scale: Vec3;
}
export declare class Skeleton {
    readonly bones: Bone[];
    constructor(bones: Bone[]);
    findBoneIndex(name: string): number;
    createBindPose(): PoseBone[];
}
//# sourceMappingURL=Skeleton.d.ts.map