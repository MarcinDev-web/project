/* tslint:disable */
/* eslint-disable */
export function capsule_obb_intersect(c_base: Float32Array, c_tip: Float32Array, c_radius: number, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
export function ray_sphere_intersect(ray_origin: Float32Array, ray_dir: Float32Array, s_center: Float32Array, s_radius: number): number;
/**
 * Linear batch check using TRS inputs (SoA) - baseline without spatial index
 */
export function batch_check_trs_linear(pre_pos: Float32Array, pre_rot: Float32Array, pre_scl: Float32Array, others_pos: Float32Array, others_rot: Float32Array, others_scl: Float32Array): Uint32Array;
export function sphere_obb_intersect(s_center: Float32Array, s_radius: number, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
export function ray_obb_intersect(ray_origin: Float32Array, ray_dir: Float32Array, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): number;
/**
 * Computes global scene bounds (AABB) from world matrices and local half-extents.
 * Returns None if inputs are invalid or empty.
 */
export function compute_scene_bounds(world_mats: Float32Array, half_extents: Float32Array): Float32Array | undefined;
export function obb_intersect(a_center: Float32Array, a_axes: Float32Array, a_half: Float32Array, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
export function sphere_sphere_intersect(a_center: Float32Array, a_radius: number, b_center: Float32Array, b_radius: number): boolean;
export function capsule_capsule_intersect(a_base: Float32Array, a_tip: Float32Array, a_radius: number, b_base: Float32Array, b_tip: Float32Array, b_radius: number): boolean;
export function batch_check(pre_center: Float32Array, pre_axes: Float32Array, pre_half: Float32Array, others_centers: Float32Array, others_axes: Float32Array, others_half: Float32Array): Uint32Array;
/**
 * Batch check using TRS with uniform-grid broad-phase inside Rust
 */
export function batch_check_trs(pre_pos: Float32Array, pre_rot: Float32Array, pre_scl: Float32Array, others_pos: Float32Array, others_rot: Float32Array, others_scl: Float32Array): Uint32Array;
export function capsule_sphere_intersect(c_base: Float32Array, c_tip: Float32Array, c_radius: number, s_center: Float32Array, s_radius: number): boolean;
/**
 * Batch check all vs all
 * Returns a list of pairs [a1, b1, a2, b2, ...]
 */
export function batch_check_all(pos: Float32Array, rot: Float32Array, scl: Float32Array): Uint32Array;
export class CollisionWorld {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Get pointer to scales buffer (Float32Array view in JS).
   */
  get_scales_ptr(): number;
  /**
   * Run batch collision check using internal buffers.
   * Returns flat array of indices [idxA1, idxB1, idxA2, idxB2, ...]
   */
  check_collisions(): Uint32Array;
  /**
   * Get pointer to positions buffer (Float32Array view in JS).
   */
  get_positions_ptr(): number;
  /**
   * Get pointer to rotations buffer (Float32Array view in JS).
   */
  get_rotations_ptr(): number;
  constructor();
  /**
   * Resize buffers to hold `count` entities.
   * This preserves existing data up to new size, or initializes new slots with 0.
   */
  resize(count: number): void;
}
