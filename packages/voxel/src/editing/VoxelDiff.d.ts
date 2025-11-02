/**
 * Voxel diff and snapshot system - for staging and versioning
 */
import type { VoxelPos } from './VoxelPosition.js';
import type { BlockType, BlockMetadata } from './VoxelOperations.js';
import type { VoxelStore, ChunkData } from './VoxelStore.js';
/**
 * Single voxel change record
 */
export interface VoxelChange {
    position: VoxelPos;
    /** Block type before change (null if was empty) */
    before: BlockType | null;
    /** Block type after change (null if now empty) */
    after: BlockType | null;
    /** Metadata before */
    metadataBefore?: BlockMetadata;
    /** Metadata after */
    metadataAfter?: BlockMetadata;
}
/**
 * Diff between two voxel states
 */
export declare class VoxelDiff {
    private readonly changes;
    /**
     * Record a change
     */
    recordChange(pos: VoxelPos, before: BlockType | null, after: BlockType | null, metadataBefore?: BlockMetadata, metadataAfter?: BlockMetadata): void;
    /**
     * Get all changes
     */
    getChanges(): VoxelChange[];
    /**
     * Check if diff is empty
     */
    isEmpty(): boolean;
    /**
     * Merge another diff into this one
     */
    merge(other: VoxelDiff): void;
    /**
     * Apply diff to store (forward)
     */
    applyToStore(store: VoxelStore): void;
    /**
     * Reverse diff (for undo)
     */
    reverse(): VoxelDiff;
    private hashPos;
}
/**
 * Snapshot of voxel world state
 */
export declare class VoxelSnapshot {
    /** Snapshot timestamp */
    readonly timestamp: number;
    /** Snapshot version ID */
    readonly version: string;
    /** Chunk data at time of snapshot */
    private readonly chunks;
    constructor(version: string, chunks: Iterable<ChunkData>);
    /**
     * Create diff from this snapshot to current store state
     */
    diffTo(store: VoxelStore): VoxelDiff;
    /**
     * Restore store to this snapshot state
     */
    restoreTo(store: VoxelStore): void;
    /**
     * Get chunk count
     */
    getChunkCount(): number;
}
//# sourceMappingURL=VoxelDiff.d.ts.map