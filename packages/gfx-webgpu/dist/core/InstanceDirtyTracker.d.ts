/**
 * Instance Dirty Tracking System
 *
 * Tracks which entities have changed to enable partial instance buffer updates.
 * Only updates changed instances instead of rewriting entire buffer each frame.
 */
import type { Entity, EntityId } from '@engine/world';
export interface DirtyRange {
    start: number;
    count: number;
}
/**
 * InstanceDirtyTracker tracks entity changes for optimal buffer updates.
 */
export declare class InstanceDirtyTracker {
    private dirtyEntities;
    private entityToIndex;
    private indexToEntity;
    private framesSinceFullUpdate;
    private fullUpdateInterval;
    /**
     * Marks an entity as dirty (needs buffer update).
     */
    markDirty(entity: Entity): void;
    /**
     * Marks an entity as dirty by ID.
     */
    markDirtyById(entityId: EntityId): void;
    /**
     * Marks all entities as dirty (forces full update).
     */
    markAllDirty(): void;
    /**
     * Updates the entity-to-index mapping.
     * Call this when rebuilding instance buffers.
     */
    updateMapping(entities: Entity[]): void;
    /**
     * Gets all dirty indices that need updating.
     */
    getDirtyIndices(): number[];
    /**
     * Gets consolidated dirty ranges for efficient buffer updates.
     * Merges adjacent dirty indices into ranges.
     */
    getDirtyRanges(): DirtyRange[];
    /**
     * Checks if any entities are dirty.
     */
    hasDirty(): boolean;
    /**
     * Gets the number of dirty entities.
     */
    getDirtyCount(): number;
    /**
     * Checks if a full update is needed.
     * Returns true if too many entities are dirty or enough frames have passed.
     */
    needsFullUpdate(entityCount: number): boolean;
    /**
     * Clears all dirty flags.
     * Call this after buffer update is complete.
     */
    clear(): void;
    /**
     * Marks a frame as complete.
     * Updates internal frame counter.
     */
    frameComplete(wasFullUpdate: boolean): void;
    /**
     * Sets the interval for forced full updates.
     */
    setFullUpdateInterval(frames: number): void;
    /**
     * Gets statistics for monitoring.
     */
    getStats(): {
        dirtyCount: number;
        trackedEntities: number;
        framesSinceFullUpdate: number;
    };
    /**
     * Resets the tracker (clears all mappings and dirty flags).
     */
    reset(): void;
}
//# sourceMappingURL=InstanceDirtyTracker.d.ts.map