import { updateCanvasSize, getTimestampPeriod } from './helpers';
import { DEFAULT_GEOMETRY, createGeometryBuffers, createTimestampResources, createUniformResources, createTextureAtlas, // NEW: Texture atlas system
createPipelines, createDepthTexture, createMsaaColorTarget, } from '../resources/resources';
import { GPUBufferPool } from './bufferPool';
import { EnvironmentComponent } from '@engine/world';
import { LightManager } from '../lighting/LightManager';
// TODO: Uncomment in Phase 4 when @engine/script exists
// import { ScriptSystem } from '@engine/script';
// import { LogicCubeSystem } from '@engine/script';
// import { LogicConnectionRenderer } from '../LogicConnectionRenderer'; // TODO: Phase 4
import { EnvironmentRenderer } from '../renderers/EnvironmentRenderer';
import { Logger } from '@engine/core/utils';
import { CameraSystem } from './CameraSystem';
import { UniformManager } from './UniformManager';
import { FrameRenderer } from './FrameRenderer';
import { createInstanceDataFromScene } from './InstanceManager';
import { DEFAULT_STATUS_MESSAGE, MSAA_SAMPLE_COUNT, TIMESTAMP_QUERY_COUNT, UNIFORM_BUFFER_SIZE, UNIFORM_DATA_LENGTH, TIMESTAMP_BUFFER_SIZE, } from '../config';
function hasPreferredCanvasFormat(gpu) {
    return (typeof gpu === 'object' &&
        gpu !== null &&
        typeof gpu.getPreferredCanvasFormat === 'function');
}
// Vertex buffer layout constants
const VERTEX_STRIDE = 24;
const INSTANCE_OFFSET_STRIDE = 12;
function createVertexBufferLayouts() {
    return [
        {
            arrayStride: VERTEX_STRIDE,
            stepMode: 'vertex',
            attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
                { shaderLocation: 2, offset: 12, format: 'snorm8x4' }, // normal
                { shaderLocation: 3, offset: 16, format: 'float16x2' }, // uv
                { shaderLocation: 7, offset: 20, format: 'unorm8x4' }, // AO (x), rest unused
            ],
        },
        { arrayStride: INSTANCE_OFFSET_STRIDE, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
        { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x4' }] },
        { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 5, offset: 0, format: 'float32x4' }] },
        { arrayStride: 4, stepMode: 'instance', attributes: [{ shaderLocation: 6, offset: 0, format: 'float32' }] },
    ];
}
export async function initRenderer(options) {
    const { canvas, statusEl, getOrbitState } = options;
    const shouldSimulateFn = typeof options.shouldSimulate === 'function' ? options.shouldSimulate : () => true;
    const onFrameUpdateFn = options.onFrameUpdate;
    const currentScene = options.scene ?? null;
    let currentCameraEntity = options.cameraEntity ?? null;
    // Initialize light manager for the scene
    const lightManager = currentScene ? new LightManager(currentScene) : null;
    if (!('gpu' in navigator) || !navigator.gpu) {
        statusEl.textContent = 'WebGPU not supported in this browser.';
        throw new Error('WebGPU not supported');
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        statusEl.textContent = 'Failed to acquire GPU adapter.';
        throw new Error('Failed to acquire GPU adapter.');
    }
    const requiredFeatures = [];
    if (adapter.features.has('timestamp-query')) {
        requiredFeatures.push('timestamp-query');
    }
    // Do not request occlusion-query proactively due to limited support in some runtimes
    const device = await adapter.requestDevice({ requiredFeatures });
    const supportsTimestampQueries = device.features.has('timestamp-query');
    const supportsOcclusionQueries = device.features.has('occlusion-query');
    // Query adapter/device info (best-effort)
    let adapterInfo;
    let adapterName;
    try {
        const anyAdapter = adapter;
        if (typeof anyAdapter.requestAdapterInfo === 'function') {
            const info = await anyAdapter.requestAdapterInfo();
            const normalized = {};
            if (typeof info.vendor === 'string')
                normalized.vendor = info.vendor;
            if (typeof info.architecture === 'string')
                normalized.architecture = info.architecture;
            if (typeof info.device === 'string')
                normalized.device = info.device;
            if (typeof info.description === 'string')
                normalized.description = info.description;
            adapterInfo = Object.keys(normalized).length > 0 ? normalized : undefined;
            adapterName = typeof info.name === 'string' ? info.name : undefined;
        }
    }
    catch {
        // ignore
    }
    const textureCompressionSupport = {
        bc: device.features.has('texture-compression-bc'),
        etc2: device.features.has('texture-compression-etc2'),
        astc: device.features.has('texture-compression-astc'),
    };
    const capabilitiesBase = {
        // adapterName and adapterInfo will be conditionally assigned below to avoid explicit undefined
        features: {
            timestampQuery: supportsTimestampQueries,
            occlusionQuery: supportsOcclusionQueries,
            compute: true, // WebGPU devices support compute; may be restricted by limits
            textureCompression: textureCompressionSupport,
        },
        limits: {
            maxTextureDimension2D: adapter?.limits?.maxTextureDimension2D ?? device?.limits?.maxTextureDimension2D ?? 4096,
            maxBufferSize: adapter?.limits?.maxBufferSize ?? device?.limits?.maxBufferSize ?? 256 * 1024 * 1024,
            maxBindGroups: device?.limits?.maxBindGroups,
            maxStorageBufferBindingSize: device?.limits?.maxStorageBufferBindingSize,
            maxUniformBufferBindingSize: device?.limits?.maxUniformBufferBindingSize,
            maxComputeWorkgroupSizeX: device?.limits?.maxComputeWorkgroupSizeX,
            maxComputeWorkgroupSizeY: device?.limits?.maxComputeWorkgroupSizeY,
            maxComputeWorkgroupSizeZ: device?.limits?.maxComputeWorkgroupSizeZ,
        },
    };
    const capabilities = capabilitiesBase;
    if (typeof adapterName === 'string') {
        capabilities.adapterName = adapterName;
    }
    if (adapterInfo) {
        capabilities.adapterInfo = adapterInfo;
    }
    const { querySet: timestampQuerySet, resolveBuffer: timestampResolveBuffer, readBuffer: timestampReadBuffer, } = createTimestampResources(device, supportsTimestampQueries, {
        queryCount: TIMESTAMP_QUERY_COUNT,
        bufferSize: TIMESTAMP_BUFFER_SIZE,
    });
    const context = canvas.getContext('webgpu');
    if (!context) {
        statusEl.textContent = 'Failed to create WebGPU context.';
        throw new Error('Failed to create WebGPU context.');
    }
    // Configure canvas format (try preferred, fallback to rgba8unorm/bgra8unorm)
    let presentationFormat = hasPreferredCanvasFormat(navigator.gpu)
        ? navigator.gpu.getPreferredCanvasFormat()
        : 'rgba8unorm';
    try {
        context.configure({ device, format: presentationFormat, alphaMode: 'opaque' });
    }
    catch (err) {
        const altFormat = presentationFormat === 'rgba8unorm' ? 'bgra8unorm' : 'rgba8unorm';
        try {
            context.configure({ device, format: altFormat, alphaMode: 'opaque' });
            Logger.warn('Canvas configure fallback format used:', { from: presentationFormat, to: altFormat });
            presentationFormat = altFormat;
        }
        catch (err2) {
            Logger.error('Failed to configure canvas with both preferred and fallback formats', err2);
            statusEl.textContent = 'WebGPU canvas configuration failed.';
            throw err instanceof Error ? err : new Error(String(err));
        }
    }
    const renderAbortController = new AbortController();
    const renderAbortSignal = renderAbortController.signal;
    const gpuTimingListeners = [];
    let cleanedUp = false;
    // Handle device loss
    device.lost
        .then((info) => {
        if (!cleanedUp && !renderAbortSignal.aborted) {
            Logger.error('WebGPU device lost', info);
            statusEl.textContent = 'WebGPU device lost. Please reload.';
            try {
                cleanup();
            }
            catch (cleanupErr) {
                Logger.warn('Cleanup after device loss threw', cleanupErr);
            }
        }
    })
        .catch((err) => Logger.error('device.lost failed', err));
    let resizeObserver = null;
    let animationFrameHandle = null;
    let scheduleNextFrame;
    let frame;
    let frameResources;
    let frameRenderer;
    // TODO: Uncomment in Phase 4
    // let scriptSystem: ScriptSystem | null = null;
    // let logicCubeSystem: LogicCubeSystem | null = null;
    // let logicConnectionRenderer: LogicConnectionRenderer | null = null;
    let lastFrameTimeMs = null;
    // Prepare geometry from scene or use default
    let geometry = options.geometry ?? DEFAULT_GEOMETRY;
    let gridRenderer = null;
    let environmentRenderer = null;
    try {
        resizeObserver = new ResizeObserver(() => {
            updateCanvasSize(canvas);
        });
        resizeObserver.observe(canvas);
        // Update geometry if scene is provided
        if (currentScene) {
            const sceneData = createInstanceDataFromScene(currentScene);
            geometry = {
                ...DEFAULT_GEOMETRY,
                ...sceneData,
            };
            if (!currentCameraEntity) {
                currentCameraEntity = currentScene.primaryCamera;
            }
            // TODO: Uncomment in Phase 4 when @engine/script exists
            // Initialize scripting runtime for scene
            // scriptSystem = new ScriptSystem(currentScene);
            // Initialize logic cube system for scene
            // logicCubeSystem = new LogicCubeSystem(currentScene);
            // Initialize logic connection renderer
            // logicConnectionRenderer = new LogicConnectionRenderer(
            //   currentScene,
            //   logicCubeSystem.getConnectionManager()
            // );
        }
        const geometryBuffers = createGeometryBuffers(device, geometry);
        const uniformResources = createUniformResources(device, {
            bufferSize: UNIFORM_BUFFER_SIZE,
            dataLength: UNIFORM_DATA_LENGTH,
        });
        const vertexBuffers = createVertexBufferLayouts();
        const { textureBindGroupLayout, textureBindGroup, atlasTexture, normalAtlasTexture, sampler, atlas, atlasMetaBuffer } = createTextureAtlas(device, undefined, 2048, 128);
        const { renderPipeline, overlayPipeline } = await createPipelines(device, 'rgba16float', uniformResources.uniformBindGroupLayout, textureBindGroupLayout, vertexBuffers, { sampleCount: MSAA_SAMPLE_COUNT, statusEl });
        const uniformBindGroup = device.createBindGroup({
            label: 'frame-uniform-bg',
            layout: uniformResources.uniformBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: uniformResources.uniformBuffer,
                        offset: 0,
                        size: UNIFORM_BUFFER_SIZE,
                    },
                },
            ],
        });
        const depthTexture = createDepthTexture(device, canvas, MSAA_SAMPLE_COUNT);
        const depthTextureView = depthTexture.createView({ label: 'frame-depth-view' });
        const msaaColorTexture = createMsaaColorTarget(device, canvas, presentationFormat, MSAA_SAMPLE_COUNT);
        const msaaColorView = msaaColorTexture.createView({ label: 'frame-msaa-color-view' });
        // Initialize rendering systems
        const uniformManager = new UniformManager(device, uniformResources.uniformBuffer);
        const cameraSystem = new CameraSystem();
        frameRenderer = new FrameRenderer(geometry.instanceCount);
        // Initialize static uniforms once
        uniformManager.initializeStaticUniforms(atlas.getConfig());
        let frameId = 0;
        scheduleNextFrame = () => {
            if (cleanedUp || renderAbortSignal.aborted) {
                return;
            }
            if (animationFrameHandle === null) {
                animationFrameHandle = requestAnimationFrame(frame);
            }
        };
        const bufferPool = new GPUBufferPool(device);
        frameResources = {
            ...geometryBuffers,
            uniformBuffer: uniformResources.uniformBuffer,
            uniformBindGroupLayout: uniformResources.uniformBindGroupLayout,
            textureBindGroupLayout,
            renderPipeline,
            overlayPipeline,
            uniformBindGroup,
            uniformData: uniformResources.uniformData,
            timestampQuerySet,
            timestampResolveBuffer,
            timestampReadBuffer,
            timestampPeriod: getTimestampPeriod(device, adapter),
            sideTexture: atlasTexture, // Atlas texture (backward compatibility field name)
            topTexture: atlasTexture, // Same atlas texture (backward compatibility field name)
            normalAtlasTexture,
            sampler,
            textureBindGroup,
            atlasMetaBuffer,
            depthTexture,
            msaaColorTexture,
            depthTextureView,
            msaaColorView,
            // keep pool as any attachment (not in type) for internal updates
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...{ bufferPool, atlas },
        };
        // Initialize environment renderer (match frame pass color format: rgba16float)
        environmentRenderer = new EnvironmentRenderer();
        await environmentRenderer.initialize({
            device,
            presentationFormat: 'rgba16float',
            sampleCount: MSAA_SAMPLE_COUNT,
        });
        // Precompute IBL textures (best-effort)
        try {
            // Shadow placeholders for bindings 4 & 5
            const shadowPlaceholder = device.createTexture({
                label: 'shadow-atlas-placeholder-r',
                size: [1, 1, 1],
                format: 'depth32float',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
            });
            const shadowSamplerCmp = device.createSampler({
                label: 'shadow-comparison-sampler-r',
                compare: 'less-equal',
                magFilter: 'linear',
                minFilter: 'linear',
            });
            // Ensure environment params exist for IBL capture (procedural-sky defaults)
            // Needed so the env-capture pipeline has a valid group(0) bind group
            const defaultEnv = new EnvironmentComponent();
            environmentRenderer.updateParams(defaultEnv);
            const { brdfLut, envCube } = await environmentRenderer.prepareIBLResources(128);
            const newBg = device.createBindGroup({
                label: 'material-atlas-bg+ibl',
                layout: textureBindGroupLayout,
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: atlasTexture.createView({ label: 'atlas-texture-view' }) },
                    { binding: 2, resource: normalAtlasTexture.createView({ label: 'atlas-normal-texture-view' }) },
                    { binding: 3, resource: { buffer: atlasMetaBuffer } },
                    // shadow bindings (4,5) will be swapped later by ShadowPass; placeholders for now
                    { binding: 4, resource: shadowPlaceholder.createView() },
                    { binding: 5, resource: shadowSamplerCmp },
                    { binding: 6, resource: brdfLut.createView() },
                    { binding: 7, resource: envCube.createView({ dimension: 'cube' }) },
                ],
            });
            frameResources.textureBindGroup = newBg;
        }
        catch {
            // ignore if IBL generation fails in minimal environments
        }
        // TODO: Uncomment in Phase 4 when @engine/script exists
        // Initialize logic connection renderer
        // if (logicConnectionRenderer) {
        //   try {
        //     await logicConnectionRenderer.initialize(device, presentationFormat);
        //     Logger.info('Logic connection renderer initialized');
        //   } catch (err) {
        //     Logger.warn('Failed to initialize logic connection renderer:', err);
        //     logicConnectionRenderer = null;
        //   }
        // }
        frame = () => {
            if (animationFrameHandle !== null) {
                try {
                    cancelAnimationFrame(animationFrameHandle);
                }
                catch (e) {
                    Logger.warn('cancelAnimationFrame failed', e);
                }
                animationFrameHandle = null;
            }
            if (cleanedUp || renderAbortSignal.aborted) {
                return;
            }
            updateCanvasSize(canvas);
            if (canvas.height === 0 || canvas.width === 0) {
                Logger.debug('Skipping frame: canvas has zero dimension', { w: canvas.width, h: canvas.height });
                scheduleNextFrame();
                return;
            }
            // Compute delta time (seconds) for systems
            let dtSec = 0;
            try {
                const nowMs = typeof performance !== 'undefined' && typeof performance.now === 'function'
                    ? performance.now()
                    : Date.now();
                if (lastFrameTimeMs !== null) {
                    dtSec = Math.max(0, (nowMs - lastFrameTimeMs) / 1000);
                    // Clamp dt to avoid huge spikes
                    if (!Number.isFinite(dtSec) || dtSec > 0.1)
                        dtSec = 0.1;
                }
                lastFrameTimeMs = nowMs;
            }
            catch {
                dtSec = 0;
            }
            const aspect = canvas.width / canvas.height;
            // Update camera matrices using CameraSystem
            const { viewProjection: viewProjectionMatrix, eyePosition: eyePos } = cameraSystem.updateCamera(currentCameraEntity, currentScene, getOrbitState, aspect);
            const eyeX = eyePos[0];
            const eyeY = eyePos[1];
            const eyeZ = eyePos[2];
            // Call frame update callback (for play mode, physics, etc.)
            if (onFrameUpdateFn && dtSec > 0) {
                try {
                    onFrameUpdateFn(dtSec);
                }
                catch (err) {
                    Logger.warn('Frame update callback failed:', err);
                }
            }
            // TODO: Uncomment in Phase 4 when @engine/script exists
            // Per-frame system updates (runtime simulation)
            // if (scriptSystem && dtSec > 0 && shouldSimulateFn()) {
            //   try {
            //     scriptSystem.update(dtSec);
            //     scriptSystem.lateUpdate(dtSec);
            //   } catch (err) {
            //     Logger.warn('ScriptSystem update failed:', err);
            //   }
            // }
            // Update logic cube system
            // if (logicCubeSystem && dtSec > 0 && shouldSimulateFn()) {
            //   try {
            //     logicCubeSystem.update(dtSec);
            //   } catch (err) {
            //     Logger.warn('LogicCubeSystem update failed:', err);
            //   }
            // }
            // TODO: Uncomment in Phase 4
            // Update logic connection renderer animations
            // if (logicConnectionRenderer && dtSec > 0) {
            //   try {
            //     logicConnectionRenderer.update(dtSec);
            //   } catch (err) {
            //     Logger.warn('Logic connection renderer update failed:', err);
            //   }
            // }
            // Update all dynamic uniforms (matrices, camera, lighting)
            const lightingData = lightManager ? lightManager.getLightingData(frameId) : undefined;
            uniformManager.updateDynamicUniforms(viewProjectionMatrix, [eyeX, eyeY, eyeZ], lightingData);
            frameId++;
            // Optional timestamp tracking for render pass
            let passDesc;
            if (supportsTimestampQueries && frameResources.timestampQuerySet) {
                passDesc = {
                    timestampWrites: {
                        querySet: frameResources.timestampQuerySet,
                        beginningOfPassWriteIndex: 0,
                        endOfPassWriteIndex: 1,
                    },
                };
            }
            // Render frame (handles all rendering operations)
            geometry = frameRenderer.renderFrame({
                device,
                canvas,
                context,
                presentationFormat,
                frameResources,
                scene: currentScene,
                geometry,
                environmentRenderer,
                gridRenderer,
                // logicConnectionRenderer: null, // TODO: Phase 4
                uniformManager,
                lightingData,
                ...(gpuTimingListeners.length
                    ? {
                        onGpuTimings: (timings) => {
                            for (const listener of gpuTimingListeners) {
                                try {
                                    listener(timings);
                                }
                                catch (err) {
                                    Logger.warn('GPU timing listener failed', err);
                                }
                            }
                        },
                    }
                    : {}),
            }, viewProjectionMatrix, [eyeX, eyeY, eyeZ], passDesc, cameraSystem.getViewMatrix(), cameraSystem.getProjectionMatrix());
            // For tests, ensure timestamp resolves happen (resolve/copy handled below)
            scheduleNextFrame();
        };
    }
    catch (err) {
        try {
            resizeObserver?.disconnect();
        }
        catch (e) {
            Logger.warn('ResizeObserver disconnect failed during init failure', e);
        }
        throw err instanceof Error ? err : new Error(String(err));
    }
    function cleanup() {
        if (cleanedUp)
            return;
        cleanedUp = true;
        // Helper to safely destroy GPU resources
        const safeDestroy = (resource) => {
            try {
                resource?.destroy?.();
            }
            catch (e) {
                Logger.warn('Destroy failed', e);
            }
        };
        // Stop rendering
        if (!renderAbortSignal.aborted) {
            try {
                renderAbortController.abort();
            }
            catch (e) {
                Logger.warn('Abort controller abort failed', e);
            }
        }
        if (animationFrameHandle !== null) {
            try {
                cancelAnimationFrame(animationFrameHandle);
            }
            catch (e) {
                Logger.warn('cancelAnimationFrame during cleanup failed', e);
            }
            animationFrameHandle = null;
        }
        try {
            resizeObserver?.disconnect();
        }
        catch (e) {
            Logger.warn('ResizeObserver disconnect during cleanup failed', e);
        }
        // Destroy all GPU resources
        safeDestroy(frameResources.timestampReadBuffer);
        safeDestroy(frameResources.timestampResolveBuffer);
        safeDestroy(frameResources.timestampQuerySet);
        safeDestroy(frameResources.uniformBuffer);
        safeDestroy(frameResources.vertexBuffer);
        safeDestroy(frameResources.indexBuffer);
        safeDestroy(frameResources.instanceOffsetBuffer);
        safeDestroy(frameResources.instanceColorScaleBuffer);
        safeDestroy(frameResources.instanceRotationBuffer);
        safeDestroy(frameResources.instanceMaterialIdBuffer);
        safeDestroy(frameResources.sideTexture);
        safeDestroy(frameResources.topTexture);
        safeDestroy(frameResources.msaaColorTexture);
        safeDestroy(frameResources.depthTexture);
        safeDestroy(device);
        // Cleanup renderers and systems
        try {
            environmentRenderer?.cleanup();
            environmentRenderer = null;
            // TODO: Phase 4
            // logicConnectionRenderer?.dispose();
            // logicConnectionRenderer = null;
            // scriptSystem = null;
            // logicCubeSystem = null;
            lastFrameTimeMs = null;
        }
        catch (e) {
            Logger.warn('Renderer systems cleanup failed', e);
        }
    }
    renderAbortSignal.addEventListener('abort', () => {
        try {
            cleanup();
        }
        catch (e) {
            Logger.warn('Cleanup during abort failed', e);
        }
    }, { once: true });
    window.addEventListener('beforeunload', cleanup, { once: true });
    statusEl.textContent = DEFAULT_STATUS_MESSAGE;
    scheduleNextFrame();
    /**
     * Updates instance buffers from the current scene.
     * Note: Per-frame updates are handled automatically by FrameRenderer.
     */
    function updateScene() {
        if (!currentScene) {
            Logger.warn('No scene to update');
            return;
        }
        // Scene updates are now handled automatically during renderFrame
        // This method is primarily for backward compatibility
        // The next frame render will pick up any scene changes
    }
    return {
        cleanup,
        abort: () => {
            try {
                renderAbortController.abort();
            }
            catch (e) {
                Logger.warn('Abort controller abort failed', e);
            }
        },
        updateScene,
        getScene: () => currentScene,
        setGridRenderer: (renderer) => {
            gridRenderer = renderer;
        },
        initializeGridRenderer: async (renderer) => {
            if (!renderer || typeof renderer.initialize !== 'function') {
                throw new Error('Invalid grid renderer');
            }
            // Match frame pass color format to avoid attachment state mismatches
            await renderer.initialize(device, 'rgba16float', 'depth24plus');
            gridRenderer = renderer;
        },
        getDevice: () => device,
        getPresentationFormat: () => presentationFormat,
        getCapabilities: () => capabilities,
        supportsTimestampQueries: () => capabilities.features.timestampQuery,
        supportsOcclusionQueries: () => capabilities.features.occlusionQuery,
        supportsTextureCompression: () => capabilities.features.textureCompression.bc ||
            capabilities.features.textureCompression.etc2 ||
            capabilities.features.textureCompression.astc,
        getFrameRenderer: () => frameRenderer,
        onGpuTimings: (handler) => {
            gpuTimingListeners.push(handler);
        },
    };
}
// validateGeometry moved to resources.validateGeometryData
//# sourceMappingURL=Renderer.js.map