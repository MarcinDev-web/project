/* tslint:disable */
/* eslint-disable */
/**
 * Linear batch check using TRS inputs (SoA) - baseline without spatial index
 */
export function batch_check_trs_linear(pre_pos: Float32Array, pre_rot: Float32Array, pre_scl: Float32Array, others_pos: Float32Array, others_rot: Float32Array, others_scl: Float32Array): Uint32Array;
/**
 * Batch check using TRS with uniform-grid broad-phase inside Rust
 */
export function batch_check_trs(pre_pos: Float32Array, pre_rot: Float32Array, pre_scl: Float32Array, others_pos: Float32Array, others_rot: Float32Array, others_scl: Float32Array): Uint32Array;
export function obb_intersect(a_center: Float32Array, a_axes: Float32Array, a_half: Float32Array, b_center: Float32Array, b_axes: Float32Array, b_half: Float32Array): boolean;
export function batch_check(pre_center: Float32Array, pre_axes: Float32Array, pre_half: Float32Array, others_centers: Float32Array, others_axes: Float32Array, others_half: Float32Array): Uint32Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly batch_check_trs_linear: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
  readonly batch_check_trs: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
  readonly obb_intersect: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => number;
  readonly batch_check: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number];
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
