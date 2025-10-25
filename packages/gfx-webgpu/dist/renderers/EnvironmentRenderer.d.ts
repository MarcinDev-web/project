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
    private uniformBuffer;
    private paramsBuffer;
    private uniformBindGroup;
    private paramsBindGroups;
    private initialized;
    private brdfLut;
    private envCube;
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
     * Updates uniform data for the current frame
     */
    updateUniforms(inverseViewProjection: Mat4, cameraPosition: Vec3): void;
    /**
     * Updates skybox parameters from environment component
     */
    updateParams(environment: EnvironmentComponent): void;
    /**
     * Renders the skybox/environment
     */
    render(passEncoder: GPURenderPassEncoder, environment: EnvironmentComponent): void;
    /**
     * Cleans up GPU resources
     */
    cleanup(): void;
    getBrdfLutTexture(): GPUTexture | null;
    getEnvCubeTexture(): GPUTexture | null;
    /**
     * Generates IBL resources: BRDF LUT (2D) and environment cubemap from procedural sky.
     * Returns generated textures for binding.
     */
    prepareIBLResources(resolution?: number): Promise<{
        brdfLut: GPUTexture;
        envCube: GPUTexture;
    }>;
}
export {};
//# sourceMappingURL=EnvironmentRenderer.d.ts.map