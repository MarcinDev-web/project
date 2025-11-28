/* tslint:disable */
/* eslint-disable */
export function capsule_sphere_intersect(c_base: Float32Array, c_tip: Float32Array, c_radius: number, s_center: Float32Array, s_radius: number): boolean;
export function batch_check_trs_linear(pre_pos: Float32Array, pre_rot: Float32Array, pre_scl: Float32Array, others_pos: Float32Array, others_rot: Float32Array, others_scl: Float32Array): Uint32Array;
export function batch_check(pre_center: Float32Array, pre_axes: Float32Array, pre_half: Float32Array, others_centers: Float32Array, others_axes: Float32Array, others_half: Float32Array): Uint32Array;
export function obb_intersect(a_center: Float32Array, a_axes: Float32Array, a_half: Float32Array, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
export function compute_scene_bounds(world_mats: Float32Array, half_extents: Float32Array): Float32Array | undefined;
/**
 * Ray-capsule intersection test.
 * Returns distance to intersection or -1.0 if no hit.
 * @param c_base - Capsule base point [x, y, z]
 * @param c_tip - Capsule tip point [x, y, z]
 * @param c_radius - Capsule radius
 */
export function ray_capsule_intersect(ray_origin: Float32Array, ray_dir: Float32Array, c_base: Float32Array, c_tip: Float32Array, c_radius: number): number;
export function sphere_sphere_intersect(a_center: Float32Array, a_radius: number, b_center: Float32Array, b_radius: number): boolean;
export function ray_sphere_intersect(ray_origin: Float32Array, ray_dir: Float32Array, s_center: Float32Array, s_radius: number): number;
export function sphere_obb_intersect(s_center: Float32Array, s_radius: number, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
export function batch_check_all(pos: Float32Array, rot: Float32Array, scl: Float32Array): Uint32Array;
export function batch_check_trs(pre_pos: Float32Array, pre_rot: Float32Array, pre_scl: Float32Array, others_pos: Float32Array, others_rot: Float32Array, others_scl: Float32Array): Uint32Array;
export function ray_obb_intersect(ray_origin: Float32Array, ray_dir: Float32Array, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): number;
export function capsule_obb_intersect(c_base: Float32Array, c_tip: Float32Array, c_radius: number, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
export function capsule_capsule_intersect(a_base: Float32Array, a_tip: Float32Array, a_radius: number, b_base: Float32Array, b_tip: Float32Array, b_radius: number): boolean;
/**
 * OBB-OBB collision with contact information for physics resolution.
 * Returns a CollisionContact struct with penetration depth, normal, and contact point.
 */
export function obb_intersect_with_contact(a_center: Float32Array, a_axes: Float32Array, a_half: Float32Array, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): CollisionContact;
/**
 * Contact information from collision detection.
 * Used for physics resolution (penetration depth, normal, contact point).
 */
export class CollisionContact {
  free(): void;
  [Symbol.dispose](): void;
  get_normal(): Float32Array;
  constructor();
  get_point(): Float32Array;
  has_collision: boolean;
  depth: number;
  normal_x: number;
  normal_y: number;
  normal_z: number;
  point_x: number;
  point_y: number;
  point_z: number;
}
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
  /**
   * Clears all data and releases memory by shrinking internal vectors.
   * Use this when the collision world is no longer needed or to reset state.
   */
  clear(): void;
  resize(count: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_collisioncontact_free: (a: number, b: number) => void;
  readonly __wbg_collisionworld_free: (a: number, b: number) => void;
  readonly __wbg_get_collisioncontact_depth: (a: number) => number;
  readonly __wbg_get_collisioncontact_has_collision: (a: number) => number;
  readonly __wbg_get_collisioncontact_normal_x: (a: number) => number;
  readonly __wbg_get_collisioncontact_normal_y: (a: number) => number;
  readonly __wbg_get_collisioncontact_normal_z: (a: number) => number;
  readonly __wbg_get_collisioncontact_point_x: (a: number) => number;
  readonly __wbg_get_collisioncontact_point_y: (a: number) => number;
  readonly __wbg_get_collisioncontact_point_z: (a: number) => number;
  readonly __wbg_set_collisioncontact_depth: (a: number, b: number) => void;
  readonly __wbg_set_collisioncontact_has_collision: (a: number, b: number) => void;
  readonly __wbg_set_collisioncontact_normal_x: (a: number, b: number) => void;
  readonly __wbg_set_collisioncontact_normal_y: (a: number, b: number) => void;
  readonly __wbg_set_collisioncontact_normal_z: (a: number, b: number) => void;
  readonly __wbg_set_collisioncontact_point_x: (a: number, b: number) => void;
  readonly __wbg_set_collisioncontact_point_y: (a: number, b: number) => void;
  readonly __wbg_set_collisioncontact_point_z: (a: number, b: number) => void;
  readonly batch_check: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
  readonly batch_check_all: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly batch_check_trs: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
  readonly capsule_capsule_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => number;
  readonly capsule_obb_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => number;
  readonly capsule_sphere_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
  readonly collisioncontact_get_normal: (a: number) => [number, number];
  readonly collisioncontact_get_point: (a: number) => [number, number];
  readonly collisioncontact_new: () => number;
  readonly collisionworld_check_collisions: (a: number) => [number, number];
  readonly collisionworld_clear: (a: number) => void;
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
  readonly obb_intersect_with_contact: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
  readonly ray_capsule_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
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
