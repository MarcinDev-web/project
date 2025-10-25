/**
 * LogicConnectionManager - Manages connections between logic cubes.
 */
import type { EntityId } from '@engine/world';
import type { LogicConnection } from '../LogicCubes/cubes/types';
/**
 * Manages the connection graph between logic cubes
 */
export declare class LogicConnectionManager {
    /** All connections in the system */
    private connections;
    /** Index: source entity -> connections */
    private sourceIndex;
    /** Index: target entity -> connections */
    private targetIndex;
    /**
     * Adds a connection between two logic cubes
     */
    addConnection(sourceEntityId: EntityId, sourcePort: string, targetEntityId: EntityId, targetPort: string): LogicConnection;
    /**
     * Removes a connection by ID
     */
    removeConnection(connectionId: string): boolean;
    /**
     * Removes all connections involving an entity
     */
    removeEntityConnections(entityId: EntityId): number;
    /**
     * Gets a connection by ID
     */
    getConnection(connectionId: string): LogicConnection | undefined;
    /**
     * Finds a connection matching the given parameters
     */
    findConnection(sourceEntityId: EntityId, sourcePort: string, targetEntityId: EntityId, targetPort: string): LogicConnection | undefined;
    /**
     * Gets all connections originating from an entity
     */
    getConnectionsFromEntity(entityId: EntityId): LogicConnection[];
    /**
     * Gets all connections targeting an entity
     */
    getConnectionsToEntity(entityId: EntityId): LogicConnection[];
    /**
     * Gets all connections involving an entity (as source or target)
     */
    getConnectionsForEntity(entityId: EntityId): LogicConnection[];
    /**
     * Gets all connections from a specific output port
     */
    getConnectionsFromPort(entityId: EntityId, portId: string): LogicConnection[];
    /**
     * Gets all connections to a specific input port
     */
    getConnectionsToPort(entityId: EntityId, portId: string): LogicConnection[];
    /**
     * Gets all connections in the system
     */
    getAllConnections(): LogicConnection[];
    /**
     * Clears all connections
     */
    clear(): void;
    /**
     * Validates a potential connection (override for custom validation)
     */
    validateConnection(sourceEntityId: EntityId, sourcePort: string, targetEntityId: EntityId, targetPort: string): {
        valid: boolean;
        reason?: string;
    };
    /**
     * Serializes connections to JSON
     */
    toJSON(): LogicConnection[];
    /**
     * Restores connections from JSON
     */
    fromJSON(data: LogicConnection[]): void;
}
//# sourceMappingURL=LogicConnectionManager.d.ts.map