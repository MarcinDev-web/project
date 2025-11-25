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

export class Skeleton {
  readonly bones: Bone[];

  constructor(bones: Bone[]) {
    if (!Array.isArray(bones) || bones.length === 0) {
      throw new TypeError('Skeleton must created with non-empty bone array');
    }
    this.bones = bones.map((bone) => ({
      ...bone,
      bindPosition: [...bone.bindPosition] as Vec3,
      bindRotation: [...bone.bindRotation] as Quat,
      bindScale: [...bone.bindScale] as Vec3,
    }));
  }

  findBoneIndex(name: string): number {
    return this.bones.findIndex((bone) => bone.name === name);
  }

  createBindPose(): PoseBone[] {
    return this.bones.map((bone) => ({
      position: [...bone.bindPosition] as Vec3,
      rotation: [...bone.bindRotation] as Quat,
      scale: [...bone.bindScale] as Vec3,
    }));
  }
}
