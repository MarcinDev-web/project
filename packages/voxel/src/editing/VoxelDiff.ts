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
export class VoxelDiff {
  private readonly changes = new Map<string, VoxelChange>();

  /**
   * Record a change
   */
  recordChange(
    pos: VoxelPos,
    before: BlockType | null,
    after: BlockType | null,
    metadataBefore?: BlockMetadata,
    metadataAfter?: BlockMetadata
  ): void {
    const key = this.hashPos(pos);
    const change: VoxelChange = {
      position: { ...pos },
      before,
      after,
    };
    if (metadataBefore !== undefined) {
      change.metadataBefore = metadataBefore;
    }
    if (metadataAfter !== undefined) {
      change.metadataAfter = metadataAfter;
    }
    this.changes.set(key, change);
  }

  /**
   * Get all changes
   */
  getChanges(): VoxelChange[] {
    return Array.from(this.changes.values());
  }

  /**
   * Check if diff is empty
   */
  isEmpty(): boolean {
    return this.changes.size === 0;
  }

  /**
   * Merge another diff into this one
   */
  merge(other: VoxelDiff): void {
    for (const change of other.getChanges()) {
      const key = this.hashPos(change.position);
      this.changes.set(key, change);
    }
  }

  /**
   * Apply diff to store (forward)
   */
  applyToStore(store: VoxelStore): void {
    for (const change of this.changes.values()) {
      if (change.after !== null) {
        const data: { blockType: number; metadata?: BlockMetadata } = {
          blockType: change.after,
        };
        if (change.metadataAfter !== undefined) {
          data.metadata = change.metadataAfter;
        }
        store.setVoxel(change.position, data);
      } else {
        store.setVoxel(change.position, null);
      }
    }
  }

  /**
   * Reverse diff (for undo)
   */
  reverse(): VoxelDiff {
    const reversed = new VoxelDiff();
    for (const change of this.changes.values()) {
      reversed.recordChange(
        change.position,
        change.after,
        change.before,
        change.metadataAfter,
        change.metadataBefore
      );
    }
    return reversed;
  }

  private hashPos(pos: VoxelPos): string {
    return `${pos.x},${pos.y},${pos.z}`;
  }
}

/**
 * Snapshot of voxel world state
 */
export class VoxelSnapshot {
  /** Snapshot timestamp */
  readonly timestamp: number;
  /** Snapshot version ID */
  readonly version: string;
  /** Chunk data at time of snapshot */
  private readonly chunks: Map<string, ChunkData>;

  constructor(version: string, chunks: Iterable<ChunkData>) {
    this.timestamp = Date.now();
    this.version = version;
    this.chunks = new Map();

    // Deep clone chunks
    for (const chunk of chunks) {
      const key = `${chunk.position.x},${chunk.position.y},${chunk.position.z}`;
      this.chunks.set(key, {
        ...chunk,
        position: { ...chunk.position },
        data: [...chunk.data],
      });
    }
  }

  /**
   * Create diff from this snapshot to current store state
   */
  diffTo(store: VoxelStore): VoxelDiff {
    const diff = new VoxelDiff();

    // Check all positions in snapshot
    for (const chunk of this.chunks.values()) {
      for (let x = 0; x < chunk.size; x++) {
        for (let y = 0; y < chunk.size; y++) {
          for (let z = 0; z < chunk.size; z++) {
            const index = x + y * chunk.size + z * chunk.size * chunk.size;
            const snapshotVoxel = chunk.data[index];
            const worldPos = {
              x: chunk.position.x * chunk.size + x,
              y: chunk.position.y * chunk.size + y,
              z: chunk.position.z * chunk.size + z,
            };
            const currentVoxel = store.getVoxel(worldPos);

            if (snapshotVoxel?.blockType !== currentVoxel?.blockType) {
              diff.recordChange(
                worldPos,
                snapshotVoxel?.blockType ?? null,
                currentVoxel?.blockType ?? null,
                snapshotVoxel?.metadata,
                currentVoxel?.metadata
              );
            }
          }
        }
      }
    }

    // Check chunks that exist in current but not in snapshot
    for (const chunk of store.getAllChunks()) {
      const key = `${chunk.position.x},${chunk.position.y},${chunk.position.z}`;
      if (!this.chunks.has(key)) {
        // New chunks entirely added
        for (let x = 0; x < chunk.size; x++) {
          for (let y = 0; y < chunk.size; y++) {
            for (let z = 0; z < chunk.size; z++) {
              const index = x + y * chunk.size + z * chunk.size * chunk.size;
              const voxel = chunk.data[index];
              if (voxel) {
                const worldPos = {
                  x: chunk.position.x * chunk.size + x,
                  y: chunk.position.y * chunk.size + y,
                  z: chunk.position.z * chunk.size + z,
                };
                diff.recordChange(worldPos, null, voxel.blockType, undefined, voxel.metadata);
              }
            }
          }
        }
      }
    }

    return diff;
  }

  /**
   * Restore store to this snapshot state
   */
  restoreTo(store: VoxelStore): void {
    store.clear();
    for (const chunk of this.chunks.values()) {
      for (let x = 0; x < chunk.size; x++) {
        for (let y = 0; y < chunk.size; y++) {
          for (let z = 0; z < chunk.size; z++) {
            const index = x + y * chunk.size + z * chunk.size * chunk.size;
            const voxel = chunk.data[index];
            if (voxel) {
              const worldPos = {
                x: chunk.position.x * chunk.size + x,
                y: chunk.position.y * chunk.size + y,
                z: chunk.position.z * chunk.size + z,
              };
              const data: { blockType: number; metadata?: BlockMetadata } = {
                blockType: voxel.blockType,
              };
              if (voxel.metadata !== undefined) {
                data.metadata = voxel.metadata;
              }
              store.setVoxel(worldPos, data);
            }
          }
        }
      }
    }
  }

  /**
   * Get chunk count
   */
  getChunkCount(): number {
    return this.chunks.size;
  }
}

