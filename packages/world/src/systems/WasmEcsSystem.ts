/**
 * WASM ECS Acceleration System
 *
 * Provides optional WASM acceleration for hot paths:
 * - Transform hierarchy batch updates
 * - ECS queries
 * - Frustum culling
 *
 * Falls back to TypeScript implementation if WASM is unavailable.
 */

import type { Scene, Entity } from '../index.js';
import type { Mat4 } from '@engine/core/math';
import type { Component, ComponentClass } from '../components/Component.js';

/**
 * Interface for WASM ECS module (lazy loaded)
 */
interface WasmEcsModule {
  initWasm(): Promise<void>;
  isWasmReady(): boolean;
  TransformHierarchyWasm: new (capacity: number) => WasmTransformHierarchy;
  EcsWorldWasm: new (capacity: number) => WasmEcsWorld;
  FrustumCullerWasm: new (capacity: number) => WasmFrustumCuller;
  batchUpdateTransforms(
    positions: Float32Array,
    rotations: Float32Array,
    scales: Float32Array,
    parents: Int32Array
  ): Float32Array;
  batchFrustumCull(
    worldMatrices: Float32Array,
    localHalfExtents: Float32Array,
    viewProj: Float32Array
  ): Uint32Array;
  batchEcsQuery(componentMasks: BigUint64Array, requiredMask: bigint): Uint32Array;
}

interface WasmTransformHierarchy {
  resize(count: number): void;
  clear(): void;
  positions: Float32Array;
  rotations: Float32Array;
  scales: Float32Array;
  parents: Int32Array;
  worldMatrices: Float32Array;
  markAllDirty(): void;
  updateWorldMatrices(): void;
  dispose(): void;
}

interface WasmEcsWorld {
  resize(count: number): void;
  clear(): void;
  batchSetMasks(masks: BigUint64Array): void;
  batchSetActive(flags: Uint8Array): void;
  query(requiredMask: bigint): Uint32Array;
  queryActive(requiredMask: bigint): Uint32Array;
  dispose(): void;
}

interface WasmFrustumCuller {
  clear(): void;
  computeWorldAabbs(worldMatrices: Float32Array, localHalfExtents: Float32Array): void;
  cull(viewProj: Float32Array): Uint32Array;
  cullActive(viewProj: Float32Array, activeFlags: Uint8Array): Uint32Array;
  dispose(): void;
}

/**
 * WASM ECS System - Accelerates hot paths using WebAssembly
 *
 * Usage:
 * ```typescript
 * const wasmEcs = new WasmEcsSystem();
 * await wasmEcs.initialize(scene);
 *
 * // In game loop
 * wasmEcs.syncFromScene(scene);
 * wasmEcs.updateWorldMatrices();
 * // Use wasmEcs.worldMatrices or sync back to scene
 * ```
 */
export class WasmEcsSystem {
  private wasmModule: WasmEcsModule | null = null;
  private hierarchy: WasmTransformHierarchy | null = null;
  private ecsWorld: WasmEcsWorld | null = null;
  private culler: WasmFrustumCuller | null = null;

  private entityToIndex = new Map<string, number>();
  private indexToEntity: Entity[] = [];
  private entityCount = 0;

  // Reusable buffers
  private activeFlags: Uint8Array | null = null;
  private componentMasks: BigUint64Array | null = null;

  // Component type registry
  private componentTypeToId = new Map<string, number>();
  private nextComponentId = 0;

  /**
   * Check if WASM acceleration is available
   */
  get isWasmAvailable(): boolean {
    return this.wasmModule !== null && this.wasmModule.isWasmReady();
  }

  /**
   * Initialize WASM module and allocate buffers
   */
  async initialize(scene: Scene, capacity = 10000): Promise<boolean> {
    try {
      // Dynamic import to avoid hard dependency
      // @ts-expect-error - Optional module, may not be installed
      this.wasmModule = await import('@engine/wasm-ecs-core') as unknown as WasmEcsModule;
      await this.wasmModule.initWasm();

      this.hierarchy = new this.wasmModule.TransformHierarchyWasm(capacity);
      this.ecsWorld = new this.wasmModule.EcsWorldWasm(capacity);
      this.culler = new this.wasmModule.FrustumCullerWasm(capacity);

      // Initial sync
      this.syncFromScene(scene);

      console.info('[WasmEcsSystem] Initialized successfully');
      return true;
    } catch (error) {
      console.warn('[WasmEcsSystem] WASM initialization failed, using TypeScript fallback:', error);
      this.wasmModule = null;
      return false;
    }
  }

  /**
   * Register a component type and get its bitmask ID
   */
  registerComponentType(typeName: string): number {
    const existing = this.componentTypeToId.get(typeName);
    if (existing !== undefined) {
      return existing;
    }

    if (this.nextComponentId >= 64) {
      throw new Error('[WasmEcsSystem] Maximum 64 component types supported');
    }

    const id = this.nextComponentId++;
    this.componentTypeToId.set(typeName, id);
    return id;
  }

  /**
   * Get bitmask for a component type
   */
  getComponentMask(typeName: string): bigint {
    const id = this.componentTypeToId.get(typeName);
    if (id === undefined) {
      return 0n;
    }
    return 1n << BigInt(id);
  }

  /**
   * Sync entity data from Scene to WASM buffers
   */
  syncFromScene(scene: Scene): void {
    if (!this.hierarchy) return;

    const entities = scene.getAllEntities();
    this.entityCount = entities.length;

    // Resize buffers
    this.hierarchy.resize(this.entityCount);
    this.ecsWorld?.resize(this.entityCount);

    // Rebuild index mapping
    this.entityToIndex.clear();
    this.indexToEntity = entities;
    entities.forEach((e, i) => this.entityToIndex.set(e.id, i));

    // Copy transform data
    const pos = this.hierarchy.positions;
    const rot = this.hierarchy.rotations;
    const scl = this.hierarchy.scales;
    const par = this.hierarchy.parents;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i]!;
      const t = e.transform;

      // Position
      const p = t.position;
      pos[i * 3] = p[0];
      pos[i * 3 + 1] = p[1];
      pos[i * 3 + 2] = p[2];

      // Rotation (quaternion)
      const r = t.rotation;
      rot[i * 4] = r[0];
      rot[i * 4 + 1] = r[1];
      rot[i * 4 + 2] = r[2];
      rot[i * 4 + 3] = r[3];

      // Scale
      const s = t.scale;
      scl[i * 3] = s[0];
      scl[i * 3 + 1] = s[1];
      scl[i * 3 + 2] = s[2];

      // Parent index
      const parentEntity = e!.parent;
      par[i] = parentEntity ? (this.entityToIndex.get(parentEntity.id) ?? -1) : -1;
    }

    this.hierarchy.markAllDirty();

    // Sync component masks and active flags
    this.syncComponentMasks(entities);
    this.syncActiveFlags(entities);
  }

  /**
   * Sync only dirty transforms (more efficient for incremental updates)
   */
  syncTransform(entity: Entity): void {
    if (!this.hierarchy) return;

    const index = this.entityToIndex.get(entity.id);
    if (index === undefined) return;

    const t = entity.transform;
    const pos = this.hierarchy.positions;
    const rot = this.hierarchy.rotations;
    const scl = this.hierarchy.scales;

    const p = t.position;
    pos[index * 3] = p[0];
    pos[index * 3 + 1] = p[1];
    pos[index * 3 + 2] = p[2];

    const r = t.rotation;
    rot[index * 4] = r[0];
    rot[index * 4 + 1] = r[1];
    rot[index * 4 + 2] = r[2];
    rot[index * 4 + 3] = r[3];

    const s = t.scale;
    scl[index * 3] = s[0];
    scl[index * 3 + 1] = s[1];
    scl[index * 3 + 2] = s[2];

    // Mark dirty is handled internally by the WASM module
  }

  /**
   * Update all world matrices (main hot path)
   */
  updateWorldMatrices(): void {
    if (!this.hierarchy) return;
    this.hierarchy.updateWorldMatrices();
  }

  /**
   * Get world matrices buffer (zero-copy view into WASM memory)
   */
  get worldMatrices(): Float32Array | null {
    return this.hierarchy?.worldMatrices ?? null;
  }

  /**
   * Get world matrix for a specific entity
   */
  getWorldMatrix(entity: Entity): Mat4 | null {
    if (!this.hierarchy) return null;

    const index = this.entityToIndex.get(entity.id);
    if (index === undefined) return null;

    const matrices = this.hierarchy.worldMatrices;
    const offset = index * 16;
    return new Float32Array(matrices.buffer, matrices.byteOffset + offset * 4, 16) as Mat4;
  }

  /**
   * Copy world matrix back to entity transform
   */
  syncWorldMatrixToEntity(entity: Entity): void {
    if (!this.hierarchy) return;

    const index = this.entityToIndex.get(entity.id);
    if (index === undefined) return;

    const matrices = this.hierarchy.worldMatrices;
    const offset = index * 16;

    // The entity transform caches its world matrix, so we can update it
    // This is a bit hacky but avoids modifying Transform class
    const worldMatrix = entity.transform.getWorldMatrix();
    for (let i = 0; i < 16; i++) {
      worldMatrix[i] = matrices[offset + i]!;
    }
  }

  /**
   * Perform ECS query using WASM acceleration
   */
  query(componentTypes: string[]): Entity[] {
    if (!this.ecsWorld || !this.componentMasks) {
      return this.fallbackQuery(componentTypes);
    }

    // Build required mask
    let requiredMask = 0n;
    for (const typeName of componentTypes) {
      requiredMask |= this.getComponentMask(typeName);
    }

    if (requiredMask === 0n) {
      return [];
    }

    const indices = this.ecsWorld.query(requiredMask);
    return this.indicesToEntities(indices);
  }

  /**
   * Query only active entities
   */
  queryActive(componentTypes: string[]): Entity[] {
    if (!this.ecsWorld || !this.componentMasks || !this.activeFlags) {
      return this.fallbackQueryActive(componentTypes);
    }

    let requiredMask = 0n;
    for (const typeName of componentTypes) {
      requiredMask |= this.getComponentMask(typeName);
    }

    if (requiredMask === 0n) {
      return [];
    }

    const indices = this.ecsWorld.queryActive(requiredMask);
    return this.indicesToEntities(indices);
  }

  /**
   * Perform frustum culling
   */
  frustumCull(viewProj: Mat4, halfExtents: Float32Array): Entity[] {
    if (!this.culler || !this.hierarchy) {
      return this.indexToEntity; // Fallback: return all entities
    }

    // Ensure world matrices are up to date
    this.updateWorldMatrices();

    // Compute world AABBs and cull
    this.culler.computeWorldAabbs(this.hierarchy.worldMatrices, halfExtents);
    const indices = this.culler.cull(viewProj as Float32Array);

    return this.indicesToEntities(indices);
  }

  /**
   * Perform frustum culling on active entities only
   */
  frustumCullActive(viewProj: Mat4, halfExtents: Float32Array): Entity[] {
    if (!this.culler || !this.hierarchy || !this.activeFlags) {
      return this.indexToEntity.filter((e) => e.active);
    }

    this.updateWorldMatrices();
    this.culler.computeWorldAabbs(this.hierarchy.worldMatrices, halfExtents);
    const indices = this.culler.cullActive(viewProj as Float32Array, this.activeFlags);

    return this.indicesToEntities(indices);
  }

  /**
   * Dispose of WASM resources
   */
  dispose(): void {
    this.hierarchy?.dispose();
    this.ecsWorld?.dispose();
    this.culler?.dispose();

    this.hierarchy = null;
    this.ecsWorld = null;
    this.culler = null;
    this.wasmModule = null;

    this.entityToIndex.clear();
    this.indexToEntity = [];
    this.componentTypeToId.clear();
  }

  // Private helpers

  private syncComponentMasks(entities: Entity[]): void {
    if (!this.ecsWorld) return;

    // Allocate or resize buffer
    if (!this.componentMasks || this.componentMasks.length < entities.length) {
      this.componentMasks = new BigUint64Array(entities.length);
    }

    for (let i = 0; i < entities.length; i++) {
      let mask = 0n;
      const entity = entities[i]!;

      // Build mask from entity's components
      // This requires iterating component types - in practice you'd cache this
      for (const [typeName, id] of this.componentTypeToId) {
        // Check if entity has this component type
        // This is a simplified check - real implementation would use component registry
        const componentClass = this.getComponentClassByName(typeName);
        if (componentClass && entity.hasComponent(componentClass)) {
          mask |= 1n << BigInt(id);
        }
      }

      this.componentMasks[i] = mask;
    }

    this.ecsWorld.batchSetMasks(this.componentMasks);
  }

  private syncActiveFlags(entities: Entity[]): void {
    if (!this.ecsWorld) return;

    if (!this.activeFlags || this.activeFlags.length < entities.length) {
      this.activeFlags = new Uint8Array(entities.length);
    }

    for (let i = 0; i < entities.length; i++) {
      this.activeFlags[i] = entities[i]!.active ? 1 : 0;
    }

    this.ecsWorld.batchSetActive(this.activeFlags);
  }

  private indicesToEntities(indices: Uint32Array): Entity[] {
    const result: Entity[] = [];
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i]!;
      const entity = this.indexToEntity[idx];
      if (entity) {
        result.push(entity);
      }
    }
    return result;
  }

  // Fallback TypeScript implementations

  private fallbackQuery(componentTypes: string[]): Entity[] {
    // Simple linear scan fallback
    return this.indexToEntity.filter((entity) => {
      for (const typeName of componentTypes) {
        const componentClass = this.getComponentClassByName(typeName);
        if (!componentClass || !entity.hasComponent(componentClass)) {
          return false;
        }
      }
      return true;
    });
  }

  private fallbackQueryActive(componentTypes: string[]): Entity[] {
    return this.fallbackQuery(componentTypes).filter((e) => e.active);
  }

  // Component registry integration (simplified)
  private componentClassRegistry = new Map<string, ComponentClass<Component>>();

  /**
   * Register component class for query support
   */
  registerComponentClass(cls: ComponentClass<Component>): void {
    this.componentClassRegistry.set(cls.name, cls);
    this.registerComponentType(cls.name);
  }

  private getComponentClassByName(name: string): ComponentClass<Component> | undefined {
    return this.componentClassRegistry.get(name);
  }
}

/**
 * Singleton instance for global access
 */
let globalWasmEcs: WasmEcsSystem | null = null;

/**
 * Get or create global WASM ECS system
 */
export function getWasmEcsSystem(): WasmEcsSystem {
  if (!globalWasmEcs) {
    globalWasmEcs = new WasmEcsSystem();
  }
  return globalWasmEcs;
}

/**
 * Initialize global WASM ECS system
 */
export async function initGlobalWasmEcs(scene: Scene, capacity?: number): Promise<boolean> {
  const system = getWasmEcsSystem();
  return system.initialize(scene, capacity);
}

