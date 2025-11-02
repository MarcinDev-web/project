/**
 * Frame Renderer
 *
 * Manages the per-frame rendering pipeline including:
 * - Scene updates and frustum culling
 * - Instance buffer management
 * - Render pass encoding
 * - Draw calls
 * - Environment/grid rendering
 *
 * This is the core rendering loop extracted from the main Renderer.
 */
import { MaterialComponent } from '@engine/world';
import { createDepthTexture, createMsaaColorTarget, createHdrColorTarget } from '../resources/resources';
import { FrustumCuller } from './FrustumCuller';
import { InstanceDataBuilder } from './InstanceManager';
import { GeometryCache } from './GeometryCache';
import { GPUBufferPool } from './bufferPool';
import { ComputePrepass } from './ComputePrepass';
import { EnvironmentComponent } from '@engine/world';
// TODO: Uncomment in Phase 4
// import type { LogicConnectionRenderer } from '../LogicConnectionRenderer';
import { mat4Invert, mat4FromQuatTranslation, mat4Scale } from '@engine/core/math';
import { Logger } from '@engine/core/utils';
import { CLEAR_COLOR, MSAA_SAMPLE_COUNT, TIMESTAMP_QUERY_COUNT, TIMESTAMP_BUFFER_SIZE, GPU_TIMESTAMP_PAIRS, TIMESTAMP_INDICES } from '../config';
import { TonemapLutPass } from '../postprocess/TonemapLut';
import { BloomPass } from '../postprocess/Bloom';
import { UniformManager } from './UniformManager';
import { ShadowPass } from '../shadows/ShadowPass';
/**
 * FrameRenderer manages the per-frame rendering operations.
 */
export class FrameRenderer {
    frustumCuller;
    instanceBuilder;
    geometryCache;
    visibleEntitiesCache = [];
    customGeometryEntitiesCache = [];
    depthTextureSize = { width: 0, height: 0 };
    computePrepass = null;
    pendingTimestampRead = false;
    staticBundle = null;
    bundleDirty = true;
    bundleInstanceCount = 0;
    bundleIndexCount = 0;
    bundleOpaqueCount = 0;
    bundleRenderPipeline = null;
    bundleTransparentPipeline = null;
    bundleOverlayPipeline = null;
    bundleUniformBindGroup = null;
    bundleTextureBindGroup = null;
    // Postprocess resources
    hdrColorTexture = null;
    bloomTexture = null;
    hdrColorView = null;
    bloomTextureView = null;
    tonemapPass = null;
    bloomPass = null;
    shadowPass = null;
    constructor(initialCapacity = 1000) {
        this.frustumCuller = new FrustumCuller();
        this.instanceBuilder = new InstanceDataBuilder(initialCapacity);
        this.geometryCache = new GeometryCache();
    }
    /**
     * Renders a single frame.
     * Returns updated geometry data.
     */
    renderFrame(ctx, viewProjectionMatrix, eyePosition, passDescriptor, viewMatrix, projectionMatrix) {
        const { device, canvas, context, frameResources, scene, environmentRenderer, gridRenderer } = ctx;
        let { geometry } = ctx;
        // Handle canvas resize (recreate depth/MSAA textures if needed)
        if (this.depthTextureSize.width !== canvas.width || this.depthTextureSize.height !== canvas.height) {
            frameResources.depthTexture.destroy();
            frameResources.msaaColorTexture.destroy();
            this.hdrColorTexture?.destroy();
            this.bloomTexture?.destroy();
            this.hdrColorView = null;
            this.bloomTextureView = null;
            const sampleCount = ctx.msaaSampleCount ?? MSAA_SAMPLE_COUNT;
            frameResources.depthTexture = createDepthTexture(device, canvas, sampleCount);
            frameResources.depthTextureView = frameResources.depthTexture.createView({
                label: 'frame-depth-view',
            });
            frameResources.msaaColorTexture = createMsaaColorTarget(device, canvas, 'rgba16float', sampleCount);
            frameResources.msaaColorView = frameResources.msaaColorTexture.createView({
                label: 'frame-msaa-color-view',
            });
            const enableHDR = ctx.featureFlags?.enableHDR !== false;
            const enableBloom = ctx.featureFlags?.enableBloom !== false;
            if (enableHDR) {
                this.hdrColorTexture = createHdrColorTarget(device, canvas);
                this.hdrColorView = this.hdrColorTexture.createView();
                if (enableBloom) {
                    // Half-resolution bloom target
                    const halfW = Math.max(1, Math.floor(canvas.width / 2));
                    const halfH = Math.max(1, Math.floor(canvas.height / 2));
                    this.bloomTexture = device.createTexture({
                        label: 'frame-bloom-texture',
                        size: { width: halfW, height: halfH, depthOrArrayLayers: 1 },
                        format: 'rgba16float',
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                    });
                    this.bloomTextureView = this.bloomTexture.createView();
                }
            }
            this.depthTextureSize = { width: canvas.width, height: canvas.height };
        }
        const encoder = device.createCommandEncoder({ label: 'frame-encoder' });
        // Frame begin timestamp (surround entire frame)
        if (frameResources.timestampQuerySet) {
            try {
                encoder.writeTimestamp?.(frameResources.timestampQuerySet, TIMESTAMP_INDICES.FRAME_BEGIN);
            }
            catch {
                // ignore when not supported by mock
            }
        }
        // Per-frame frustum culling and dynamic instance buffer updates (before shadow pass to avoid destroy-use hazards)
        if (scene) {
            try {
                const frustum = this.frustumCuller.extractFrustumFromVP(viewProjectionMatrix);
                const allEntities = scene.getActiveEntities();
                this.frustumCuller.cullEntitiesToArray(allEntities, frustum, this.visibleEntitiesCache);
                // Separate entities with custom geometry (meshData) from default geometry
                const { defaultGeometry, customGeometry } = this.instanceBuilder.separateCustomGeometry(this.visibleEntitiesCache);
                this.customGeometryEntitiesCache = customGeometry;
                // Build instance data only for default geometry entities
                const sceneData = this.instanceBuilder.build(defaultGeometry);
                if (geometry.instanceCount === sceneData.instanceCount) {
                    // Same count: update in place
                    this.updateInstanceBuffers(device, frameResources, sceneData);
                }
                else {
                    // Different count: reallocate
                    this.reallocateInstanceBuffers(device, frameResources, sceneData);
                }
                geometry = { ...geometry, ...sceneData };
                // Update geometry cache frame counter (for LRU)
                this.geometryCache.tick();
            }
            catch (err) {
                Logger.warn('Frustum culling/update failed:', err);
            }
        }
        // Shadow map pre-pass before main render pass (after buffers updated)
        if (ctx.featureFlags?.enableShadows !== false) {
            try {
                // Lazy initialize shadow pass
                if (!this.shadowPass) {
                    this.shadowPass = new ShadowPass(device);
                }
                // Apply quality preset each frame (cheap)
                try {
                    const q = ctx.shadowQuality ?? 'med';
                    this.shadowPass.setQualityPreset(q);
                }
                catch { }
                if (viewMatrix && projectionMatrix) {
                    this.shadowPass.render({
                        encoder,
                        frameResources,
                        geometry,
                        viewMatrix,
                        projectionMatrix,
                        uniformManager: ctx.uniformManager,
                        lightingData: ctx.lightingData,
                        ibl: {
                            brdfLut: ctx.environmentRenderer && ctx.environmentRenderer.getBrdfLutTexture?.(),
                            envCube: ctx.environmentRenderer && ctx.environmentRenderer.getEnvCubeTexture?.(),
                        },
                    });
                    if (typeof ctx.onShadowMetrics === 'function') {
                        try {
                            ctx.onShadowMetrics(this.shadowPass.getLastCascadeInstanceCounts());
                        }
                        catch { }
                    }
                }
            }
            catch (err) {
                Logger.warn('Shadow pass failed:', err);
            }
        }
        // Compute prepass (runs before render pass)
        try {
            if (ctx.featureFlags?.enableComputePrepass !== false) {
                if (!this.computePrepass) {
                    if (typeof encoder.beginComputePass === 'function') {
                        this.computePrepass = new ComputePrepass(device);
                    }
                }
                if (frameResources.timestampQuerySet) {
                    try {
                        encoder.writeTimestamp?.(frameResources.timestampQuerySet, TIMESTAMP_INDICES.COMPUTE_BEGIN);
                    }
                    catch { }
                }
                this.computePrepass?.run(encoder);
                if (frameResources.timestampQuerySet) {
                    try {
                        encoder.writeTimestamp?.(frameResources.timestampQuerySet, TIMESTAMP_INDICES.COMPUTE_END);
                    }
                    catch { }
                }
            }
        }
        catch (err) {
            Logger.warn('Compute prepass failed:', err);
        }
        const swapChainView = context.getCurrentTexture().createView({ label: 'frame-color-resolve-view' });
        // Base pass descriptor with required attachments
        const enableHDR = ctx.featureFlags?.enableHDR !== false;
        const basePassDesc = {
            label: 'frame-render-pass',
            colorAttachments: [
                {
                    view: frameResources.msaaColorView,
                    resolveTarget: enableHDR
                        ? (this.hdrColorView ?? (this.hdrColorTexture ??= createHdrColorTarget(device, canvas)).createView({ label: 'frame-hdr-view' }))
                        : swapChainView,
                    clearValue: CLEAR_COLOR,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: frameResources.depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'discard',
            },
        };
        // Preserve optional timestamp/occlusion fields from provided descriptor
        const finalPassDesc = {
            ...basePassDesc,
            ...(passDescriptor?.timestampWrites
                ? { timestampWrites: passDescriptor.timestampWrites }
                : {}),
            ...(passDescriptor?.occlusionQuerySet
                ? { occlusionQuerySet: passDescriptor.occlusionQuerySet }
                : {}),
            ...(typeof passDescriptor?.maxDrawCount === 'number'
                ? { maxDrawCount: passDescriptor.maxDrawCount }
                : {}),
        };
        // (moved culling and instance buffer updates above the shadow pass)
        const passEncoder = encoder.beginRenderPass(finalPassDesc);
        // Render environment/skybox first (background)
        if (environmentRenderer && scene) {
            const environmentEntities = scene.queryEntities(EnvironmentComponent);
            const environmentEntity = environmentEntities.find((e) => e.active);
            if (environmentEntity) {
                const envComponent = environmentEntity.getComponent(EnvironmentComponent);
                if (envComponent && envComponent.enabled) {
                    const inverseVP = new Float32Array(16);
                    mat4Invert(inverseVP, viewProjectionMatrix);
                    environmentRenderer.updateUniforms(inverseVP, eyePosition);
                    environmentRenderer.updateParams(envComponent);
                    environmentRenderer.render(passEncoder, envComponent);
                }
            }
        }
        // Determine if the cached render bundle is still valid
        if (this.bundleRenderPipeline !== frameResources.renderPipeline ||
            this.bundleTransparentPipeline !== frameResources.transparentPipeline ||
            this.bundleOverlayPipeline !== frameResources.overlayPipeline ||
            this.bundleUniformBindGroup !== frameResources.uniformBindGroup ||
            this.bundleTextureBindGroup !== frameResources.textureBindGroup) {
            this.invalidateBundle();
        }
        if (this.bundleInstanceCount !== geometry.instanceCount ||
            this.bundleIndexCount !== geometry.indices.length ||
            this.bundleOpaqueCount !== (geometry.opaqueCount ?? geometry.instanceCount)) {
            this.invalidateBundle();
        }
        if (this.bundleDirty || !this.staticBundle) {
            try {
                this.staticBundle = this.recordStaticBundle(device, frameResources, ctx.presentationFormat, geometry, ctx.msaaSampleCount ?? MSAA_SAMPLE_COUNT);
                this.bundleDirty = false;
                this.bundleInstanceCount = geometry.instanceCount;
                this.bundleIndexCount = geometry.indices.length;
                this.bundleOpaqueCount = geometry.opaqueCount ?? geometry.instanceCount;
                this.bundleRenderPipeline = frameResources.renderPipeline;
                this.bundleTransparentPipeline = frameResources.transparentPipeline;
                this.bundleOverlayPipeline = frameResources.overlayPipeline;
                this.bundleUniformBindGroup = frameResources.uniformBindGroup;
                this.bundleTextureBindGroup = frameResources.textureBindGroup;
            }
            catch (err) {
                Logger.warn('Render bundle creation failed', err);
                this.invalidateBundle();
            }
        }
        if (this.staticBundle) {
            try {
                passEncoder.executeBundles([this.staticBundle]);
            }
            catch {
                this.drawStaticGeometry(passEncoder, frameResources, geometry);
            }
        }
        else {
            this.drawStaticGeometry(passEncoder, frameResources, geometry);
        }
        // Render custom geometry entities (with meshData)
        this.drawCustomGeometry(passEncoder, device, frameResources);
        // Render grid overlay if available
        if (gridRenderer && typeof gridRenderer.render === 'function') {
            try {
                gridRenderer.render(passEncoder, viewProjectionMatrix);
            }
            catch (err) {
                Logger.warn('Grid render failed:', err);
            }
        }
        // TODO: Uncomment in Phase 4
        // Render logic cube connections if available
        // const { logicConnectionRenderer } = ctx;
        // if (logicConnectionRenderer && ctx.scene) {
        //   try {
        //     logicConnectionRenderer.render(passEncoder, viewProjectionMatrix, eyePosition);
        //   } catch (err) {
        //     Logger.warn('Logic connection render failed:', err);
        //   }
        // }
        passEncoder.end();
        // Postprocess: Bloom then Tonemap+LUT to the swap chain
        // Initialize passes lazily
        if (enableHDR) {
            if (!this.bloomPass) {
                this.bloomPass = new BloomPass(device);
                this.bloomPass.initialize('rgba16float');
            }
            if (!this.tonemapPass) {
                this.tonemapPass = new TonemapLutPass(device);
                this.tonemapPass.initialize(ctx.presentationFormat);
            }
        }
        // Ensure views exist (created on resize)
        if (!this.hdrColorTexture) {
            this.hdrColorTexture = createHdrColorTarget(device, canvas);
            this.hdrColorView = this.hdrColorTexture.createView();
        }
        if (!this.hdrColorView)
            this.hdrColorView = this.hdrColorTexture.createView();
        if (enableHDR && !this.bloomTexture) {
            const halfW = Math.max(1, Math.floor(canvas.width / 2));
            const halfH = Math.max(1, Math.floor(canvas.height / 2));
            this.bloomTexture = device.createTexture({
                label: 'frame-bloom-texture',
                size: { width: halfW, height: halfH, depthOrArrayLayers: 1 },
                format: 'rgba16float',
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            });
            this.bloomTextureView = this.bloomTexture.createView();
        }
        if (enableHDR && this.bloomTexture && !this.bloomTextureView) {
            this.bloomTextureView = this.bloomTexture.createView();
        }
        const hdrView = this.hdrColorView;
        const bloomView = this.bloomTextureView;
        // Bloom pass with timestamps (optional flag)
        if (enableHDR && hdrView && bloomView && this.bloomPass && ctx.featureFlags?.enableBloom !== false) {
            this.bloomPass.render(encoder, hdrView, bloomView, frameResources.timestampQuerySet
                ? { querySet: frameResources.timestampQuerySet, begin: TIMESTAMP_INDICES.BLOOM_BEGIN, end: TIMESTAMP_INDICES.BLOOM_END }
                : undefined);
        }
        // Tonemap pass with timestamps (only when HDR path is enabled)
        if (enableHDR && hdrView && bloomView && this.tonemapPass) {
            this.tonemapPass.render(encoder, hdrView, bloomView, swapChainView, frameResources.timestampQuerySet
                ? { querySet: frameResources.timestampQuerySet, begin: TIMESTAMP_INDICES.TONEMAP_BEGIN, end: TIMESTAMP_INDICES.TONEMAP_END }
                : undefined);
        }
        // Frame end timestamp (after all passes; before resolve/copy)
        if (frameResources.timestampQuerySet) {
            try {
                encoder.writeTimestamp?.(frameResources.timestampQuerySet, TIMESTAMP_INDICES.FRAME_END);
            }
            catch { }
        }
        // Resolve and copy timestamps after all writes are recorded
        if (frameResources.timestampQuerySet && frameResources.timestampResolveBuffer && frameResources.timestampReadBuffer) {
            encoder.resolveQuerySet(frameResources.timestampQuerySet, 0, TIMESTAMP_QUERY_COUNT, frameResources.timestampResolveBuffer, 0);
            encoder.copyBufferToBuffer(frameResources.timestampResolveBuffer, 0, frameResources.timestampReadBuffer, 0, TIMESTAMP_BUFFER_SIZE);
        }
        device.queue.submit([encoder.finish()]);
        if (frameResources.timestampQuerySet &&
            frameResources.timestampResolveBuffer &&
            frameResources.timestampReadBuffer &&
            typeof ctx.onGpuTimings === 'function') {
            this.scheduleTimestampRead(device, frameResources, ctx.onGpuTimings);
        }
        return geometry;
    }
    /**
     * Releases resources owned by the FrameRenderer
     */
    dispose() {
        try {
            this.computePrepass?.dispose();
        }
        catch {
            // ignore
        }
        this.computePrepass = null;
        this.pendingTimestampRead = false;
        this.invalidateBundle();
        try {
            this.hdrColorTexture?.destroy();
        }
        catch { }
        try {
            this.bloomTexture?.destroy();
        }
        catch { }
        this.hdrColorTexture = null;
        this.bloomTexture = null;
    }
    /**
     * Updates instance buffers in place (same count).
     */
    updateInstanceBuffers(device, frameResources, sceneData) {
        device.queue.writeBuffer(frameResources.instanceOffsetBuffer, 0, sceneData.instanceOffsetData.buffer, sceneData.instanceOffsetData.byteOffset, sceneData.instanceOffsetData.byteLength);
        device.queue.writeBuffer(frameResources.instanceColorScaleBuffer, 0, sceneData.instanceColorScaleData.buffer, sceneData.instanceColorScaleData.byteOffset, sceneData.instanceColorScaleData.byteLength);
        device.queue.writeBuffer(frameResources.instanceSecondaryColorBuffer, 0, sceneData.instanceSecondaryColorData.buffer, sceneData.instanceSecondaryColorData.byteOffset, sceneData.instanceSecondaryColorData.byteLength);
        device.queue.writeBuffer(frameResources.instanceEmissiveColorBuffer, 0, sceneData.instanceEmissiveColorData.buffer, sceneData.instanceEmissiveColorData.byteOffset, sceneData.instanceEmissiveColorData.byteLength);
        device.queue.writeBuffer(frameResources.instanceMaterialParamsBuffer, 0, sceneData.instanceMaterialParamsData.buffer, sceneData.instanceMaterialParamsData.byteOffset, sceneData.instanceMaterialParamsData.byteLength);
        device.queue.writeBuffer(frameResources.instanceRotationBuffer, 0, sceneData.instanceRotationData.buffer, sceneData.instanceRotationData.byteOffset, sceneData.instanceRotationData.byteLength);
        // Ensure materialId buffer has enough capacity
        if ((frameResources.instanceMaterialIdBuffer.size ?? 0) <
            sceneData.instanceMaterialIdData.byteLength) {
            const pool = frameResources.bufferPool;
            const materialIdBuf = pool.getOrCreate('instance-material-id', sceneData.instanceMaterialIdData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'instance-material-id-buffer');
            try {
                const prev = frameResources.instanceMaterialIdBuffer;
                if (pool.get('instance-material-id') !== prev && prev !== materialIdBuf)
                    prev.destroy();
            }
            catch {
                // ignore
            }
            frameResources.instanceMaterialIdBuffer = materialIdBuf;
        }
        device.queue.writeBuffer(frameResources.instanceMaterialIdBuffer, 0, sceneData.instanceMaterialIdData.buffer, sceneData.instanceMaterialIdData.byteOffset, sceneData.instanceMaterialIdData.byteLength);
    }
    /**
     * Reallocates instance buffers (different count).
     */
    reallocateInstanceBuffers(device, frameResources, sceneData) {
        const pool = frameResources.bufferPool;
        // Keep references and check if pooled
        const prevOffsetBuf = frameResources.instanceOffsetBuffer;
        const prevColorScaleBuf = frameResources.instanceColorScaleBuffer;
        const prevSecondaryColorBuf = frameResources.instanceSecondaryColorBuffer;
        const prevEmissiveColorBuf = frameResources.instanceEmissiveColorBuffer;
        const prevMaterialParamsBuf = frameResources.instanceMaterialParamsBuffer;
        const prevRotationBuf = frameResources.instanceRotationBuffer;
        const prevMaterialIdBuf = frameResources.instanceMaterialIdBuffer;
        const wasPooledOffset = pool.get('instance-offset') === prevOffsetBuf;
        const wasPooledColorScale = pool.get('instance-color-scale') === prevColorScaleBuf;
        const wasPooledSecondary = pool.get('instance-secondary-color') === prevSecondaryColorBuf;
        const wasPooledEmissive = pool.get('instance-emissive-color') === prevEmissiveColorBuf;
        const wasPooledMaterialParams = pool.get('instance-material-params') === prevMaterialParamsBuf;
        const wasPooledRotation = pool.get('instance-rotation') === prevRotationBuf;
        const wasPooledMaterialId = pool.get('instance-material-id') === prevMaterialIdBuf;
        // Reallocate via pool
        const offsetBuf = pool.getOrCreate('instance-offset', sceneData.instanceOffsetData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'instance-offset-buffer');
        const colorScaleBuf = pool.getOrCreate('instance-color-scale', sceneData.instanceColorScaleData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'instance-color-scale-buffer');
        const secondaryColorBuf = pool.getOrCreate('instance-secondary-color', sceneData.instanceSecondaryColorData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'instance-secondary-color-buffer');
        const emissiveColorBuf = pool.getOrCreate('instance-emissive-color', sceneData.instanceEmissiveColorData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'instance-emissive-color-buffer');
        const materialParamsBuf = pool.getOrCreate('instance-material-params', sceneData.instanceMaterialParamsData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'instance-material-params-buffer');
        const rotationBuf = pool.getOrCreate('instance-rotation', sceneData.instanceRotationData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'instance-rotation-buffer');
        const materialIdBuf = pool.getOrCreate('instance-material-id', sceneData.instanceMaterialIdData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'instance-material-id-buffer');
        frameResources.instanceOffsetBuffer = offsetBuf;
        frameResources.instanceColorScaleBuffer = colorScaleBuf;
        frameResources.instanceSecondaryColorBuffer = secondaryColorBuf;
        frameResources.instanceEmissiveColorBuffer = emissiveColorBuf;
        frameResources.instanceMaterialParamsBuffer = materialParamsBuf;
        frameResources.instanceRotationBuffer = rotationBuf;
        frameResources.instanceMaterialIdBuffer = materialIdBuf;
        // Upload data
        this.updateInstanceBuffers(device, frameResources, sceneData);
        this.invalidateBundle();
        // Destroy previous non-pooled buffers
        try {
            if (!wasPooledOffset && prevOffsetBuf !== offsetBuf)
                prevOffsetBuf.destroy();
        }
        catch {
            // ignore
        }
        try {
            if (!wasPooledColorScale && prevColorScaleBuf !== colorScaleBuf)
                prevColorScaleBuf.destroy();
        }
        catch {
            // ignore
        }
        try {
            if (!wasPooledSecondary && prevSecondaryColorBuf !== secondaryColorBuf)
                prevSecondaryColorBuf.destroy();
        }
        catch {
            // ignore
        }
        try {
            if (!wasPooledEmissive && prevEmissiveColorBuf !== emissiveColorBuf)
                prevEmissiveColorBuf.destroy();
        }
        catch {
            // ignore
        }
        try {
            if (!wasPooledMaterialParams && prevMaterialParamsBuf !== materialParamsBuf)
                prevMaterialParamsBuf.destroy();
        }
        catch {
            // ignore
        }
        try {
            if (!wasPooledRotation && prevRotationBuf !== rotationBuf)
                prevRotationBuf.destroy();
        }
        catch {
            // ignore
        }
        try {
            if (!wasPooledMaterialId && prevMaterialIdBuf !== materialIdBuf)
                prevMaterialIdBuf.destroy();
        }
        catch {
            // ignore
        }
    }
    scheduleTimestampRead(device, frameResources, callback) {
        if (this.pendingTimestampRead) {
            return;
        }
        this.pendingTimestampRead = true;
        const readBuffer = frameResources.timestampReadBuffer;
        device.queue
            .onSubmittedWorkDone()
            .then(() => readBuffer.mapAsync(GPUMapMode.READ))
            .then(() => {
            let snapshot;
            try {
                const mapped = readBuffer.getMappedRange();
                snapshot = mapped.slice(0);
            }
            finally {
                try {
                    readBuffer.unmap();
                }
                catch {
                    // ignore
                }
            }
            const values = new BigUint64Array(snapshot);
            const timings = [];
            for (const pair of GPU_TIMESTAMP_PAIRS) {
                const begin = values[pair.beginIndex];
                const end = values[pair.endIndex];
                if (begin === undefined || end === undefined || begin === 0n || end <= begin) {
                    continue;
                }
                const delta = end - begin;
                if (delta <= 0) {
                    continue;
                }
                const durationNs = Number(delta) * frameResources.timestampPeriod;
                if (!Number.isFinite(durationNs) || durationNs <= 0) {
                    continue;
                }
                timings.push({ label: pair.label, timeMs: durationNs / 1_000_000 });
            }
            callback(timings);
        })
            .catch((err) => {
            Logger.warn('GPU timestamp read failed', err);
            try {
                readBuffer.unmap();
            }
            catch {
                // ignore
            }
        })
            .finally(() => {
            this.pendingTimestampRead = false;
        });
    }
    invalidateBundle() {
        this.staticBundle = null;
        this.bundleDirty = true;
        this.bundleInstanceCount = 0;
        this.bundleIndexCount = 0;
        this.bundleOpaqueCount = 0;
        this.bundleRenderPipeline = null;
        this.bundleTransparentPipeline = null;
        this.bundleOverlayPipeline = null;
        this.bundleUniformBindGroup = null;
        this.bundleTextureBindGroup = null;
    }
    drawStaticGeometry(encoder, frameResources, geometry) {
        encoder.setVertexBuffer(0, frameResources.vertexBuffer);
        encoder.setVertexBuffer(1, frameResources.instanceOffsetBuffer);
        encoder.setVertexBuffer(2, frameResources.instanceColorScaleBuffer);
        encoder.setVertexBuffer(3, frameResources.instanceSecondaryColorBuffer);
        encoder.setVertexBuffer(4, frameResources.instanceEmissiveColorBuffer);
        encoder.setVertexBuffer(5, frameResources.instanceMaterialParamsBuffer);
        encoder.setVertexBuffer(6, frameResources.instanceRotationBuffer);
        encoder.setVertexBuffer(7, frameResources.instanceMaterialIdBuffer);
        encoder.setIndexBuffer(frameResources.indexBuffer, 'uint16');
        const totalInstances = geometry.instanceCount;
        const opaqueCount = Math.min(Math.max(geometry.opaqueCount ?? totalInstances, 0), totalInstances);
        const transparentCount = Math.max(totalInstances - opaqueCount, 0);
        if (opaqueCount > 0) {
            encoder.setPipeline(frameResources.renderPipeline);
            encoder.setBindGroup(0, frameResources.uniformBindGroup);
            encoder.setBindGroup(1, frameResources.textureBindGroup);
            encoder.drawIndexed(geometry.indices.length, opaqueCount, 0, 0, 0);
        }
        if (transparentCount > 0 && frameResources.transparentPipeline) {
            encoder.setPipeline(frameResources.transparentPipeline);
            encoder.setBindGroup(0, frameResources.uniformBindGroup);
            encoder.setBindGroup(1, frameResources.textureBindGroup);
            encoder.drawIndexed(geometry.indices.length, transparentCount, 0, 0, opaqueCount);
        }
        encoder.setPipeline(frameResources.overlayPipeline);
        encoder.setBindGroup(0, frameResources.uniformBindGroup);
        encoder.setBindGroup(1, frameResources.textureBindGroup);
        encoder.drawIndexed(geometry.indices.length, totalInstances, 0, 0, 0);
    }
    /**
     * Renders custom geometry entities (those with meshData)
     */
    drawCustomGeometry(encoder, device, frameResources) {
        if (this.customGeometryEntitiesCache.length === 0)
            return;
        // For each custom geometry entity, render individually
        // We can optimize this later by grouping entities with same geometry
        for (const { entity, meshComponent } of this.customGeometryEntitiesCache) {
            if (!entity.active)
                continue;
            const meshData = meshComponent.meshData;
            if (!meshData?.vertices || !meshData.indices)
                continue;
            // Get or create geometry buffers from cache
            const geometryBuffers = this.geometryCache.getGeometryBuffers(device, meshData);
            if (!geometryBuffers) {
                // Geometry was invalid or failed to create - log entity info for debugging
                const entityName = entity.name || entity.id || 'unnamed';
                Logger.warn(`[FrameRenderer] Skipping entity "${entityName}" (id: ${entity.id}) due to invalid geometry`);
                continue;
            }
            // Get material
            const material = entity.getComponent(MaterialComponent);
            const primary = material?.primaryColor ?? [1, 1, 1, 1];
            const alpha = primary[3] ?? (material?.opacity ?? 1);
            const flags = material?.flags ?? 0;
            const isTransparent = (flags & MaterialComponent.FLAG_TRANSPARENT) !== 0 || alpha < 0.999;
            // Update instance buffers with this entity's transform data
            // Use single-instance buffers from geometry cache (already set up)
            // We need to update the instance data for this entity
            const pos = entity.transform.getWorldPosition();
            const rot = entity.transform.rotation;
            const scale = entity.transform.scale;
            const maxScale = Math.max(scale[0], scale[1], scale[2]);
            const secondary = material?.secondaryColor ?? primary;
            const emissive = material?.emissiveColor ?? [0, 0, 0, 1];
            const metallic = material?.metallic ?? 0;
            const roughness = material?.roughness ?? 1;
            // Write instance data to buffers (single instance)
            device.queue.writeBuffer(geometryBuffers.instanceOffsetBuffer, 0, new Float32Array(pos));
            device.queue.writeBuffer(geometryBuffers.instanceColorScaleBuffer, 0, new Float32Array([primary[0], primary[1], primary[2], maxScale]));
            device.queue.writeBuffer(geometryBuffers.instanceSecondaryColorBuffer, 0, new Float32Array([secondary[0], secondary[1], secondary[2], secondary[3] ?? 1]));
            device.queue.writeBuffer(geometryBuffers.instanceEmissiveColorBuffer, 0, new Float32Array([emissive[0], emissive[1], emissive[2], material?.emissiveIntensity ?? 0]));
            device.queue.writeBuffer(geometryBuffers.instanceMaterialParamsBuffer, 0, new Float32Array([alpha, metallic, roughness, flags]));
            device.queue.writeBuffer(geometryBuffers.instanceRotationBuffer, 0, new Float32Array(rot));
            device.queue.writeBuffer(geometryBuffers.instanceMaterialIdBuffer, 0, new Uint32Array([material?.materialId ?? 0]));
            // Set up vertex buffers for custom geometry
            encoder.setVertexBuffer(0, geometryBuffers.vertexBuffer);
            encoder.setVertexBuffer(1, geometryBuffers.instanceOffsetBuffer);
            encoder.setVertexBuffer(2, geometryBuffers.instanceColorScaleBuffer);
            encoder.setVertexBuffer(3, geometryBuffers.instanceSecondaryColorBuffer);
            encoder.setVertexBuffer(4, geometryBuffers.instanceEmissiveColorBuffer);
            encoder.setVertexBuffer(5, geometryBuffers.instanceMaterialParamsBuffer);
            encoder.setVertexBuffer(6, geometryBuffers.instanceRotationBuffer);
            encoder.setVertexBuffer(7, geometryBuffers.instanceMaterialIdBuffer);
            encoder.setIndexBuffer(geometryBuffers.indexBuffer, 'uint16');
            // Set bind groups (same as default geometry)
            encoder.setBindGroup(0, frameResources.uniformBindGroup);
            encoder.setBindGroup(1, frameResources.textureBindGroup);
            // Choose pipeline based on transparency
            if (isTransparent) {
                if (frameResources.transparentPipeline) {
                    encoder.setPipeline(frameResources.transparentPipeline);
                    encoder.drawIndexed(geometryBuffers.indexCount, 1, 0, 0, 0);
                }
            }
            else {
                encoder.setPipeline(frameResources.renderPipeline);
                encoder.drawIndexed(geometryBuffers.indexCount, 1, 0, 0, 0);
            }
            // Render overlay pass if needed
            encoder.setPipeline(frameResources.overlayPipeline);
            encoder.drawIndexed(geometryBuffers.indexCount, 1, 0, 0, 0);
        }
    }
    recordStaticBundle(device, frameResources, presentationFormat, geometry, sampleCount) {
        if (typeof device.createRenderBundleEncoder !== 'function') {
            // Fallback path when mock device lacks bundle encoder support
            throw new Error('RenderBundleEncoder not supported');
        }
        const bundleEncoder = device.createRenderBundleEncoder({
            label: 'frame-static-bundle',
            colorFormats: ['rgba16float'],
            depthStencilFormat: 'depth24plus',
            sampleCount,
        });
        this.drawStaticGeometry(bundleEncoder, frameResources, geometry);
        return bundleEncoder.finish();
    }
}
//# sourceMappingURL=FrameRenderer.js.map