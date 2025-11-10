import { Component, registerComponent } from '@engine/world';
import { AnimationClip } from './AnimationClip';
import { AnimationController } from './AnimationController';
import {
  AnimationStateMachine,
  type AnimationStateConfig,
  type AnimationTransitionConfig,
} from './AnimationStateMachine';
import { Skeleton, type PoseBone } from './Skeleton';
import type {
  AnimationComponentJSON,
  AnimationControllerJSON,
  AnimationParameter,
  AnimationStateJSON,
  AnimationTransitionJSON,
  AnimationParameters,
  AnimationEasing,
} from './types';

export class AnimationComponent extends Component {
  static readonly type = 'Animation';

  skeleton: Skeleton | null = null;
  pose: PoseBone[] | null = null;
  clips = new Map<string, AnimationClip>();
  controllers = new Map<string, AnimationController>();
  stateMachine = new AnimationStateMachine();
  private activeStateName: string | null = null;

  onAttach(): void {
    super.onAttach();
    if (this.clips.size === 0) {
      return;
    }
    for (const clip of this.clips.values()) {
      if (!this.controllers.has(clip.name)) {
        const controller = new AnimationController({ clip });
        this.controllers.set(clip.name, controller);
        this.stateMachine.addState({ name: clip.name, controller });
      }
    }
  }

  getType(): string {
    return AnimationComponent.type;
  }

  addClip(clip: AnimationClip): AnimationController {
    this.clips.set(clip.name, clip);
    let controller = this.controllers.get(clip.name);
    if (!controller) {
      controller = new AnimationController({ clip });
      this.controllers.set(clip.name, controller);
      this.stateMachine.addState({ name: clip.name, controller });
    }
    return controller;
  }

  setSkeleton(skeleton: Skeleton): void {
    this.skeleton = skeleton;
    this.pose = skeleton.createBindPose();
  }

  getController(name: string): AnimationController | undefined {
    return this.controllers.get(name);
  }

  setParameterDefinitions(parameters: AnimationParameter[]): void {
    this.stateMachine.setParameterDefinitions(parameters);
  }

  getParameterDefinitions(): AnimationParameter[] {
    return this.stateMachine.getParameterDefinitions();
  }

  setParameters(values: AnimationParameters | null | undefined): void {
    this.stateMachine.setParameters(values);
  }

  getParameters(): AnimationParameters {
    return this.stateMachine.getParameters();
  }

  setParam(name: string, value: boolean | number): void {
    this.stateMachine.setParam(name, value);
  }

  getParam(name: string): boolean | number | null {
    const value = this.stateMachine.getParam(name);
    if (typeof value === 'boolean' || typeof value === 'number') {
      return value;
    }
    return null;
  }

  setTrigger(name: string): void {
    this.stateMachine.setTrigger(name);
  }

  resetTrigger(name: string): void {
    this.stateMachine.resetTrigger(name);
  }

  setStates(states: AnimationStateConfig[]): void {
    this.stateMachine.replaceStates(states);
  }

  getStates(): AnimationStateConfig[] {
    return this.stateMachine.getStateConfigs();
  }

  getActiveState(): string | null {
    return this.stateMachine.getCurrentStateName();
  }

  setActiveState(name: string | null, blendTime?: number, blendEasing?: AnimationEasing): void {
    if (!name) {
      this.activeStateName = null;
      return;
    }
    try {
      const current = this.stateMachine.getCurrentStateName();
      if (current && current !== name && typeof blendTime === 'number' && blendTime > 0) {
        const options: { resetTime: boolean; autoPlay: boolean; easing?: AnimationEasing } = {
          resetTime: false,
          autoPlay: true,
        };
        if (blendEasing !== undefined) {
          options.easing = blendEasing;
        }
        this.stateMachine.requestBlendTo(name, blendTime, options);
      } else {
        this.stateMachine.setState(name, { resetTime: false, autoPlay: true });
      }
      this.activeStateName = name;
    } catch {
      // Ignore unknown states to avoid crashing the component
    }
  }

  toJSON(): AnimationComponentJSON {
    const clips = Array.from(this.clips.values()).map((clip) => clip.toJSON());
    const controllers: Record<string, AnimationControllerJSON> = {};
    for (const [name, controller] of this.controllers) {
      controllers[name] = {
        clip: controller.clip.name,
        speed: controller.speed.value,
        weight: controller.weight.value,
        loop: controller.loop.value,
      };
    }

    const states = this.stateMachine.getStateConfigs().map((state) => this.serializeState(state));
    const parameters = this.getParameterDefinitions();
    const parameterValues = this.stateMachine.getParameters();
    const activeState = this.stateMachine.getCurrentStateName() ?? this.activeStateName ?? undefined;

    return {
      clips,
      ...(Object.keys(controllers).length > 0 ? { controllers } : {}),
      ...(states.length > 0 ? { states } : {}),
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(Object.keys(parameterValues).length > 0 ? { parameterValues } : {}),
      ...(activeState ? { activeState } : {}),
    };
  }

  fromJSON(data: AnimationComponentJSON): void {
    if (!data || typeof data !== 'object') return;

    this.clips.clear();
    this.controllers.clear();
    this.stateMachine.clearStates();

    if (Array.isArray(data.clips)) {
      for (const clipData of data.clips) {
        const clip = AnimationClip.fromJSON(clipData);
        this.clips.set(clip.name, clip);
      }
    }

    if (data.controllers && typeof data.controllers === 'object') {
      for (const [name, controllerData] of Object.entries(data.controllers)) {
        const clip = controllerData.clip ? this.clips.get(controllerData.clip) : this.clips.get(name);
        if (!clip) continue;
        const controller = this.createControllerFromJSON(clip, controllerData);
        this.controllers.set(name, controller);
      }
    }

    // Ensure controllers exist for every clip
    for (const clip of this.clips.values()) {
      if (!this.controllers.has(clip.name)) {
        const controller = new AnimationController({ clip });
        this.controllers.set(clip.name, controller);
      }
    }

    if (Array.isArray(data.parameters)) {
      this.stateMachine.setParameterDefinitions(data.parameters);
    }
    if (data.parameterValues && typeof data.parameterValues === 'object') {
      this.stateMachine.setParameters(data.parameterValues);
    }

    if (Array.isArray(data.states)) {
      const stateConfigs = this.deserializeStates(data.states);
      this.stateMachine.replaceStates(stateConfigs);
    } else {
      // Backward compatibility: create simple states from clip names
      const fallbackStates = Array.from(this.controllers.entries()).map(([name, controller]) => ({
        name,
        controller,
      }));
      this.stateMachine.replaceStates(fallbackStates);
    }

    const activeState = data.activeState ?? null;
    if (activeState) {
      try {
        this.stateMachine.setState(activeState, { resetTime: false, autoPlay: true });
        this.activeStateName = activeState;
      } catch {
        this.activeStateName = null;
      }
    } else {
      this.activeStateName = null;
    }
  }

  clone(): AnimationComponent {
    const clone = new AnimationComponent();
    clone.skeleton = this.skeleton;
    clone.pose = this.pose
      ? this.pose.map((bone) => ({
          position: [...bone.position] as PoseBone['position'],
          rotation: [...bone.rotation] as PoseBone['rotation'],
          scale: [...bone.scale] as PoseBone['scale'],
        }))
      : null;
    const controllerMap = new Map<AnimationController, AnimationController>();
    for (const [name, clip] of this.clips.entries()) {
      const clipClone = AnimationClip.fromJSON(clip.toJSON());
      const cloneController = clone.addClip(clipClone);
      const sourceController = this.controllers.get(name);
      if (sourceController) {
        cloneController.speed.value = sourceController.speed.value;
        cloneController.weight.value = sourceController.weight.value;
        cloneController.loop.value = sourceController.loop.value;
        controllerMap.set(sourceController, cloneController);
      }
    }

    // Replace auto-generated states with serialized versions
    clone.stateMachine.clearStates();

    const parameterDefinitions = this.getParameterDefinitions().map((param) => ({ ...param }));
    clone.setParameterDefinitions(parameterDefinitions);
    const parameters = this.getParameters();
    clone.setParameters({ ...parameters });

    const clonedStates = this.getStates().map((state) => {
      const cloneController = controllerMap.get(state.controller)
        ?? clone.controllers.get(state.controller.clip.name)
        ?? clone.controllers.get(state.name);
      if (!cloneController) {
        const base = {
          name: state.name,
          controller: clone.controllers.values().next().value ?? clone.addClip(
            AnimationClip.fromJSON(state.controller.clip.toJSON())
          ),
        } as const;
        const transitions = this.cloneTransitions(state.transitions);
        return transitions ? { ...base, transitions } : base;
      }
      const base = { name: state.name, controller: cloneController } as const;
      const transitions = this.cloneTransitions(state.transitions);
      return transitions ? { ...base, transitions } : base;
    });
    clone.setStates(clonedStates);

    const activeState = this.getActiveState() ?? this.activeStateName;
    if (activeState) {
      try {
        clone.stateMachine.setState(activeState, { resetTime: false, autoPlay: false });
        clone.activeStateName = activeState;
      } catch {
        clone.activeStateName = null;
      }
    }
    return clone;
  }

  private serializeState(state: AnimationStateConfig): AnimationStateJSON {
    const transitions = state.transitions
      ?.map((transition) => this.serializeTransition(transition))
      .filter((transition): transition is AnimationTransitionJSON => Boolean(transition));
    return {
      name: state.name,
      clip: state.controller.clip.name,
      ...(transitions && transitions.length > 0 ? { transitions } : {}),
    };
  }

  private serializeTransition(transition: AnimationTransitionConfig): AnimationTransitionJSON | undefined {
    if (typeof transition.condition === 'function') {
      return undefined;
    }
    const conditions = transition.conditions?.map((condition) => ({
      parameter: condition.parameter,
      operator: condition.operator,
      ...(condition.value !== undefined ? { value: condition.value } : {}),
    }));
    return {
      to: transition.to,
      ...(transition.blendDuration !== undefined ? { blendDuration: transition.blendDuration } : {}),
      ...(transition.blendEasing !== undefined ? { blendEasing: transition.blendEasing } : {}),
      ...(conditions && conditions.length > 0 ? { conditions } : {}),
    };
  }

  private deserializeStates(states: AnimationStateJSON[]): AnimationStateConfig[] {
    const result: AnimationStateConfig[] = [];
    for (const state of states) {
      if (!state || typeof state !== 'object') continue;
      const controller = state.clip ? this.controllers.get(state.clip) : this.controllers.get(state.name);
      if (!controller) continue;
      const transitions = this.deserializeTransitions(state.transitions);
      const base = { name: state.name, controller } as const;
      result.push(transitions ? { ...base, transitions } : base);
    }
    return result;
  }

  private deserializeTransitions(transitions: AnimationTransitionJSON[] | undefined): AnimationTransitionConfig[] | undefined {
    if (!Array.isArray(transitions) || transitions.length === 0) {
      return undefined;
    }
    const result: AnimationTransitionConfig[] = [];
    for (const transition of transitions) {
      if (!transition) continue;
      const mapped: AnimationTransitionConfig = {
        to: transition.to,
        ...(transition.blendDuration !== undefined ? { blendDuration: transition.blendDuration } : {}),
        ...(transition.blendEasing !== undefined ? { blendEasing: transition.blendEasing } : {}),
        ...(transition.conditions
          ? {
              conditions: transition.conditions.map((condition) => ({
                parameter: condition.parameter,
                operator: condition.operator,
                ...(condition.value !== undefined ? { value: condition.value } : {}),
              })),
            }
          : {}),
      };
      result.push(mapped);
    }
    return result.length > 0 ? result : undefined;
  }

  private cloneTransitions(transitions: AnimationTransitionConfig[] | undefined): AnimationTransitionConfig[] | undefined {
    if (!Array.isArray(transitions) || transitions.length === 0) return undefined;
    return transitions.map((transition) => ({
      to: transition.to,
      ...(transition.blendDuration !== undefined ? { blendDuration: transition.blendDuration } : {}),
      ...(transition.blendEasing !== undefined ? { blendEasing: transition.blendEasing } : {}),
      ...(typeof transition.condition === 'function' ? { condition: transition.condition } : {}),
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

  private createControllerFromJSON(clip: AnimationClip, data: AnimationControllerJSON): AnimationController {
    const speed = typeof data.speed === 'number' && Number.isFinite(data.speed) ? data.speed : 1;
    const weight = typeof data.weight === 'number' && Number.isFinite(data.weight) ? data.weight : 1;
    const loop = data.loop ?? true;
    return new AnimationController({ clip, speed, weight, loop });
  }
}

registerComponent(AnimationComponent.type, AnimationComponent);

