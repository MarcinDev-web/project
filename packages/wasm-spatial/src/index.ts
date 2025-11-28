/**
 * @engine/wasm-spatial - High-performance spatial indexing in Rust/WASM
 *
 * Provides BVH and Loose Octree implementations optimized for:
 * - Dynamic scenes with many moving objects
 * - Incremental updates (no full rebuild needed)
 * - Zero-copy memory access from JavaScript
 * - SIMD-optimized AABB operations
 *
 * @example
 * ```ts
 * import { initWasm, createBVH, createLooseOctree } from '@engine/wasm-spatial';
 *
 * await initWasm();
 *
 * // Create BVH for dynamic scene
 * const bvh = createBVH({ fatMargin: 0.2 });
 * bvh.insert(entityId, [minX, minY, minZ, maxX, maxY, maxZ]);
 * const visible = bvh.queryFrustum(frustumPlanes);
 *
 * // Create Loose Octree for mostly static scene
 * const octree = createLooseOctree({
 *   bounds: [-100, -100, -100, 100, 100, 100],
 *   looseness: 2.0,
 * });
 * ```
 */

// Will be populated after WASM init
let wasmModule: WasmSpatialModule | null = null;

/**
 * WASM module interface (from wasm-bindgen)
 */
interface WasmSpatialModule {
  init_panic_hook(): void;
  SpatialBVH: new (fatMargin: number) => WasmBVH;
  SpatialLooseOctree: new (
    bounds: Float32Array,
    looseness: number,
    maxDepth: number,
    maxEntitiesPerNode: number,
    minNodeSize: number
  ) => WasmLooseOctree;
}

interface WasmBVH {
  free(): void;
  clear(): void;
  insert(entityId: number, aabb: Float32Array): void;
  remove(entityId: number): boolean;
  update(entityId: number, aabb: Float32Array): boolean;
  batch_update(data: Float32Array): number;
  query_aabb(aabb: Float32Array): Uint32Array;
  query_frustum(planes: Float32Array): Uint32Array;
  get_stats(): Uint32Array;
  reset_stats(): void;
}

interface WasmLooseOctree {
  free(): void;
  clear(): void;
  insert(entityId: number, aabb: Float32Array): void;
  remove(entityId: number): boolean;
  update(entityId: number, aabb: Float32Array): boolean;
  query(aabb: Float32Array): Uint32Array;
  get_stats(): Uint32Array;
  reset_stats(): void;
}

/**
 * BVH configuration options
 */
export interface BVHOptions {
  /** Fat AABB margin for movement tolerance (default: 0.2) */
  fatMargin?: number;
}

/**
 * Loose Octree configuration options
 */
export interface LooseOctreeOptions {
  /** World bounds [minX, minY, minZ, maxX, maxY, maxZ] */
  bounds: [number, number, number, number, number, number];
  /** Looseness factor (default: 2.0) */
  looseness?: number;
  /** Maximum tree depth (default: 6) */
  maxDepth?: number;
  /** Maximum entities per node before splitting (default: 8) */
  maxEntitiesPerNode?: number;
  /** Minimum node size to prevent infinite subdivision (default: 1.0) */
  minNodeSize?: number;
}

/**
 * Spatial index statistics
 */
export interface SpatialStats {
  entityCount: number;
  nodeCount: number;
  insertCount: number;
  updateCount: number;
  refitCount: number;
  treeHeight?: number;
}

/**
 * High-level BVH wrapper
 */
export class SpatialBVH {
  private wasm: WasmBVH;
  private aabbBuffer = new Float32Array(6);
  private planesBuffer = new Float32Array(24);

  constructor(options: BVHOptions = {}) {
    if (!wasmModule) {
      throw new Error('WASM not initialized. Call initWasm() first.');
    }
    this.wasm = new wasmModule.SpatialBVH(options.fatMargin ?? 0.2);
  }

  /**
   * Clears all entities
   */
  clear(): void {
    this.wasm.clear();
  }

  /**
   * Inserts or updates an entity
   */
  insert(entityId: number, aabb: ArrayLike<number>): void {
    this.aabbBuffer[0] = aabb[0];
    this.aabbBuffer[1] = aabb[1];
    this.aabbBuffer[2] = aabb[2];
    this.aabbBuffer[3] = aabb[3];
    this.aabbBuffer[4] = aabb[4];
    this.aabbBuffer[5] = aabb[5];
    this.wasm.insert(entityId, this.aabbBuffer);
  }

  /**
   * Removes an entity
   */
  remove(entityId: number): boolean {
    return this.wasm.remove(entityId);
  }

  /**
   * Updates entity AABB - returns true if re-insertion was needed
   */
  update(entityId: number, aabb: ArrayLike<number>): boolean {
    this.aabbBuffer[0] = aabb[0];
    this.aabbBuffer[1] = aabb[1];
    this.aabbBuffer[2] = aabb[2];
    this.aabbBuffer[3] = aabb[3];
    this.aabbBuffer[4] = aabb[4];
    this.aabbBuffer[5] = aabb[5];
    return this.wasm.update(entityId, this.aabbBuffer);
  }

  /**
   * Batch updates entities
   * @param updates Array of { entityId, aabb } objects
   * @returns Number of re-insertions
   */
  batchUpdate(updates: Array<{ entityId: number; aabb: ArrayLike<number> }>): number {
    const stride = 7;
    const data = new Float32Array(updates.length * stride);

    for (let i = 0; i < updates.length; i++) {
      const base = i * stride;
      const { entityId, aabb } = updates[i];
      data[base] = entityId;
      data[base + 1] = aabb[0];
      data[base + 2] = aabb[1];
      data[base + 3] = aabb[2];
      data[base + 4] = aabb[3];
      data[base + 5] = aabb[4];
      data[base + 6] = aabb[5];
    }

    return this.wasm.batch_update(data);
  }

  /**
   * Queries entities intersecting AABB
   */
  queryAABB(aabb: ArrayLike<number>): Uint32Array {
    this.aabbBuffer[0] = aabb[0];
    this.aabbBuffer[1] = aabb[1];
    this.aabbBuffer[2] = aabb[2];
    this.aabbBuffer[3] = aabb[3];
    this.aabbBuffer[4] = aabb[4];
    this.aabbBuffer[5] = aabb[5];
    return this.wasm.query_aabb(this.aabbBuffer);
  }

  /**
   * Frustum culling - returns visible entity IDs
   * @param planes 6 frustum planes, each with [nx, ny, nz, d]
   */
  queryFrustum(
    planes: Array<{ nx: number; ny: number; nz: number; d: number }>
  ): Uint32Array {
    for (let i = 0; i < 6 && i < planes.length; i++) {
      const base = i * 4;
      const p = planes[i];
      this.planesBuffer[base] = p.nx;
      this.planesBuffer[base + 1] = p.ny;
      this.planesBuffer[base + 2] = p.nz;
      this.planesBuffer[base + 3] = p.d;
    }
    return this.wasm.query_frustum(this.planesBuffer);
  }

  /**
   * Gets statistics
   */
  getStats(): SpatialStats {
    const stats = this.wasm.get_stats();
    return {
      entityCount: stats[0],
      nodeCount: stats[1],
      treeHeight: stats[2],
      insertCount: stats[3],
      updateCount: stats[4],
      refitCount: stats[5],
    };
  }

  /**
   * Resets statistics counters
   */
  resetStats(): void {
    this.wasm.reset_stats();
  }

  /**
   * Frees WASM memory
   */
  dispose(): void {
    this.wasm.free();
  }
}

/**
 * High-level Loose Octree wrapper
 */
export class SpatialLooseOctree {
  private wasm: WasmLooseOctree;
  private aabbBuffer = new Float32Array(6);

  constructor(options: LooseOctreeOptions) {
    if (!wasmModule) {
      throw new Error('WASM not initialized. Call initWasm() first.');
    }

    const boundsArray = new Float32Array(options.bounds);
    this.wasm = new wasmModule.SpatialLooseOctree(
      boundsArray,
      options.looseness ?? 2.0,
      options.maxDepth ?? 6,
      options.maxEntitiesPerNode ?? 8,
      options.minNodeSize ?? 1.0
    );
  }

  /**
   * Clears all entities
   */
  clear(): void {
    this.wasm.clear();
  }

  /**
   * Inserts an entity
   */
  insert(entityId: number, aabb: ArrayLike<number>): void {
    this.aabbBuffer[0] = aabb[0];
    this.aabbBuffer[1] = aabb[1];
    this.aabbBuffer[2] = aabb[2];
    this.aabbBuffer[3] = aabb[3];
    this.aabbBuffer[4] = aabb[4];
    this.aabbBuffer[5] = aabb[5];
    this.wasm.insert(entityId, this.aabbBuffer);
  }

  /**
   * Removes an entity
   */
  remove(entityId: number): boolean {
    return this.wasm.remove(entityId);
  }

  /**
   * Updates entity AABB - returns true if re-insertion was needed
   */
  update(entityId: number, aabb: ArrayLike<number>): boolean {
    this.aabbBuffer[0] = aabb[0];
    this.aabbBuffer[1] = aabb[1];
    this.aabbBuffer[2] = aabb[2];
    this.aabbBuffer[3] = aabb[3];
    this.aabbBuffer[4] = aabb[4];
    this.aabbBuffer[5] = aabb[5];
    return this.wasm.update(entityId, this.aabbBuffer);
  }

  /**
   * Queries entities intersecting AABB
   */
  query(aabb: ArrayLike<number>): Uint32Array {
    this.aabbBuffer[0] = aabb[0];
    this.aabbBuffer[1] = aabb[1];
    this.aabbBuffer[2] = aabb[2];
    this.aabbBuffer[3] = aabb[3];
    this.aabbBuffer[4] = aabb[4];
    this.aabbBuffer[5] = aabb[5];
    return this.wasm.query(this.aabbBuffer);
  }

  /**
   * Gets statistics
   */
  getStats(): SpatialStats {
    const stats = this.wasm.get_stats();
    return {
      entityCount: stats[0],
      nodeCount: stats[1],
      insertCount: stats[2],
      updateCount: stats[3],
      refitCount: stats[4],
    };
  }

  /**
   * Resets statistics counters
   */
  resetStats(): void {
    this.wasm.reset_stats();
  }

  /**
   * Frees WASM memory
   */
  dispose(): void {
    this.wasm.free();
  }
}

let initPromise: Promise<void> | null = null;

/**
 * Initializes the WASM module
 * Must be called before using any spatial structures
 */
export async function initWasm(): Promise<void> {
  if (wasmModule) return;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        // Dynamic import of WASM module
        const mod = await import('../pkg/wasm_spatial.js');

        if (typeof mod.default === 'function') {
          await mod.default();
        }

        if (typeof mod.init_panic_hook === 'function') {
          mod.init_panic_hook();
        }

        wasmModule = mod as unknown as WasmSpatialModule;
      } catch (error) {
        console.warn('[wasm-spatial] Failed to load WASM module:', error);
        throw error;
      }
    })();
  }

  return initPromise;
}

/**
 * Checks if WASM is initialized
 */
export function isWasmInitialized(): boolean {
  return wasmModule !== null;
}

/**
 * Factory function to create BVH
 */
export function createBVH(options?: BVHOptions): SpatialBVH {
  return new SpatialBVH(options);
}

/**
 * Factory function to create Loose Octree
 */
export function createLooseOctree(options: LooseOctreeOptions): SpatialLooseOctree {
  return new SpatialLooseOctree(options);
}

