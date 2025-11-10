import { AnimationController } from './AnimationController';
import type {
  AnimationParameter,
  AnimationParameterType,
  AnimationParameters,
  AnimationParameterValue,
  TransitionCondition,
  AnimationEasing,
} from './types';

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

interface CompiledTransition {
  to: string;
  blendDuration: number;
  blendEasing?: AnimationEasing;
  evaluate: () => boolean;
  consumeTriggers: string[];
  source: AnimationTransitionConfig;
}

interface CompiledState {
  name: string;
  controller: AnimationController;
  transitions: CompiledTransition[];
}

export class AnimationStateMachine {
  private states = new Map<string, CompiledState>();
  private rawStates = new Map<string, AnimationStateConfig>();
  private currentState: CompiledState | null = null;
  private blendState: {
    target: CompiledState;
    duration: number;
    elapsed: number;
    easing?: AnimationEasing;
  } | null = null;

  private parameterDefs = new Map<string, AnimationParameter>();
  private parameterValues = new Map<string, AnimationParameterValue>();

  addState(state: AnimationStateConfig): void {
    if (!state || typeof state !== 'object') {
      throw new TypeError('Animation state must be an object');
    }
    if (!state.name || !state.controller) {
      throw new TypeError('Animation state must include name and controller');
    }
    state.controller.stop();
    const clonedState = this.cloneStateConfig(state);
    const compiled = this.compileState(clonedState);
    this.states.set(compiled.name, compiled);
    this.rawStates.set(clonedState.name, clonedState);
    if (this.currentState?.name === compiled.name) {
      this.currentState = compiled;
    }
    if (this.blendState?.target.name === compiled.name) {
      const blendState = {
        target: compiled,
        duration: this.blendState.duration,
        elapsed: this.blendState.elapsed,
        ...(this.blendState.easing !== undefined ? { easing: this.blendState.easing } : {}),
      };
      this.blendState = blendState;
    }
    if (!this.currentState) {
      this.setState(compiled.name, { resetTime: true, autoPlay: false });
    }
  }

  update(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;
    if (!this.currentState) return;
    this.currentState.controller.update(deltaTime);
    if (this.blendState) {
      this.advanceBlend(deltaTime);
      return;
    }
    for (const transition of this.currentState.transitions) {
      if (!transition.evaluate()) {
        continue;
      }
      const target = this.states.get(transition.to);
      if (!target) {
        continue;
      }
      this.startTransition(target, transition.blendDuration, transition.consumeTriggers, transition.blendEasing);
      break;
    }
    if (this.blendState) {
      this.advanceBlend(deltaTime);
    }
  }

  getSamples(): { primary: AnimationController; secondary: AnimationController | null; blendWeight: number } {
    if (!this.currentState) {
      throw new Error('AnimationStateMachine has no active state');
    }
    if (!this.blendState) {
      return { primary: this.currentState.controller, secondary: null, blendWeight: 0 };
    }
    const { duration, elapsed, target, easing } = this.blendState;
    const rawWeight = duration > 0 ? Math.min(1, elapsed / duration) : 1;
    const weight = this.applyBlendEasing(rawWeight, easing);
    return { primary: this.currentState.controller, secondary: target.controller, blendWeight: weight };
  }

  hasState(name: string): boolean {
    return this.states.has(name);
  }

  getCurrentStateName(): string | null {
    return this.currentState?.name ?? null;
  }

  setState(name: string, options?: { resetTime?: boolean; autoPlay?: boolean }): void {
    const target = this.states.get(name);
    if (!target) {
      throw new Error(`AnimationStateMachine: unknown state "${name}"`);
    }
    const { resetTime = true, autoPlay = true } = options ?? {};
    if (this.currentState && this.currentState !== target) {
      this.currentState.controller.pause();
    }
    if (resetTime) {
      target.controller.time.value = 0;
    }
    if (autoPlay) {
      target.controller.play();
    } else {
      target.controller.pause();
    }
    this.currentState = target;
    this.blendState = null;
  }

  clearStates(): void {
    this.states.clear();
    this.rawStates.clear();
    this.currentState = null;
    this.blendState = null;
  }

  replaceStates(states: AnimationStateConfig[]): void {
    this.clearStates();
    for (const state of states) {
      try {
        this.addState(state);
      } catch {
        // Skip invalid states silently to keep playback resilient
      }
    }
  }

  getStateConfigs(): AnimationStateConfig[] {
    return Array.from(this.rawStates.values()).map((state) => this.cloneStateConfig(state));
  }

  getStateConfig(name: string): AnimationStateConfig | undefined {
    const state = this.rawStates.get(name);
    return state ? this.cloneStateConfig(state) : undefined;
  }

  setParameterDefinitions(parameters: AnimationParameter[]): void {
    const nextDefs = new Map<string, AnimationParameter>();
    const nextValues = new Map<string, AnimationParameterValue>();

    for (const param of parameters) {
      if (!param || typeof param.name !== 'string') continue;
      const existing = this.parameterDefs.get(param.name);
      nextDefs.set(param.name, { ...param });
      const prev = existing ? this.parameterValues.get(param.name) : undefined;
      let value: AnimationParameterValue;
      switch (param.type) {
        case 'bool': {
          if (typeof prev === 'boolean') {
            value = prev;
          } else if (typeof param.defaultValue === 'boolean') {
            value = param.defaultValue;
          } else {
            value = false;
          }
          break;
        }
        case 'number': {
          const prevNumber = typeof prev === 'number' && Number.isFinite(prev) ? prev : undefined;
          const defaultNumber = typeof param.defaultValue === 'number' && Number.isFinite(param.defaultValue)
            ? param.defaultValue
            : undefined;
          value = prevNumber ?? defaultNumber ?? 0;
          break;
        }
        case 'trigger': {
          value = prev === true ? true : null;
          break;
        }
        default: {
          value = null;
        }
      }
      nextValues.set(param.name, value);
    }

    this.parameterDefs = nextDefs;
    this.parameterValues = nextValues;
  }

  getParameterDefinitions(): AnimationParameter[] {
    return Array.from(this.parameterDefs.values()).map((param) => ({ ...param }));
  }

  setParameters(values: AnimationParameters | null | undefined): void {
    if (!values) return;
    for (const [name, rawValue] of Object.entries(values)) {
      const definition = this.parameterDefs.get(name);
      if (!definition) continue;
      switch (definition.type) {
        case 'bool': {
          this.parameterValues.set(name, Boolean(rawValue));
          break;
        }
        case 'number': {
          const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
          this.parameterValues.set(
            name,
            Number.isFinite(numeric)
              ? numeric
              : (typeof definition.defaultValue === 'number' && Number.isFinite(definition.defaultValue)
                  ? definition.defaultValue
                  : 0)
          );
          break;
        }
        case 'trigger': {
          this.parameterValues.set(name, rawValue ? true : null);
          break;
        }
      }
    }
  }

  getParameters(): AnimationParameters {
    const result: AnimationParameters = {};
    for (const [name, value] of this.parameterValues) {
      result[name] = value ?? null;
    }
    return result;
  }

  setParam(name: string, value: boolean | number): void {
    if (typeof value === 'number') {
      this.ensureParameterDefinition(name, 'number');
      this.parameterValues.set(name, Number.isFinite(value) ? value : 0);
    } else {
      this.ensureParameterDefinition(name, 'bool');
      this.parameterValues.set(name, Boolean(value));
    }
  }

  getParam(name: string): AnimationParameterValue {
    return this.resolveParameterValue(name);
  }

  setTrigger(name: string): void {
    this.ensureParameterDefinition(name, 'trigger');
    this.parameterValues.set(name, true);
  }

  resetTrigger(name: string): void {
    this.ensureParameterDefinition(name, 'trigger');
    this.parameterValues.set(name, null);
  }

  private compileState(state: AnimationStateConfig): CompiledState {
    const transitions = (state.transitions ?? []).map((transition) =>
      this.compileTransition(transition)
    );
    return {
      name: state.name,
      controller: state.controller,
      transitions,
    };
  }

  private compileTransition(transition: AnimationTransitionConfig): CompiledTransition {
    const blendDuration = this.sanitizeBlendDuration(transition.blendDuration);
    if (typeof transition.condition === 'function') {
      return {
        to: transition.to,
        blendDuration,
        ...(transition.blendEasing !== undefined ? { blendEasing: transition.blendEasing } : {}),
        evaluate: transition.condition,
        consumeTriggers: [],
        source: transition,
      };
    }

    const conditions = Array.isArray(transition.conditions) ? transition.conditions : [];
    const consumeTriggers = Array.from(
      new Set(
        conditions
          .filter((condition) => condition.operator === 'triggered')
          .map((condition) => condition.parameter)
      )
    );

    const evaluate = conditions.length === 0
      ? () => true
      : () => this.evaluateTransitionConditions(conditions);

    return {
      to: transition.to,
      blendDuration,
      ...(transition.blendEasing !== undefined ? { blendEasing: transition.blendEasing } : {}),
      evaluate,
      consumeTriggers,
      source: transition,
    };
  }

  private evaluateTransitionConditions(conditions: TransitionCondition[]): boolean {
    for (const condition of conditions) {
      const definition = this.parameterDefs.get(condition.parameter);
      const value = this.resolveParameterValue(condition.parameter);
      const type: AnimationParameterType = definition?.type
        ?? (typeof value === 'number'
          ? 'number'
          : typeof value === 'boolean'
            ? 'bool'
            : 'trigger');

      switch (condition.operator) {
        case 'triggered': {
          if (type !== 'trigger') return false;
          if (value !== true) return false;
          break;
        }
        case '==':
        case '!=': {
          if (type === 'number') {
            const compareValue = typeof condition.value === 'number'
              ? condition.value
              : Number(condition.value);
            if (!Number.isFinite(compareValue)) return false;
            const numericValue = typeof value === 'number' ? value : Number(value);
            if (!Number.isFinite(numericValue)) return false;
            if (condition.operator === '==') {
              if (numericValue !== compareValue) return false;
            } else if (numericValue === compareValue) {
              return false;
            }
          } else if (type === 'bool') {
            const expected = typeof condition.value === 'boolean'
              ? condition.value
              : Boolean(condition.value);
            const boolValue = Boolean(value);
            if (condition.operator === '==') {
              if (boolValue !== expected) return false;
            } else if (boolValue === expected) {
              return false;
            }
          } else {
            return false;
          }
          break;
        }
        case '>':
        case '>=':
        case '<':
        case '<=': {
          if (type !== 'number') return false;
          const compareValue = typeof condition.value === 'number'
            ? condition.value
            : Number(condition.value);
          const numericValue = typeof value === 'number' ? value : Number(value);
          if (!Number.isFinite(compareValue) || !Number.isFinite(numericValue)) return false;
          switch (condition.operator) {
            case '>':
              if (!(numericValue > compareValue)) return false;
              break;
            case '>=':
              if (!(numericValue >= compareValue)) return false;
              break;
            case '<':
              if (!(numericValue < compareValue)) return false;
              break;
            case '<=':
              if (!(numericValue <= compareValue)) return false;
              break;
          }
          break;
        }
        default:
          return false;
      }
    }
    return true;
  }

  private resolveParameterValue(name: string): AnimationParameterValue {
    if (this.parameterValues.has(name)) {
      const stored = this.parameterValues.get(name);
      return stored ?? null;
    }
    const definition = this.parameterDefs.get(name);
    if (!definition) {
      return null;
    }
    let value: AnimationParameterValue;
    switch (definition.type) {
      case 'bool':
        value = typeof definition.defaultValue === 'boolean' ? definition.defaultValue : false;
        break;
      case 'number':
        value = typeof definition.defaultValue === 'number' && Number.isFinite(definition.defaultValue)
          ? definition.defaultValue
          : 0;
        break;
      case 'trigger':
        value = null;
        break;
      default:
        value = null;
    }
    this.parameterValues.set(name, value);
    return value;
  }

  private ensureParameterDefinition(name: string, type: AnimationParameterType): void {
    const existing = this.parameterDefs.get(name);
    if (!existing) {
      const definition: AnimationParameter = { name, type } as AnimationParameter;
      this.parameterDefs.set(name, definition);
      switch (type) {
        case 'bool':
          this.parameterValues.set(name, false);
          break;
        case 'number':
          this.parameterValues.set(name, 0);
          break;
        case 'trigger':
          this.parameterValues.set(name, null);
          break;
      }
      return;
    }
    if (existing.type !== type) {
      throw new TypeError(
        `AnimationStateMachine: parameter "${name}" already defined as ${existing.type}, cannot redefine as ${type}`
      );
    }
  }

  private consumeTriggerParameters(names: readonly string[]): void {
    if (!names.length) return;
    for (const name of names) {
      this.parameterValues.set(name, null);
    }
  }

  private applyBlendEasing(weight: number, easing?: AnimationEasing): number {
    if (!Number.isFinite(weight)) return 0;
    const clamped = Math.min(1, Math.max(0, weight));
    if (!easing || easing === 'linear') {
      return clamped;
    }
    switch (easing) {
      case 'ease-in':
        return clamped * clamped;
      case 'ease-out':
        return clamped * (2 - clamped);
      case 'ease-in-out':
        return clamped < 0.5 ? 2 * clamped * clamped : -1 + (4 - 2 * clamped) * clamped;
      default:
        return clamped;
    }
  }

  private startTransition(
    target: CompiledState,
    blendDuration: number,
    consumeTriggers: readonly string[],
    blendEasing?: AnimationEasing
  ): void {
    if (this.currentState === target) return;
    if (this.blendState && this.blendState.target === target) return;

    this.consumeTriggerParameters(consumeTriggers);

    target.controller.play();
    if (blendDuration <= 0) {
      this.currentState?.controller.pause();
      this.currentState = target;
      this.blendState = null;
      return;
    }

    this.blendState = { target, duration: blendDuration, elapsed: 0, ...(blendEasing !== undefined ? { easing: blendEasing } : {}) };
  }

  private finishTransition(): void {
    if (!this.blendState) return;
    const previous = this.currentState;
    if (previous && previous !== this.blendState.target) {
      previous.controller.pause();
    }
    this.currentState = this.blendState.target;
    this.blendState = null;
  }

  private advanceBlend(deltaTime: number): void {
    const blend = this.blendState;
    if (!blend) return;
    blend.elapsed += deltaTime;
    if (blend.duration === 0 || blend.elapsed >= blend.duration) {
      this.finishTransition();
    } else {
      blend.target.controller.update(deltaTime);
    }
  }

  /**
   * Request an immediate transition to the target state with a given blend duration.
   * If there is no current state, behaves like setState().
   */
  requestBlendTo(name: string, blendDuration: number, options?: { resetTime?: boolean; autoPlay?: boolean; easing?: AnimationEasing }): void {
    const target = this.states.get(name);
    if (!target) {
      throw new Error(`AnimationStateMachine: unknown state "${name}"`);
    }
    const duration = this.sanitizeBlendDuration(blendDuration);
    // If no current state, fallback to setState semantics
    if (!this.currentState) {
      this.setState(name, options);
      return;
    }
    // Reset target time if requested
    if (options?.resetTime) {
      target.controller.time.value = 0;
    }
    // Ensure target playback state per options (default autoPlay=true)
    if (options?.autoPlay === false) {
      target.controller.pause();
    } else {
      target.controller.play();
    }
    // Start blend
    const blendState = duration > 0 
      ? { target, duration, elapsed: 0, ...(options?.easing !== undefined ? { easing: options.easing } : {}) }
      : null;
    this.blendState = blendState;
    if (!this.blendState) {
      // Immediate switch
      this.currentState.controller.pause();
      this.currentState = target;
    }
  }

  private sanitizeBlendDuration(duration?: number): number {
    if (!Number.isFinite(duration)) return 0;
    return Math.max(0, duration ?? 0);
  }

  private cloneStateConfig(state: AnimationStateConfig): AnimationStateConfig {
    const base: AnimationStateConfig = {
      name: state.name,
      controller: state.controller,
    };

    if (state.transitions) {
      base.transitions = state.transitions.map((transition) => ({
        to: transition.to,
        ...(transition.blendDuration !== undefined
          ? { blendDuration: transition.blendDuration }
          : {}),
        ...(transition.blendEasing !== undefined
          ? { blendEasing: transition.blendEasing }
          : {}),
        ...(typeof transition.condition === 'function'
          ? { condition: transition.condition }
          : {}),
        ...(transition.conditions
          ? {
              conditions: transition.conditions.map((condition) => ({
                parameter: condition.parameter,
                operator: condition.operator,
                ...(condition.value !== undefined ? { value: condition.value } : {}),
              })),
            }
          : {}),
      }));
    }

    return base;
  }
}

