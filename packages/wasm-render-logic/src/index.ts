import init, { 
    SSGIConfig, 
    BlueNoiseGenerator, 
    get_ssgi_uniforms,
    SSGIUniforms,
    cull_aabb_batch,
} from "../pkg/render_logic.js";

export { 
    SSGIConfig, 
    BlueNoiseGenerator, 
    get_ssgi_uniforms, 
    SSGIUniforms,
    cull_aabb_batch,
};

// Stub exports for functions that were removed from WASM but still referenced
// TODO: Re-implement these in Rust if needed for batch AABB transform + cull
export const batch_transform_aabbs = null;
export const batch_transform_and_cull_aabbs = null;
export const batch_transform_cull_get_visible_indices = null;

/**
 * Initialize the WASM module.
 * Must be called before using any WASM functions.
 */
export const initWasm = async () => {
    await init();
};

