import { Component } from './Component';
import type { Animator, AnimatorController, Pose, Skeleton, MorphTargetClip } from '@engine/animation';
export declare class AnimatorComponent extends Component {
    static readonly type = "Animator";
    skeleton: Skeleton | null;
    pose: Pose | null;
    animator: Animator | null;
    controller: AnimatorController | null;
    morphClip: MorphTargetClip | null;
    morphWeights: Float32Array | null;
    getType(): string;
    setSkeleton(skeleton: Skeleton): void;
    clone(): AnimatorComponent;
}
//# sourceMappingURL=AnimatorComponent.d.ts.map