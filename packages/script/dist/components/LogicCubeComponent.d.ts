/**
 * LogicCubeComponent - Component for logic cube entities.
 * Stores the logic cube type, configuration, and runtime state.
 */
import { Component } from '@engine/world';
import type { LogicCubeState } from '../LogicCubes/cubes/types';
export declare class LogicCubeComponent extends Component {
    static readonly type = "LogicCube";
    /** Type of logic cube (e.g., 'onClickTrigger', 'sendMessageAction') */
    private cubeType;
    /** Configuration parameters for this cube */
    private config;
    /** Whether this cube is enabled */
    private enabled;
    /** Current cooldown remaining (seconds) */
    private cooldown;
    /** Custom state data for this cube instance */
    private state;
    getType(): string;
    /**
     * Gets the cube type identifier
     */
    getCubeType(): string;
    /**
     * Sets the cube type identifier
     */
    setCubeType(type: string): void;
    /**
     * Gets all configuration parameters
     */
    getConfig(): Record<string, unknown>;
    /**
     * Gets a specific configuration parameter
     */
    getConfigValue<T = unknown>(key: string, defaultValue?: T): T;
    /**
     * Sets a configuration parameter
     */
    setConfigValue(key: string, value: unknown): void;
    /**
     * Sets all configuration parameters
     */
    setConfig(config: Record<string, unknown>): void;
    /**
     * Gets whether this cube is enabled
     */
    isEnabled(): boolean;
    /**
     * Sets whether this cube is enabled
     */
    setEnabled(enabled: boolean): void;
    /**
     * Gets current cooldown
     */
    getCooldown(): number;
    /**
     * Sets cooldown
     */
    setCooldown(cooldown: number): void;
    /**
     * Updates cooldown (called by LogicCubeSystem)
     */
    updateCooldown(deltaTime: number): void;
    /**
     * Gets custom state data
     */
    getState<T = unknown>(key: string, defaultValue?: T): T;
    /**
     * Sets custom state data
     */
    setState(key: string, value: unknown): void;
    /**
     * Gets all state data
     */
    getAllState(): Record<string, unknown>;
    /**
     * Sets all state data
     */
    setAllState(state: Record<string, unknown>): void;
    clone(): LogicCubeComponent;
    toJSON(): LogicCubeState;
    fromJSON(data: LogicCubeState): void;
}
//# sourceMappingURL=LogicCubeComponent.d.ts.map