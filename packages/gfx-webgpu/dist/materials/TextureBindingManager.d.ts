export interface FallbackTextures {
    white: GPUTexture;
    black: GPUTexture;
    flatNormal: GPUTexture;
}
/**
 * Manages allocation of texture binding layouts and creation of fallback textures.
 * Does not change the existing renderer pipeline; provides helpers for future integration.
 */
export declare class TextureBindingManager {
    private device;
    private fallbacks;
    constructor(device: GPUDevice);
    /** Creates and caches 1x1 fallback textures (white, black, flat normal). */
    getFallbacks(): FallbackTextures;
    /**
     * Creates a bind group layout with 1 sampler plus N sampled textures.
     * Defaults to 2 textures to mirror the current atlas + normal-atlas layout.
     */
    createLayout(sampledTextureCount?: number): GPUBindGroupLayout;
    /**
     * Creates a bind group for provided textures using the given layout.
     * Expects layout with binding 0 = sampler, 1..N = textures.
     */
    createBindGroup(layout: GPUBindGroupLayout, sampler: GPUSampler, textures: GPUTexture[]): GPUBindGroup;
}
//# sourceMappingURL=TextureBindingManager.d.ts.map