/* tslint:disable */
/* eslint-disable */
/**
 * Generate complete PBR texture set
 *
 * # Arguments
 * * `width` - Texture width in pixels
 * * `height` - Texture height in pixels
 * * `pattern` - Pattern type (0=solid, 1=smooth, 2=noise, 3=cobble, 4=bricks, 5=planks, 6=grid)
 * * `color` - Base color as [R, G, B, A] in 0-1 range
 * * `params` - PBR parameters [roughness, metallic, emission_r, emission_g, emission_b, emission_intensity]
 * * `seed` - Random seed for deterministic generation
 */
export function generate_pbr_texture(width: number, height: number, pattern: number, color: Float32Array, params: Float32Array, seed: number): PBRResult;
/**
 * Generate ambient occlusion map based on pattern
 *
 * # Arguments
 * * `output` - Output RGBA buffer (width * height * 4 bytes)
 * * `width` - Texture width
 * * `height` - Texture height
 * * `pattern` - Pattern type
 * * `seed` - Random seed
 */
export function generate_ao_map(output: Uint8Array, width: number, height: number, pattern: Pattern, seed: number): void;
/**
 * Generate flat normal map (pointing straight up)
 *
 * Useful as fallback or for completely flat surfaces
 */
export function generate_flat_normal_map(output: Uint8Array, width: number, height: number): void;
/**
 * Generate normal map from height data using Sobel operator
 *
 * # Arguments
 * * `height_data` - Height map (width * height floats in 0-1 range)
 * * `output` - Output RGBA buffer (width * height * 4 bytes)
 * * `width` - Texture width
 * * `height` - Texture height
 * * `strength` - Normal map intensity (1.0 = subtle, 3.0+ = strong)
 */
export function generate_normal_map(height_data: Float32Array, output: Uint8Array, width: number, height: number, strength: number): void;
/**
 * Generate emission map
 *
 * # Arguments
 * * `output` - Output RGBA buffer (width * height * 4 bytes)
 * * `width` - Texture width
 * * `height` - Texture height
 * * `color` - Emission color [R, G, B] in 0-1 range
 * * `intensity` - Emission intensity multiplier
 * * `pattern` - Pattern type (0=solid, 1=smooth, 2=noise, 3=worley)
 * * `seed` - Random seed
 */
export function generate_emission_map(output: Uint8Array, width: number, height: number, color: Float32Array, intensity: number, pattern: number, seed: number): void;
/**
 * Generate black emission map (no emission)
 */
export function generate_no_emission(output: Uint8Array, width: number, height: number): void;
/**
 * Generate metallic map based on pattern
 *
 * # Arguments
 * * `output` - Output RGBA buffer (width * height * 4 bytes)
 * * `width` - Texture width
 * * `height` - Texture height
 * * `base_metallic` - Base metallic value (0-1)
 * * `pattern` - Pattern type (affects variation)
 * * `seed` - Random seed
 */
export function generate_metallic_map(output: Uint8Array, width: number, height: number, base_metallic: number, pattern: Pattern, seed: number): void;
/**
 * Generate roughness map with noise variation
 *
 * # Arguments
 * * `output` - Output RGBA buffer (width * height * 4 bytes)
 * * `width` - Texture width
 * * `height` - Texture height
 * * `base_roughness` - Base roughness value (0-1)
 * * `noise_scale` - Scale of noise pattern
 * * `noise_strength` - Strength of noise variation (0-1)
 * * `seed` - Random seed
 */
export function generate_roughness_map(output: Uint8Array, width: number, height: number, base_roughness: number, noise_scale: number, noise_strength: number, seed: number): void;
/**
 * Generate uniform roughness map
 */
export function generate_uniform_roughness(output: Uint8Array, width: number, height: number, roughness: number): void;
/**
 * Pack rectangles into an atlas
 *
 * # Arguments
 * * `widths` - Array of rectangle widths
 * * `heights` - Array of rectangle heights
 * * `max_atlas_size` - Maximum atlas dimension
 * * `padding` - Padding between rectangles
 *
 * # Returns
 * PackResult with positions and atlas dimensions
 */
export function pack_rectangles(widths: Uint32Array, heights: Uint32Array, max_atlas_size: number, padding: number): PackResult;
/**
 * Build atlas with automatic padding (copies edge pixels)
 */
export function build_atlas_with_padding(textures: Uint8Array, tex_sizes: Uint32Array, atlas_width: number, atlas_height: number, positions: Uint32Array, padding: number): Uint8Array;
/**
 * Build atlas texture from packed textures
 *
 * # Arguments
 * * `textures` - Concatenated RGBA data of all textures
 * * `tex_sizes` - Sizes array [w0, h0, w1, h1, ...]
 * * `atlas_width` - Atlas texture width
 * * `atlas_height` - Atlas texture height
 * * `positions` - Packed positions [x0, y0, x1, y1, ...] from pack_rectangles
 *
 * # Returns
 * Final atlas RGBA data
 */
export function build_atlas(textures: Uint8Array, tex_sizes: Uint32Array, atlas_width: number, atlas_height: number, positions: Uint32Array): Uint8Array;
/**
 * Generate 2D Perlin noise for entire image
 *
 * # Arguments
 * * `output` - Output buffer (width * height floats)
 * * `width` - Image width
 * * `height` - Image height
 * * `scale` - Noise scale (smaller = larger features)
 * * `seed` - Random seed
 */
export function perlin_2d_batch(output: Float32Array, width: number, height: number, scale: number, seed: number): void;
/**
 * 2D Perlin noise at point (x, y)
 *
 * Returns value in range [-1, 1]
 */
export function perlin_2d(x: number, y: number, seed: number): number;
/**
 * Fractal Brownian Motion using Perlin noise
 *
 * Combines multiple octaves for more natural-looking noise
 */
export function perlin_fbm(x: number, y: number, seed: number, octaves: number, lacunarity: number, persistence: number): number;
/**
 * Inverted Worley noise (1 - distance)
 *
 * Creates bright spots at cell centers
 */
export function worley_inverted(x: number, y: number, seed: number): number;
/**
 * F1-F2 Worley noise (second nearest minus nearest)
 *
 * Creates more interesting patterns with ridges
 */
export function worley_f1f2(x: number, y: number, seed: number): number;
/**
 * 2D Worley noise at point (x, y)
 *
 * Returns distance to nearest feature point, normalized to approximately [0, 1]
 */
export function worley_2d(x: number, y: number, seed: number): number;
/**
 * Generate 2D Worley noise for entire image
 *
 * # Arguments
 * * `output` - Output buffer (width * height floats)
 * * `width` - Image width
 * * `height` - Image height
 * * `scale` - Noise scale (smaller = larger cells)
 * * `seed` - Random seed
 */
export function worley_2d_batch(output: Float32Array, width: number, height: number, scale: number, seed: number): void;
/**
 * Generate 2D Simplex noise for entire image
 *
 * # Arguments
 * * `output` - Output buffer (width * height floats)
 * * `width` - Image width
 * * `height` - Image height
 * * `scale` - Noise scale (smaller = larger features)
 * * `seed` - Random seed
 */
export function simplex_2d_batch(output: Float32Array, width: number, height: number, scale: number, seed: number): void;
/**
 * Fractal Brownian Motion using Simplex noise
 */
export function simplex_fbm(x: number, y: number, seed: number, octaves: number, lacunarity: number, persistence: number): number;
/**
 * 2D Simplex noise at point (x, y)
 *
 * Returns value in range [-1, 1]
 */
export function simplex_2d(x: number, y: number, seed: number): number;
/**
 * Calculate number of mip levels for given dimensions
 */
export function calculate_mip_count(width: number, height: number): number;
/**
 * Generate mipmaps using Lanczos filter (high quality)
 *
 * # Arguments
 * * `base_data` - Base level RGBA data
 * * `width` - Base level width
 * * `height` - Base level height
 * * `radius` - Lanczos filter radius (2 or 3 recommended)
 *
 * # Returns
 * All mipmap levels concatenated
 */
export function generate_mipmaps_lanczos(base_data: Uint8Array, width: number, height: number, radius: number): Uint8Array;
/**
 * Generate mipmaps using box filter (fast, 2x2 averaging)
 *
 * # Arguments
 * * `base_data` - Base level RGBA data
 * * `width` - Base level width
 * * `height` - Base level height
 *
 * # Returns
 * All mipmap levels concatenated (including base level)
 */
export function generate_mipmaps_box(base_data: Uint8Array, width: number, height: number): Uint8Array;
/**
 * Get offset and size for specific mip level
 */
export function get_mip_info(base_width: number, base_height: number, level: number): Uint32Array;
/**
 * Distance metric types
 */
export enum DistanceMetric {
  Euclidean = 0,
  Manhattan = 1,
  Chebyshev = 2,
}
/**
 * Pattern types for procedural generation
 */
export enum Pattern {
  Solid = 0,
  Smooth = 1,
  Noise = 2,
  Cobble = 3,
  Bricks = 4,
  Planks = 5,
  Grid = 6,
}
/**
 * PBR texture generation result containing all maps
 */
export class PBRResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  ao(): Uint8Array;
  width(): number;
  albedo(): Uint8Array;
  height(): number;
  normal(): Uint8Array;
  emission(): Uint8Array;
  metallic(): Uint8Array;
  roughness(): Uint8Array;
}
/**
 * Result of rectangle packing operation
 */
export class PackResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Get atlas width
   */
  atlas_width(): number;
  /**
   * Get atlas height
   */
  atlas_height(): number;
  /**
   * Get number of packed rectangles
   */
  packed_count(): number;
  /**
   * Get packed positions array
   */
  positions(): Uint32Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_packresult_free: (a: number, b: number) => void;
  readonly __wbg_pbrresult_free: (a: number, b: number) => void;
  readonly build_atlas: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
  readonly build_atlas_with_padding: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
  readonly calculate_mip_count: (a: number, b: number) => number;
  readonly generate_ao_map: (a: number, b: number, c: any, d: number, e: number, f: number, g: number) => void;
  readonly generate_emission_map: (a: number, b: number, c: any, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
  readonly generate_flat_normal_map: (a: number, b: number, c: any, d: number, e: number) => void;
  readonly generate_metallic_map: (a: number, b: number, c: any, d: number, e: number, f: number, g: number, h: number) => void;
  readonly generate_mipmaps_box: (a: number, b: number, c: number, d: number) => [number, number];
  readonly generate_mipmaps_lanczos: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly generate_no_emission: (a: number, b: number, c: any, d: number, e: number) => void;
  readonly generate_normal_map: (a: number, b: number, c: number, d: number, e: any, f: number, g: number, h: number) => void;
  readonly generate_pbr_texture: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
  readonly generate_roughness_map: (a: number, b: number, c: any, d: number, e: number, f: number, g: number, h: number, i: number) => void;
  readonly generate_uniform_roughness: (a: number, b: number, c: any, d: number, e: number, f: number) => void;
  readonly get_mip_info: (a: number, b: number, c: number) => [number, number];
  readonly pack_rectangles: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly packresult_atlas_height: (a: number) => number;
  readonly packresult_atlas_width: (a: number) => number;
  readonly packresult_packed_count: (a: number) => number;
  readonly packresult_positions: (a: number) => [number, number];
  readonly pbrresult_albedo: (a: number) => [number, number];
  readonly pbrresult_ao: (a: number) => [number, number];
  readonly pbrresult_emission: (a: number) => [number, number];
  readonly pbrresult_height: (a: number) => number;
  readonly pbrresult_metallic: (a: number) => [number, number];
  readonly pbrresult_normal: (a: number) => [number, number];
  readonly pbrresult_roughness: (a: number) => [number, number];
  readonly pbrresult_width: (a: number) => number;
  readonly perlin_2d: (a: number, b: number, c: number) => number;
  readonly perlin_2d_batch: (a: number, b: number, c: any, d: number, e: number, f: number, g: number) => void;
  readonly perlin_fbm: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly simplex_2d: (a: number, b: number, c: number) => number;
  readonly simplex_2d_batch: (a: number, b: number, c: any, d: number, e: number, f: number, g: number) => void;
  readonly simplex_fbm: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly worley_2d_batch: (a: number, b: number, c: any, d: number, e: number, f: number, g: number) => void;
  readonly worley_f1f2: (a: number, b: number, c: number) => number;
  readonly worley_inverted: (a: number, b: number, c: number) => number;
  readonly worley_2d: (a: number, b: number, c: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
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
