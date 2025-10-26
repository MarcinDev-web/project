/**
 * Base class for all Logic Cube types.
 * Logic cubes are node-based logic elements that can be connected together.
 */
import type { Entity } from '@engine/world';
import type { Scene } from '@engine/world';
import type { LogicPort, LogicSignal, LogicExecutionContext, LogicCubeMetadata } from './types';
/**
 * Abstract base class for logic cubes
 */
export declare abstract class LogicCube {
    /** The entity this logic cube is attached to */
    protected entity: Entity;
    /** The scene this logic cube is part of */
    protected scene: Scene;
    /** Whether this cube is enabled */
    enabled: boolean;
    /** Current cooldown timer (seconds) */
    protected cooldown: number;
    /** Configuration parameters for this cube */
    protected config: Record<string, unknown>;
    /** Custom state data for this cube instance */
    protected state: Record<string, unknown>;
    constructor(entity: Entity, scene: Scene, config?: Record<string, unknown>);
    /**
     * Returns metadata describing this cube type.
     * Must be implemented by subclasses.
     */
    abstract getMetadata(): LogicCubeMetadata;
    /**
     * Returns the input ports for this cube
     */
    getInputPorts(): LogicPort[];
    /**
     * Returns the output ports for this cube
     */
    getOutputPorts(): LogicPort[];
    /**
     * Called once when the cube is initialized
     */
    onInit(): void;
    /**
     * Called every frame to update cube state (timers, etc.)
     */
    onUpdate(context: LogicExecutionContext): void;
    /**
     * Called when a signal arrives at an input port.
     * Returns signals to emit from output ports (if any).
     */
    abstract onSignalReceived(portId: string, signal: LogicSignal, context: LogicExecutionContext): Map<string, LogicSignal> | null;
    /**
     * Validates if this cube can receive a signal on the given port
     */
    canReceiveSignal(portId: string): boolean;
    /**
     * Sets a configuration parameter
     */
    setConfig(key: string, value: unknown): void;
    /**
     * Gets a configuration parameter
     */
    getConfig<T = unknown>(key: string, defaultValue?: T): T;
    /**
     * Gets custom state data
     */
    getState<T = unknown>(key: string, defaultValue?: T): T;
    /**
     * Sets custom state data
     */
    setState(key: string, value: unknown): void;
    /**
     * Sets cooldown duration in seconds
     */
    setCooldown(seconds: number): void;
    /**
     * Checks if cube is currently on cooldown
     */
    isOnCooldown(): boolean;
    /**
     * Serializes the cube's state
     */
    toJSON(): {
        config: Record<string, unknown>;
        state: Record<string, unknown>;
        cooldown: number;
    };
    /**
     * Restores the cube's state from serialized data
     */
    fromJSON(data: {
        config?: Record<string, unknown>;
        state?: Record<string, unknown>;
        cooldown?: number;
    }): void;
    /**
     * Called when the cube is destroyed
     */
    onDestroy(): void;
}
/**
 * Type alias for logic cube constructor
 */
export type LogicCubeConstructor = new (entity: Entity, scene: Scene, config?: Record<string, unknown>) => LogicCube;
//# sourceMappingURL=LogicCube.d.ts.map