/* tslint:disable */
/* eslint-disable */
export function capsule_sphere_intersect(c_base: Float32Array, c_tip: Float32Array, c_radius: number, s_center: Float32Array, s_radius: number): boolean;
export function sphere_sphere_intersect(a_center: Float32Array, a_radius: number, b_center: Float32Array, b_radius: number): boolean;
export function ray_sphere_intersect(ray_origin: Float32Array, ray_dir: Float32Array, s_center: Float32Array, s_radius: number): number;
export function obb_intersect(a_center: Float32Array, a_axes: Float32Array, a_half: Float32Array, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
export function batch_check_trs(pre_pos: Float32Array, pre_rot: Float32Array, pre_scl: Float32Array, others_pos: Float32Array, others_rot: Float32Array, others_scl: Float32Array): Uint32Array;
export function compute_scene_bounds(world_mats: Float32Array, half_extents: Float32Array): Float32Array | undefined;
export function sphere_obb_intersect(s_center: Float32Array, s_radius: number, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
export function capsule_capsule_intersect(a_base: Float32Array, a_tip: Float32Array, a_radius: number, b_base: Float32Array, b_tip: Float32Array, b_radius: number): boolean;
export function batch_check_trs_linear(pre_pos: Float32Array, pre_rot: Float32Array, pre_scl: Float32Array, others_pos: Float32Array, others_rot: Float32Array, others_scl: Float32Array): Uint32Array;
export function batch_check(pre_center: Float32Array, pre_axes: Float32Array, pre_half: Float32Array, others_centers: Float32Array, others_axes: Float32Array, others_half: Float32Array): Uint32Array;
export function ray_obb_intersect(ray_origin: Float32Array, ray_dir: Float32Array, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): number;
export function batch_check_all(pos: Float32Array, rot: Float32Array, scl: Float32Array): Uint32Array;
export function capsule_obb_intersect(c_base: Float32Array, c_tip: Float32Array, c_radius: number, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
export class CollisionWorld {
  free(): void;
  [Symbol.dispose](): void;
  query_frustum(view_proj: Float32Array): Uint32Array;
  raycast_world(origin: Float32Array, dir: Float32Array): Float32Array | undefined;
  get_scales_ptr(): number;
  check_collisions(): Uint32Array;
  get_positions_ptr(): number;
  get_rotations_ptr(): number;
  /**
   * Rasterize a set of entities (indices) as occluders.
   * These entities will be rendered into the depth buffer as solid boxes.
   */
  rasterize_occluders(indices: Uint32Array, view_proj: Float32Array): void;
  /**
   * Clear occlusion buffer.
   */
  clear_occlusion_buffer(): void;
  /**
   * Initialize occlusion buffer with given dimensions (e.g., 256x128).
   */
  init_occlusion_culling(width: number, height: number): void;
  constructor();
  resize(count: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_collisionworld_free: (a: number, b: number) => void;
  readonly batch_check: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
  readonly batch_check_all: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly batch_check_trs: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
  readonly capsule_capsule_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => number;
  readonly capsule_obb_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => number;
  readonly capsule_sphere_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
  readonly collisionworld_check_collisions: (a: number) => [number, number];
  readonly collisionworld_clear_occlusion_buffer: (a: number) => void;
  readonly collisionworld_get_positions_ptr: (a: number) => number;
  readonly collisionworld_get_rotations_ptr: (a: number) => number;
  readonly collisionworld_get_scales_ptr: (a: number) => number;
  readonly collisionworld_init_occlusion_culling: (a: number, b: number, c: number) => void;
  readonly collisionworld_new: () => number;
  readonly collisionworld_query_frustum: (a: number, b: number, c: number) => [number, number];
  readonly collisionworld_rasterize_occluders: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly collisionworld_raycast_world: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly collisionworld_resize: (a: number, b: number) => void;
  readonly compute_scene_bounds: (a: number, b: number, c: number, d: number) => [number, number];
  readonly obb_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
  readonly ray_obb_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => number;
  readonly ray_sphere_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly sphere_obb_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
  readonly sphere_sphere_intersect: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly batch_check_trs_linear: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
