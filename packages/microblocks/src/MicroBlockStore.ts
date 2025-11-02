/**
 * MicroBlockStore - Sparse chunk-based storage for micro blocks
 *
 * Stores micro blocks in chunks (16×16×16 blocks per chunk) for efficient
 * spatial queries and incremental mesh updates.
 */

import { DisposableGroup } from '@engine/core';
import type { Vec3 } from '@engine/core/math';
import type {
  MicroBlock,
  MicroBlockChunk,
  ChunkCoord,
  LocalPos,
  MicroBlockChunkData,
  MicroBlockStoreData,
} from './types';

/**
 * Micro block size: 1/8 of standard block (0.125 units)
 */
export const MICRO_BLOCK_SIZE = 0.125;

/**
 * Default chunk size: 16×16×16 micro blocks per chunk
 */
export const DEFAULT_CHUNK_SIZE = 16;

/**
 * Stores micro blocks in a sparse chunk-based structure
 */
export class MicroBlockStore {
  /** Block size in world units */
  readonly blockSize: number = MICRO_BLOCK_SIZE;

  /** Chunk size (blocks per axis) */
  private readonly _chunkSize: number;

  /** Sparse chunk storage: chunkKey -> chunk */
  private readonly chunks = new Map<string, MicroBlockChunk>();

  /** Disposable group for cleanup */
  private readonly disposables = new DisposableGroup();

  constructor(chunkSize: number = DEFAULT_CHUNK_SIZE) {
    if (chunkSize <= 0 || !Number.isInteger(chunkSize)) {
      throw new Error(`Invalid chunk size: ${chunkSize}. Must be a positive integer.`);
    }
    this._chunkSize = chunkSize;
  }

  get chunkSize(): number {
    return this._chunkSize;
  }

  /**
   * Converts world position to chunk coordinate
   */
  worldToChunk(worldPos: Vec3): ChunkCoord {
    const x = Math.floor(worldPos[0] / (this.blockSize * this.chunkSize));
    const y = Math.floor(worldPos[1] / (this.blockSize * this.chunkSize));
    const z = Math.floor(worldPos[2] / (this.blockSize * this.chunkSize));
    return [x, y, z];
  }

  /**
   * Converts world position to local position within chunk
   */
  worldToLocal(worldPos: Vec3): { chunk: ChunkCoord; local: LocalPos } {
    const chunk = this.worldToChunk(worldPos);
    const chunkWorldX = chunk[0] * this.blockSize * this.chunkSize;
    const chunkWorldY = chunk[1] * this.blockSize * this.chunkSize;
    const chunkWorldZ = chunk[2] * this.blockSize * this.chunkSize;

    const localX = Math.floor((worldPos[0] - chunkWorldX) / this.blockSize);
    const localY = Math.floor((worldPos[1] - chunkWorldY) / this.blockSize);
    const localZ = Math.floor((worldPos[2] - chunkWorldZ) / this.blockSize);

    // Clamp to chunk bounds
    const local: LocalPos = [
      Math.max(0, Math.min(this.chunkSize - 1, localX)),
      Math.max(0, Math.min(this.chunkSize - 1, localY)),
      Math.max(0, Math.min(this.chunkSize - 1, localZ)),
    ];

    return { chunk, local };
  }

  /**
   * Generates a string key for a chunk coordinate
   */
  private chunkKey(coord: ChunkCoord): string {
    return `${coord[0]},${coord[1]},${coord[2]}`;
  }

  /**
   * Converts local position to flat index within chunk
   */
  private localToIndex(local: LocalPos): number {
    return local[0] + local[1] * this.chunkSize + local[2] * this.chunkSize * this.chunkSize;
  }

  /**
   * Gets or creates a chunk
   */
  private getOrCreateChunk(coord: ChunkCoord): MicroBlockChunk {
    const key = this.chunkKey(coord);
    let chunk = this.chunks.get(key);

    if (!chunk) {
      chunk = {
        coord: [coord[0], coord[1], coord[2]], // Copy array
        blocks: new Map(),
        dirty: false,
      };
      this.chunks.set(key, chunk);
    }

    return chunk;
  }

  /**
   * Gets a chunk by coordinate (returns undefined if doesn't exist)
   */
  getChunk(coord: ChunkCoord): MicroBlockChunk | undefined {
    const key = this.chunkKey(coord);
    return this.chunks.get(key);
  }

  /**
   * Gets all chunks
   */
  getAllChunks(): MicroBlockChunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Gets a block at world position
   */
  getBlock(worldPos: Vec3): MicroBlock | null {
    const { chunk, local } = this.worldToLocal(worldPos);
    const chunkObj = this.chunks.get(this.chunkKey(chunk));
    if (!chunkObj) return null;

    const index = this.localToIndex(local);
    return chunkObj.blocks.get(index) ?? null;
  }

  /**
   * Sets a block at world position (null to remove)
   */
  setBlock(worldPos: Vec3, block: MicroBlock | null): void {
    const { chunk, local } = this.worldToLocal(worldPos);
    const chunkObj = this.getOrCreateChunk(chunk);
    const index = this.localToIndex(local);

    if (block === null) {
      // Remove block
      if (chunkObj.blocks.delete(index)) {
        chunkObj.dirty = true;

        // Remove chunk if empty
        if (chunkObj.blocks.size === 0) {
          this.chunks.delete(this.chunkKey(chunk));
        }
      }
    } else {
      // Set block
      const existed = chunkObj.blocks.has(index);
      chunkObj.blocks.set(index, block);

      if (!existed || chunkObj.blocks.get(index) !== block) {
        chunkObj.dirty = true;
      }
    }
  }

  /**
   * Marks chunk as dirty
   */
  markChunkDirty(coord: ChunkCoord): void {
    const chunk = this.getChunk(coord);
    if (chunk) {
      chunk.dirty = true;
    }
  }

  /**
   * Clears dirty flag for a chunk
   */
  clearChunkDirty(coord: ChunkCoord): void {
    const chunk = this.getChunk(coord);
    if (chunk) {
      chunk.dirty = false;
    }
  }

  /**
   * Gets all dirty chunks
   */
  getDirtyChunks(): MicroBlockChunk[] {
    return Array.from(this.chunks.values()).filter((chunk) => chunk.dirty);
  }

  /**
   * Serializes store to JSON-compatible format
   */
  toJSON(): MicroBlockStoreData {
    const chunks: MicroBlockChunkData[] = [];

    for (const chunk of this.chunks.values()) {
      chunks.push({
        coord: [chunk.coord[0], chunk.coord[1], chunk.coord[2]],
        blocks: Array.from(chunk.blocks.entries()),
      });
    }

    return { chunks };
  }

  /**
   * Deserializes store from JSON-compatible format
   */
  fromJSON(data: MicroBlockStoreData): void {
    this.chunks.clear();

    for (const chunkData of data.chunks) {
      const chunk: MicroBlockChunk = {
        coord: [chunkData.coord[0], chunkData.coord[1], chunkData.coord[2]],
        blocks: new Map(chunkData.blocks),
        dirty: true, // Mark as dirty to regenerate mesh
      };
      this.chunks.set(this.chunkKey(chunk.coord), chunk);
    }
  }

  /**
   * Clears all blocks
   */
  clear(): void {
    this.chunks.clear();
  }

  /**
   * Gets total number of blocks
   */
  getBlockCount(): number {
    let count = 0;
    for (const chunk of this.chunks.values()) {
      count += chunk.blocks.size;
    }
    return count;
  }

  /**
   * Gets total number of chunks
   */
  getChunkCount(): number {
    return this.chunks.size;
  }

  /**
   * Disposes all resources
   */
  dispose(): void {
    this.disposables.dispose();
    this.chunks.clear();
  }
}

