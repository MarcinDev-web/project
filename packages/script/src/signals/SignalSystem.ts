/**
 * SignalSystem - Lightweight event/signal system for block logic
 *
 * Allows connecting signals (onEnter, onUse, etc.) to actions
 */

import type { Entity } from '@engine/world';

/**
 * Signal types
 */
export enum SignalType {
  /** Entity enters trigger zone */
  ON_ENTER = 'onEnter',
  /** Entity exits trigger zone */
  ON_EXIT = 'onExit',
  /** Entity uses/interacts */
  ON_USE = 'onUse',
  /** Timer fires */
  ON_TIMER = 'onTimer',
  /** Custom signal */
  CUSTOM = 'custom',
}

/**
 * Signal event
 */
export interface SignalEvent {
  type: SignalType;
  source: Entity; // Entity that emitted the signal
  target?: Entity; // Target entity (if specified)
  data?: unknown; // Custom data
  timestamp: number;
}

/**
 * Action handler function
 */
export type ActionHandler = (event: SignalEvent) => void;

/**
 * Action types
 */
export enum ActionType {
  /** Open/activate something */
  ACTIVATE = 'activate',
  /** Close/deactivate something */
  DEACTIVATE = 'deactivate',
  /** Toggle state */
  TOGGLE = 'toggle',
  /** Move entity */
  MOVE = 'move',
  /** Emit another signal */
  EMIT_SIGNAL = 'emit',
  /** Custom action */
  CUSTOM = 'custom',
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
export class SignalSystem {
  private readonly connections = new Map<string, SignalConnection>();
  private readonly handlers = new Map<ActionType, ActionHandler[]>();
  private connectionCounter = 0;

  /**
   * Register an action handler
   */
  registerHandler(actionType: ActionType, handler: ActionHandler): () => void {
    let handlers = this.handlers.get(actionType);
    if (!handlers) {
      handlers = [];
      this.handlers.set(actionType, handlers);
    }
    handlers.push(handler);

    // Return unsubscribe function
    return () => {
      const idx = handlers!.indexOf(handler);
      if (idx >= 0) {
        handlers!.splice(idx, 1);
      }
    };
  }

  /**
   * Connect a signal to an action
   */
  connect(
    sourceEntity: Entity,
    signalType: SignalType,
    targetEntity: Entity,
    actionType: ActionType,
    actionParams?: Record<string, unknown>
  ): SignalConnection {
    const id = `conn_${this.connectionCounter++}`;
    const connection: SignalConnection = {
      id,
      sourceEntity,
      signalType,
      targetEntity,
      actionType,
      ...(actionParams !== undefined && { actionParams }),
    };
    this.connections.set(id, connection);
    return connection;
  }

  /**
   * Disconnect a connection
   */
  disconnect(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /**
   * Disconnect all connections for an entity
   */
  disconnectEntity(entity: Entity): void {
    for (const [id, conn] of this.connections.entries()) {
      if (conn.sourceEntity === entity || conn.targetEntity === entity) {
        this.connections.delete(id);
      }
    }
  }

  /**
   * Emit a signal
   */
  emit(event: SignalEvent): void {
    // Find all connections that match this signal
    for (const connection of this.connections.values()) {
      if (
        connection.sourceEntity === event.source &&
        connection.signalType === event.type
      ) {
        // Execute action
        this.executeAction(connection, event);
      }
    }
  }

  /**
   * Execute an action
   */
  private executeAction(connection: SignalConnection, event: SignalEvent): void {
    const handlers = this.handlers.get(connection.actionType);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }

    // Built-in action implementations
    switch (connection.actionType) {
      case ActionType.ACTIVATE:
        // Set entity active
        connection.targetEntity.active = true;
        break;
      case ActionType.DEACTIVATE:
        // Set entity inactive
        connection.targetEntity.active = false;
        break;
      case ActionType.TOGGLE:
        // Toggle entity active state
        connection.targetEntity.active = !connection.targetEntity.active;
        break;
      case ActionType.MOVE:
        // Move entity (if params specify position)
        if (connection.actionParams?.position) {
          const pos = connection.actionParams.position as [number, number, number];
          connection.targetEntity.transform.position = pos;
        }
        break;
      case ActionType.EMIT_SIGNAL:
        // Emit another signal
        if (connection.actionParams?.signalType) {
          this.emit({
            type: connection.actionParams.signalType as SignalType,
            source: connection.targetEntity,
            timestamp: Date.now(),
          });
        }
        break;
    }
  }

  /**
   * Get all connections for an entity
   */
  getConnectionsForEntity(entity: Entity): SignalConnection[] {
    const result: SignalConnection[] = [];
    for (const connection of this.connections.values()) {
      if (connection.sourceEntity === entity || connection.targetEntity === entity) {
        result.push(connection);
      }
    }
    return result;
  }

  /**
   * Clear all connections
   */
  clear(): void {
    this.connections.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clear();
    this.handlers.clear();
  }
}

