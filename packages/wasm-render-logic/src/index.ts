import init, { 
    SSGIConfig, 
    BlueNoiseGenerator, 
    get_ssgi_uniforms,
    SSGIUniforms,
    cull_aabb_batch
} from "../pkg/render_logic.js";

export { 
    SSGIConfig, 
    BlueNoiseGenerator, 
    get_ssgi_uniforms, 
    SSGIUniforms,
    cull_aabb_batch
};

export const initWasm = async () => {
    await init();
};

