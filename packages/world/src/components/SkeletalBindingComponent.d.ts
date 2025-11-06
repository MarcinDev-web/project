import { Component } from './Component.js';
import type { Skeleton, Pose } from '@engine/animation';
export declare class SkeletalBindingComponent extends Component {
    static readonly type = "SkeletalBinding";
    skeleton: Skeleton | null;
    pose: Pose | null;
    jointPalette: Float32Array | null;
    getType(): string;
    clone(): SkeletalBindingComponent;
}
//# sourceMappingURL=SkeletalBindingComponent.d.ts.map