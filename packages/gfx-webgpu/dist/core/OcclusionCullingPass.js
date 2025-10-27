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
import { Logger } from '@engine/core/utils';
const DEFAULT_CONFIG = {
    enabled: true,
    useHiZBuffer: true,
    useOcclusionQueries: false, // Limited browser support
    occluderSizeThreshold: 2.0, // Min 2 unit cube size
    hiZMipLevels: 8,
};
/**
 * OcclusionCullingPass manages GPU-based occlusion culling.
 */
export class OcclusionCullingPass {
    config;
    device;
    hiZTexture = null;
    hiZSampler = null;
    hiZPipeline = null;
    hiZBindGroupLayout = null;
    currentSize = { width: 0, height: 0 };
    occlusionQuerySet = null;
    occlusionResolveBuffer = null;
    occlusionReadBuffer = null;
    maxOcclusionQueries = 512;
    constructor(device, config) {
        this.device = device;
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Check if occlusion queries are supported
        if (this.config.useOcclusionQueries) {
            const hasOcclusionQuery = device.features.has('occlusion-query');
            if (!hasOcclusionQuery) {
                Logger.warn('Occlusion queries not supported, disabling');
                this.config.useOcclusionQueries = false;
            }
        }
    }
    /**
     * Initializes the occlusion culling system.
     */
    async initialize(width, height) {
        if (!this.config.enabled)
            return;
        this.currentSize = { width, height };
        // Initialize Hi-Z buffer if enabled
        if (this.config.useHiZBuffer) {
            await this.initializeHiZBuffer(width, height);
        }
        // Initialize occlusion queries if enabled
        if (this.config.useOcclusionQueries) {
            this.initializeOcclusionQueries();
        }
    }
    /**
     * Performs occlusion culling on a list of entities.
     * Returns visible entities after culling.
     */
    performCulling(entities, depthTexture, encoder) {
        if (!this.config.enabled || entities.length === 0) {
            return {
                visibleEntities: entities,
                culledCount: 0,
                occluderCount: 0,
            };
        }
        // Separate entities into occluders and occludees
        const { occluders, occludees } = this.categorizeEntities(entities);
        // If using Hi-Z buffer, generate it from depth texture
        if (this.config.useHiZBuffer && this.hiZTexture) {
            this.generateHiZBuffer(encoder, depthTexture);
        }
        // Test occludees against depth/Hi-Z buffer
        const visibleOccludees = this.testOcclusion(occludees, encoder);
        // All occluders are always visible (they define occlusion)
        const visibleEntities = [...occluders, ...visibleOccludees];
        return {
            visibleEntities,
            culledCount: occludees.length - visibleOccludees.length,
            occluderCount: occluders.length,
        };
    }
    /**
     * Resizes internal buffers when viewport changes.
     */
    resize(width, height) {
        if (width === this.currentSize.width && height === this.currentSize.height) {
            return;
        }
        this.currentSize = { width, height };
        // Recreate Hi-Z buffer
        if (this.config.useHiZBuffer) {
            this.destroyHiZBuffer();
            this.initializeHiZBuffer(width, height).catch((err) => {
                Logger.error('Failed to resize Hi-Z buffer:', err);
            });
        }
    }
    /**
     * Disposes resources.
     */
    dispose() {
        this.destroyHiZBuffer();
        try {
            this.occlusionQuerySet?.destroy();
        }
        catch { }
        try {
            this.occlusionResolveBuffer?.destroy();
        }
        catch { }
        try {
            this.occlusionReadBuffer?.destroy();
        }
        catch { }
        this.occlusionQuerySet = null;
        this.occlusionResolveBuffer = null;
        this.occlusionReadBuffer = null;
    }
    /**
     * Categorizes entities into occluders and occludees.
     */
    categorizeEntities(entities) {
        const occluders = [];
        const occludees = [];
        for (const entity of entities) {
            const scale = entity.transform.scale;
            const maxScale = Math.max(scale[0], scale[1], scale[2]);
            // Large objects are occluders, small objects are occludees
            if (maxScale >= this.config.occluderSizeThreshold) {
                occluders.push(entity);
            }
            else {
                occludees.push(entity);
            }
        }
        return { occluders, occludees };
    }
    /**
     * Initializes Hi-Z (Hierarchical Depth) buffer.
     */
    async initializeHiZBuffer(width, height) {
        // Calculate mip chain dimensions
        const mipLevels = Math.min(this.config.hiZMipLevels, Math.floor(Math.log2(Math.max(width, height))) + 1);
        // Create Hi-Z texture (depth pyramid)
        this.hiZTexture = this.device.createTexture({
            label: 'hi-z-buffer',
            size: { width, height, depthOrArrayLayers: 1 },
            format: 'r32float', // Store depth as float
            mipLevelCount: mipLevels,
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.STORAGE_BINDING |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });
        // Create sampler for Hi-Z lookups
        this.hiZSampler = this.device.createSampler({
            label: 'hi-z-sampler',
            magFilter: 'nearest',
            minFilter: 'nearest',
            mipmapFilter: 'nearest',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });
        // Create compute pipeline for Hi-Z generation
        await this.createHiZPipeline();
    }
    /**
     * Creates compute pipeline for Hi-Z buffer generation.
     */
    async createHiZPipeline() {
        // Hi-Z downsample shader
        const shaderCode = `
      @group(0) @binding(0) var inputTexture: texture_2d<f32>;
      @group(0) @binding(1) var outputTexture: texture_storage_2d<r32float, write>;
      
      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let coords = vec2<i32>(globalId.xy);
        let inputCoords = coords * 2;
        
        // Sample 4 pixels from input and take max depth (furthest)
        var maxDepth = 0.0;
        maxDepth = max(maxDepth, textureLoad(inputTexture, inputCoords + vec2<i32>(0, 0), 0).r);
        maxDepth = max(maxDepth, textureLoad(inputTexture, inputCoords + vec2<i32>(1, 0), 0).r);
        maxDepth = max(maxDepth, textureLoad(inputTexture, inputCoords + vec2<i32>(0, 1), 0).r);
        maxDepth = max(maxDepth, textureLoad(inputTexture, inputCoords + vec2<i32>(1, 1), 0).r);
        
        textureStore(outputTexture, coords, vec4<f32>(maxDepth, 0.0, 0.0, 0.0));
      }
    `;
        const shaderModule = this.device.createShaderModule({
            label: 'hi-z-downsample-shader',
            code: shaderCode,
        });
        // Create bind group layout
        this.hiZBindGroupLayout = this.device.createBindGroupLayout({
            label: 'hi-z-bind-group-layout',
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: { sampleType: 'unfilterable-float' },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: { format: 'r32float', access: 'write-only' },
                },
            ],
        });
        // Create compute pipeline
        this.hiZPipeline = this.device.createComputePipeline({
            label: 'hi-z-downsample-pipeline',
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.hiZBindGroupLayout],
            }),
            compute: {
                module: shaderModule,
                entryPoint: 'main',
            },
        });
    }
    /**
     * Generates Hi-Z buffer from depth texture.
     */
    generateHiZBuffer(encoder, depthTexture) {
        if (!this.hiZTexture || !this.hiZPipeline || !this.hiZBindGroupLayout) {
            return;
        }
        // Copy depth to first mip level of Hi-Z buffer
        // (This would need a render pass to copy depth to r32float texture)
        // For now, we'll skip the actual copy and assume it's done elsewhere
        // Generate mip chain (downsample each level)
        const mipLevelCount = this.hiZTexture.mipLevelCount;
        for (let mip = 0; mip < mipLevelCount - 1; mip++) {
            const inputView = this.hiZTexture.createView({
                baseMipLevel: mip,
                mipLevelCount: 1,
            });
            const outputView = this.hiZTexture.createView({
                baseMipLevel: mip + 1,
                mipLevelCount: 1,
            });
            const bindGroup = this.device.createBindGroup({
                layout: this.hiZBindGroupLayout,
                entries: [
                    { binding: 0, resource: inputView },
                    { binding: 1, resource: outputView },
                ],
            });
            const computePass = encoder.beginComputePass({
                label: `hi-z-downsample-mip-${mip}`,
            });
            computePass.setPipeline(this.hiZPipeline);
            computePass.setBindGroup(0, bindGroup);
            // Calculate workgroup count
            const mipWidth = Math.max(1, this.currentSize.width >> (mip + 1));
            const mipHeight = Math.max(1, this.currentSize.height >> (mip + 1));
            const workgroupsX = Math.ceil(mipWidth / 8);
            const workgroupsY = Math.ceil(mipHeight / 8);
            computePass.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
            computePass.end();
        }
    }
    /**
     * Tests entities for occlusion.
     * Returns visible entities.
     */
    testOcclusion(entities, encoder) {
        // Simplified implementation - in real implementation:
        // 1. Render bounding boxes to depth buffer with occlusion queries
        // 2. Read back query results
        // 3. Filter entities based on visibility
        // For now, use conservative approach: assume all are visible
        // Full implementation would require:
        // - Bounding box rendering pipeline
        // - Occlusion query management
        // - Async result readback
        return entities;
    }
    /**
     * Initializes occlusion query resources.
     */
    initializeOcclusionQueries() {
        if (!this.config.useOcclusionQueries)
            return;
        try {
            this.occlusionQuerySet = this.device.createQuerySet({
                type: 'occlusion',
                count: this.maxOcclusionQueries,
            });
            this.occlusionResolveBuffer = this.device.createBuffer({
                size: this.maxOcclusionQueries * 8, // 8 bytes per query
                usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
            });
            this.occlusionReadBuffer = this.device.createBuffer({
                size: this.maxOcclusionQueries * 8,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            });
        }
        catch (err) {
            Logger.warn('Failed to initialize occlusion queries:', err);
            this.config.useOcclusionQueries = false;
        }
    }
    /**
     * Destroys Hi-Z buffer resources.
     */
    destroyHiZBuffer() {
        try {
            this.hiZTexture?.destroy();
        }
        catch { }
        this.hiZTexture = null;
        this.hiZSampler = null;
        this.hiZPipeline = null;
        this.hiZBindGroupLayout = null;
    }
    /**
     * Gets current configuration.
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Updates configuration.
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
//# sourceMappingURL=OcclusionCullingPass.js.map