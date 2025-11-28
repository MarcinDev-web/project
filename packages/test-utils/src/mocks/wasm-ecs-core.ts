/**
 * Mock for @engine/wasm-ecs-core
 * Provides stub implementations for tests that don't need actual WASM
 */

// ============================================================================
// Type definitions (copied from wasm-ecs-core)
// ============================================================================

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

// ============================================================================
// Mock WASM module
// ============================================================================

let _wasmReady = false;

export async function initWasm(): Promise<WasmEcsCore> {
  _wasmReady = true;
  return {} as WasmEcsCore;
}

export function isWasmReady(): boolean {
  return _wasmReady;
}

export function getWasmModule(): WasmEcsCore {
  return {} as WasmEcsCore;
}

// ============================================================================
// Mock TypeScript Wrappers
// ============================================================================

export class TransformHierarchyWasm {
  private _count = 0;

  constructor(_capacity = 1000) {}

  resize(count: number): void {
    this._count = count;
  }

  clear(): void {
    this._count = 0;
  }

  get count(): number {
    return this._count;
  }

  get positions(): Float32Array {
    return new Float32Array(this._count * 3);
  }

  get rotations(): Float32Array {
    return new Float32Array(this._count * 4);
  }

  get scales(): Float32Array {
    return new Float32Array(this._count * 3);
  }

  get parents(): Int32Array {
    return new Int32Array(this._count);
  }

  get worldMatrices(): Float32Array {
    return new Float32Array(this._count * 16);
  }

  setParent(_index: number, _parent: number): void {}

  markLocalDirty(_index: number): void {}

  markAllDirty(): void {}

  updateWorldMatrices(): void {}

  batchUpdate(
    _positions: Float32Array,
    _rotations: Float32Array,
    _scales: Float32Array,
    parents: Int32Array
  ): Float32Array {
    this._count = parents.length;
    return new Float32Array(this._count * 16);
  }

  dispose(): void {}
}

export class EcsWorldWasm {
  private _count = 0;

  constructor(_capacity = 1000) {}

  resize(count: number): void {
    this._count = count;
  }

  clear(): void {
    this._count = 0;
  }

  get count(): number {
    return this._count;
  }

  setComponentMask(_entity: number, _mask: bigint): void {}

  addComponent(_entity: number, _componentType: number): void {}

  removeComponent(_entity: number, _componentType: number): void {}

  setActive(_entity: number, _active: boolean): void {}

  batchSetMasks(masks: BigUint64Array): void {
    this._count = masks.length;
  }

  batchSetActive(_flags: Uint8Array): void {}

  query(_requiredMask: bigint): Uint32Array {
    return new Uint32Array(0);
  }

  queryActive(_requiredMask: bigint): Uint32Array {
    return new Uint32Array(0);
  }

  queryExclude(_requiredMask: bigint, _excludeMask: bigint): Uint32Array {
    return new Uint32Array(0);
  }

  buildArchetypes(): void {}

  queryArchetypes(_requiredMask: bigint): Uint32Array {
    return new Uint32Array(0);
  }

  dispose(): void {}
}

export class FrustumCullerWasm {
  constructor(_capacity = 1000) {}

  clear(): void {}

  computeWorldAabbs(_worldMatrices: Float32Array, _localHalfExtents: Float32Array): void {}

  cull(_viewProj: Float32Array): Uint32Array {
    return new Uint32Array(0);
  }

  cullActive(_viewProj: Float32Array, _activeFlags: Uint8Array): Uint32Array {
    return new Uint32Array(0);
  }

  cullHierarchy(
    _hierarchy: TransformHierarchyWasm,
    _localHalfExtents: Float32Array,
    _viewProj: Float32Array
  ): Uint32Array {
    return new Uint32Array(0);
  }

  dispose(): void {}
}

// ============================================================================
// Mock Stateless Batch APIs
// ============================================================================

export function batchUpdateTransforms(
  _positions: Float32Array,
  _rotations: Float32Array,
  _scales: Float32Array,
  parents: Int32Array
): Float32Array {
  return new Float32Array(parents.length * 16);
}

export function batchFrustumCull(
  _worldMatrices: Float32Array,
  _localHalfExtents: Float32Array,
  _viewProj: Float32Array
): Uint32Array {
  return new Uint32Array(0);
}

export function batchEcsQuery(
  _componentMasks: BigUint64Array,
  _requiredMask: bigint
): Uint32Array {
  return new Uint32Array(0);
}

export function batchEcsQueryActive(
  _componentMasks: BigUint64Array,
  _activeFlags: Uint8Array,
  _requiredMask: bigint
): Uint32Array {
  return new Uint32Array(0);
}

// ============================================================================
// Mock Component Registry
// ============================================================================

export class ComponentRegistry {
  private typeToId = new Map<Function, number>();
  private nextId = 0;

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

  getMask(componentClass: Function): bigint {
    const id = this.typeToId.get(componentClass);
    if (id === undefined) {
      throw new Error(`[ComponentRegistry] Component not registered: ${componentClass.name}`);
    }
    return 1n << BigInt(id);
  }

  getCombinedMask(componentClasses: Function[]): bigint {
    let mask = 0n;
    for (const cls of componentClasses) {
      mask |= this.getMask(cls);
    }
    return mask;
  }

  hasComponent(mask: bigint, componentClass: Function): boolean {
    const componentMask = this.getMask(componentClass);
    return (mask & componentMask) === componentMask;
  }

  getId(componentClass: Function): number | undefined {
    return this.typeToId.get(componentClass);
  }
}

export const globalComponentRegistry = new ComponentRegistry();

