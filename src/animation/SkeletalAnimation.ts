import type { Vec3, Quat } from '../math';
import { Skeleton, type PoseBone } from './Skeleton';
import type { AnimationSample } from './types';

export class SkeletalAnimation {
  readonly skeleton: Skeleton;
  pose: PoseBone[];

  constructor(skeleton: Skeleton) {
    this.skeleton = skeleton;
    this.pose = skeleton.createBindPose();
  }

  applySamples(samples: AnimationSample[]): void {
    for (const sample of samples) {
      if (sample.target.type !== 'bone') continue;
      const index = this.skeleton.findBoneIndex(sample.target.bone);
      if (index === -1) continue;
      const bonePose = this.pose[index];
      if (!bonePose) continue;
      switch (sample.target.property) {
        case 'position':
          bonePose.position = [...(sample.value as Vec3)] as Vec3;
          break;
        case 'rotation':
          bonePose.rotation = [...(sample.value as Quat)] as Quat;
          break;
        case 'scale':
          bonePose.scale = [...(sample.value as Vec3)] as Vec3;
          break;
      }
    }
  }
}

