/**
 * ModelBuilder - Main class for building models with micro blocks
 * 
 * Manages micro block operations, region operations, and model export/import
 */

import { DisposableGroup } from '@engine/core';
import type { Vec3 } from '@engine/core/math';
import { MicroBlockStore, MICRO_BLOCK_SIZE } from '@engine/microblocks';
import type {
  MicroBlock,
  LocalPos,
  RotationAxis,
  MicroBlockStoreData,
} from '@engine/microblocks';
import type { ModelBuilderConfig, BuildBounds, ModelData, AABB } from './ModelBuilderTypes';

/**
 * ModelBuilder manages micro block construction with bounds validation
 */
export class ModelBuilder {
  private readonly store: MicroBlockStore;
  private readonly bounds: BuildBounds;
  private readonly logger: ModelBuilderConfig['logger'];
  private readonly disposables = new DisposableGroup();

  constructor(config: ModelBuilderConfig) {
    this.bounds = config.bounds;
    this.store = new MicroBlockStore(config.chunkSize ?? 16);
    this.logger = config.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };

    // Validate bounds
    if (
      this.bounds.min[0] > this.bounds.max[0] ||
      this.bounds.min[1] > this.bounds.max[1] ||
      this.bounds.min[2] > this.bounds.max[2]
    ) {
      throw new Error('Invalid build bounds: min must be <= max');
    }
  }

  /**
   * Gets the micro block store
   */
  getStore(): MicroBlockStore {
    return this.store;
  }

  /**
   * Gets build bounds
   */
  getBounds(): BuildBounds {
    return {
      min: [...this.bounds.min] as LocalPos,
      max: [...this.bounds.max] as LocalPos,
    };
  }

  /**
   * Converts local position to world position
   */
  private localToWorld(local: LocalPos): Vec3 {
    return [
      local[0] * MICRO_BLOCK_SIZE,
      local[1] * MICRO_BLOCK_SIZE,
      local[2] * MICRO_BLOCK_SIZE,
    ];
  }

  /**
   * Converts world position to local position
   */
  private worldToLocal(world: Vec3): LocalPos {
    return [
      Math.floor(world[0] / MICRO_BLOCK_SIZE),
      Math.floor(world[1] / MICRO_BLOCK_SIZE),
      Math.floor(world[2] / MICRO_BLOCK_SIZE),
    ];
  }

  /**
   * Checks if position is within build bounds
   */
  private isWithinBounds(pos: LocalPos): boolean {
    return (
      pos[0] >= this.bounds.min[0] &&
      pos[0] <= this.bounds.max[0] &&
      pos[1] >= this.bounds.min[1] &&
      pos[1] <= this.bounds.max[1] &&
      pos[2] >= this.bounds.min[2] &&
      pos[2] <= this.bounds.max[2]
    );
  }

  /**
   * Places a block at local position
   * @returns true if placed successfully, false if out of bounds
   */
  placeBlock(pos: LocalPos, block: MicroBlock): boolean {
    if (!this.isWithinBounds(pos)) {
      this.logger?.warn(`Cannot place block at ${pos}: out of bounds`);
      return false;
    }

    const worldPos = this.localToWorld(pos);
    this.store.setBlock(worldPos, block);
    return true;
  }

  /**
   * Removes a block at local position
   * @returns true if removed successfully, false if out of bounds or no block
   */
  removeBlock(pos: LocalPos): boolean {
    if (!this.isWithinBounds(pos)) {
      this.logger?.warn(`Cannot remove block at ${pos}: out of bounds`);
      return false;
    }

    const worldPos = this.localToWorld(pos);
    const existing = this.store.getBlock(worldPos);
    if (existing) {
      this.store.setBlock(worldPos, null);
      return true;
    }
    return false;
  }

  /**
   * Rotates a block at local position
   * @returns true if rotated successfully
   */
  rotateBlock(pos: LocalPos, axis: RotationAxis): boolean {
    if (!this.isWithinBounds(pos)) {
      return false;
    }

    const worldPos = this.localToWorld(pos);
    const block = this.store.getBlock(worldPos);
    if (!block) {
      return false;
    }

    const newRotation = ((block.rotation ?? 0) + axis) % 4 as RotationAxis;
    const rotatedBlock: MicroBlock = {
      ...block,
      rotation: newRotation,
    };

    this.store.setBlock(worldPos, rotatedBlock);
    return true;
  }

  /**
   * Copies a region of blocks
   */
  copyRegion(bounds: AABB): MicroBlockStoreData {
    const tempStore = new MicroBlockStore(this.store.chunkSize);
    const minLocal = this.worldToLocal(bounds.min);
    const maxLocal = this.worldToLocal(bounds.max);

    // Clamp to build bounds
    const clampedMin: LocalPos = [
      Math.max(minLocal[0], this.bounds.min[0]),
      Math.max(minLocal[1], this.bounds.min[1]),
      Math.max(minLocal[2], this.bounds.min[2]),
    ];
    const clampedMax: LocalPos = [
      Math.min(maxLocal[0], this.bounds.max[0]),
      Math.min(maxLocal[1], this.bounds.max[1]),
      Math.min(maxLocal[2], this.bounds.max[2]),
    ];

    // Copy blocks to temp store (offset to origin)
    for (let x = clampedMin[0]; x <= clampedMax[0]; x++) {
      for (let y = clampedMin[1]; y <= clampedMax[1]; y++) {
        for (let z = clampedMin[2]; z <= clampedMax[2]; z++) {
          const localPos: LocalPos = [x, y, z];
          const worldPos = this.localToWorld(localPos);
          const block = this.store.getBlock(worldPos);
          if (block) {
            // Store with offset relative to clampedMin (so paste starts at origin)
            const offsetPos: LocalPos = [
              x - clampedMin[0],
              y - clampedMin[1],
              z - clampedMin[2],
            ];
            const offsetWorld = this.localToWorld(offsetPos);
            tempStore.setBlock(offsetWorld, { ...block }); // Copy block object
          }
        }
      }
    }

    return tempStore.toJSON();
  }

  /**
   * Pastes a region of blocks at offset position
   */
  pasteRegion(data: MicroBlockStoreData, offset: LocalPos): void {
    const tempStore = new MicroBlockStore(this.store.chunkSize);
    tempStore.fromJSON(data);

    // Get all chunks from temp store
    const chunks = tempStore.getAllChunks();
    for (const chunk of chunks) {
      // Calculate chunk world bounds
      const chunkWorldMinX = chunk.coord[0] * MICRO_BLOCK_SIZE * this.store.chunkSize;
      const chunkWorldMinY = chunk.coord[1] * MICRO_BLOCK_SIZE * this.store.chunkSize;
      const chunkWorldMinZ = chunk.coord[2] * MICRO_BLOCK_SIZE * this.store.chunkSize;

      // Iterate through all possible positions in chunk
      for (let x = 0; x < this.store.chunkSize; x++) {
        for (let y = 0; y < this.store.chunkSize; y++) {
          for (let z = 0; z < this.store.chunkSize; z++) {
            const localInChunk: LocalPos = [x, y, z];
            const worldInChunk: Vec3 = [
              chunkWorldMinX + x * MICRO_BLOCK_SIZE,
              chunkWorldMinY + y * MICRO_BLOCK_SIZE,
              chunkWorldMinZ + z * MICRO_BLOCK_SIZE,
            ];
            
            const block = tempStore.getBlock(worldInChunk);
            if (block) {
              const targetPos: LocalPos = [
                x + chunk.coord[0] * this.store.chunkSize + offset[0],
                y + chunk.coord[1] * this.store.chunkSize + offset[1],
                z + chunk.coord[2] * this.store.chunkSize + offset[2],
              ];

              if (this.isWithinBounds(targetPos)) {
                this.placeBlock(targetPos, block);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Mirrors a region along specified axis
   */
  mirrorRegion(bounds: AABB, axis: 'x' | 'y' | 'z'): void {
    const minLocal = this.worldToLocal(bounds.min);
    const maxLocal = this.worldToLocal(bounds.max);

    // Clamp to build bounds
    const clampedMin: LocalPos = [
      Math.max(minLocal[0], this.bounds.min[0]),
      Math.max(minLocal[1], this.bounds.min[1]),
      Math.max(minLocal[2], this.bounds.min[2]),
    ];
    const clampedMax: LocalPos = [
      Math.min(maxLocal[0], this.bounds.max[0]),
      Math.min(maxLocal[1], this.bounds.max[1]),
      Math.min(maxLocal[2], this.bounds.max[2]),
    ];

    // Copy original blocks
    const originalBlocks = new Map<string, MicroBlock>();
    for (let x = clampedMin[0]; x <= clampedMax[0]; x++) {
      for (let y = clampedMin[1]; y <= clampedMax[1]; y++) {
        for (let z = clampedMin[2]; z <= clampedMax[2]; z++) {
          const localPos: LocalPos = [x, y, z];
          const worldPos = this.localToWorld(localPos);
          const block = this.store.getBlock(worldPos);
          if (block) {
            const key = `${x},${y},${z}`;
            originalBlocks.set(key, block);
          }
        }
      }
    }

    // Mirror blocks
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const center = (clampedMin[axisIndex] + clampedMax[axisIndex]) / 2;

    for (const [key, block] of originalBlocks.entries()) {
      const [x, y, z] = key.split(',').map(Number) as LocalPos;
      const mirroredPos: LocalPos = [...[x, y, z]] as LocalPos;
      mirroredPos[axisIndex] = Math.round(2 * center - mirroredPos[axisIndex]);

      // Adjust rotation for mirrored blocks
      let mirroredRotation = block.rotation ?? 0;
      if (axis === 'x' || axis === 'z') {
        // Flip rotation for horizontal mirroring
        mirroredRotation = (4 - mirroredRotation) % 4 as RotationAxis;
      }

      const mirroredBlock: MicroBlock = {
        ...block,
        rotation: mirroredRotation,
      };

      const mirroredWorldPos = this.localToWorld(mirroredPos);
      if (this.isWithinBounds(mirroredPos)) {
        this.store.setBlock(mirroredWorldPos, mirroredBlock);
      }
    }
  }

  /**
   * Fills a region with a block
   */
  fillRegion(bounds: AABB, block: MicroBlock): void {
    const minLocal = this.worldToLocal(bounds.min);
    const maxLocal = this.worldToLocal(bounds.max);

    // Clamp to build bounds
    const clampedMin: LocalPos = [
      Math.max(minLocal[0], this.bounds.min[0]),
      Math.max(minLocal[1], this.bounds.min[1]),
      Math.max(minLocal[2], this.bounds.min[2]),
    ];
    const clampedMax: LocalPos = [
      Math.min(maxLocal[0], this.bounds.max[0]),
      Math.min(maxLocal[1], this.bounds.max[1]),
      Math.min(maxLocal[2], this.bounds.max[2]),
    ];

    for (let x = clampedMin[0]; x <= clampedMax[0]; x++) {
      for (let y = clampedMin[1]; y <= clampedMax[1]; y++) {
        for (let z = clampedMin[2]; z <= clampedMax[2]; z++) {
          const localPos: LocalPos = [x, y, z];
          this.placeBlock(localPos, block);
        }
      }
    }
  }

  /**
   * Clears a region (removes all blocks)
   */
  clearRegion(bounds: AABB): void {
    const minLocal = this.worldToLocal(bounds.min);
    const maxLocal = this.worldToLocal(bounds.max);

    // Clamp to build bounds
    const clampedMin: LocalPos = [
      Math.max(minLocal[0], this.bounds.min[0]),
      Math.max(minLocal[1], this.bounds.min[1]),
      Math.max(minLocal[2], this.bounds.min[2]),
    ];
    const clampedMax: LocalPos = [
      Math.min(maxLocal[0], this.bounds.max[0]),
      Math.min(maxLocal[1], this.bounds.max[1]),
      Math.min(maxLocal[2], this.bounds.max[2]),
    ];

    for (let x = clampedMin[0]; x <= clampedMax[0]; x++) {
      for (let y = clampedMin[1]; y <= clampedMax[1]; y++) {
        for (let z = clampedMin[2]; z <= clampedMax[2]; z++) {
          const localPos: LocalPos = [x, y, z];
          this.removeBlock(localPos);
        }
      }
    }
  }

  /**
   * Gets AABB bounds of the model
   */
  getModelBounds(): AABB | null {
    const chunks = this.store.getAllChunks();
    if (chunks.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const chunk of chunks) {
      const chunkWorldMinX = chunk.coord[0] * MICRO_BLOCK_SIZE * this.store.chunkSize;
      const chunkWorldMinY = chunk.coord[1] * MICRO_BLOCK_SIZE * this.store.chunkSize;
      const chunkWorldMinZ = chunk.coord[2] * MICRO_BLOCK_SIZE * this.store.chunkSize;
      const chunkWorldMaxX = chunkWorldMinX + MICRO_BLOCK_SIZE * this.store.chunkSize;
      const chunkWorldMaxY = chunkWorldMinY + MICRO_BLOCK_SIZE * this.store.chunkSize;
      const chunkWorldMaxZ = chunkWorldMinZ + MICRO_BLOCK_SIZE * this.store.chunkSize;

      minX = Math.min(minX, chunkWorldMinX);
      minY = Math.min(minY, chunkWorldMinY);
      minZ = Math.min(minZ, chunkWorldMinZ);
      maxX = Math.max(maxX, chunkWorldMaxX);
      maxY = Math.max(maxY, chunkWorldMaxY);
      maxZ = Math.max(maxZ, chunkWorldMaxZ);
    }

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    };
  }

  /**
   * Exports model data
   */
  exportModel(metadata?: ModelData['metadata']): ModelData {
    return {
      storeData: this.store.toJSON(),
      chunkSize: this.store.chunkSize,
      bounds: this.getBounds(),
      metadata: {
        ...metadata,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Imports model data
   */
  importModel(data: ModelData): void {
    this.store.fromJSON(data.storeData);
    // Note: bounds are not updated from import, they remain as configured
  }

  /**
   * Clears all blocks
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Gets total number of blocks
   */
  getBlockCount(): number {
    return this.store.getBlockCount();
  }

  /**
   * Disposes resources
   */
  dispose(): void {
    this.disposables.dispose();
    this.store.dispose();
  }
}

