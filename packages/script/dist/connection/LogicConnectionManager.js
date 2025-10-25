/**
 * LogicConnectionManager - Manages connections between logic cubes.
 */
let nextConnectionId = 0;
/**
 * Generates a unique connection ID
 */
function generateConnectionId() {
    return `connection_${nextConnectionId++}`;
}
/**
 * Manages the connection graph between logic cubes
 */
export class LogicConnectionManager {
    /** All connections in the system */
    connections = new Map();
    /** Index: source entity -> connections */
    sourceIndex = new Map();
    /** Index: target entity -> connections */
    targetIndex = new Map();
    /**
     * Adds a connection between two logic cubes
     */
    addConnection(sourceEntityId, sourcePort, targetEntityId, targetPort) {
        // Check if connection already exists
        const existing = this.findConnection(sourceEntityId, sourcePort, targetEntityId, targetPort);
        if (existing) {
            return existing;
        }
        const connection = {
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
        this.sourceIndex.get(sourceEntityId).add(connection.id);
        if (!this.targetIndex.has(targetEntityId)) {
            this.targetIndex.set(targetEntityId, new Set());
        }
        this.targetIndex.get(targetEntityId).add(connection.id);
        return connection;
    }
    /**
     * Removes a connection by ID
     */
    removeConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection)
            return false;
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
    removeEntityConnections(entityId) {
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
    getConnection(connectionId) {
        return this.connections.get(connectionId);
    }
    /**
     * Finds a connection matching the given parameters
     */
    findConnection(sourceEntityId, sourcePort, targetEntityId, targetPort) {
        const sourceConnections = this.sourceIndex.get(sourceEntityId);
        if (!sourceConnections)
            return undefined;
        for (const connectionId of sourceConnections) {
            const conn = this.connections.get(connectionId);
            if (conn &&
                conn.sourcePort === sourcePort &&
                conn.targetEntityId === targetEntityId &&
                conn.targetPort === targetPort) {
                return conn;
            }
        }
        return undefined;
    }
    /**
     * Gets all connections originating from an entity
     */
    getConnectionsFromEntity(entityId) {
        const connectionIds = this.sourceIndex.get(entityId);
        if (!connectionIds)
            return [];
        const result = [];
        for (const id of connectionIds) {
            const conn = this.connections.get(id);
            if (conn)
                result.push(conn);
        }
        return result;
    }
    /**
     * Gets all connections targeting an entity
     */
    getConnectionsToEntity(entityId) {
        const connectionIds = this.targetIndex.get(entityId);
        if (!connectionIds)
            return [];
        const result = [];
        for (const id of connectionIds) {
            const conn = this.connections.get(id);
            if (conn)
                result.push(conn);
        }
        return result;
    }
    /**
     * Gets all connections involving an entity (as source or target)
     */
    getConnectionsForEntity(entityId) {
        const sources = this.getConnectionsFromEntity(entityId);
        const targets = this.getConnectionsToEntity(entityId);
        return [...sources, ...targets];
    }
    /**
     * Gets all connections from a specific output port
     */
    getConnectionsFromPort(entityId, portId) {
        const connections = this.getConnectionsFromEntity(entityId);
        return connections.filter((conn) => conn.sourcePort === portId);
    }
    /**
     * Gets all connections to a specific input port
     */
    getConnectionsToPort(entityId, portId) {
        const connections = this.getConnectionsToEntity(entityId);
        return connections.filter((conn) => conn.targetPort === portId);
    }
    /**
     * Gets all connections in the system
     */
    getAllConnections() {
        return Array.from(this.connections.values());
    }
    /**
     * Clears all connections
     */
    clear() {
        this.connections.clear();
        this.sourceIndex.clear();
        this.targetIndex.clear();
    }
    /**
     * Validates a potential connection (override for custom validation)
     */
    validateConnection(sourceEntityId, sourcePort, targetEntityId, targetPort) {
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
    toJSON() {
        return this.getAllConnections();
    }
    /**
     * Restores connections from JSON
     */
    fromJSON(data) {
        this.clear();
        if (!Array.isArray(data))
            return;
        for (const conn of data) {
            if (conn &&
                typeof conn === 'object' &&
                conn.sourceEntityId &&
                conn.sourcePort &&
                conn.targetEntityId &&
                conn.targetPort) {
                this.addConnection(conn.sourceEntityId, conn.sourcePort, conn.targetEntityId, conn.targetPort);
            }
        }
    }
}
//# sourceMappingURL=LogicConnectionManager.js.map