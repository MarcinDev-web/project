/**
 * LogicConnectionManager - Manages connections between logic cubes.
 */

import type { EntityId } from '@engine/world';
import type { LogicConnection, LogicSignal } from '../LogicCubes/cubes/types';

let nextConnectionId = 0;

/**
 * Generates a unique connection ID
 */
function generateConnectionId(): string {
  return `connection_${nextConnectionId++}`;
}

/**
 * Manages the connection graph between logic cubes
 */
export class LogicConnectionManager {
  /** All connections in the system */
  private connections = new Map<string, LogicConnection>();

  /** Index: source entity -> connections */
  private sourceIndex = new Map<EntityId, Set<string>>();

  /** Index: target entity -> connections */
  private targetIndex = new Map<EntityId, Set<string>>();

  /**
   * Adds a connection between two logic cubes
   */
  addConnection(
    sourceEntityId: EntityId,
    sourcePort: string,
    targetEntityId: EntityId,
    targetPort: string
  ): LogicConnection {
    // Check if connection already exists
    const existing = this.findConnection(sourceEntityId, sourcePort, targetEntityId, targetPort);
    if (existing) {
      return existing;
    }

    const connection: LogicConnection = {
      id: generateConnectionId(),
      sourceEntityId,
      sourcePort,
      targetEntityId,
      targetPort,
    };

    this.connections.set(connection.id, connection);

    // Update indices
    if (!this.sourceIndex.has(sourceEntityId)) {
      this.sourceIndex.set(sourceEntityId, new Set());
    }
    this.sourceIndex.get(sourceEntityId)!.add(connection.id);

    if (!this.targetIndex.has(targetEntityId)) {
      this.targetIndex.set(targetEntityId, new Set());
    }
    this.targetIndex.get(targetEntityId)!.add(connection.id);

    return connection;
  }

  /**
   * Removes a connection by ID
   */
  removeConnection(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    this.connections.delete(connectionId);

    // Update indices
    const sourceSet = this.sourceIndex.get(connection.sourceEntityId);
    if (sourceSet) {
      sourceSet.delete(connectionId);
      if (sourceSet.size === 0) {
        this.sourceIndex.delete(connection.sourceEntityId);
      }
    }

    const targetSet = this.targetIndex.get(connection.targetEntityId);
    if (targetSet) {
      targetSet.delete(connectionId);
      if (targetSet.size === 0) {
        this.targetIndex.delete(connection.targetEntityId);
      }
    }

    return true;
  }

  /**
   * Removes all connections involving an entity
   */
  removeEntityConnections(entityId: EntityId): number {
    let count = 0;

    // Remove connections where entity is source
    const sourceConnections = this.sourceIndex.get(entityId);
    if (sourceConnections) {
      for (const connectionId of Array.from(sourceConnections)) {
        if (this.removeConnection(connectionId)) {
          count++;
        }
      }
    }

    // Remove connections where entity is target
    const targetConnections = this.targetIndex.get(entityId);
    if (targetConnections) {
      for (const connectionId of Array.from(targetConnections)) {
        if (this.removeConnection(connectionId)) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Gets a connection by ID
   */
  getConnection(connectionId: string): LogicConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Finds a connection matching the given parameters
   */
  findConnection(
    sourceEntityId: EntityId,
    sourcePort: string,
    targetEntityId: EntityId,
    targetPort: string
  ): LogicConnection | undefined {
    const sourceConnections = this.sourceIndex.get(sourceEntityId);
    if (!sourceConnections) return undefined;

    for (const connectionId of sourceConnections) {
      const conn = this.connections.get(connectionId);
      if (
        conn &&
        conn.sourcePort === sourcePort &&
        conn.targetEntityId === targetEntityId &&
        conn.targetPort === targetPort
      ) {
        return conn;
      }
    }

    return undefined;
  }

  /**
   * Gets all connections originating from an entity
   */
  getConnectionsFromEntity(entityId: EntityId): LogicConnection[] {
    const connectionIds = this.sourceIndex.get(entityId);
    if (!connectionIds) return [];

    const result: LogicConnection[] = [];
    for (const id of connectionIds) {
      const conn = this.connections.get(id);
      if (conn) result.push(conn);
    }
    return result;
  }

  /**
   * Gets all connections targeting an entity
   */
  getConnectionsToEntity(entityId: EntityId): LogicConnection[] {
    const connectionIds = this.targetIndex.get(entityId);
    if (!connectionIds) return [];

    const result: LogicConnection[] = [];
    for (const id of connectionIds) {
      const conn = this.connections.get(id);
      if (conn) result.push(conn);
    }
    return result;
  }

  /**
   * Gets all connections involving an entity (as source or target)
   */
  getConnectionsForEntity(entityId: EntityId): LogicConnection[] {
    const sources = this.getConnectionsFromEntity(entityId);
    const targets = this.getConnectionsToEntity(entityId);
    return [...sources, ...targets];
  }

  /**
   * Gets all connections from a specific output port
   */
  getConnectionsFromPort(entityId: EntityId, portId: string): LogicConnection[] {
    const connections = this.getConnectionsFromEntity(entityId);
    return connections.filter((conn) => conn.sourcePort === portId);
  }

  /**
   * Gets all connections to a specific input port
   */
  getConnectionsToPort(entityId: EntityId, portId: string): LogicConnection[] {
    const connections = this.getConnectionsToEntity(entityId);
    return connections.filter((conn) => conn.targetPort === portId);
  }

  /**
   * Gets all connections in the system
   */
  getAllConnections(): LogicConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Clears all connections
   */
  clear(): void {
    this.connections.clear();
    this.sourceIndex.clear();
    this.targetIndex.clear();
  }

  /**
   * Validates a potential connection (override for custom validation)
   */
  validateConnection(
    sourceEntityId: EntityId,
    sourcePort: string,
    targetEntityId: EntityId,
    targetPort: string
  ): { valid: boolean; reason?: string } {
    // Prevent self-connections
    if (sourceEntityId === targetEntityId) {
      return { valid: false, reason: 'Cannot connect entity to itself' };
    }

    // Check if connection already exists
    if (this.findConnection(sourceEntityId, sourcePort, targetEntityId, targetPort)) {
      return { valid: false, reason: 'Connection already exists' };
    }

    return { valid: true };
  }

  /**
   * Serializes connections to JSON
   */
  toJSON(): LogicConnection[] {
    return this.getAllConnections();
  }

  /**
   * Restores connections from JSON
   */
  fromJSON(data: LogicConnection[]): void {
    this.clear();
    if (!Array.isArray(data)) return;

    for (const conn of data) {
      if (
        conn &&
        typeof conn === 'object' &&
        conn.sourceEntityId &&
        conn.sourcePort &&
        conn.targetEntityId &&
        conn.targetPort
      ) {
        this.addConnection(
          conn.sourceEntityId,
          conn.sourcePort,
          conn.targetEntityId,
          conn.targetPort
        );
      }
    }
  }
}

