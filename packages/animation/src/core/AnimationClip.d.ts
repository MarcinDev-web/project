export type Interpolation = 'step' | 'linear' | 'cubic';
export type TranslationTrack = {
    kind: 'translation';
    jointIndex: number;
    times: Float32Array;
    values: Float32Array;
    interpolation: Interpolation;
};
export type RotationTrack = {
    kind: 'rotation';
    jointIndex: number;
    times: Float32Array;
    values: Float32Array;
    interpolation: Interpolation;
};
export type ScaleTrack = {
    kind: 'scale';
    jointIndex: number;
    times: Float32Array;
    values: Float32Array;
    interpolation: Interpolation;
};
export type Track = TranslationTrack | RotationTrack | ScaleTrack;
export type AnimationClip = {
    name: string;
    duration: number;
    tracks: Track[];
};
export declare function createClip(name: string, tracks: Track[]): AnimationClip;
export declare function validateTrack(track: Track): void;
//# sourceMappingURL=AnimationClip.d.ts.map