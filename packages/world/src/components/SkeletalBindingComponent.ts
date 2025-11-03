import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { Skeleton, Pose } from '@engine/animation';

export class SkeletalBindingComponent extends Component {
  static readonly type = 'SkeletalBinding';

  skeleton: Skeleton | null = null;
  pose: Pose | null = null;
  jointPalette: Float32Array | null = null; // mat4 per joint (length = jointCount * 16)

  getType(): string {
    return SkeletalBindingComponent.type;
  }

  override clone(): SkeletalBindingComponent {
    const clone = new SkeletalBindingComponent();
    clone.skeleton = this.skeleton;
    clone.pose = this.pose;
    clone.jointPalette = this.jointPalette ? new Float32Array(this.jointPalette) : null;
    return clone;
  }
}

registerComponent(SkeletalBindingComponent.type, SkeletalBindingComponent);


