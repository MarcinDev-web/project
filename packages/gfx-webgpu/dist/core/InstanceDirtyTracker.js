/**
 * Instance Dirty Tracking System
 *
 * Tracks which entities have changed to enable partial instance buffer updates.
 * Only updates changed instances instead of rewriting entire buffer each frame.
 */
/**
 * InstanceDirtyTracker tracks entity changes for optimal buffer updates.
 */
export class InstanceDirtyTracker {
    dirtyEntities = new Set();
    entityToIndex = new Map();
    indexToEntity = new Map();
    framesSinceFullUpdate = 0;
    fullUpdateInterval = 300; // Force full update every N frames (safety)
    /**
     * Marks an entity as dirty (needs buffer update).
     */
    markDirty(entity) {
        this.dirtyEntities.add(entity.id);
    }
    /**
     * Marks an entity as dirty by ID.
     */
    markDirtyById(entityId) {
        this.dirtyEntities.add(entityId);
    }
    /**
     * Marks all entities as dirty (forces full update).
     */
    markAllDirty() {
        for (const entityId of this.entityToIndex.keys()) {
            this.dirtyEntities.add(entityId);
        }
    }
    /**
     * Updates the entity-to-index mapping.
     * Call this when rebuilding instance buffers.
     */
    updateMapping(entities) {
        this.entityToIndex.clear();
        this.indexToEntity.clear();
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (entity) {
                this.entityToIndex.set(entity.id, i);
                this.indexToEntity.set(i, entity.id);
            }
        }
    }
    /**
     * Gets all dirty indices that need updating.
     */
    getDirtyIndices() {
        const indices = [];
        for (const entityId of this.dirtyEntities) {
            const index = this.entityToIndex.get(entityId);
            if (index !== undefined) {
                indices.push(index);
            }
        }
        return indices.sort((a, b) => a - b);
    }
    /**
     * Gets consolidated dirty ranges for efficient buffer updates.
     * Merges adjacent dirty indices into ranges.
     */
    getDirtyRanges() {
        const indices = this.getDirtyIndices();
        if (indices.length === 0)
            return [];
        const ranges = [];
        let start = indices[0];
        let count = 1;
        for (let i = 1; i < indices.length; i++) {
            const current = indices[i];
            const prev = indices[i - 1];
            // If consecutive, extend current range
            if (current === prev + 1) {
                count++;
            }
            else {
                // Start new range
                ranges.push({ start, count });
                start = current;
                count = 1;
            }
        }
        // Add final range
        ranges.push({ start, count });
        return ranges;
    }
    /**
     * Checks if any entities are dirty.
     */
    hasDirty() {
        return this.dirtyEntities.size > 0;
    }
    /**
     * Gets the number of dirty entities.
     */
    getDirtyCount() {
        return this.dirtyEntities.size;
    }
    /**
     * Checks if a full update is needed.
     * Returns true if too many entities are dirty or enough frames have passed.
     */
    needsFullUpdate(entityCount) {
        // Force full update periodically for safety
        if (this.framesSinceFullUpdate >= this.fullUpdateInterval) {
            return true;
        }
        // If more than 50% of entities are dirty, do full update
        if (this.dirtyEntities.size > entityCount * 0.5) {
            return true;
        }
        return false;
    }
    /**
     * Clears all dirty flags.
     * Call this after buffer update is complete.
     */
    clear() {
        this.dirtyEntities.clear();
    }
    /**
     * Marks a frame as complete.
     * Updates internal frame counter.
     */
    frameComplete(wasFullUpdate) {
        if (wasFullUpdate) {
            this.framesSinceFullUpdate = 0;
        }
        else {
            this.framesSinceFullUpdate++;
        }
    }
    /**
     * Sets the interval for forced full updates.
     */
    setFullUpdateInterval(frames) {
        this.fullUpdateInterval = frames;
    }
    /**
     * Gets statistics for monitoring.
     */
    getStats() {
        return {
            dirtyCount: this.dirtyEntities.size,
            trackedEntities: this.entityToIndex.size,
            framesSinceFullUpdate: this.framesSinceFullUpdate,
        };
    }
    /**
     * Resets the tracker (clears all mappings and dirty flags).
     */
    reset() {
        this.dirtyEntities.clear();
        this.entityToIndex.clear();
        this.indexToEntity.clear();
        this.framesSinceFullUpdate = 0;
    }
}
//# sourceMappingURL=InstanceDirtyTracker.js.map