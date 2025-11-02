import { type Unsubscribe } from '@engine/core/event/EventBus';
import { type Quat, type Vec3 } from '@engine/core/math';
import type { AvatarJointName, AvatarSkeleton } from './skeleton';
export interface AvatarJointKeyframe {
    readonly position?: Vec3;
    readonly rotation?: Quat;
}
export interface AvatarAnimationKeyframe {
    readonly time: number;
    readonly joints: Partial<Record<AvatarJointName, AvatarJointKeyframe>>;
}
export interface AvatarAnimation {
    readonly name: string;
    readonly length: number;
    readonly loop?: boolean;
    readonly frames: readonly AvatarAnimationKeyframe[];
}
export interface AvatarAnimationFinishedEvent {
    readonly animation: AvatarAnimation;
}
export interface AvatarAnimationStopOptions {
    readonly resetPose?: boolean;
}
/**
 * Minimal animation player supporting quaternion slerp + vector lerp.
 */
export declare class AvatarAnimationPlayer {
    private readonly skeleton;
    private animation;
    private time;
    private readonly tracks;
    private readonly events;
    private finished;
    constructor(skeleton: AvatarSkeleton);
    play(animation: AvatarAnimation, time?: number): void;
    stop(options?: AvatarAnimationStopOptions): void;
    update(deltaTime: number): void;
    onFinished(handler: (event: AvatarAnimationFinishedEvent) => void): Unsubscribe;
    onceFinished(handler: (event: AvatarAnimationFinishedEvent) => void): Unsubscribe;
    isFinished(): boolean;
    private sampleAndApply;
    private prepareTracks;
    private checkForCompletion;
}
//# sourceMappingURL=animation.d.ts.map