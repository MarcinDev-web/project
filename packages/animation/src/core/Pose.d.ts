import type { Vec3, Quat } from '@engine/core';
export type Pose = {
    jointCount: number;
    localTranslations: Float32Array;
    localRotations: Float32Array;
    localScales: Float32Array;
};
export declare function createPose(jointCount: number): Pose;
export declare function clonePose(src: Pose): Pose;
export declare function copyPose(dst: Pose, src: Pose): void;
export declare function getLocalTranslation(out: Vec3, pose: Pose, jointIndex: number): Vec3;
export declare function getLocalRotation(out: Quat, pose: Pose, jointIndex: number): Quat;
export declare function getLocalScale(out: Vec3, pose: Pose, jointIndex: number): Vec3;
export declare function setLocalTranslation(pose: Pose, jointIndex: number, value: Vec3): void;
export declare function setLocalRotation(pose: Pose, jointIndex: number, value: Quat): void;
export declare function setLocalScale(pose: Pose, jointIndex: number, value: Vec3): void;
//# sourceMappingURL=Pose.d.ts.map