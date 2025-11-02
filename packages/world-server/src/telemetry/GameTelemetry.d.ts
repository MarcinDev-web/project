/**
 * Gameplay telemetry events for creator metrics and analytics
 */
/**
 * Base telemetry event
 */
export interface GameTelemetryEvent {
    /** Event type */
    type: string;
    /** Timestamp */
    timestamp: number;
    /** User/client ID */
    userId: string;
    /** Zone ID */
    zoneId: string;
}
/**
 * Voxel operation event
 */
export interface VoxelOpGameEvent extends GameTelemetryEvent {
    type: 'voxel:place' | 'voxel:remove' | 'voxel:paint';
    position: {
        x: number;
        y: number;
        z: number;
    };
    blockType?: number;
}
/**
 * Session event
 */
export interface SessionGameEvent extends GameTelemetryEvent {
    type: 'session:start' | 'session:stop';
    duration?: number;
}
/**
 * Checkpoint activation event
 */
export interface CheckpointGameEvent extends GameTelemetryEvent {
    type: 'checkpoint:activate';
    checkpointId: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
}
/**
 * Time trial event
 */
export interface TimeTrialGameEvent extends GameTelemetryEvent {
    type: 'trial:start' | 'trial:complete' | 'trial:fail';
    trialId?: string;
    time?: number;
}
/**
 * Player death/respawn event
 */
export interface DeathGameEvent extends GameTelemetryEvent {
    type: 'player:death' | 'player:respawn';
    position: {
        x: number;
        y: number;
        z: number;
    };
    checkpointId?: string;
}
/**
 * Union of all gameplay telemetry events
 */
export type TelemetryGameEvent = VoxelOpGameEvent | SessionGameEvent | CheckpointGameEvent | TimeTrialGameEvent | DeathGameEvent;
/**
 * Telemetry event handler
 */
export type TelemetryEventHandler = (event: TelemetryGameEvent) => void;
/**
 * Simple telemetry collector for gameplay events
 */
export declare class TelemetryCollector {
    private readonly handlers;
    private readonly events;
    private readonly maxEvents;
    constructor(maxEvents?: number);
    /**
     * Emit telemetry event
     */
    emit(event: TelemetryGameEvent): void;
    /**
     * Subscribe to events
     */
    on(handler: TelemetryEventHandler): () => void;
    /**
     * Get recent events
     */
    getRecentEvents(count?: number): TelemetryGameEvent[];
    /**
     * Get events by type
     */
    getEventsByType(type: string): TelemetryGameEvent[];
    /**
     * Clear all events
     */
    clear(): void;
    /**
     * Dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=GameTelemetry.d.ts.map