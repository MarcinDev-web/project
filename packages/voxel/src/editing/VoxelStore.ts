/**
 * Voxel data store - chunk-based storage for voxel world
 */

import type { VoxelPos, ChunkPos } from './VoxelPosition.js';
import { worldToChunk, hashChunkPos } from './VoxelPosition.js';
import type { BlockType, BlockMetadata } from './VoxelOperations.js';

/**
 * Single voxel data
 */
export interface VoxelData {
  blockType: BlockType;
  metadata?: BlockMetadata;
}

/**
 * Chunk data - stores voxels in a 3D grid within a chunk
 */
export interface ChunkData {
  position: ChunkPos;
  size: number;
  /** Linear array: data[x + y * size + z * size * size] */
  data: (VoxelData | null)[];
  /** Last modified timestamp */
  modifiedAt: number;
}

/**
 * Chunk-based voxel store
 */
export class VoxelStore {
  private readonly chunks = new Map<string, ChunkData>();
  private readonly chunkSize: number;

  constructor(chunkSize = 16) {
    this.chunkSize = chunkSize;
  }

  /**
   * Get or create chunk for position
   */
  private getOrCreateChunk(chunkPos: ChunkPos): ChunkData {
    const key = hashChunkPos(chunkPos);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = {
        position: { ...chunkPos },
        size: this.chunkSize,
        data: new Array(this.chunkSize * this.chunkSize * this.chunkSize).fill(null),
        modifiedAt: Date.now(),
      };
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  /**
   * Get chunk if exists
   */
  private getChunk(chunkPos: ChunkPos): ChunkData | null {
    const key = hashChunkPos(chunkPos);
    return this.chunks.get(key) ?? null;
  }

  /**
   * Get local index within chunk
   */
  private getLocalIndex(local: VoxelPos): number {
    if (
      local.x < 0 ||
      local.y < 0 ||
      local.z < 0 ||
      local.x >= this.chunkSize ||
      local.y >= this.chunkSize ||
      local.z >= this.chunkSize
    ) {
      return -1;
    }
    return local.x + local.y * this.chunkSize + local.z * this.chunkSize * this.chunkSize;
  }

  /**
   * Get voxel at position
   */
  getVoxel(pos: VoxelPos): VoxelData | null {
    const chunkPos = worldToChunk(pos, this.chunkSize);
    const chunk = this.getChunk(chunkPos);
    if (!chunk) return null;

    const localPos = {
      x: pos.x - chunkPos.x * this.chunkSize,
      y: pos.y - chunkPos.y * this.chunkSize,
      z: pos.z - chunkPos.z * this.chunkSize,
    };
    const index = this.getLocalIndex(localPos);
    if (index < 0) return null;

    return chunk.data[index] ?? null;
  }

  /**
   * Set voxel at position
   */
  setVoxel(pos: VoxelPos, data: VoxelData | null): void {
    const chunkPos = worldToChunk(pos, this.chunkSize);
    const chunk = this.getOrCreateChunk(chunkPos);

    const localPos = {
      x: pos.x - chunkPos.x * this.chunkSize,
      y: pos.y - chunkPos.y * this.chunkSize,
      z: pos.z - chunkPos.z * this.chunkSize,
    };
    const index = this.getLocalIndex(localPos);
    if (index < 0) return;

    chunk.data[index] = data;
    chunk.modifiedAt = Date.now();
  }

  /**
   * Get all modified chunks since timestamp
   */
  getModifiedChunks(since: number): ChunkData[] {
    const result: ChunkData[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.modifiedAt >= since) {
        result.push(chunk);
      }
    }
    return result;
  }

  /**
   * Get all chunks
   */
  getAllChunks(): ChunkData[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Get chunk count
   */
  getChunkCount(): number {
    return this.chunks.size;
  }

  /**
   * Clear all chunks
   */
  clear(): void {
    this.chunks.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clear();
  }
}

