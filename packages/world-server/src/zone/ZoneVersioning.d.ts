/**
 * Zone versioning system - manages staging vs live versions
 */
import type { VoxelStore } from '@engine/voxel';
import { VoxelSnapshot } from '@engine/voxel';
/**
 * Zone version metadata
 */
export interface ZoneVersion {
    /** Version ID */
    versionId: string;
    /** Version number (incremental) */
    versionNumber: number;
    /** Timestamp when created */
    createdAt: number;
    /** User ID who created this version */
    createdBy: string;
    /** Changelog description */
    changelog?: string;
    /** Whether this is the live/public version */
    isLive: boolean;
}
/**
 * Zone versioning manager
 */
export declare class ZoneVersioning {
    private readonly versions;
    private readonly snapshots;
    private currentVersionId;
    private liveVersionId;
    private versionCounter;
    /**
     * Create a new version from current state
     */
    createVersion(store: VoxelStore, createdBy: string, changelog?: string, isLive?: boolean): ZoneVersion;
    /**
     * Set a version as live
     */
    setLiveVersion(versionId: string): void;
    /**
     * Get snapshot for a version
     */
    getSnapshot(versionId: string): VoxelSnapshot | null;
    /**
     * Restore a version to store
     */
    restoreVersion(versionId: string, store: VoxelStore): void;
    /**
     * Get current version
     */
    getCurrentVersion(): ZoneVersion | null;
    /**
     * Get live version
     */
    getLiveVersion(): ZoneVersion | null;
    /**
     * Get all versions
     */
    getAllVersions(): ZoneVersion[];
    /**
     * Delete a version (cannot delete live version)
     */
    deleteVersion(versionId: string): void;
    /**
     * Get version count
     */
    getVersionCount(): number;
    /**
     * Clear all versions (except live)
     */
    clearNonLiveVersions(): void;
    /**
     * Dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=ZoneVersioning.d.ts.map