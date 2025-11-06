import type { AnimationClip } from '../core/AnimationClip';
export type AnimatorParameterMap = Record<string, number | boolean>;
export type AnimatorState = {
    name: string;
    clip: AnimationClip;
    speed: number;
};
export type AnimatorTransition = {
    from: string;
    to: string;
    duration: number;
    condition?: (params: AnimatorParameterMap) => boolean;
};
export declare class AnimatorController {
    private readonly states;
    private readonly transitions;
    private _defaultState;
    addState(name: string, clip: AnimationClip, speed?: number): this;
    addTransition(t: AnimatorTransition): this;
    get defaultState(): string;
    setDefaultState(name: string): this;
    getState(name: string): AnimatorState;
    getTransitionsFrom(name: string): AnimatorTransition[];
}
//# sourceMappingURL=AnimatorController.d.ts.map