import type { Interpolation } from './AnimationClip';
export type MorphChannel = {
    targetIndex: number;
    times: Float32Array;
    values: Float32Array;
    interpolation: Interpolation;
};
export type MorphTargetClip = {
    name: string;
    duration: number;
    channels: MorphChannel[];
    targetCount: number;
};
export declare function createMorphClip(name: string, channels: MorphChannel[], targetCount: number): MorphTargetClip;
/**
 * Samples morph weights for all targets at the given time into `outWeights`.
 * `outWeights.length` must equal `clip.targetCount`. Channels not affecting a target leave its weight at 0.
 */
export declare function sampleMorphWeightsAt(outWeights: Float32Array, clip: MorphTargetClip, time: number): Float32Array;
//# sourceMappingURL=Morph.d.ts.map