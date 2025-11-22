let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}


let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
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

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @param {Float32Array} c_base
 * @param {Float32Array} c_tip
 * @param {number} c_radius
 * @param {Float32Array} s_center
 * @param {number} s_radius
 * @returns {boolean}
 */
export function capsule_sphere_intersect(c_base, c_tip, c_radius, s_center, s_radius) {
    const ptr0 = passArrayF32ToWasm0(c_base, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(c_tip, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(s_center, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.capsule_sphere_intersect(ptr0, len0, ptr1, len1, c_radius, ptr2, len2, s_radius);
    return ret !== 0;
}

/**
 * @param {Float32Array} a_center
 * @param {number} a_radius
 * @param {Float32Array} b_center
 * @param {number} b_radius
 * @returns {boolean}
 */
export function sphere_sphere_intersect(a_center, a_radius, b_center, b_radius) {
    const ptr0 = passArrayF32ToWasm0(a_center, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(b_center, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.sphere_sphere_intersect(ptr0, len0, a_radius, ptr1, len1, b_radius);
    return ret !== 0;
}

/**
 * @param {Float32Array} ray_origin
 * @param {Float32Array} ray_dir
 * @param {Float32Array} s_center
 * @param {number} s_radius
 * @returns {number}
 */
export function ray_sphere_intersect(ray_origin, ray_dir, s_center, s_radius) {
    const ptr0 = passArrayF32ToWasm0(ray_origin, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(ray_dir, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(s_center, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.ray_sphere_intersect(ptr0, len0, ptr1, len1, ptr2, len2, s_radius);
    return ret;
}

/**
 * @param {Float32Array} a_center
 * @param {Float32Array} a_axes
 * @param {Float32Array} a_half
 * @param {Float32Array} b_center
 * @param {Float32Array} b_axes
 * @param {Float32Array} b_half
 * @returns {boolean}
 */
export function obb_intersect(a_center, a_axes, a_half, b_center, b_axes, b_half) {
    const ptr0 = passArrayF32ToWasm0(a_center, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(a_axes, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(a_half, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(b_center, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(b_axes, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF32ToWasm0(b_half, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.obb_intersect(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
    return ret !== 0;
}

/**
 * @param {Float32Array} pre_pos
 * @param {Float32Array} pre_rot
 * @param {Float32Array} pre_scl
 * @param {Float32Array} others_pos
 * @param {Float32Array} others_rot
 * @param {Float32Array} others_scl
 * @returns {Uint32Array}
 */
export function batch_check_trs(pre_pos, pre_rot, pre_scl, others_pos, others_rot, others_scl) {
    const ptr0 = passArrayF32ToWasm0(pre_pos, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(pre_rot, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(pre_scl, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(others_pos, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(others_rot, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF32ToWasm0(others_scl, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.batch_check_trs(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
    var v7 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v7;
}

/**
 * @param {Float32Array} world_mats
 * @param {Float32Array} half_extents
 * @returns {Float32Array | undefined}
 */
export function compute_scene_bounds(world_mats, half_extents) {
    const ptr0 = passArrayF32ToWasm0(world_mats, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(half_extents, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.compute_scene_bounds(ptr0, len0, ptr1, len1);
    let v3;
    if (ret[0] !== 0) {
        v3 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    }
    return v3;
}

/**
 * @param {Float32Array} s_center
 * @param {number} s_radius
 * @param {Float32Array} b_center
 * @param {Float32Array} b_axes
 * @param {Float32Array} b_half
 * @returns {boolean}
 */
export function sphere_obb_intersect(s_center, s_radius, b_center, b_axes, b_half) {
    const ptr0 = passArrayF32ToWasm0(s_center, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(b_center, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(b_axes, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(b_half, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.sphere_obb_intersect(ptr0, len0, s_radius, ptr1, len1, ptr2, len2, ptr3, len3);
    return ret !== 0;
}

/**
 * @param {Float32Array} a_base
 * @param {Float32Array} a_tip
 * @param {number} a_radius
 * @param {Float32Array} b_base
 * @param {Float32Array} b_tip
 * @param {number} b_radius
 * @returns {boolean}
 */
export function capsule_capsule_intersect(a_base, a_tip, a_radius, b_base, b_tip, b_radius) {
    const ptr0 = passArrayF32ToWasm0(a_base, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(a_tip, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(b_base, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(b_tip, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.capsule_capsule_intersect(ptr0, len0, ptr1, len1, a_radius, ptr2, len2, ptr3, len3, b_radius);
    return ret !== 0;
}

/**
 * @param {Float32Array} pre_pos
 * @param {Float32Array} pre_rot
 * @param {Float32Array} pre_scl
 * @param {Float32Array} others_pos
 * @param {Float32Array} others_rot
 * @param {Float32Array} others_scl
 * @returns {Uint32Array}
 */
export function batch_check_trs_linear(pre_pos, pre_rot, pre_scl, others_pos, others_rot, others_scl) {
    const ptr0 = passArrayF32ToWasm0(pre_pos, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(pre_rot, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(pre_scl, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(others_pos, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(others_rot, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF32ToWasm0(others_scl, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.batch_check_trs_linear(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
    var v7 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v7;
}

/**
 * @param {Float32Array} pre_center
 * @param {Float32Array} pre_axes
 * @param {Float32Array} pre_half
 * @param {Float32Array} others_centers
 * @param {Float32Array} others_axes
 * @param {Float32Array} others_half
 * @returns {Uint32Array}
 */
export function batch_check(pre_center, pre_axes, pre_half, others_centers, others_axes, others_half) {
    const ptr0 = passArrayF32ToWasm0(pre_center, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(pre_axes, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(pre_half, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(others_centers, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(others_axes, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF32ToWasm0(others_half, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.batch_check(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5);
    var v7 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v7;
}

/**
 * @param {Float32Array} ray_origin
 * @param {Float32Array} ray_dir
 * @param {Float32Array} b_center
 * @param {Float32Array} b_axes
 * @param {Float32Array} b_half
 * @returns {number}
 */
export function ray_obb_intersect(ray_origin, ray_dir, b_center, b_axes, b_half) {
    const ptr0 = passArrayF32ToWasm0(ray_origin, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(ray_dir, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(b_center, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(b_axes, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(b_half, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ret = wasm.ray_obb_intersect(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
    return ret;
}

/**
 * @param {Float32Array} pos
 * @param {Float32Array} rot
 * @param {Float32Array} scl
 * @returns {Uint32Array}
 */
export function batch_check_all(pos, rot, scl) {
    const ptr0 = passArrayF32ToWasm0(pos, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(rot, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(scl, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.batch_check_all(ptr0, len0, ptr1, len1, ptr2, len2);
    var v4 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v4;
}

/**
 * @param {Float32Array} c_base
 * @param {Float32Array} c_tip
 * @param {number} c_radius
 * @param {Float32Array} b_center
 * @param {Float32Array} b_axes
 * @param {Float32Array} b_half
 * @returns {boolean}
 */
export function capsule_obb_intersect(c_base, c_tip, c_radius, b_center, b_axes, b_half) {
    const ptr0 = passArrayF32ToWasm0(c_base, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(c_tip, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(b_center, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(b_axes, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(b_half, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ret = wasm.capsule_obb_intersect(ptr0, len0, ptr1, len1, c_radius, ptr2, len2, ptr3, len3, ptr4, len4);
    return ret !== 0;
}

const CollisionWorldFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_collisionworld_free(ptr >>> 0, 1));

export class CollisionWorld {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CollisionWorldFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_collisionworld_free(ptr, 0);
    }
    /**
     * @param {Float32Array} view_proj
     * @returns {Uint32Array}
     */
    query_frustum(view_proj) {
        const ptr0 = passArrayF32ToWasm0(view_proj, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.collisionworld_query_frustum(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v2;
    }
    /**
     * @param {Float32Array} origin
     * @param {Float32Array} dir
     * @returns {Float32Array | undefined}
     */
    raycast_world(origin, dir) {
        const ptr0 = passArrayF32ToWasm0(origin, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(dir, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.collisionworld_raycast_world(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        let v3;
        if (ret[0] !== 0) {
            v3 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        }
        return v3;
    }
    /**
     * @returns {number}
     */
    get_scales_ptr() {
        const ret = wasm.collisionworld_get_scales_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {Uint32Array}
     */
    check_collisions() {
        const ret = wasm.collisionworld_check_collisions(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {number}
     */
    get_positions_ptr() {
        const ret = wasm.collisionworld_get_positions_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get_rotations_ptr() {
        const ret = wasm.collisionworld_get_rotations_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Rasterize a set of entities (indices) as occluders.
     * These entities will be rendered into the depth buffer as solid boxes.
     * @param {Uint32Array} indices
     * @param {Float32Array} view_proj
     */
    rasterize_occluders(indices, view_proj) {
        const ptr0 = passArray32ToWasm0(indices, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm0(view_proj, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.collisionworld_rasterize_occluders(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * Clear occlusion buffer.
     */
    clear_occlusion_buffer() {
        wasm.collisionworld_clear_occlusion_buffer(this.__wbg_ptr);
    }
    /**
     * Initialize occlusion buffer with given dimensions (e.g., 256x128).
     * @param {number} width
     * @param {number} height
     */
    init_occlusion_culling(width, height) {
        wasm.collisionworld_init_occlusion_culling(this.__wbg_ptr, width, height);
    }
    constructor() {
        const ret = wasm.collisionworld_new();
        this.__wbg_ptr = ret >>> 0;
        CollisionWorldFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {number} count
     */
    resize(count) {
        wasm.collisionworld_resize(this.__wbg_ptr, count);
    }
}
if (Symbol.dispose) CollisionWorld.prototype[Symbol.dispose] = CollisionWorld.prototype.free;

export function __wbg_wbindgenthrow_451ec1a8469d7eb6(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_export_0;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
    ;
};

