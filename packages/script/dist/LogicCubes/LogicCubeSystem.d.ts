/**
 * LogicCubeSystem - Manages execution of logic cubes in the scene.
 * Similar to ScriptSystem but for visual logic cubes.
 */
import type { Scene } from '@engine/world';
import { LogicConnectionManager } from '../connection/LogicConnectionManager';
import { VariableStorage } from '../storage/VariableStorage';
import { PlayerDetection } from './cubes/PlayerDetection';
import type { LogicCube, LogicCubeConstructor } from './cubes/LogicCube';
import type { LogicSignal } from './cubes/types';
import type { EntityId } from '@engine/world';
/**
 * Registry for logic cube types
 */
declare class LogicCubeRegistry {
    private static cubes;
    static register(type: string, ctor: LogicCubeConstructor): void;
    static get(type: string): LogicCubeConstructor | undefined;
    static has(type: string): boolean;
    static list(): string[];
}
export { LogicCubeRegistry };
/**
 * Main system for managing logic cubes
 */
export declare class LogicCubeSystem {
    private readonly scene;
    private readonly connectionManager;
    private readonly variableStorage;
    private readonly playerDetection;
    /** Map of entity ID -> logic cube instance */
    private cubeInstances;
    /** Queue of signals to process this frame */
    private signalQueue;
    /** Total game time */
    private gameTime;
    /** Max signals to process per frame (prevent infinite loops) */
    private maxSignalsPerFrame;
    constructor(scene: Scene);
    /**
     * Gets the connection manager
     */
    getConnectionManager(): LogicConnectionManager;
    /**
     * Gets the variable storage
     */
    getVariableStorage(): VariableStorage;
    /**
     * Gets the player detection helper
     */
    getPlayerDetection(): PlayerDetection;
    /**
     * Update loop - called every frame
     */
    update(deltaTime: number): void;
    /**
     * Ensures all LogicCubeComponents have corresponding cube instances
     */
    private ensureInstances;
    /**
     * Creates a cube instance for an entity
     */
    private createCubeInstance;
    /**
     * Destroys a cube instance
     */
    private destroyCubeInstance;
    /**
     * Emits a signal from an output port
     */
    emitSignal(sourceEntityId: EntityId, sourcePort: string, signal: LogicSignal): void;
    /**
     * Processes the signal queue
     */
    private processSignalQueue;
    /**
     * Manually triggers a logic cube (useful for editor/debugging)
     */
    triggerCube(entityId: EntityId, inputPort?: string): void;
    /**
     * Gets a cube instance by entity ID
     */
    getCubeInstance(entityId: EntityId): LogicCube | undefined;
    /**
     * Resets the system
     */
    reset(): void;
    /**
     * Serializes the system state
     */
    toJSON(): {
        connections: unknown;
        variables: unknown;
        gameTime: number;
    };
    /**
     * Restores the system state
     */
    fromJSON(data: {
        connections?: unknown;
        variables?: unknown;
        gameTime?: number;
    }): void;
}
//# sourceMappingURL=LogicCubeSystem.d.ts.map