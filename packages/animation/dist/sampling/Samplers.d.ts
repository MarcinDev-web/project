import type { Vec3, Quat } from '@engine/core';
import type { TranslationTrack, RotationTrack, ScaleTrack } from '../core/AnimationClip';
export declare function sampleTranslationAt(out: Vec3, track: TranslationTrack, time: number): Vec3;
export declare function sampleScaleAt(out: Vec3, track: ScaleTrack, time: number): Vec3;
export declare function sampleRotationAt(out: Quat, track: RotationTrack, time: number): Quat;
export declare function findInterval(times: Float32Array, time: number): {
    idx: number;
    t: number;
};
//# sourceMappingURL=Samplers.d.ts.map