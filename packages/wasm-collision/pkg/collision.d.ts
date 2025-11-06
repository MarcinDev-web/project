/* tslint:disable */
/* eslint-disable */
export function obb_intersect(a_center: Float32Array, a_axes: Float32Array, a_half: Float32Array, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
/**
 * Linear batch check using TRS inputs (SoA) - baseline without spatial index
 */
export function batch_check_trs_linear(pre_pos: Float32Array, pre_rot: Float32Array, pre_scl: Float32Array, others_pos: Float32Array, others_rot: Float32Array, others_scl: Float32Array): Uint32Array;
/**
 * Batch check using TRS with uniform-grid broad-phase inside Rust
 */
export function batch_check_trs(pre_pos: Float32Array, pre_rot: Float32Array, pre_scl: Float32Array, others_pos: Float32Array, others_rot: Float32Array, others_scl: Float32Array): Uint32Array;
export function batch_check(pre_center: Float32Array, pre_axes: Float32Array, pre_half: Float32Array, others_centers: Float32Array, others_axes: Float32Array, others_half: Float32Array): Uint32Array;
