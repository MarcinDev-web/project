import { Skeleton, type PoseBone } from './Skeleton';
import type { AnimationSample } from './types';
export declare class SkeletalAnimation {
    readonly skeleton: Skeleton;
    pose: PoseBone[];
    constructor(skeleton: Skeleton);
    applySamples(samples: AnimationSample[]): void;
}
//# sourceMappingURL=SkeletalAnimation.d.ts.map