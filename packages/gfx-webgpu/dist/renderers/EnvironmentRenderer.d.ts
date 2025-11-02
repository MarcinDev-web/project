import type { Mat4, Vec3 } from '@engine/core/math';
import type { EnvironmentComponent } from '@engine/world';
/**
 * Configuration for environment rendering pipeline
 */
interface EnvironmentRenderConfig {
    device: GPUDevice;
    presentationFormat: GPUTextureFormat;
    sampleCount?: number;
}
/**
 * EnvironmentRenderer handles skybox and atmospheric rendering
 */
export declare class EnvironmentRenderer {
    private device;
    private pipelines;
    private uniformBindGroupLayout;
    private paramsBindGroupLayout;
    private cubemapBindGroupLayout;
    private uniformBuffer;
    private paramsBuffer;
    private uniformBindGroup;
    private paramsBindGroups;
    private cubemapBindGroup;
    private cubemapSampler;
    private initialized;
    private brdfLut;
    private envCube;
    private cubemapCache;
    private iblCache;
    private iblCacheMaxSize;
    private uniformsDirty;
    private paramsDirty;
    constructor();
    /**
     * Initializes the environment renderer with WebGPU resources
     */
    initialize(config: EnvironmentRenderConfig): Promise<void>;
    /**
     * Creates a render pipeline for a specific skybox type
     */
    private createPipeline;
    /**
     * Creates a render pipeline specifically for cubemap skybox (different bind group layout)
     */
    private createCubemapPipeline;
    /**
     * Generates a hash from environment parameters for cache key
     */
    private hashEnvironmentParams;
    /**
     * Updates uniform data for the current frame
     */
    updateUniforms(inverseViewProjection: Mat4, cameraPosition: Vec3): void;
    /**
     * Validates and clamps color values
     */
    private validateColor;
    /**
     * Validates and normalizes sun direction
     */
    private validateSunDirection;
    /**
     * Validates sun intensity (allows HDR > 1.0, clamps negative values)
     */
    private validateSunIntensity;
    /**
     * Updates skybox parameters from environment component
     */
    updateParams(environment: EnvironmentComponent): void;
    /**
     * Renders the skybox/environment
     */
    render(passEncoder: GPURenderPassEncoder, environment: EnvironmentComponent): void;
    /**
     * Creates a cubemap texture from 6 individual face images
     * @param faces Array of 6 ImageBitmap or HTMLImageElement (in order: +X, -X, +Y, -Y, +Z, -Z)
     * @param path Optional path/identifier for caching
     */
    loadCubemapFromFaces(faces: Array<ImageBitmap | HTMLImageElement>, path?: string): Promise<GPUTexture>;
    /**
     * Loads HDR file and converts to cubemap texture
     * @param source File, URL, or ArrayBuffer containing HDR data
     * @param resolution Resolution for each cubemap face
     * @param path Optional path for caching
     */
    loadHdrCubemap(source: string | File | ArrayBuffer, resolution?: number, path?: string): Promise<GPUTexture>;
    /**
     * Clears cubemap from cache
     */
    clearCubemapCache(path: string): void;
    /**
     * Converts HDR equirectangular image to cubemap
     * @param hdrData HDR image data (width x height x 4 RGBA float32)
     * @param resolution Resolution for each cubemap face
     * @param path Optional path for caching
     */
    convertHdrToCubemap(hdrData: {
        width: number;
        height: number;
        data: Float32Array;
    }, resolution?: number, path?: string): Promise<GPUTexture>;
    /**
     * Cleans up GPU resources
     */
    cleanup(): void;
    getBrdfLutTexture(): GPUTexture | null;
    getEnvCubeTexture(): GPUTexture | null;
    /**
     * Gets cached IBL resources or generates new ones
     */
    private getCachedIBLResources;
    /**
     * Evicts oldest IBL cache entry if at max size
     */
    private evictOldestIBLCache;
    /**
     * Generates IBL resources: BRDF LUT (2D) and environment cubemap from procedural sky.
     * Returns generated textures for binding.
     * Uses cache to avoid regenerating for same environment parameters.
     */
    prepareIBLResources(environment: EnvironmentComponent, resolution?: number): Promise<{
        brdfLut: GPUTexture;
        envCube: GPUTexture;
    }>;
}
export {};
//# sourceMappingURL=EnvironmentRenderer.d.ts.map