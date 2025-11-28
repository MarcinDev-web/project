/**
 * @engine/wasm-ecs-core
 *
 * WASM-accelerated ECS hot paths:
 * - Batch ECS queries with component masks
 * - Transform hierarchy batch updates
 * - Frustum culling with hierarchical transforms
 *
 * @example
 * ```typescript
 * import { initWasm, TransformHierarchyWasm, EcsWorldWasm, FrustumCullerWasm } from '@engine/wasm-ecs-core';
 *
 * await initWasm();
 *
 * // Transform hierarchy
 * const hierarchy = new TransformHierarchyWasm(1000);
 * hierarchy.resize(entityCount);
 * // ... copy data ...
 * hierarchy.updateWorldMatrices();
 *
 * // ECS queries
 * const ecs = new EcsWorldWasm(1000);
 * const result = ecs.query(TRANSFORM_MASK | MESH_MASK);
 *
 * // Frustum culling
 * const culler = new FrustumCullerWasm(1000);
 * const visible = culler.cullHierarchy(hierarchy, halfExtents, viewProj);
 * ```
 */

// Type definitions for the WASM module
export interface TransformHierarchy {
  free(): void;
  resize(count: number): void;
  clear(): void;
  get_positions_ptr(): number;
  get_rotations_ptr(): number;
  get_scales_ptr(): number;
  get_parents_ptr(): number;
  get_world_matrices_ptr(): number;
  set_parent(index: number, parent: number): void;
  mark_local_dirty(index: number): void;
  mark_all_dirty(): void;
  update_world_matrices(): void;
  batch_update(
    positions: Float32Array,
    rotations: Float32Array,
    scales: Float32Array,
    parents: Int32Array
  ): Float32Array;
  get_count(): number;
}

export interface EcsWorld {
  free(): void;
  resize(count: number): void;
  clear(): void;
  set_component_mask(entity: number, mask: bigint): void;
  add_component(entity: number, componentType: number): void;
  remove_component(entity: number, componentType: number): void;
  set_active(entity: number, active: boolean): void;
  batch_set_masks(masks: BigUint64Array): void;
  batch_set_active(flags: Uint8Array): void;
  query(requiredMask: bigint): Uint32Array;
  query_active(requiredMask: bigint): Uint32Array;
  query_exclude(requiredMask: bigint, excludeMask: bigint): Uint32Array;
  build_archetypes(): void;
  query_archetypes(requiredMask: bigint): Uint32Array;
  get_count(): number;
}

export interface FrustumCuller {
  free(): void;
  clear(): void;
  compute_world_aabbs(worldMatrices: Float32Array, localHalfExtents: Float32Array): void;
  cull(viewProj: Float32Array): Uint32Array;
  cull_active(viewProj: Float32Array, activeFlags: Uint8Array): Uint32Array;
  cull_hierarchy(
    hierarchy: TransformHierarchy,
    localHalfExtents: Float32Array,
    viewProj: Float32Array
  ): Uint32Array;
}

export interface WasmEcsCore {
  TransformHierarchy: new (capacity: number) => TransformHierarchy;
  EcsWorld: new (capacity: number) => EcsWorld;
  FrustumCuller: new (capacity: number) => FrustumCuller;
  batch_update_transforms(
    positions: Float32Array,
    rotations: Float32Array,
    scales: Float32Array,
    parents: Int32Array
  ): Float32Array;
  batch_frustum_cull(
    worldMatrices: Float32Array,
    localHalfExtents: Float32Array,
    viewProj: Float32Array
  ): Uint32Array;
  batch_ecs_query(componentMasks: BigUint64Array, requiredMask: bigint): Uint32Array;
  batch_ecs_query_active(
    componentMasks: BigUint64Array,
    activeFlags: Uint8Array,
    requiredMask: bigint
  ): Uint32Array;
  init_panic_hook?(): void;
  memory: WebAssembly.Memory;
}

// Module state
let wasmModule: WasmEcsCore | null = null;
let initPromise: Promise<WasmEcsCore> | null = null;

/**
 * Initialize the WASM module
 */
export async function initWasm(): Promise<WasmEcsCore> {
  if (wasmModule) {
    return wasmModule;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Dynamic import of WASM glue code
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('../pkg/ecs_core.js');

      // Initialize WASM
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const maybeInit = mod.default || mod.init;
      if (typeof maybeInit === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await maybeInit();
      }

      // Install panic hook for better error messages
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof mod.init_panic_hook === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        mod.init_panic_hook();
      }

      wasmModule = mod as WasmEcsCore;
      return wasmModule;
    } catch (error) {
      console.error('[wasm-ecs-core] Failed to initialize:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Check if WASM module is initialized
 */
export function isWasmReady(): boolean {
  return wasmModule !== null;
}

/**
 * Get the raw WASM module (throws if not initialized)
 */
export function getWasmModule(): WasmEcsCore {
  if (!wasmModule) {
    throw new Error('[wasm-ecs-core] WASM not initialized. Call initWasm() first.');
  }
  return wasmModule;
}

// ============================================================================
// High-Level TypeScript Wrappers
// ============================================================================

/**
 * TypeScript wrapper for TransformHierarchy WASM class.
 * Provides zero-copy access to WASM memory for efficient data transfer.
 */
export class TransformHierarchyWasm {
  private inner: TransformHierarchy;
  private _count = 0;
  private _memory: WebAssembly.Memory;

  // Cached typed array views (invalidated on resize)
  private _positions: Float32Array | null = null;
  private _rotations: Float32Array | null = null;
  private _scales: Float32Array | null = null;
  private _parents: Int32Array | null = null;
  private _worldMatrices: Float32Array | null = null;

  constructor(capacity = 1000) {
    const mod = getWasmModule();
    this.inner = new mod.TransformHierarchy(capacity);
    this._memory = mod.memory;
  }

  /**
   * Resize the hierarchy to hold `count` transforms
   */
  resize(count: number): void {
    this.inner.resize(count);
    this._count = count;
    this.invalidateViews();
  }

  /**
   * Clear all data and release memory
   */
  clear(): void {
    this.inner.clear();
    this._count = 0;
    this.invalidateViews();
  }

  /**
   * Get count of transforms
   */
  get count(): number {
    return this._count;
  }

  /**
   * Get direct access to local positions buffer (zero-copy)
   * Layout: [x0, y0, z0, x1, y1, z1, ...]
   */
  get positions(): Float32Array {
    if (!this._positions) {
      const ptr = this.inner.get_positions_ptr();
      this._positions = new Float32Array(this._memory.buffer, ptr, this._count * 3);
    }
    return this._positions;
  }

  /**
   * Get direct access to local rotations buffer (zero-copy)
   * Layout: [x0, y0, z0, w0, x1, y1, z1, w1, ...]
   */
  get rotations(): Float32Array {
    if (!this._rotations) {
      const ptr = this.inner.get_rotations_ptr();
      this._rotations = new Float32Array(this._memory.buffer, ptr, this._count * 4);
    }
    return this._rotations;
  }

  /**
   * Get direct access to local scales buffer (zero-copy)
   * Layout: [x0, y0, z0, x1, y1, z1, ...]
   */
  get scales(): Float32Array {
    if (!this._scales) {
      const ptr = this.inner.get_scales_ptr();
      this._scales = new Float32Array(this._memory.buffer, ptr, this._count * 3);
    }
    return this._scales;
  }

  /**
   * Get direct access to parent indices buffer (zero-copy)
   * Layout: [p0, p1, p2, ...] where -1 = root
   */
  get parents(): Int32Array {
    if (!this._parents) {
      const ptr = this.inner.get_parents_ptr();
      this._parents = new Int32Array(this._memory.buffer, ptr, this._count);
    }
    return this._parents;
  }

  /**
   * Get direct access to world matrices buffer (zero-copy)
   * Layout: 16 floats per matrix, column-major
   */
  get worldMatrices(): Float32Array {
    if (!this._worldMatrices) {
      const ptr = this.inner.get_world_matrices_ptr();
      this._worldMatrices = new Float32Array(this._memory.buffer, ptr, this._count * 16);
    }
    return this._worldMatrices;
  }

  /**
   * Set parent for a transform
   */
  setParent(index: number, parent: number): void {
    this.inner.set_parent(index, parent);
  }

  /**
   * Mark a transform's local data as dirty
   */
  markLocalDirty(index: number): void {
    this.inner.mark_local_dirty(index);
  }

  /**
   * Mark all transforms as dirty
   */
  markAllDirty(): void {
    this.inner.mark_all_dirty();
  }

  /**
   * Update all world matrices (main hot path)
   */
  updateWorldMatrices(): void {
    this.inner.update_world_matrices();
  }

  /**
   * Batch update: copy all data and update world matrices
   * Returns world matrices as Float32Array
   */
  batchUpdate(
    positions: Float32Array,
    rotations: Float32Array,
    scales: Float32Array,
    parents: Int32Array
  ): Float32Array {
    const result = this.inner.batch_update(positions, rotations, scales, parents);
    this._count = parents.length;
    this.invalidateViews();
    return result;
  }

  /**
   * Dispose of WASM resources
   */
  dispose(): void {
    this.inner.free();
    this.invalidateViews();
  }

  private invalidateViews(): void {
    this._positions = null;
    this._rotations = null;
    this._scales = null;
    this._parents = null;
    this._worldMatrices = null;
  }
}

/**
 * TypeScript wrapper for EcsWorld WASM class.
 * Provides efficient batch queries using component bitmasks.
 */
export class EcsWorldWasm {
  private inner: EcsWorld;
  private _count = 0;

  constructor(capacity = 1000) {
    const mod = getWasmModule();
    this.inner = new mod.EcsWorld(capacity);
  }

  /**
   * Resize the world to hold `count` entities
   */
  resize(count: number): void {
    this.inner.resize(count);
    this._count = count;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.inner.clear();
    this._count = 0;
  }

  /**
   * Get entity count
   */
  get count(): number {
    return this._count;
  }

  /**
   * Set component mask for an entity
   */
  setComponentMask(entity: number, mask: bigint): void {
    this.inner.set_component_mask(entity, mask);
  }

  /**
   * Add component type to entity (type must be 0-63)
   */
  addComponent(entity: number, componentType: number): void {
    this.inner.add_component(entity, componentType);
  }

  /**
   * Remove component type from entity
   */
  removeComponent(entity: number, componentType: number): void {
    this.inner.remove_component(entity, componentType);
  }

  /**
   * Set entity active flag
   */
  setActive(entity: number, active: boolean): void {
    this.inner.set_active(entity, active);
  }

  /**
   * Batch set component masks from TypeScript
   */
  batchSetMasks(masks: BigUint64Array): void {
    this.inner.batch_set_masks(masks);
    this._count = masks.length;
  }

  /**
   * Batch set active flags
   */
  batchSetActive(flags: Uint8Array): void {
    this.inner.batch_set_active(flags);
  }

  /**
   * Query entities that have ALL specified component types
   * @param requiredMask Bitmask of required components
   * @returns Indices of matching entities
   */
  query(requiredMask: bigint): Uint32Array {
    return this.inner.query(requiredMask);
  }

  /**
   * Query active entities with specified components
   */
  queryActive(requiredMask: bigint): Uint32Array {
    return this.inner.query_active(requiredMask);
  }

  /**
   * Query with exclusion mask
   */
  queryExclude(requiredMask: bigint, excludeMask: bigint): Uint32Array {
    return this.inner.query_exclude(requiredMask, excludeMask);
  }

  /**
   * Build archetypes for faster repeated queries
   */
  buildArchetypes(): void {
    this.inner.build_archetypes();
  }

  /**
   * Query using archetypes (faster for repeated queries)
   */
  queryArchetypes(requiredMask: bigint): Uint32Array {
    return this.inner.query_archetypes(requiredMask);
  }

  /**
   * Dispose of WASM resources
   */
  dispose(): void {
    this.inner.free();
  }
}

/**
 * TypeScript wrapper for FrustumCuller WASM class.
 */
export class FrustumCullerWasm {
  private inner: FrustumCuller;

  constructor(capacity = 1000) {
    const mod = getWasmModule();
    this.inner = new mod.FrustumCuller(capacity);
  }

  /**
   * Clear internal state
   */
  clear(): void {
    this.inner.clear();
  }

  /**
   * Compute world AABBs from world matrices and local half-extents
   */
  computeWorldAabbs(worldMatrices: Float32Array, localHalfExtents: Float32Array): void {
    this.inner.compute_world_aabbs(worldMatrices, localHalfExtents);
  }

  /**
   * Cull entities against frustum
   * @param viewProj View-projection matrix (16 floats, column-major)
   * @returns Indices of visible entities
   */
  cull(viewProj: Float32Array): Uint32Array {
    return this.inner.cull(viewProj);
  }

  /**
   * Cull with active mask
   */
  cullActive(viewProj: Float32Array, activeFlags: Uint8Array): Uint32Array {
    return this.inner.cull_active(viewProj, activeFlags);
  }

  /**
   * Full pipeline: update transforms, compute AABBs, cull
   */
  cullHierarchy(
    hierarchy: TransformHierarchyWasm,
    localHalfExtents: Float32Array,
    viewProj: Float32Array
  ): Uint32Array {
    // Access inner WASM object directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.inner.cull_hierarchy((hierarchy as any).inner, localHalfExtents, viewProj);
  }

  /**
   * Dispose of WASM resources
   */
  dispose(): void {
    this.inner.free();
  }
}

// ============================================================================
// Stateless Batch APIs
// ============================================================================

/**
 * Batch update transform hierarchy (stateless)
 * @returns World matrices as Float32Array
 */
export function batchUpdateTransforms(
  positions: Float32Array,
  rotations: Float32Array,
  scales: Float32Array,
  parents: Int32Array
): Float32Array {
  const mod = getWasmModule();
  return mod.batch_update_transforms(positions, rotations, scales, parents);
}

/**
 * Batch frustum cull (stateless)
 * @returns Visible indices
 */
export function batchFrustumCull(
  worldMatrices: Float32Array,
  localHalfExtents: Float32Array,
  viewProj: Float32Array
): Uint32Array {
  const mod = getWasmModule();
  return mod.batch_frustum_cull(worldMatrices, localHalfExtents, viewProj);
}

/**
 * Batch ECS query (stateless)
 */
export function batchEcsQuery(
  componentMasks: BigUint64Array,
  requiredMask: bigint
): Uint32Array {
  const mod = getWasmModule();
  return mod.batch_ecs_query(componentMasks, requiredMask);
}

/**
 * Batch ECS query with active filter (stateless)
 */
export function batchEcsQueryActive(
  componentMasks: BigUint64Array,
  activeFlags: Uint8Array,
  requiredMask: bigint
): Uint32Array {
  const mod = getWasmModule();
  return mod.batch_ecs_query_active(componentMasks, activeFlags, requiredMask);
}

// ============================================================================
// Component Type Registry (for mapping TypeScript classes to bitmask positions)
// ============================================================================

/**
 * Registry for mapping component classes to bitmask positions.
 * Supports up to 64 unique component types.
 */
export class ComponentRegistry {
  private typeToId = new Map<Function, number>();
  private nextId = 0;

  /**
   * Register a component class and get its bitmask position
   */
  register(componentClass: Function): number {
    const existing = this.typeToId.get(componentClass);
    if (existing !== undefined) {
      return existing;
    }

    if (this.nextId >= 64) {
      throw new Error('[ComponentRegistry] Maximum 64 component types supported');
    }

    const id = this.nextId++;
    this.typeToId.set(componentClass, id);
    return id;
  }

  /**
   * Get bitmask for a component class
   */
  getMask(componentClass: Function): bigint {
    const id = this.typeToId.get(componentClass);
    if (id === undefined) {
      throw new Error(`[ComponentRegistry] Component not registered: ${componentClass.name}`);
    }
    return 1n << BigInt(id);
  }

  /**
   * Get combined mask for multiple component classes
   */
  getCombinedMask(componentClasses: Function[]): bigint {
    let mask = 0n;
    for (const cls of componentClasses) {
      mask |= this.getMask(cls);
    }
    return mask;
  }

  /**
   * Check if a mask contains a component
   */
  hasComponent(mask: bigint, componentClass: Function): boolean {
    const componentMask = this.getMask(componentClass);
    return (mask & componentMask) === componentMask;
  }

  /**
   * Get registered ID for component class (or undefined)
   */
  getId(componentClass: Function): number | undefined {
    return this.typeToId.get(componentClass);
  }
}

// Default global registry
export const globalComponentRegistry = new ComponentRegistry();

