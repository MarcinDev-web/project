import { type Signal } from '@preact/signals-core';
import { AnimationClip } from './AnimationClip';
import type { AnimationSample } from './types';
export interface AnimationControllerOptions {
    clip: AnimationClip;
    speed?: number;
    weight?: number;
    loop?: boolean;
}
export declare class AnimationController {
    readonly clip: AnimationClip;
    readonly time: Signal<number>;
    readonly playing: Signal<boolean>;
    speed: Signal<number>;
    weight: Signal<number>;
    loop: Signal<boolean>;
    constructor(options: AnimationControllerOptions);
    play(): void;
    pause(): void;
    stop(): void;
    update(deltaTime: number): void;
    sample(): AnimationSample[];
}
//# sourceMappingURL=AnimationController.d.ts.map