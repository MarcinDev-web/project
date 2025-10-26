import type { Scene } from '@engine/world';
export interface AnimationSystemOptions {
    enableSkeletal?: boolean;
}
export declare class AnimationSystem {
    private readonly scene;
    private readonly enableSkeletal;
    constructor(scene: Scene, options?: AnimationSystemOptions);
    update(deltaTime: number): void;
    private applyTransformSamples;
    private applySkeletalSamples;
    private clampControllerWeight;
    private resolveControllerWeights;
    private interpolateWeightedVec3;
    private interpolateWeightedQuat;
}
//# sourceMappingURL=AnimationSystem.d.ts.map