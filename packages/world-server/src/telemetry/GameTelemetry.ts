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
  position: { x: number; y: number; z: number };
  blockType?: number;
}

/**
 * Session event
 */
export interface SessionGameEvent extends GameTelemetryEvent {
  type: 'session:start' | 'session:stop';
  duration?: number; // For stop events
}

/**
 * Checkpoint activation event
 */
export interface CheckpointGameEvent extends GameTelemetryEvent {
  type: 'checkpoint:activate';
  checkpointId: string;
  position: { x: number; y: number; z: number };
}

/**
 * Time trial event
 */
export interface TimeTrialGameEvent extends GameTelemetryEvent {
  type: 'trial:start' | 'trial:complete' | 'trial:fail';
  trialId?: string;
  time?: number; // Completion time in ms
}

/**
 * Player death/respawn event
 */
export interface DeathGameEvent extends GameTelemetryEvent {
  type: 'player:death' | 'player:respawn';
  position: { x: number; y: number; z: number };
  checkpointId?: string;
}

/**
 * Union of all gameplay telemetry events
 */
export type TelemetryGameEvent =
  | VoxelOpGameEvent
  | SessionGameEvent
  | CheckpointGameEvent
  | TimeTrialGameEvent
  | DeathGameEvent;

/**
 * Telemetry event handler
 */
export type TelemetryEventHandler = (event: TelemetryGameEvent) => void;

/**
 * Simple telemetry collector for gameplay events
 */
export class TelemetryCollector {
  private readonly handlers = new Set<TelemetryEventHandler>();
  private readonly events: TelemetryGameEvent[] = [];
  private readonly maxEvents: number;

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents;
  }

  /**
   * Emit telemetry event
   */
  emit(event: TelemetryGameEvent): void {
    // Store event
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Call handlers
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  /**
   * Subscribe to events
   */
  on(handler: TelemetryEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(count = 100): TelemetryGameEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string): TelemetryGameEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events.length = 0;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.handlers.clear();
    this.clear();
  }
}

