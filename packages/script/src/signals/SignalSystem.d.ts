/**
 * SignalSystem - Lightweight event/signal system for block logic
 *
 * Allows connecting signals (onEnter, onUse, etc.) to actions
 */
import type { Entity } from '@engine/world';
/**
 * Signal types
 */
export declare enum SignalType {
    /** Entity enters trigger zone */
    ON_ENTER = "onEnter",
    /** Entity exits trigger zone */
    ON_EXIT = "onExit",
    /** Entity uses/interacts */
    ON_USE = "onUse",
    /** Timer fires */
    ON_TIMER = "onTimer",
    /** Custom signal */
    CUSTOM = "custom"
}
/**
 * Signal event
 */
export interface SignalEvent {
    type: SignalType;
    source: Entity;
    target?: Entity;
    data?: unknown;
    timestamp: number;
}
/**
 * Action handler function
 */
export type ActionHandler = (event: SignalEvent) => void;
/**
 * Action types
 */
export declare enum ActionType {
    /** Open/activate something */
    ACTIVATE = "activate",
    /** Close/deactivate something */
    DEACTIVATE = "deactivate",
    /** Toggle state */
    TOGGLE = "toggle",
    /** Move entity */
    MOVE = "move",
    /** Emit another signal */
    EMIT_SIGNAL = "emit",
    /** Custom action */
    CUSTOM = "custom"
}
/**
 * Signal-to-action connection
 */
export interface SignalConnection {
    /** Unique connection ID */
    id: string;
    /** Source entity that emits signal */
    sourceEntity: Entity;
    /** Signal type */
    signalType: SignalType;
    /** Target entity to receive action */
    targetEntity: Entity;
    /** Action type */
    actionType: ActionType;
    /** Action parameters */
    actionParams?: Record<string, unknown>;
}
/**
 * Signal system - manages signal connections and routing
 */
export declare class SignalSystem {
    private readonly connections;
    private readonly handlers;
    private connectionCounter;
    /**
     * Register an action handler
     */
    registerHandler(actionType: ActionType, handler: ActionHandler): () => void;
    /**
     * Connect a signal to an action
     */
    connect(sourceEntity: Entity, signalType: SignalType, targetEntity: Entity, actionType: ActionType, actionParams?: Record<string, unknown>): SignalConnection;
    /**
     * Disconnect a connection
     */
    disconnect(connectionId: string): void;
    /**
     * Disconnect all connections for an entity
     */
    disconnectEntity(entity: Entity): void;
    /**
     * Emit a signal
     */
    emit(event: SignalEvent): void;
    /**
     * Execute an action
     */
    private executeAction;
    /**
     * Get all connections for an entity
     */
    getConnectionsForEntity(entity: Entity): SignalConnection[];
    /**
     * Clear all connections
     */
    clear(): void;
    /**
     * Dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=SignalSystem.d.ts.map