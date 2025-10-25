/**
 * Base class for all Logic Cube types.
 * Logic cubes are node-based logic elements that can be connected together.
 */
/**
 * Abstract base class for logic cubes
 */
export class LogicCube {
    /** The entity this logic cube is attached to */
    entity;
    /** The scene this logic cube is part of */
    scene;
    /** Whether this cube is enabled */
    enabled = true;
    /** Current cooldown timer (seconds) */
    cooldown = 0;
    /** Configuration parameters for this cube */
    config = {};
    /** Custom state data for this cube instance */
    state = {};
    constructor(entity, scene, config = {}) {
        this.entity = entity;
        this.scene = scene;
        this.config = { ...config };
    }
    /**
     * Returns the input ports for this cube
     */
    getInputPorts() {
        return this.getMetadata().inputs;
    }
    /**
     * Returns the output ports for this cube
     */
    getOutputPorts() {
        return this.getMetadata().outputs;
    }
    /**
     * Called once when the cube is initialized
     */
    onInit() {
        // Override in subclasses if needed
    }
    /**
     * Called every frame to update cube state (timers, etc.)
     */
    onUpdate(context) {
        // Update cooldown
        if (this.cooldown > 0) {
            this.cooldown = Math.max(0, this.cooldown - context.deltaTime);
        }
    }
    /**
     * Validates if this cube can receive a signal on the given port
     */
    canReceiveSignal(portId) {
        if (!this.enabled)
            return false;
        if (this.cooldown > 0)
            return false;
        const port = this.getInputPorts().find((p) => p.id === portId);
        return port !== undefined;
    }
    /**
     * Sets a configuration parameter
     */
    setConfig(key, value) {
        this.config[key] = value;
    }
    /**
     * Gets a configuration parameter
     */
    getConfig(key, defaultValue) {
        const value = this.config[key];
        return (value !== undefined ? value : defaultValue);
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
     * Sets cooldown duration in seconds
     */
    setCooldown(seconds) {
        this.cooldown = Math.max(0, seconds);
    }
    /**
     * Checks if cube is currently on cooldown
     */
    isOnCooldown() {
        return this.cooldown > 0;
    }
    /**
     * Serializes the cube's state
     */
    toJSON() {
        return {
            config: { ...this.config },
            state: { ...this.state },
            cooldown: this.cooldown,
        };
    }
    /**
     * Restores the cube's state from serialized data
     */
    fromJSON(data) {
        if (data.config) {
            this.config = { ...data.config };
        }
        if (data.state) {
            this.state = { ...data.state };
        }
        if (typeof data.cooldown === 'number') {
            this.cooldown = data.cooldown;
        }
    }
    /**
     * Called when the cube is destroyed
     */
    onDestroy() {
        // Override in subclasses if needed
    }
}
//# sourceMappingURL=LogicCube.js.map