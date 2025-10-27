import { Component, registerComponent } from './Component';
import type { Animator, AnimatorController, Pose, Skeleton, MorphTargetClip } from '@engine/animation';
import { createPose } from '@engine/animation';

export class AnimatorComponent extends Component {
  static readonly type = 'Animator';

  skeleton: Skeleton | null = null;
  pose: Pose | null = null;
  animator: Animator | null = null;
  controller: AnimatorController | null = null;

  morphClip: MorphTargetClip | null = null;
  morphWeights: Float32Array | null = null; // sized to mesh target count when bound

  getType(): string {
    return AnimatorComponent.type;
  }

  setSkeleton(skeleton: Skeleton): void {
    this.skeleton = skeleton;
    this.pose = createPose(skeleton.jointCount);
    if (this.controller) {
      // Lazy: animator is created by the system when controller is present
      // This component only holds data
    }
  }
}

registerComponent(AnimatorComponent.type, AnimatorComponent);


