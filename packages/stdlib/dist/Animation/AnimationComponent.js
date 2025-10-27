import { Component, registerComponent } from '@engine/world';
import { AnimationClip } from './AnimationClip';
import { AnimationController } from './AnimationController';
import { AnimationStateMachine, } from './AnimationStateMachine';
import { Skeleton } from './Skeleton';
export class AnimationComponent extends Component {
    static type = 'Animation';
    skeleton = null;
    pose = null;
    clips = new Map();
    controllers = new Map();
    stateMachine = new AnimationStateMachine();
    activeStateName = null;
    onAttach() {
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
    getType() {
        return AnimationComponent.type;
    }
    addClip(clip) {
        this.clips.set(clip.name, clip);
        let controller = this.controllers.get(clip.name);
        if (!controller) {
            controller = new AnimationController({ clip });
            this.controllers.set(clip.name, controller);
            this.stateMachine.addState({ name: clip.name, controller });
        }
        return controller;
    }
    setSkeleton(skeleton) {
        this.skeleton = skeleton;
        this.pose = skeleton.createBindPose();
    }
    getController(name) {
        return this.controllers.get(name);
    }
    setParameterDefinitions(parameters) {
        this.stateMachine.setParameterDefinitions(parameters);
    }
    getParameterDefinitions() {
        return this.stateMachine.getParameterDefinitions();
    }
    setParameters(values) {
        this.stateMachine.setParameters(values);
    }
    getParameters() {
        return this.stateMachine.getParameters();
    }
    setParam(name, value) {
        this.stateMachine.setParam(name, value);
    }
    getParam(name) {
        const value = this.stateMachine.getParam(name);
        if (typeof value === 'boolean' || typeof value === 'number') {
            return value;
        }
        return null;
    }
    setTrigger(name) {
        this.stateMachine.setTrigger(name);
    }
    resetTrigger(name) {
        this.stateMachine.resetTrigger(name);
    }
    setStates(states) {
        this.stateMachine.replaceStates(states);
    }
    getStates() {
        return this.stateMachine.getStateConfigs();
    }
    getActiveState() {
        return this.stateMachine.getCurrentStateName();
    }
    setActiveState(name) {
        if (!name) {
            this.activeStateName = null;
            return;
        }
        try {
            this.stateMachine.setState(name, { resetTime: false, autoPlay: true });
            this.activeStateName = name;
        }
        catch {
            // Ignore unknown states to avoid crashing the component
        }
    }
    toJSON() {
        const clips = Array.from(this.clips.values()).map((clip) => clip.toJSON());
        const controllers = {};
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
    fromJSON(data) {
        if (!data || typeof data !== 'object')
            return;
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
                if (!clip)
                    continue;
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
        }
        else {
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
            }
            catch {
                this.activeStateName = null;
            }
        }
        else {
            this.activeStateName = null;
        }
    }
    clone() {
        const clone = new AnimationComponent();
        clone.skeleton = this.skeleton;
        clone.pose = this.pose
            ? this.pose.map((bone) => ({
                position: [...bone.position],
                rotation: [...bone.rotation],
                scale: [...bone.scale],
            }))
            : null;
        const controllerMap = new Map();
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
                    controller: clone.controllers.values().next().value ?? clone.addClip(AnimationClip.fromJSON(state.controller.clip.toJSON())),
                };
                const transitions = this.cloneTransitions(state.transitions);
                return transitions ? { ...base, transitions } : base;
            }
            const base = { name: state.name, controller: cloneController };
            const transitions = this.cloneTransitions(state.transitions);
            return transitions ? { ...base, transitions } : base;
        });
        clone.setStates(clonedStates);
        const activeState = this.getActiveState() ?? this.activeStateName;
        if (activeState) {
            try {
                clone.stateMachine.setState(activeState, { resetTime: false, autoPlay: false });
                clone.activeStateName = activeState;
            }
            catch {
                clone.activeStateName = null;
            }
        }
        return clone;
    }
    serializeState(state) {
        const transitions = state.transitions
            ?.map((transition) => this.serializeTransition(transition))
            .filter((transition) => Boolean(transition));
        return {
            name: state.name,
            clip: state.controller.clip.name,
            ...(transitions && transitions.length > 0 ? { transitions } : {}),
        };
    }
    serializeTransition(transition) {
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
            ...(conditions && conditions.length > 0 ? { conditions } : {}),
        };
    }
    deserializeStates(states) {
        const result = [];
        for (const state of states) {
            if (!state || typeof state !== 'object')
                continue;
            const controller = state.clip ? this.controllers.get(state.clip) : this.controllers.get(state.name);
            if (!controller)
                continue;
            const transitions = this.deserializeTransitions(state.transitions);
            const base = { name: state.name, controller };
            result.push(transitions ? { ...base, transitions } : base);
        }
        return result;
    }
    deserializeTransitions(transitions) {
        if (!Array.isArray(transitions) || transitions.length === 0) {
            return undefined;
        }
        const result = [];
        for (const transition of transitions) {
            if (!transition)
                continue;
            const mapped = {
                to: transition.to,
                ...(transition.blendDuration !== undefined ? { blendDuration: transition.blendDuration } : {}),
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
    cloneTransitions(transitions) {
        if (!Array.isArray(transitions) || transitions.length === 0)
            return undefined;
        return transitions.map((transition) => ({
            to: transition.to,
            ...(transition.blendDuration !== undefined ? { blendDuration: transition.blendDuration } : {}),
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
    createControllerFromJSON(clip, data) {
        const speed = typeof data.speed === 'number' && Number.isFinite(data.speed) ? data.speed : 1;
        const weight = typeof data.weight === 'number' && Number.isFinite(data.weight) ? data.weight : 1;
        const loop = data.loop ?? true;
        return new AnimationController({ clip, speed, weight, loop });
    }
}
registerComponent(AnimationComponent.type, AnimationComponent);
//# sourceMappingURL=AnimationComponent.js.map