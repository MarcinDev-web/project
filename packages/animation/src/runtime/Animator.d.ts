import type { Pose } from '../core/Pose';
import type { AnimatorController } from './AnimatorController';
export declare class Animator {
    private readonly controller;
    private currentStateName;
    private currentTime;
    private readonly params;
    private fadeActive;
    private fadeFromStateName;
    private fadeToStateName;
    private fadeTime;
    private fadeDuration;
    private fadeFromTime;
    private fadeToTime;
    private readonly poseA;
    private readonly poseB;
    constructor(controller: AnimatorController, jointCount: number);
    setParameter(name: string, value: number | boolean): void;
    getParameter(name: string): number | boolean | undefined;
    setState(name: string, resetTime?: boolean): void;
    update(deltaSeconds: number): void;
    sample(outPose: Pose): void;
    crossfadeTo(toStateName: string, duration: number): void;
}
//# sourceMappingURL=Animator.d.ts.map