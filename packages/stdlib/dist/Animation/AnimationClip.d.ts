import type { AnimationClipJSON, AnimationSample, AnimationTrack } from './types';
export declare class AnimationClip {
    readonly name: string;
    readonly duration: number;
    readonly tracks: AnimationTrack[];
    constructor(options: {
        name: string;
        duration: number;
        tracks?: AnimationTrack[];
    });
    sample(time: number): AnimationSample[];
    toJSON(): AnimationClipJSON;
    static fromJSON(data: AnimationClipJSON): AnimationClip;
}
//# sourceMappingURL=AnimationClip.d.ts.map