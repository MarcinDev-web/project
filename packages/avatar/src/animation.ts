import type { Quat, Vec3 } from '@engine/core/math';
import type { AvatarJointName } from './skeleton';

export interface AvatarJointKeyframe {
  readonly position?: Vec3;
  readonly rotation?: Quat;
  readonly scale?: Vec3;
}

export interface AvatarAnimationKeyframe {
  readonly time: number;
  readonly joints: Partial<Record<AvatarJointName, AvatarJointKeyframe>>;
}

export interface AvatarAnimation {
  readonly name: string;
  readonly length: number;
  readonly loop?: boolean;
  readonly frames: readonly AvatarAnimationKeyframe[];
}
