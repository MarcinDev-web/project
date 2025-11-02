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
export class ZoneVersioning {
  private readonly versions = new Map<string, ZoneVersion>();
  private readonly snapshots = new Map<string, VoxelSnapshot>();
  private currentVersionId: string | null = null;
  private liveVersionId: string | null = null;
  private versionCounter = 1;

  /**
   * Create a new version from current state
   */
  createVersion(
    store: VoxelStore,
    createdBy: string,
    changelog?: string,
    isLive = false
  ): ZoneVersion {
    const versionId = `v${this.versionCounter++}`;
    const snapshot = new VoxelSnapshot(versionId, store.getAllChunks());

    const version: ZoneVersion = {
      versionId,
      versionNumber: this.versionCounter - 1,
      createdAt: Date.now(),
      createdBy,
      ...(changelog !== undefined && { changelog }),
      isLive,
    };

    this.versions.set(versionId, version);
    this.snapshots.set(versionId, snapshot);

    if (isLive) {
      this.setLiveVersion(versionId);
    }

    return version;
  }

  /**
   * Set a version as live
   */
  setLiveVersion(versionId: string): void {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new Error(`Version ${versionId} does not exist`);
    }

    // Unset previous live version
    if (this.liveVersionId) {
      const prev = this.versions.get(this.liveVersionId);
      if (prev) {
        prev.isLive = false;
      }
    }

    version.isLive = true;
    this.liveVersionId = versionId;
  }

  /**
   * Get snapshot for a version
   */
  getSnapshot(versionId: string): VoxelSnapshot | null {
    return this.snapshots.get(versionId) ?? null;
  }

  /**
   * Restore a version to store
   */
  restoreVersion(versionId: string, store: VoxelStore): void {
    const snapshot = this.snapshots.get(versionId);
    if (!snapshot) {
      throw new Error(`Version ${versionId} does not exist`);
    }

    snapshot.restoreTo(store);
    this.currentVersionId = versionId;
  }

  /**
   * Get current version
   */
  getCurrentVersion(): ZoneVersion | null {
    if (!this.currentVersionId) return null;
    return this.versions.get(this.currentVersionId) ?? null;
  }

  /**
   * Get live version
   */
  getLiveVersion(): ZoneVersion | null {
    if (!this.liveVersionId) return null;
    return this.versions.get(this.liveVersionId) ?? null;
  }

  /**
   * Get all versions
   */
  getAllVersions(): ZoneVersion[] {
    return Array.from(this.versions.values()).sort(
      (a, b) => b.versionNumber - a.versionNumber
    );
  }

  /**
   * Delete a version (cannot delete live version)
   */
  deleteVersion(versionId: string): void {
    if (this.liveVersionId === versionId) {
      throw new Error('Cannot delete live version');
    }

    this.versions.delete(versionId);
    this.snapshots.delete(versionId);

    if (this.currentVersionId === versionId) {
      this.currentVersionId = null;
    }
  }

  /**
   * Get version count
   */
  getVersionCount(): number {
    return this.versions.size;
  }

  /**
   * Clear all versions (except live)
   */
  clearNonLiveVersions(): void {
    for (const [id] of this.versions.entries()) {
      if (id !== this.liveVersionId) {
        this.versions.delete(id);
        this.snapshots.delete(id);
      }
    }
    this.currentVersionId = this.liveVersionId;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.versions.clear();
    this.snapshots.clear();
    this.currentVersionId = null;
    this.liveVersionId = null;
  }
}

