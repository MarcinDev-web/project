/**
 * Occlusion Culling Pass
 *
 * GPU-based occlusion culling using Hi-Z buffer and occlusion queries.
 * Reduces overdraw by culling objects hidden behind other geometry.
 *
 * Two-phase approach:
 * 1. Render occluders (large opaque objects) to depth buffer
 * 2. Test occludees against depth buffer, cull hidden objects
 */
import type { Entity } from '@engine/world';
export interface OcclusionCullingConfig {
    enabled: boolean;
    useHiZBuffer: boolean;
    useOcclusionQueries: boolean;
    occluderSizeThreshold: number;
    hiZMipLevels: number;
}
export interface OcclusionTestResult {
    visibleEntities: Entity[];
    culledCount: number;
    occluderCount: number;
}
/**
 * OcclusionCullingPass manages GPU-based occlusion culling.
 */
export declare class OcclusionCullingPass {
    private config;
    private device;
    private hiZTexture;
    private hiZSampler;
    private hiZPipeline;
    private hiZBindGroupLayout;
    private currentSize;
    private occlusionQuerySet;
    private occlusionResolveBuffer;
    private occlusionReadBuffer;
    private maxOcclusionQueries;
    constructor(device: GPUDevice, config?: Partial<OcclusionCullingConfig>);
    /**
     * Initializes the occlusion culling system.
     */
    initialize(width: number, height: number): Promise<void>;
    /**
     * Performs occlusion culling on a list of entities.
     * Returns visible entities after culling.
     */
    performCulling(entities: Entity[], depthTexture: GPUTexture, encoder: GPUCommandEncoder): OcclusionTestResult;
    /**
     * Resizes internal buffers when viewport changes.
     */
    resize(width: number, height: number): void;
    /**
     * Disposes resources.
     */
    dispose(): void;
    /**
     * Categorizes entities into occluders and occludees.
     */
    private categorizeEntities;
    /**
     * Initializes Hi-Z (Hierarchical Depth) buffer.
     */
    private initializeHiZBuffer;
    /**
     * Creates compute pipeline for Hi-Z buffer generation.
     */
    private createHiZPipeline;
    /**
     * Generates Hi-Z buffer from depth texture.
     */
    private generateHiZBuffer;
    /**
     * Tests entities for occlusion.
     * Returns visible entities.
     */
    private testOcclusion;
    /**
     * Initializes occlusion query resources.
     */
    private initializeOcclusionQueries;
    /**
     * Destroys Hi-Z buffer resources.
     */
    private destroyHiZBuffer;
    /**
     * Gets current configuration.
     */
    getConfig(): OcclusionCullingConfig;
    /**
     * Updates configuration.
     */
    updateConfig(config: Partial<OcclusionCullingConfig>): void;
}
//# sourceMappingURL=OcclusionCullingPass.d.ts.map