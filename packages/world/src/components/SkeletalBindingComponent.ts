import { Component, registerComponent } from './Component';
import type { Skeleton, Pose } from '@engine/animation';

export class SkeletalBindingComponent extends Component {
  static readonly type = 'SkeletalBinding';

  skeleton: Skeleton | null = null;
  pose: Pose | null = null;
  jointPalette: Float32Array | null = null; // mat4 per joint (length = jointCount * 16)

  getType(): string {
    return SkeletalBindingComponent.type;
  }
}

registerComponent(SkeletalBindingComponent.type, SkeletalBindingComponent);


