let wasm;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedFloat32ArrayMemory0 = null;

function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let WASM_VECTOR_LEN = 0;

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
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
 * @param {number} width
 * @param {number} height
 * @param {number} pattern
 * @param {Float32Array} color
 * @param {Float32Array} params
 * @param {number} seed
 * @returns {PBRResult}
 */
export function generate_pbr_texture(width, height, pattern, color, params, seed) {
    const ptr0 = passArrayF32ToWasm0(color, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(params, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.generate_pbr_texture(width, height, pattern, ptr0, len0, ptr1, len1, seed);
    return PBRResult.__wrap(ret);
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * Generate ambient occlusion map based on pattern
 *
 * # Arguments
 * * `output` - Output RGBA buffer (width * height * 4 bytes)
 * * `width` - Texture width
 * * `height` - Texture height
 * * `pattern` - Pattern type
 * * `seed` - Random seed
 * @param {Uint8Array} output
 * @param {number} width
 * @param {number} height
 * @param {Pattern} pattern
 * @param {number} seed
 */
export function generate_ao_map(output, width, height, pattern, seed) {
    var ptr0 = passArray8ToWasm0(output, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.generate_ao_map(ptr0, len0, output, width, height, pattern, seed);
}

/**
 * Generate flat normal map (pointing straight up)
 *
 * Useful as fallback or for completely flat surfaces
 * @param {Uint8Array} output
 * @param {number} width
 * @param {number} height
 */
export function generate_flat_normal_map(output, width, height) {
    var ptr0 = passArray8ToWasm0(output, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.generate_flat_normal_map(ptr0, len0, output, width, height);
}

/**
 * Generate normal map from height data using Sobel operator
 *
 * # Arguments
 * * `height_data` - Height map (width * height floats in 0-1 range)
 * * `output` - Output RGBA buffer (width * height * 4 bytes)
 * * `width` - Texture width
 * * `height` - Texture height
 * * `strength` - Normal map intensity (1.0 = subtle, 3.0+ = strong)
 * @param {Float32Array} height_data
 * @param {Uint8Array} output
 * @param {number} width
 * @param {number} height
 * @param {number} strength
 */
export function generate_normal_map(height_data, output, width, height, strength) {
    const ptr0 = passArrayF32ToWasm0(height_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    var ptr1 = passArray8ToWasm0(output, wasm.__wbindgen_malloc);
    var len1 = WASM_VECTOR_LEN;
    wasm.generate_normal_map(ptr0, len0, ptr1, len1, output, width, height, strength);
}

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
 * @param {Uint8Array} output
 * @param {number} width
 * @param {number} height
 * @param {Float32Array} color
 * @param {number} intensity
 * @param {number} pattern
 * @param {number} seed
 */
export function generate_emission_map(output, width, height, color, intensity, pattern, seed) {
    var ptr0 = passArray8ToWasm0(output, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(color, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    wasm.generate_emission_map(ptr0, len0, output, width, height, ptr1, len1, intensity, pattern, seed);
}

/**
 * Generate black emission map (no emission)
 * @param {Uint8Array} output
 * @param {number} width
 * @param {number} height
 */
export function generate_no_emission(output, width, height) {
    var ptr0 = passArray8ToWasm0(output, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.generate_no_emission(ptr0, len0, output, width, height);
}

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
 * @param {Uint8Array} output
 * @param {number} width
 * @param {number} height
 * @param {number} base_metallic
 * @param {Pattern} pattern
 * @param {number} seed
 */
export function generate_metallic_map(output, width, height, base_metallic, pattern, seed) {
    var ptr0 = passArray8ToWasm0(output, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.generate_metallic_map(ptr0, len0, output, width, height, base_metallic, pattern, seed);
}

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
 * @param {Uint8Array} output
 * @param {number} width
 * @param {number} height
 * @param {number} base_roughness
 * @param {number} noise_scale
 * @param {number} noise_strength
 * @param {number} seed
 */
export function generate_roughness_map(output, width, height, base_roughness, noise_scale, noise_strength, seed) {
    var ptr0 = passArray8ToWasm0(output, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.generate_roughness_map(ptr0, len0, output, width, height, base_roughness, noise_scale, noise_strength, seed);
}

/**
 * Generate uniform roughness map
 * @param {Uint8Array} output
 * @param {number} width
 * @param {number} height
 * @param {number} roughness
 */
export function generate_uniform_roughness(output, width, height, roughness) {
    var ptr0 = passArray8ToWasm0(output, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.generate_uniform_roughness(ptr0, len0, output, width, height, roughness);
}

let cachedUint32ArrayMemory0 = null;

function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
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
 * @param {Uint32Array} widths
 * @param {Uint32Array} heights
 * @param {number} max_atlas_size
 * @param {number} padding
 * @returns {PackResult}
 */
export function pack_rectangles(widths, heights, max_atlas_size, padding) {
    const ptr0 = passArray32ToWasm0(widths, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(heights, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.pack_rectangles(ptr0, len0, ptr1, len1, max_atlas_size, padding);
    return PackResult.__wrap(ret);
}

/**
 * Build atlas with automatic padding (copies edge pixels)
 * @param {Uint8Array} textures
 * @param {Uint32Array} tex_sizes
 * @param {number} atlas_width
 * @param {number} atlas_height
 * @param {Uint32Array} positions
 * @param {number} padding
 * @returns {Uint8Array}
 */
export function build_atlas_with_padding(textures, tex_sizes, atlas_width, atlas_height, positions, padding) {
    const ptr0 = passArray8ToWasm0(textures, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(tex_sizes, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray32ToWasm0(positions, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.build_atlas_with_padding(ptr0, len0, ptr1, len1, atlas_width, atlas_height, ptr2, len2, padding);
    var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v4;
}

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
 * @param {Uint8Array} textures
 * @param {Uint32Array} tex_sizes
 * @param {number} atlas_width
 * @param {number} atlas_height
 * @param {Uint32Array} positions
 * @returns {Uint8Array}
 */
export function build_atlas(textures, tex_sizes, atlas_width, atlas_height, positions) {
    const ptr0 = passArray8ToWasm0(textures, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray32ToWasm0(tex_sizes, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray32ToWasm0(positions, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.build_atlas(ptr0, len0, ptr1, len1, atlas_width, atlas_height, ptr2, len2);
    var v4 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v4;
}

/**
 * Generate 2D Perlin noise for entire image
 *
 * # Arguments
 * * `output` - Output buffer (width * height floats)
 * * `width` - Image width
 * * `height` - Image height
 * * `scale` - Noise scale (smaller = larger features)
 * * `seed` - Random seed
 * @param {Float32Array} output
 * @param {number} width
 * @param {number} height
 * @param {number} scale
 * @param {number} seed
 */
export function perlin_2d_batch(output, width, height, scale, seed) {
    var ptr0 = passArrayF32ToWasm0(output, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.perlin_2d_batch(ptr0, len0, output, width, height, scale, seed);
}

/**
 * 2D Perlin noise at point (x, y)
 *
 * Returns value in range [-1, 1]
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @returns {number}
 */
export function perlin_2d(x, y, seed) {
    const ret = wasm.perlin_2d(x, y, seed);
    return ret;
}

/**
 * Fractal Brownian Motion using Perlin noise
 *
 * Combines multiple octaves for more natural-looking noise
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @param {number} octaves
 * @param {number} lacunarity
 * @param {number} persistence
 * @returns {number}
 */
export function perlin_fbm(x, y, seed, octaves, lacunarity, persistence) {
    const ret = wasm.perlin_fbm(x, y, seed, octaves, lacunarity, persistence);
    return ret;
}

/**
 * Inverted Worley noise (1 - distance)
 *
 * Creates bright spots at cell centers
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @returns {number}
 */
export function worley_inverted(x, y, seed) {
    const ret = wasm.worley_inverted(x, y, seed);
    return ret;
}

/**
 * F1-F2 Worley noise (second nearest minus nearest)
 *
 * Creates more interesting patterns with ridges
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @returns {number}
 */
export function worley_f1f2(x, y, seed) {
    const ret = wasm.worley_f1f2(x, y, seed);
    return ret;
}

/**
 * 2D Worley noise at point (x, y)
 *
 * Returns distance to nearest feature point, normalized to approximately [0, 1]
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @returns {number}
 */
export function worley_2d(x, y, seed) {
    const ret = wasm.worley_2d(x, y, seed);
    return ret;
}

/**
 * Generate 2D Worley noise for entire image
 *
 * # Arguments
 * * `output` - Output buffer (width * height floats)
 * * `width` - Image width
 * * `height` - Image height
 * * `scale` - Noise scale (smaller = larger cells)
 * * `seed` - Random seed
 * @param {Float32Array} output
 * @param {number} width
 * @param {number} height
 * @param {number} scale
 * @param {number} seed
 */
export function worley_2d_batch(output, width, height, scale, seed) {
    var ptr0 = passArrayF32ToWasm0(output, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.worley_2d_batch(ptr0, len0, output, width, height, scale, seed);
}

/**
 * Generate 2D Simplex noise for entire image
 *
 * # Arguments
 * * `output` - Output buffer (width * height floats)
 * * `width` - Image width
 * * `height` - Image height
 * * `scale` - Noise scale (smaller = larger features)
 * * `seed` - Random seed
 * @param {Float32Array} output
 * @param {number} width
 * @param {number} height
 * @param {number} scale
 * @param {number} seed
 */
export function simplex_2d_batch(output, width, height, scale, seed) {
    var ptr0 = passArrayF32ToWasm0(output, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    wasm.simplex_2d_batch(ptr0, len0, output, width, height, scale, seed);
}

/**
 * Fractal Brownian Motion using Simplex noise
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @param {number} octaves
 * @param {number} lacunarity
 * @param {number} persistence
 * @returns {number}
 */
export function simplex_fbm(x, y, seed, octaves, lacunarity, persistence) {
    const ret = wasm.simplex_fbm(x, y, seed, octaves, lacunarity, persistence);
    return ret;
}

/**
 * 2D Simplex noise at point (x, y)
 *
 * Returns value in range [-1, 1]
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @returns {number}
 */
export function simplex_2d(x, y, seed) {
    const ret = wasm.simplex_2d(x, y, seed);
    return ret;
}

/**
 * Calculate number of mip levels for given dimensions
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
export function calculate_mip_count(width, height) {
    const ret = wasm.calculate_mip_count(width, height);
    return ret >>> 0;
}

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
 * @param {Uint8Array} base_data
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @returns {Uint8Array}
 */
export function generate_mipmaps_lanczos(base_data, width, height, radius) {
    const ptr0 = passArray8ToWasm0(base_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.generate_mipmaps_lanczos(ptr0, len0, width, height, radius);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

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
 * @param {Uint8Array} base_data
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function generate_mipmaps_box(base_data, width, height) {
    const ptr0 = passArray8ToWasm0(base_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.generate_mipmaps_box(ptr0, len0, width, height);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * Get offset and size for specific mip level
 * @param {number} base_width
 * @param {number} base_height
 * @param {number} level
 * @returns {Uint32Array}
 */
export function get_mip_info(base_width, base_height, level) {
    const ret = wasm.get_mip_info(base_width, base_height, level);
    var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * Distance metric types
 * @enum {0 | 1 | 2}
 */
export const DistanceMetric = Object.freeze({
    Euclidean: 0, "0": "Euclidean",
    Manhattan: 1, "1": "Manhattan",
    Chebyshev: 2, "2": "Chebyshev",
});
/**
 * Pattern types for procedural generation
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 6}
 */
export const Pattern = Object.freeze({
    Solid: 0, "0": "Solid",
    Smooth: 1, "1": "Smooth",
    Noise: 2, "2": "Noise",
    Cobble: 3, "3": "Cobble",
    Bricks: 4, "4": "Bricks",
    Planks: 5, "5": "Planks",
    Grid: 6, "6": "Grid",
});

const PBRResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pbrresult_free(ptr >>> 0, 1));
/**
 * PBR texture generation result containing all maps
 */
export class PBRResult {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PBRResult.prototype);
        obj.__wbg_ptr = ptr;
        PBRResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PBRResultFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_pbrresult_free(ptr, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    ao() {
        const ret = wasm.pbrresult_ao(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number}
     */
    width() {
        const ret = wasm.pbrresult_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Uint8Array}
     */
    albedo() {
        const ret = wasm.pbrresult_albedo(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {number}
     */
    height() {
        const ret = wasm.pbrresult_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Uint8Array}
     */
    normal() {
        const ret = wasm.pbrresult_normal(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    emission() {
        const ret = wasm.pbrresult_emission(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    metallic() {
        const ret = wasm.pbrresult_metallic(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
    /**
     * @returns {Uint8Array}
     */
    roughness() {
        const ret = wasm.pbrresult_roughness(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) PBRResult.prototype[Symbol.dispose] = PBRResult.prototype.free;

const PackResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_packresult_free(ptr >>> 0, 1));
/**
 * Result of rectangle packing operation
 */
export class PackResult {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PackResult.prototype);
        obj.__wbg_ptr = ptr;
        PackResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PackResultFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_packresult_free(ptr, 0);
    }
    /**
     * Get atlas width
     * @returns {number}
     */
    atlas_width() {
        const ret = wasm.packresult_atlas_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Get atlas height
     * @returns {number}
     */
    atlas_height() {
        const ret = wasm.packresult_atlas_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Get number of packed rectangles
     * @returns {number}
     */
    packed_count() {
        const ret = wasm.packresult_packed_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Get packed positions array
     * @returns {Uint32Array}
     */
    positions() {
        const ret = wasm.packresult_positions(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}
if (Symbol.dispose) PackResult.prototype[Symbol.dispose] = PackResult.prototype.free;

const EXPECTED_RESPONSE_TYPES = new Set(['basic', 'cors', 'default']);

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                const validResponse = module.ok && EXPECTED_RESPONSE_TYPES.has(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg___wbindgen_copy_to_typed_array_33fbd71146904370 = function(arg0, arg1, arg2) {
        new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_externrefs;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };

    return imports;
}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('texture_processor_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
