import { AnimationController } from './AnimationController';
import type { AnimationParameter, AnimationParameters, AnimationParameterValue, TransitionCondition, AnimationEasing } from './types';
export interface AnimationStateConfig {
    name: string;
    controller: AnimationController;
    transitions?: AnimationTransitionConfig[];
}
export interface AnimationTransitionConfig {
    to: string;
    blendDuration?: number;
    blendEasing?: AnimationEasing;
    condition?: () => boolean;
    conditions?: TransitionCondition[];
}
export declare class AnimationStateMachine {
    private states;
    private rawStates;
    private currentState;
    private blendState;
    private parameterDefs;
    private parameterValues;
    addState(state: AnimationStateConfig): void;
    update(deltaTime: number): void;
    getSamples(): {
        primary: AnimationController;
        secondary: AnimationController | null;
        blendWeight: number;
    };
    hasState(name: string): boolean;
    getCurrentStateName(): string | null;
    setState(name: string, options?: {
        resetTime?: boolean;
        autoPlay?: boolean;
    }): void;
    clearStates(): void;
    replaceStates(states: AnimationStateConfig[]): void;
    getStateConfigs(): AnimationStateConfig[];
    getStateConfig(name: string): AnimationStateConfig | undefined;
    requestBlendTo(name: string, blendDuration: number, options?: {
        resetTime?: boolean;
        autoPlay?: boolean;
        easing?: AnimationEasing;
    }): void;
    setParameterDefinitions(parameters: AnimationParameter[]): void;
    getParameterDefinitions(): AnimationParameter[];
    setParameters(values: AnimationParameters | null | undefined): void;
    getParameters(): AnimationParameters;
    setParam(name: string, value: boolean | number): void;
    getParam(name: string): AnimationParameterValue;
    setTrigger(name: string): void;
    resetTrigger(name: string): void;
    private compileState;
    private compileTransition;
    private evaluateTransitionConditions;
    private resolveParameterValue;
    private ensureParameterDefinition;
    private consumeTriggerParameters;
    private sanitizeBlendDuration;
    private startTransition;
    private finishTransition;
    private advanceBlend;
    private cloneStateConfig;
}
//# sourceMappingURL=AnimationStateMachine.d.ts.map