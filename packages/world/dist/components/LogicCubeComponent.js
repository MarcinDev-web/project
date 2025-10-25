/**
 * LogicCubeComponent - Component for logic cube entities.
 * Stores the logic cube type, configuration, and runtime state.
 */
import { Component } from './Component';
import { registerComponent } from './registry';
export class LogicCubeComponent extends Component {
    static type = 'LogicCube';
    /** Type of logic cube (e.g., 'onClickTrigger', 'sendMessageAction') */
    cubeType = '';
    /** Configuration parameters for this cube */
    config = {};
    /** Whether this cube is enabled */
    enabled = true;
    /** Current cooldown remaining (seconds) */
    cooldown = 0;
    /** Custom state data for this cube instance */
    state = {};
    getType() {
        return LogicCubeComponent.type;
    }
    /**
     * Gets the cube type identifier
     */
    getCubeType() {
        return this.cubeType;
    }
    /**
     * Sets the cube type identifier
     */
    setCubeType(type) {
        this.cubeType = type;
    }
    /**
     * Gets all configuration parameters
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Gets a specific configuration parameter
     */
    getConfigValue(key, defaultValue) {
        const value = this.config[key];
        return (value !== undefined ? value : defaultValue);
    }
    /**
     * Sets a configuration parameter
     */
    setConfigValue(key, value) {
        this.config[key] = value;
    }
    /**
     * Sets all configuration parameters
     */
    setConfig(config) {
        this.config = { ...config };
    }
    /**
     * Gets whether this cube is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Sets whether this cube is enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    /**
     * Gets current cooldown
     */
    getCooldown() {
        return this.cooldown;
    }
    /**
     * Sets cooldown
     */
    setCooldown(cooldown) {
        this.cooldown = Math.max(0, cooldown);
    }
    /**
     * Updates cooldown (called by LogicCubeSystem)
     */
    updateCooldown(deltaTime) {
        if (this.cooldown > 0) {
            this.cooldown = Math.max(0, this.cooldown - deltaTime);
        }
    }
    /**
     * Gets custom state data
     */
    getState(key, defaultValue) {
        const value = this.state[key];
        return (value !== undefined ? value : defaultValue);
    }
    /**
     * Sets custom state data
     */
    setState(key, value) {
        this.state[key] = value;
    }
    /**
     * Gets all state data
     */
    getAllState() {
        return { ...this.state };
    }
    /**
     * Sets all state data
     */
    setAllState(state) {
        this.state = { ...state };
    }
    clone() {
        const copy = new LogicCubeComponent();
        copy.cubeType = this.cubeType;
        copy.config = { ...this.config };
        copy.enabled = this.enabled;
        copy.cooldown = this.cooldown;
        copy.state = { ...this.state };
        return copy;
    }
    toJSON() {
        return {
            cubeType: this.cubeType,
            config: { ...this.config },
            enabled: this.enabled,
            cooldown: this.cooldown,
            state: { ...this.state },
        };
    }
    fromJSON(data) {
        if (!data || typeof data !== 'object')
            return;
        if (typeof data.cubeType === 'string') {
            this.cubeType = data.cubeType;
        }
        if (data.config && typeof data.config === 'object') {
            this.config = { ...data.config };
        }
        if (typeof data.enabled === 'boolean') {
            this.enabled = data.enabled;
        }
        if (typeof data.cooldown === 'number') {
            this.cooldown = Math.max(0, data.cooldown);
        }
        if (data.state && typeof data.state === 'object') {
            this.state = { ...data.state };
        }
    }
}
registerComponent(LogicCubeComponent.type, LogicCubeComponent);
//# sourceMappingURL=LogicCubeComponent.js.map