/**
 * Frustum Culling System
 *
 * Extracts frustum planes from view-projection matrix and performs
 * efficient visibility tests against entity bounding boxes.
 *
 * Performance: Culls objects outside camera view to reduce draw calls.
 * 
 * Spatial Indexing Strategies:
 * - 'linear': O(N) brute force scan - best for < 100 entities
 * - 'loose-octree': Loose octree with expanded bounds - best for mostly static scenes
 * - 'bvh': Dynamic BVH with fat AABBs - best for dynamic scenes with moving objects
 * - 'wasm-bvh': WASM-accelerated BVH (fastest, recommended for production)
 * - 'auto': Automatically selects based on entity count and movement patterns
 * 
 * WASM Acceleration:
 * - Uses @engine/wasm-spatial for high-performance spatial indexing
 * - BVH with fat AABBs: O(1) updates for small movements
 * - Frustum culling: O(log N) with early termination
 * - 5-10x faster than JS implementation for large entity counts
 */

import type { Mat4, Vec3 } from '@engine/core/math';
import type { Entity, AABB } from '@engine/world';
import { Octree, LooseOctree, DynamicBVH, MeshComponent } from '@engine/world';
import {
  initWasm as initWasmSpatial,
  isWasmInitialized,
  SpatialBVH,
  type SpatialStats,
} from '@engine/wasm-spatial';

export interface FrustumPlane {
  nx: number;
  ny: number;
  nz: number;
  d: number;
}

export interface Frustum {
  planes: FrustumPlane[];
}

/** WASM batch culling interface (from @engine/wasm-render-logic) */
export interface WasmCullingFunctions {
  batch_transform_and_cull_aabbs: (
    planes: Float32Array,
    worldMatrices: Float32Array,
    localAabbs: Float32Array
  ) => Uint8Array;
  batch_transform_cull_get_visible_indices: (
    planes: Float32Array,
    worldMatrices: Float32Array,
    localAabbs: Float32Array
  ) => Uint32Array;
}

/**
 * Spatial indexing strategy
 */
export type SpatialIndexStrategy = 'linear' | 'loose-octree' | 'bvh' | 'wasm-bvh' | 'auto';

/**
 * FrustumCuller configuration
 */
export interface FrustumCullerConfig {
  /** Spatial indexing strategy */
  strategy: SpatialIndexStrategy;
  /** Loose octree looseness factor (default: 2.0) */
  loosenessFactor: number;
  /** BVH fat AABB margin (default: 0.2) */
  bvhFatMargin: number;
  /** Entity count threshold for switching from linear to spatial index (auto mode) */
  linearThreshold: number;
  /** Movement ratio threshold for preferring BVH over octree (auto mode) */
  dynamicThreshold: number;
  /** Prefer WASM implementation when available (default: true) */
  preferWasm: boolean;
}

const DEFAULT_CONFIG: FrustumCullerConfig = {
  strategy: 'auto',
  loosenessFactor: 2.0,
  bvhFatMargin: 0.2,
  linearThreshold: 100,
  dynamicThreshold: 0.3, // If > 30% of entities move, prefer BVH
  preferWasm: true, // Always prefer WASM when available
};

/**
 * FrustumCuller manages frustum extraction and entity culling operations.
 * Enhanced with multiple spatial partitioning strategies for efficient broad-phase culling.
 * 
 * Strategies:
 * - linear: Simple O(N) scan - fast for small entity counts
 * - loose-octree: Expanded bounds reduce re-insertions for small movements
 * - bvh: Dynamic BVH with fat AABBs - optimal for highly dynamic scenes
 * - wasm-bvh: WASM-accelerated BVH (fastest, recommended)
 * - auto: Intelligently selects based on scene characteristics (prefers WASM)
 * 
 * WASM acceleration is always preferred when available.
 */
export class FrustumCuller {
  private reusableVisibleArray: Entity[] = [];
  private octree: Octree | null = null;
  private looseOctree: LooseOctree | null = null;
  private bvh: DynamicBVH | null = null;
  private wasmBvh: SpatialBVH | null = null;
  private octreeDirty = true;
  private lastEntityCount = 0;
  private config: FrustumCullerConfig;
  
  /** Track entity positions for movement detection (auto mode) */
  private lastPositions = new Map<Entity, [number, number, number]>();
  private movementRatio = 0;
  private frameCount = 0;
  
  /** Entity ID mapping for WASM BVH (Entity -> numeric ID) */
  private entityIdMap = new Map<Entity, number>();
  private idToEntityMap = new Map<number, Entity>();
  private nextEntityId = 1;
  
  /** Current active strategy (may differ from config.strategy in auto mode) */
  private activeStrategy: SpatialIndexStrategy = 'linear';
  
  /** Whether WASM spatial module is initialized */
  private wasmInitialized = false;
  
  /** WASM functions for batch culling (legacy, from @engine/wasm-render-logic) */
  private wasmFunctions: WasmCullingFunctions | null = null;
  
  /** Reusable buffers for WASM batch operations (avoids allocations per frame) */
  private planesBuffer = new Float32Array(24); // 6 planes × 4 floats
  private worldMatricesBuffer: Float32Array | null = null;
  private localAabbsBuffer: Float32Array | null = null;
  private bufferCapacity = 0;
  
  /** Reusable arrays for spatial queries */
  private broadPhaseCandidates: Entity[] = [];

  constructor(config: Partial<FrustumCullerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Initializes WASM spatial indexing module.
   * Should be called once at application startup.
   * After initialization, WASM BVH will be used for optimal performance.
   */
  async initWasm(): Promise<void> {
    if (this.wasmInitialized) return;
    
    try {
      await initWasmSpatial();
      this.wasmInitialized = true;
      this.wasmBvh = new SpatialBVH({ fatMargin: this.config.bvhFatMargin });
      console.log('[FrustumCuller] WASM spatial indexing initialized');
    } catch (error) {
      console.warn('[FrustumCuller] Failed to initialize WASM spatial, falling back to JS:', error);
    }
  }
  
  /**
   * Checks if WASM spatial indexing is available
   */
  isWasmAvailable(): boolean {
    return this.wasmInitialized && this.wasmBvh !== null;
  }
  
  /**
   * Sets the spatial indexing strategy
   */
  setStrategy(strategy: SpatialIndexStrategy): void {
    if (this.config.strategy !== strategy) {
      this.config.strategy = strategy;
      this.octreeDirty = true;
      // Clear existing structures
      this.octree = null;
      this.looseOctree = null;
      this.bvh = null;
    }
  }
  
  /**
   * Gets the current active strategy
   */
  getActiveStrategy(): SpatialIndexStrategy {
    return this.activeStrategy;
  }
  
  /**
   * Gets spatial indexing statistics
   */
  getSpatialStats(): {
    strategy: SpatialIndexStrategy;
    movementRatio: number;
    entityCount: number;
    wasmAvailable: boolean;
    structureStats?: Record<string, unknown> | SpatialStats;
  } {
    let structureStats: Record<string, unknown> | SpatialStats | undefined;
    
    if (this.wasmBvh && this.activeStrategy === 'wasm-bvh') {
      structureStats = this.wasmBvh.getStats();
    } else if (this.looseOctree) {
      structureStats = this.looseOctree.getStats();
    } else if (this.bvh) {
      structureStats = this.bvh.getStats();
    } else if (this.octree) {
      structureStats = this.octree.getStats();
    }
    
    return {
      strategy: this.activeStrategy,
      movementRatio: this.movementRatio,
      entityCount: this.lastEntityCount,
      wasmAvailable: this.wasmInitialized,
      structureStats,
    };
  }
  
  /**
   * Enable WASM-accelerated batch culling.
   * Call this with the exported functions from @engine/wasm-render-logic after init.
   * 
   * @example
   * ```ts
   * import { initWasm, batch_transform_and_cull_aabbs, batch_transform_cull_get_visible_indices } from '@engine/wasm-render-logic';
   * await initWasm();
   * culler.setWasmFunctions({ batch_transform_and_cull_aabbs, batch_transform_cull_get_visible_indices });
   * ```
   */
  setWasmFunctions(functions: WasmCullingFunctions): void {
    this.wasmFunctions = functions;
  }
  
  /**
   * Check if WASM acceleration is enabled.
   */
  hasWasmAcceleration(): boolean {
    return this.wasmFunctions !== null;
  }

  /**
   * Extracts a world-space frustum from a combined view-projection matrix.
   * Uses standard OpenGL/WebGPU frustum extraction.
   */
  extractFrustumFromVP(m: Mat4): Frustum {
    // Matrix is column-major; indices map as:
    // [ m00, m01, m02, m03,
    //   m10, m11, m12, m13,
    //   m20, m21, m22, m23,
    //   m30, m31, m32, m33 ]
    const planes: FrustumPlane[] = [];

    // Left: row3 + row0
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) + (m[0] ?? 0),
        ny: (m[7] ?? 0) + (m[4] ?? 0),
        nz: (m[11] ?? 0) + (m[8] ?? 0),
        d: (m[15] ?? 0) + (m[12] ?? 0),
      })
    );

    // Right: row3 - row0
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) - (m[0] ?? 0),
        ny: (m[7] ?? 0) - (m[4] ?? 0),
        nz: (m[11] ?? 0) - (m[8] ?? 0),
        d: (m[15] ?? 0) - (m[12] ?? 0),
      })
    );

    // Bottom: row3 + row1
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) + (m[1] ?? 0),
        ny: (m[7] ?? 0) + (m[5] ?? 0),
        nz: (m[11] ?? 0) + (m[9] ?? 0),
        d: (m[15] ?? 0) + (m[13] ?? 0),
      })
    );

    // Top: row3 - row1
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) - (m[1] ?? 0),
        ny: (m[7] ?? 0) - (m[5] ?? 0),
        nz: (m[11] ?? 0) - (m[9] ?? 0),
        d: (m[15] ?? 0) - (m[13] ?? 0),
      })
    );

    // Near: row3 + row2
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) + (m[2] ?? 0),
        ny: (m[7] ?? 0) + (m[6] ?? 0),
        nz: (m[11] ?? 0) + (m[10] ?? 0),
        d: (m[15] ?? 0) + (m[14] ?? 0),
      })
    );

    // Far: row3 - row2
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) - (m[2] ?? 0),
        ny: (m[7] ?? 0) - (m[6] ?? 0),
        nz: (m[11] ?? 0) - (m[10] ?? 0),
        d: (m[15] ?? 0) - (m[14] ?? 0),
      })
    );

    return { planes };
  }

  /**
   * Culls entities outside frustum.
   * Reuses internal array to avoid allocations.
   * Uses WASM batch processing when available (5-10x faster for large entity counts).
   * Falls back to JS implementation when WASM is not initialized.
   * @returns Array of visible entities (reused, do not store reference)
   */
  cullEntities(entities: Entity[], frustum: Frustum): Entity[] {
    this.reusableVisibleArray.length = 0; // Clear without deallocating

    // Use WASM batch culling if available and entity count warrants it
    if (this.wasmFunctions && entities.length >= 32) {
      return this.cullEntitiesWasm(entities, frustum);
    }

    // Determine active strategy
    this.updateActiveStrategy(entities);
    
    // Update spatial structure if needed
    if (
      this.octreeDirty ||
      entities.length !== this.lastEntityCount
    ) {
      this.rebuildSpatialStructure(entities);
    } else {
      // Incremental update for changed entities
      this.updateSpatialStructure(entities);
    }

    // Get candidates based on active strategy
    const candidates = this.getBroadPhaseCandidates(entities, frustum);

    // Fine-phase: Test each candidate against frustum planes
    for (const e of candidates) {
      const aabb = this.getEntityAABB(e);
      if (this.frustumIntersectsAABB(aabb, frustum)) {
        this.reusableVisibleArray.push(e);
      }
    }

    return this.reusableVisibleArray;
  }
  
  /**
   * Determines the best strategy based on scene characteristics (auto mode)
   */
  private updateActiveStrategy(entities: Entity[]): void {
    // If explicit strategy is set (not auto), use it
    if (this.config.strategy !== 'auto') {
      // If wasm-bvh is requested but not available, fall back to JS bvh
      if (this.config.strategy === 'wasm-bvh' && !this.wasmInitialized) {
        this.activeStrategy = 'bvh';
      } else {
        this.activeStrategy = this.config.strategy;
      }
      return;
    }
    
    const count = entities.length;
    
    // Small scenes: use linear (overhead of structures > benefit)
    if (count < this.config.linearThreshold) {
      this.activeStrategy = 'linear';
      return;
    }
    
    // WASM BVH is always preferred when available and preferWasm is true
    if (this.wasmInitialized && this.config.preferWasm) {
      this.activeStrategy = 'wasm-bvh';
      return;
    }
    
    // Calculate movement ratio every 30 frames
    this.frameCount++;
    if (this.frameCount >= 30) {
      this.frameCount = 0;
      this.movementRatio = this.calculateMovementRatio(entities);
    }
    
    // Highly dynamic scenes: use BVH
    if (this.movementRatio > this.config.dynamicThreshold) {
      this.activeStrategy = 'bvh';
    } else {
      // Mostly static: use loose octree
      this.activeStrategy = 'loose-octree';
    }
  }
  
  /**
   * Calculates what fraction of entities moved since last frame
   */
  private calculateMovementRatio(entities: Entity[]): number {
    if (entities.length === 0) return 0;
    
    let movedCount = 0;
    const threshold = 0.01; // 1cm movement threshold
    
    for (const entity of entities) {
      const pos = entity.transform.position;
      const lastPos = this.lastPositions.get(entity);
      
      if (lastPos) {
        const dx = Math.abs(pos[0] - lastPos[0]);
        const dy = Math.abs(pos[1] - lastPos[1]);
        const dz = Math.abs(pos[2] - lastPos[2]);
        
        if (dx > threshold || dy > threshold || dz > threshold) {
          movedCount++;
        }
      }
      
      // Update last position
      this.lastPositions.set(entity, [pos[0], pos[1], pos[2]]);
    }
    
    return movedCount / entities.length;
  }
  
  /**
   * Gets broad-phase candidates based on active strategy
   */
  private getBroadPhaseCandidates(entities: Entity[], frustum: Frustum): Entity[] {
    switch (this.activeStrategy) {
      case 'linear':
        return entities;
        
      case 'loose-octree':
        if (this.looseOctree) {
          const frustumBounds = this.getFrustumBounds(frustum);
          return this.looseOctree.queryToArray(frustumBounds, this.broadPhaseCandidates);
        }
        return entities;
        
      case 'bvh':
        if (this.bvh) {
          return this.bvh.queryFrustum(frustum.planes);
        }
        return entities;
        
      case 'wasm-bvh':
        if (this.wasmBvh) {
          const visibleIds = this.wasmBvh.queryFrustum(frustum.planes);
          this.broadPhaseCandidates.length = 0;
          for (let i = 0; i < visibleIds.length; i++) {
            const entity = this.idToEntityMap.get(visibleIds[i]!);
            if (entity) {
              this.broadPhaseCandidates.push(entity);
            }
          }
          return this.broadPhaseCandidates;
        }
        return entities;
        
      default:
        return entities;
    }
  }
  
  /**
   * Rebuilds spatial structure based on active strategy
   */
  private rebuildSpatialStructure(entities: Entity[]): void {
    const worldBounds = this.calculateWorldBounds(entities);
    
    switch (this.activeStrategy) {
      case 'wasm-bvh':
        if (this.wasmBvh) {
          this.wasmBvh.clear();
          this.entityIdMap.clear();
          this.idToEntityMap.clear();
          this.nextEntityId = 1;
          
          for (const entity of entities) {
            if (entity && entity.active) {
              const aabb = this.getEntityAABB(entity);
              const id = this.getOrCreateEntityId(entity);
              this.wasmBvh.insert(id, [
                aabb.min[0], aabb.min[1], aabb.min[2],
                aabb.max[0], aabb.max[1], aabb.max[2],
              ]);
            }
          }
        }
        break;
        
      case 'loose-octree':
        this.looseOctree = new LooseOctree(worldBounds, {
          maxDepth: 6,
          maxEntitiesPerNode: 8,
          minNodeSize: 1.0,
          looseness: this.config.loosenessFactor,
        });
        
        for (const entity of entities) {
          if (entity && entity.active) {
            const aabb = this.getEntityAABB(entity);
            this.looseOctree.insert(entity, aabb);
          }
        }
        break;
        
      case 'bvh':
        this.bvh = new DynamicBVH({
          fatMargin: this.config.bvhFatMargin,
          velocityMultiplier: 2.0,
          minDisplacement: 0.01,
        });
        
        for (const entity of entities) {
          if (entity && entity.active) {
            const aabb = this.getEntityAABB(entity);
            this.bvh.insert(entity, aabb);
          }
        }
        break;
        
      case 'linear':
      default:
        // No structure needed for linear scan
        break;
    }
    
    // Also maintain legacy octree for compatibility
    this.rebuildOctree(entities);
    
    this.octreeDirty = false;
    this.lastEntityCount = entities.length;
  }
  
  /**
   * Gets or creates a numeric ID for an entity (for WASM BVH)
   */
  private getOrCreateEntityId(entity: Entity): number {
    let id = this.entityIdMap.get(entity);
    if (id === undefined) {
      id = this.nextEntityId++;
      this.entityIdMap.set(entity, id);
      this.idToEntityMap.set(id, entity);
    }
    return id;
  }
  
  /**
   * Incrementally updates spatial structure for moved entities
   */
  private updateSpatialStructure(entities: Entity[]): void {
    if (this.activeStrategy === 'linear') return;
    
    // Collect updates
    const updates: Array<{ entity: Entity; aabb: AABB }> = [];
    
    for (const entity of entities) {
      if (!entity || !entity.active) continue;
      
      const pos = entity.transform.position;
      const lastPos = this.lastPositions.get(entity);
      
      // Check if entity moved significantly
      if (lastPos) {
        const dx = Math.abs(pos[0] - lastPos[0]);
        const dy = Math.abs(pos[1] - lastPos[1]);
        const dz = Math.abs(pos[2] - lastPos[2]);
        
        if (dx > 0.001 || dy > 0.001 || dz > 0.001) {
          const aabb = this.getEntityAABB(entity);
          updates.push({ entity, aabb });
        }
      }
    }
    
    // Apply updates based on strategy
    if (updates.length > 0) {
      if (this.activeStrategy === 'wasm-bvh' && this.wasmBvh) {
        // Batch update for WASM BVH
        const wasmUpdates = updates.map(({ entity, aabb }) => ({
          entityId: this.getOrCreateEntityId(entity),
          aabb: [
            aabb.min[0], aabb.min[1], aabb.min[2],
            aabb.max[0], aabb.max[1], aabb.max[2],
          ] as [number, number, number, number, number, number],
        }));
        this.wasmBvh.batchUpdate(wasmUpdates);
      } else if (this.activeStrategy === 'loose-octree' && this.looseOctree) {
        this.looseOctree.batchUpdate(updates);
      } else if (this.activeStrategy === 'bvh' && this.bvh) {
        this.bvh.batchUpdate(updates);
      }
    }
  }
  
  /**
   * WASM-accelerated batch culling.
   * Transforms local AABBs to world space and tests against frustum in one WASM call.
   * Uses Arvo's method for AABB transform (O(18) vs O(96) for 8-corner transform).
   */
  private cullEntitiesWasm(entities: Entity[], frustum: Frustum): Entity[] {
    const count = entities.length;
    
    // Ensure buffers are large enough
    if (count > this.bufferCapacity) {
      this.bufferCapacity = Math.max(count, this.bufferCapacity * 2, 256);
      this.worldMatricesBuffer = new Float32Array(this.bufferCapacity * 16);
      this.localAabbsBuffer = new Float32Array(this.bufferCapacity * 6);
    }
    
    const worldMatrices = this.worldMatricesBuffer!;
    const localAabbs = this.localAabbsBuffer!;
    
    // Pack frustum planes into flat array
    for (let i = 0; i < 6; i++) {
      const plane = frustum.planes[i]!;
      this.planesBuffer[i * 4] = plane.nx;
      this.planesBuffer[i * 4 + 1] = plane.ny;
      this.planesBuffer[i * 4 + 2] = plane.nz;
      this.planesBuffer[i * 4 + 3] = plane.d;
    }
    
    // Pack entity data into flat arrays
    for (let i = 0; i < count; i++) {
      const entity = entities[i]!;
      const matrix = entity.transform.getWorldMatrix();
      const mBase = i * 16;
      
      // Copy world matrix (column-major)
      for (let j = 0; j < 16; j++) {
        worldMatrices[mBase + j] = matrix[j] ?? 0;
      }
      
      // Get local AABB
      const aabbBase = i * 6;
      const localBounds = this.getLocalAABB(entity);
      localAabbs[aabbBase] = localBounds.min[0];
      localAabbs[aabbBase + 1] = localBounds.min[1];
      localAabbs[aabbBase + 2] = localBounds.min[2];
      localAabbs[aabbBase + 3] = localBounds.max[0];
      localAabbs[aabbBase + 4] = localBounds.max[1];
      localAabbs[aabbBase + 5] = localBounds.max[2];
    }
    
    // Call WASM batch function - returns indices of visible entities
    const visibleIndices = this.wasmFunctions!.batch_transform_cull_get_visible_indices(
      this.planesBuffer,
      worldMatrices.subarray(0, count * 16),
      localAabbs.subarray(0, count * 6)
    );
    
    // Map indices back to entities
    for (let i = 0; i < visibleIndices.length; i++) {
      const idx = visibleIndices[i]!;
      this.reusableVisibleArray.push(entities[idx]!);
    }
    
    return this.reusableVisibleArray;
  }
  
  /**
   * Gets local-space AABB for entity (without world transform).
   * Used by WASM batch processing.
   */
  private getLocalAABB(entity: Entity): AABB {
    let minX = -0.5;
    let minY = -0.5;
    let minZ = -0.5;
    let maxX = 0.5;
    let maxY = 0.5;
    let maxZ = 0.5;

    const mesh = entity.getComponent(MeshComponent);
    if (mesh && mesh.localAABB) {
      return mesh.localAABB;
    } else if (mesh && (mesh.meshType === 'box' || mesh.meshType === 'cube') && mesh.options) {
      let w = 1, h = 1, d = 1;
      if (mesh.options.size && Array.isArray(mesh.options.size)) {
        w = mesh.options.size[0] ?? 1;
        h = mesh.options.size[1] ?? 1;
        d = mesh.options.size[2] ?? 1;
      } else {
        w = mesh.options.width ?? 1;
        h = mesh.options.height ?? 1;
        d = mesh.options.depth ?? 1;
      }
      const halfW = w / 2;
      const halfH = h / 2;
      const halfD = d / 2;
      minX = -halfW; minY = -halfH; minZ = -halfD;
      maxX = halfW; maxY = halfH; maxZ = halfD;
    } else if (mesh && mesh.meshType === 'sphere' && mesh.options?.radius) {
      const r = mesh.options.radius;
      minX = -r; minY = -r; minZ = -r;
      maxX = r; maxY = r; maxZ = r;
    } else if (mesh && mesh.meshType === 'cylinder' && mesh.options) {
      const r = mesh.options.radius ?? 0.5;
      const halfH = (mesh.options.height ?? 1) / 2;
      minX = -r; minY = -halfH; minZ = -r;
      maxX = r; maxY = halfH; maxZ = r;
    } else if (mesh && mesh.meshType === 'plane' && mesh.options) {
      const halfW = (mesh.options.width ?? 1) / 2;
      const halfD = (mesh.options.depth ?? 1) / 2;
      minX = -halfW; minY = -0.001; minZ = -halfD;
      maxX = halfW; maxY = 0.001; maxZ = halfD;
    }

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    };
  }

  /**
   * Culls entities and writes results to provided output array (avoids internal state).
   * Uses WASM batch processing when available (5-10x faster for large entity counts).
   */
  cullEntitiesToArray(entities: Entity[], frustum: Frustum, outVisible: Entity[]): Entity[] {
    outVisible.length = 0; // Clear without deallocating

    // Use WASM batch culling if available and entity count warrants it
    if (this.wasmFunctions && entities.length >= 32) {
      return this.cullEntitiesToArrayWasm(entities, frustum, outVisible);
    }

    // Rebuild octree if needed
    if (
      this.octreeDirty ||
      !this.octree ||
      entities.length !== this.lastEntityCount
    ) {
      this.rebuildOctree(entities);
    }

    // Broad-phase: Get potentially visible entities from octree
    // Note: We currently bypass the octree and force a linear scan (candidates = entities)
    // because the octree is not updated when entity transforms/bounds change (only on add/remove).
    // This caused issues with dynamic objects (like growing terrain) disappearing when their
    // bounds expanded outside the initial octree node.
    // Linear scan is O(N) which is faster than rebuilding octree O(N log N) every frame,
    // and sufficient for < 10k entities.
    const candidates = entities;
    /*
    const frustumBounds = this.getFrustumBounds(frustum);
    const candidates = this.octree
      ? this.octree.query(frustumBounds)
      : entities;
    */

    // Fine-phase: Test each candidate against frustum planes
    for (const e of candidates) {
      const aabb = this.getEntityAABB(e);
      if (this.frustumIntersectsAABB(aabb, frustum)) {
        outVisible.push(e);
      }
    }

    return outVisible;
  }
  
  /**
   * WASM-accelerated batch culling to external array.
   */
  private cullEntitiesToArrayWasm(entities: Entity[], frustum: Frustum, outVisible: Entity[]): Entity[] {
    const count = entities.length;
    
    // Ensure buffers are large enough
    if (count > this.bufferCapacity) {
      this.bufferCapacity = Math.max(count, this.bufferCapacity * 2, 256);
      this.worldMatricesBuffer = new Float32Array(this.bufferCapacity * 16);
      this.localAabbsBuffer = new Float32Array(this.bufferCapacity * 6);
    }
    
    const worldMatrices = this.worldMatricesBuffer!;
    const localAabbs = this.localAabbsBuffer!;
    
    // Pack frustum planes
    for (let i = 0; i < 6; i++) {
      const plane = frustum.planes[i]!;
      this.planesBuffer[i * 4] = plane.nx;
      this.planesBuffer[i * 4 + 1] = plane.ny;
      this.planesBuffer[i * 4 + 2] = plane.nz;
      this.planesBuffer[i * 4 + 3] = plane.d;
    }
    
    // Pack entity data
    for (let i = 0; i < count; i++) {
      const entity = entities[i]!;
      const matrix = entity.transform.getWorldMatrix();
      const mBase = i * 16;
      
      for (let j = 0; j < 16; j++) {
        worldMatrices[mBase + j] = matrix[j] ?? 0;
      }
      
      const aabbBase = i * 6;
      const localBounds = this.getLocalAABB(entity);
      localAabbs[aabbBase] = localBounds.min[0];
      localAabbs[aabbBase + 1] = localBounds.min[1];
      localAabbs[aabbBase + 2] = localBounds.min[2];
      localAabbs[aabbBase + 3] = localBounds.max[0];
      localAabbs[aabbBase + 4] = localBounds.max[1];
      localAabbs[aabbBase + 5] = localBounds.max[2];
    }
    
    // Call WASM batch function
    const visibleIndices = this.wasmFunctions!.batch_transform_cull_get_visible_indices(
      this.planesBuffer,
      worldMatrices.subarray(0, count * 16),
      localAabbs.subarray(0, count * 6)
    );
    
    // Map indices back to entities
    for (let i = 0; i < visibleIndices.length; i++) {
      const idx = visibleIndices[i]!;
      outVisible.push(entities[idx]!);
    }
    
    return outVisible;
  }

  /**
   * Marks the octree as dirty, forcing rebuild on next cull.
   */
  markDirty(): void {
    this.octreeDirty = true;
  }
  
  /**
   * Disposes WASM resources. Call when FrustumCuller is no longer needed.
   */
  dispose(): void {
    if (this.wasmBvh) {
      this.wasmBvh.dispose();
      this.wasmBvh = null;
    }
    this.entityIdMap.clear();
    this.idToEntityMap.clear();
    this.lastPositions.clear();
  }

  /**
   * Computes AABB from interleaved vertex data (positions only).
   * Assumes vertex format: [x, y, z, nx, ny, nz, u, v, ...]
   * @param vertices - Float32Array of interleaved vertex data
   * @returns AABB computed from positions
   */
  private computeAABBFromVertices(vertices: ArrayBufferView): AABB {
    const data = vertices instanceof Float32Array
      ? vertices
      : new Float32Array(vertices.buffer, vertices.byteOffset, vertices.byteLength / 4);
    
    // Assume 8 floats per vertex (position xyz + normal xyz + uv)
    const stride = 8;
    const vertexCount = Math.floor(data.length / stride);
    
    if (vertexCount === 0) {
      return { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] };
    }
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < vertexCount; i++) {
      const baseIdx = i * stride;
      const x = data[baseIdx] ?? 0;
      const y = data[baseIdx + 1] ?? 0;
      const z = data[baseIdx + 2] ?? 0;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    
    // Add small padding to avoid edge cases
    const pad = 0.01;
    return {
      min: [minX - pad, minY - pad, minZ - pad],
      max: [maxX + pad, maxY + pad, maxZ + pad],
    };
  }

  /**
   * Rebuilds the octree from entity list.
   */
  private rebuildOctree(entities: Entity[]): void {
    // Calculate world bounds from entities
    const worldBounds = this.calculateWorldBounds(entities);

    // Create new octree
    this.octree = new Octree(worldBounds, {
      maxDepth: 6,
      maxEntitiesPerNode: 8,
      minNodeSize: 1.0,
    });

    // Insert entities into octree
    for (const entity of entities) {
      if (entity && entity.active) {
        const aabb = this.getEntityAABB(entity);
        this.octree.insert(entity, aabb);
      }
    }

    this.octreeDirty = false;
    this.lastEntityCount = entities.length;
  }

  /**
   * Calculates world bounds from entity list.
   */
  private calculateWorldBounds(entities: Entity[]): AABB {
    if (entities.length === 0) {
      return {
        min: [-100, -100, -100],
        max: [100, 100, 100],
      };
    }

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (const e of entities) {
      const aabb = this.getEntityAABB(e);
      minX = Math.min(minX, aabb.min[0]);
      minY = Math.min(minY, aabb.min[1]);
      minZ = Math.min(minZ, aabb.min[2]);
      maxX = Math.max(maxX, aabb.max[0]);
      maxY = Math.max(maxY, aabb.max[1]);
      maxZ = Math.max(maxZ, aabb.max[2]);
    }

    // Add some padding
    const padding = 10;
    return {
      min: [minX - padding, minY - padding, minZ - padding],
      max: [maxX + padding, maxY + padding, maxZ + padding],
    };
  }

  /**
   * Gets approximate AABB bounds for frustum (for broad-phase query).
   */
  private getFrustumBounds(frustum: Frustum): AABB {
    // Calculate bounds from frustum planes intersection
    // This is a conservative estimate - could be tighter
    let minX = -Infinity,
      minY = -Infinity,
      minZ = -Infinity;
    let maxX = Infinity,
      maxY = Infinity,
      maxZ = Infinity;

    // For each plane, constrain the bounds
    for (const plane of frustum.planes) {
      const absNx = Math.abs(plane.nx);
      const absNy = Math.abs(plane.ny);
      const absNz = Math.abs(plane.nz);

      // Estimate constraint based on dominant axis
      if (absNx > absNy && absNx > absNz) {
        // X-dominant plane
        const x = -plane.d / plane.nx;
        if (plane.nx > 0) minX = Math.max(minX, x);
        else maxX = Math.min(maxX, x);
      } else if (absNy > absNz) {
        // Y-dominant plane
        const y = -plane.d / plane.ny;
        if (plane.ny > 0) minY = Math.max(minY, y);
        else maxY = Math.min(maxY, y);
      } else {
        // Z-dominant plane
        const z = -plane.d / plane.nz;
        if (plane.nz > 0) minZ = Math.max(minZ, z);
        else maxZ = Math.min(maxZ, z);
      }
    }

    // Clamp to reasonable bounds if infinite
    const maxBound = 1000;
    if (!Number.isFinite(minX)) minX = -maxBound;
    if (!Number.isFinite(minY)) minY = -maxBound;
    if (!Number.isFinite(minZ)) minZ = -maxBound;
    if (!Number.isFinite(maxX)) maxX = maxBound;
    if (!Number.isFinite(maxY)) maxY = maxBound;
    if (!Number.isFinite(maxZ)) maxZ = maxBound;

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    };
  }

  /**
   * Computes axis-aligned bounding box for entity in world space.
   * Handles rotation by transforming all 8 corners of the local box.
   */
  private getEntityAABB(entity: Entity): AABB {
    const worldMatrix = entity.transform.getWorldMatrix();
    
    let minX = -0.5;
    let minY = -0.5;
    let minZ = -0.5;
    let maxX = 0.5;
    let maxY = 0.5;
    let maxZ = 0.5;

    // Check for custom local AABB in MeshComponent
    const mesh = entity.getComponent(MeshComponent);
    if (mesh && mesh.localAABB) {
      minX = mesh.localAABB.min[0];
      minY = mesh.localAABB.min[1];
      minZ = mesh.localAABB.min[2];
      maxX = mesh.localAABB.max[0];
      maxY = mesh.localAABB.max[1];
      maxZ = mesh.localAABB.max[2];
    } else if (mesh && mesh.meshData?.vertices) {
      // Compute AABB from custom geometry vertices
      const aabb = this.computeAABBFromVertices(mesh.meshData.vertices);
      minX = aabb.min[0]; minY = aabb.min[1]; minZ = aabb.min[2];
      maxX = aabb.max[0]; maxY = aabb.max[1]; maxZ = aabb.max[2];
    } else if (mesh && (mesh.meshType === 'box' || mesh.meshType === 'cube') && mesh.options) {
      // Handle both 'box' and 'cube' mesh types
      // Support both size array format [w, h, d] and individual width/height/depth properties
      let w = 1, h = 1, d = 1;
      
      if (mesh.options.size && Array.isArray(mesh.options.size)) {
        // Size array format: [width, height, depth]
        w = mesh.options.size[0] ?? 1;
        h = mesh.options.size[1] ?? 1;
        d = mesh.options.size[2] ?? 1;
      } else {
        // Individual property format (legacy/plane-style)
        w = mesh.options.width ?? 1;
        h = mesh.options.height ?? 1;
        d = mesh.options.depth ?? 1;
      }
      
      // Box/cube primitives are centered at (0,0,0)
      const halfW = w / 2;
      const halfH = h / 2;
      const halfD = d / 2;
      minX = -halfW; minY = -halfH; minZ = -halfD;
      maxX = halfW; maxY = halfH; maxZ = halfD;
    } else if (mesh && mesh.meshType === 'sphere') {
      // Sphere primitives - default radius 0.5 if not specified
      const r = mesh.options?.radius ?? 0.5;
      minX = -r; minY = -r; minZ = -r;
      maxX = r; maxY = r; maxZ = r;
    } else if (mesh && mesh.meshType === 'capsule_y' && mesh.options) {
      // Capsule Y-axis: cylinder with hemispherical caps
      const r = mesh.options.radius ?? 0.5;
      const halfH = (mesh.options.height ?? 1) / 2;
      const totalHalfHeight = halfH + r; // Include hemisphere caps
      minX = -r; minY = -totalHalfHeight; minZ = -r;
      maxX = r; maxY = totalHalfHeight; maxZ = r;
    } else if (mesh && mesh.meshType === 'avatar_torso') {
      // Avatar torso - approximate bounds
      minX = -0.4; minY = -0.5; minZ = -0.2;
      maxX = 0.4; maxY = 0.5; maxZ = 0.2;
    } else if (mesh && mesh.meshType === 'cylinder' && mesh.options) {
      // Cylinder primitives
      const r = mesh.options.radius ?? 0.5;
      const halfH = (mesh.options.height ?? 1) / 2;
      minX = -r; minY = -halfH; minZ = -r;
      maxX = r; maxY = halfH; maxZ = r;
    } else if (mesh && mesh.meshType === 'plane' && mesh.options) {
      // Plane primitives (flat, thin in Y)
      const halfW = (mesh.options.width ?? 1) / 2;
      const halfD = (mesh.options.depth ?? 1) / 2;
      minX = -halfW; minY = -0.001; minZ = -halfD;
      maxX = halfW; maxY = 0.001; maxZ = halfD;
    }

    // 8 corners of the local bounding box
    // Note: We do NOT multiply by scale here because getWorldMatrix() includes scale
    const localCorners: Vec3[] = [
      [minX, minY, minZ],
      [maxX, minY, minZ],
      [minX, maxY, minZ],
      [maxX, maxY, minZ],
      [minX, minY, maxZ],
      [maxX, minY, maxZ],
      [minX, maxY, maxZ],
      [maxX, maxY, maxZ],
    ];

    let wMinX = Infinity,
      wMinY = Infinity,
      wMinZ = Infinity;
    let wMaxX = -Infinity,
      wMaxY = -Infinity,
      wMaxZ = -Infinity;

    // Transform each corner to world space and expand AABB
    for (const corner of localCorners) {
      const wx =
        (worldMatrix[0] ?? 0) * corner[0] +
        (worldMatrix[4] ?? 0) * corner[1] +
        (worldMatrix[8] ?? 0) * corner[2] +
        (worldMatrix[12] ?? 0);
      const wy =
        (worldMatrix[1] ?? 0) * corner[0] +
        (worldMatrix[5] ?? 0) * corner[1] +
        (worldMatrix[9] ?? 0) * corner[2] +
        (worldMatrix[13] ?? 0);
      const wz =
        (worldMatrix[2] ?? 0) * corner[0] +
        (worldMatrix[6] ?? 0) * corner[1] +
        (worldMatrix[10] ?? 0) * corner[2] +
        (worldMatrix[14] ?? 0);

      wMinX = Math.min(wMinX, wx);
      wMinY = Math.min(wMinY, wy);
      wMinZ = Math.min(wMinZ, wz);
      wMaxX = Math.max(wMaxX, wx);
      wMaxY = Math.max(wMaxY, wy);
      wMaxZ = Math.max(wMaxZ, wz);
    }

    return {
      min: [wMinX, wMinY, wMinZ],
      max: [wMaxX, wMaxY, wMaxZ],
    };
  }

  /**
   * Tests if an AABB intersects the frustum.
   * Returns false if AABB is completely outside any plane.
   */
  private frustumIntersectsAABB(aabb: AABB, frustum: Frustum): boolean {
    // Cull if AABB is completely outside any plane
    for (const p of frustum.planes) {
      const px = p.nx >= 0 ? aabb.max[0] : aabb.min[0];
      const py = p.ny >= 0 ? aabb.max[1] : aabb.min[1];
      const pz = p.nz >= 0 ? aabb.max[2] : aabb.min[2];
      const dist = p.nx * px + p.ny * py + p.nz * pz + p.d;
      if (dist < 0) return false;
    }
    return true;
  }

  /**
   * Normalizes a frustum plane.
   */
  private normalizePlane(plane: FrustumPlane): FrustumPlane {
    const len = Math.hypot(plane.nx, plane.ny, plane.nz) || 1;
    return {
      nx: plane.nx / len,
      ny: plane.ny / len,
      nz: plane.nz / len,
      d: plane.d / len,
    };
  }
}

// Export legacy functions for backward compatibility
export function extractFrustumFromVP(m: Mat4): Frustum {
  const culler = new FrustumCuller();
  return culler.extractFrustumFromVP(m);
}

export function cullEntities(entities: Entity[], frustum: Frustum, outVisible: Entity[]): Entity[] {
  const culler = new FrustumCuller();
  return culler.cullEntitiesToArray(entities, frustum, outVisible);
}

