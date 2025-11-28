/**
 * Renderer
 *
 * Main WebGPU renderer orchestrator. Manages the complete rendering lifecycle:
 * - Device acquisition and configuration
 * - Frame loop management
 * - Resource creation and disposal
 * - Scene rendering
 *
 * @module gfx-webgpu/core/Renderer
 */

// ========== External Dependencies ==========
import type { OrbitControlsState } from '@engine/camera';
import type { Scene, Entity } from '@engine/world';
import { EnvironmentComponent, type VisualPreset } from '@engine/world';
import { Logger } from '@engine/core/utils';
import { ScriptSystem, LogicCubeSystem } from '@engine/script';
import { init as initWasmCollision, type CollisionWorld } from '@engine/wasm-collision';
import { initializeWasmTextureProcessor } from '../resources/GPUAtlasMaterialBuilder';

// ========== Internal Dependencies ==========
import { updateCanvasSize, getTimestampPeriod } from './helpers';
import {
  pickAdapter,
  probeAdapterCapabilities,
  probeResultToCapabilities,
  validateMinimumLimits,
  type FeatureTier,
} from './adapterProbing';
import {
  DEFAULT_GEOMETRY,
  createGeometryBuffers,
  createTimestampResources,
  createUniformResources,
  createTextureAtlas,
  createPipelines,
  createDepthTexture,
  createMsaaColorTarget,
} from '../resources/resources';
import type { FrameResources, GeometryData } from '../resources/resources';
import { GPUBufferPool } from './bufferPool';
import { LightManager } from '../lighting/LightManager';
import { LogicConnectionRenderer } from '../LogicConnectionRenderer';
import { EnvironmentRenderer } from '../renderers/EnvironmentRenderer';
import { WaterRenderer } from '../renderers/WaterRenderer';
import { CameraSystem } from './CameraSystem';
import { UniformManager } from './UniformManager';
import { FrameRenderer } from './FrameRenderer';
import { InstanceManager } from './InstanceManager';
import { TextureCompressionManager } from '../textures/TextureCompressionManager';
import type { CompressionFormat } from '../textures/TextureCompressionManager';
import { ResourceManager } from '../resources/ResourceManager';
import { initializeMaterialLibrary } from '../materials/MaterialLibrary';

// ========== Config ==========
import {
  DEFAULT_STATUS_MESSAGE,
  MSAA_SAMPLE_COUNT,
  TIMESTAMP_QUERY_COUNT,
  UNIFORM_BUFFER_SIZE,
  UNIFORM_DATA_LENGTH,
  TIMESTAMP_BUFFER_SIZE,
  MAX_DELTA_TIME_SEC,
  MAX_DEVICE_RECREATION_ATTEMPTS,
  OCCLUSION_BUFFER_WIDTH,
  OCCLUSION_BUFFER_HEIGHT,
  TIMESTAMP_INDICES,
} from '../config';
import type { RendererCapabilities } from '../config';

// ========== Types (re-exported from RendererTypes) ==========
import type {
  Renderer,
  GridRenderer,
  RendererOptions,
  RenderSettings,
  GpuTimingsHandler,
  CpuTimingsHandler,
  ShadowMetricsHandler,
  RenderStatsHandler,
} from './RendererTypes';

// Re-export types for backwards compatibility
export type { Renderer, GridRenderer, RendererOptions } from './RendererTypes';

// ========== Helper Functions ==========

/**
 * Maps visual preset to render settings.
 */
function applyVisualPreset(preset: VisualPreset | undefined): Partial<RenderSettings> {
  switch (preset) {
    case 'stylized-balanced':
      return {
        enableHDR: true,
        enableBloom: true,
        enableSSAO: true,
        enableFXAA: true,
        enableOutlines: true,
        outlineQuality: 'med',
        shadowQuality: 'med',
      };
    case 'cinematic':
      return {
        enableHDR: true,
        enableBloom: true,
        enableSSAO: true,
        enableFXAA: true,
        enableOutlines: true,
        outlineQuality: 'med',
        shadowQuality: 'high',
      };
    case 'low':
      return {
        enableHDR: false,
        enableBloom: false,
        enableSSAO: false,
        enableFXAA: false,
        enableOutlines: false,
        shadowQuality: 'low',
      };
    default:
      return {};
  }
}

function hasPreferredCanvasFormat(
  gpu: unknown
): gpu is { getPreferredCanvasFormat: () => GPUTextureFormat } {
  return (
    typeof gpu === 'object' &&
    gpu !== null &&
    typeof (gpu as GPU).getPreferredCanvasFormat === 'function'
  );
}

// Vertex buffer layout constants
const VERTEX_STRIDE = 24;
const INSTANCE_INTERLEAVED_STRIDE = 96;

/**
 * Creates vertex buffer layouts for the render pipeline.
 * Uses interleaved instance buffer for optimal GPU compaction.
 * Layout matches FrameResourceFactory and FrameRenderer binding.
 */
function createVertexBufferLayouts(): GPUVertexBufferLayout[] {
  return [
    // Vertex buffer (position, normal, uv, AO)
    {
      arrayStride: VERTEX_STRIDE,
      stepMode: 'vertex',
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
        { shaderLocation: 1, offset: 12, format: 'snorm8x4' },  // normal
        { shaderLocation: 2, offset: 16, format: 'float16x2' }, // uv
        { shaderLocation: 3, offset: 20, format: 'unorm8x4' },  // AO (x), rest unused
      ],
    },
    // Single interleaved instance buffer (96 bytes per instance)
    // Combines all instance attributes for single-pass GPU compaction
    {
      arrayStride: INSTANCE_INTERLEAVED_STRIDE,
      stepMode: 'instance',
      attributes: [
        { shaderLocation: 4, offset: 0, format: 'float32x3' },   // offset (12 bytes)
        { shaderLocation: 5, offset: 12, format: 'float32x4' },  // colorScale (16 bytes)
        { shaderLocation: 6, offset: 28, format: 'float32x4' },  // secondaryColor (16 bytes)
        { shaderLocation: 7, offset: 44, format: 'float32x4' },  // emissiveColor (16 bytes)
        { shaderLocation: 8, offset: 60, format: 'float32x4' },  // materialParams (16 bytes)
        { shaderLocation: 9, offset: 76, format: 'float32x4' },  // rotation (16 bytes)
        { shaderLocation: 10, offset: 92, format: 'float32' },   // materialId (4 bytes)
      ],
    },
  ];
}

// ========== Main Renderer Function ==========

/**
 * Initializes the WebGPU renderer.
 *
 * @param options - Renderer configuration options
 * @returns Promise resolving to the Renderer interface
 */
export async function initRenderer(options: RendererOptions): Promise<Renderer> {
  const { canvas, statusEl, getOrbitState, orbitTarget = [0, 0, 0] } = options;
  const shouldSimulateFn = typeof options.shouldSimulate === 'function' ? options.shouldSimulate : () => true;
  const onFrameUpdateFn = options.onFrameUpdate;
  const currentScene = options.scene ?? null;
  let currentCameraEntity = options.cameraEntity ?? null;
  let lastAppliedPreset: VisualPreset | undefined = undefined;

  // Resolve render settings with defaults (mutable for runtime updates)
  let renderSettings = {
    enableHDR: options.enableHDR !== false,
    enableBloom: options.enableBloom !== false,
    enableShadows: options.enableShadows !== false,
    enableSSAO: options.enableSSAO !== false,
    enableSSGI: options.enableSSGI === true,
    enableFXAA: false,
    enableForwardPlus: false,
    enableScreenLOD: false,
    shadowQuality: (options.shadowQuality ?? 'med') as 'low' | 'med' | 'high' | 'ultra',
    enableComputePrepass: options.enableComputePrepass !== false,
    enableAsyncCompute: options.enableAsyncCompute ?? false,
    msaaSampleCount: (options.msaaSampleCount ?? MSAA_SAMPLE_COUNT) as 1 | 2 | 4,
    enableOutlines: options.enableOutlines ?? false,
    outlineQuality: (options.outlineQuality ?? 'med') as 'low' | 'med',
    resolutionScale: 1.0,
  };

  // Initialize light manager for the scene
  const lightManager = currentScene ? new LightManager(currentScene) : null;

  if (!('gpu' in navigator) || !navigator.gpu) {
    statusEl.textContent = 'WebGPU not supported in this browser.';
    throw new Error('WebGPU not supported');
  }

  // Use new adapter probing strategy
  const adapter = await pickAdapter();
  if (!adapter) {
    statusEl.textContent = 'Failed to acquire GPU adapter.';
    throw new Error('Failed to acquire GPU adapter.');
  }

  // Probe adapter capabilities to determine Tier and features
  const probeResult = await probeAdapterCapabilities(adapter);
  
  // Validate minimum limits (warns but doesn't fail)
  validateMinimumLimits(probeResult.limits);

  // Build required features list based on Tier
  const requiredFeatures: GPUFeatureName[] = [];
  if (probeResult.timestampQuery) {
    requiredFeatures.push('timestamp-query');
  }
  // Do not request occlusion-query proactively due to limited support in some runtimes

  let device = await adapter.requestDevice({ requiredFeatures });

  // Convert probe result to RendererCapabilities format
  const capabilities: RendererCapabilities = probeResultToCapabilities(probeResult);

  // Initialize texture compression manager
  const textureCompressionManager = new TextureCompressionManager(capabilities);

  // Initialize ResourceManager for centralized texture/material management
  const resourceManager = options.resourceManager ?? new ResourceManager();
  initializeMaterialLibrary(resourceManager.materials);
  resourceManager.initialize(device);
  Logger.info('[Renderer] ResourceManager initialized with', resourceManager.materials.count, 'materials');

  const {
    querySet: timestampQuerySet,
    resolveBuffer: timestampResolveBuffer,
    readBuffer: timestampReadBuffer,
  } = createTimestampResources(device, capabilities.features.timestampQuery, {
    queryCount: TIMESTAMP_QUERY_COUNT,
    bufferSize: TIMESTAMP_BUFFER_SIZE,
  });

  const context = canvas.getContext('webgpu');
  if (!context) {
    statusEl.textContent = 'Failed to create WebGPU context.';
    throw new Error('Failed to create WebGPU context.');
  }
  // TypeScript: context is non-null after the check above
  const webgpuContext: GPUCanvasContext = context;

  // Configure canvas format (try preferred, fallback to rgba8unorm/bgra8unorm)
  let presentationFormat: GPUTextureFormat = hasPreferredCanvasFormat(navigator.gpu)
    ? navigator.gpu.getPreferredCanvasFormat()
    : 'rgba8unorm';
  try {
    webgpuContext.configure({ device, format: presentationFormat, alphaMode: 'opaque' });
  } catch (err) {
    const altFormat: GPUTextureFormat = presentationFormat === 'rgba8unorm' ? 'bgra8unorm' : 'rgba8unorm';
    try {
      webgpuContext.configure({ device, format: altFormat, alphaMode: 'opaque' });
      Logger.warn('Canvas configure fallback format used:', { from: presentationFormat, to: altFormat });
      presentationFormat = altFormat;
    } catch (err2) {
      Logger.error('Failed to configure canvas with both preferred and fallback formats', err2 as unknown as Error);
      statusEl.textContent = 'WebGPU canvas configuration failed.';
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  const renderAbortController = new AbortController();
  const renderAbortSignal = renderAbortController.signal;
  const gpuTimingListeners: GpuTimingsHandler[] = [];
  const cpuTimingListeners: CpuTimingsHandler[] = [];
  const shadowMetricsListeners: ShadowMetricsHandler[] = [];
  const renderStatsListeners: RenderStatsHandler[] = [];

  let cleanedUp = false;
  
  // Track the device that was used to configure the context
  // This ensures we can validate device consistency before rendering
  let configuredDevice: GPUDevice = device;
  // Track which device was used to create frameResources
  // This allows us to detect when resources become invalid after device recreation
  let frameResourcesDevice: GPUDevice = device;
  let deviceRecreationAttempts = 0;
  const MAX_DEVICE_RECREATION_ATTEMPTS = 3;
  let isRecreatingDevice = false;
  let currentTier = capabilities.tier;

  /**
   * Safely disposes GPU resources from frameResources.
   * This is idempotent and safe to call multiple times.
   */
  function disposeFrameResources(): void {
    if (!frameResources) return;

    const safeDestroy = (resource: { destroy?: () => void } | null | undefined) => {
      try {
        resource?.destroy?.();
      } catch (e) {
        Logger.debug('Resource destroy failed during device recovery', e);
      }
    };

    try {
      safeDestroy(frameResources.timestampReadBuffer);
      safeDestroy(frameResources.timestampResolveBuffer);
      safeDestroy(frameResources.timestampQuerySet);
      safeDestroy(frameResources.uniformBuffer);
      safeDestroy(frameResources.vertexBuffer);
      safeDestroy(frameResources.indexBuffer);
      safeDestroy(frameResources.instanceInterleavedBuffer);
      safeDestroy(frameResources.instanceInterleavedStagingBuffer);
      safeDestroy(frameResources.instanceBoundsBuffer);
      safeDestroy(frameResources.instanceIndirectArgsBuffer);
      safeDestroy(frameResources.sideTexture);
      safeDestroy(frameResources.topTexture);
      safeDestroy(frameResources.msaaColorTexture);
      safeDestroy(frameResources.depthTexture);
      safeDestroy(frameResources.atlasMetaBuffer);
      
      // Dispose renderers
      try {
        environmentRenderer?.cleanup();
        waterRenderer?.dispose();
      } catch (e) {
        Logger.debug('Renderer cleanup failed during device recovery', e);
      }
    } catch (e) {
      Logger.warn('Frame resources disposal failed', e);
    }
  }

  /**
   * Recreates all frame resources with a new device after device loss.
   * This is a complete recreation of all GPU resources.
   */
  async function recreateFrameResources(newDevice: GPUDevice, newAdapter: GPUAdapter): Promise<void> {
    try {
      Logger.info('Recreating frame resources with new device');
      
      // Dispose old resources first
      disposeFrameResources();
      
      // Recreate geometry buffers (use current geometry state)
      const geometryBuffers = createGeometryBuffers(newDevice, geometry);

      // Recreate uniform resources
      const uniformResources = createUniformResources(newDevice, {
        bufferSize: UNIFORM_BUFFER_SIZE,
        dataLength: UNIFORM_DATA_LENGTH,
      });

      // Recreate texture atlas
      const vertexBuffers = createVertexBufferLayouts();
      const { textureBindGroupLayout, textureBindGroup, atlasTexture, normalAtlasTexture, sampler, atlas, atlasMetaBuffer } =
        createTextureAtlas(newDevice, undefined, 2048, 128, { useGPU: true });

      // Recreate pipelines
      const { renderPipeline, transparentPipeline, overlayPipeline } = await createPipelines(
        newDevice,
        'rgba16float',
        uniformResources.uniformBindGroupLayout,
        textureBindGroupLayout,
        vertexBuffers,
        { sampleCount: renderSettings.msaaSampleCount, statusEl }
      );

      // Recreate uniform bind group
      const uniformBindGroup = newDevice.createBindGroup({
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

      // Recreate depth and MSAA textures
      const depthTexture = createDepthTexture(newDevice, canvas, renderSettings.msaaSampleCount);
      const depthTextureView = depthTexture.createView({ label: 'frame-depth-view' });
      const msaaColorTexture = createMsaaColorTarget(
        newDevice,
        canvas,
        presentationFormat,
        renderSettings.msaaSampleCount
      );
      const msaaColorView = msaaColorTexture.createView({ label: 'frame-msaa-color-view' });

      // Recreate timestamp resources
      const {
        querySet: timestampQuerySet,
        resolveBuffer: timestampResolveBuffer,
        readBuffer: timestampReadBuffer,
      } = createTimestampResources(newDevice, capabilities.features.timestampQuery, {
        queryCount: TIMESTAMP_QUERY_COUNT,
        bufferSize: TIMESTAMP_BUFFER_SIZE,
      });

      // Recreate buffer pool
      const bufferPool = new GPUBufferPool(newDevice);

      // Update uniform manager with new buffer
      uniformManager.updateBuffer(newDevice, uniformResources.uniformBuffer);
      
      // Reinitialize static uniforms
      uniformManager.initializeStaticUniforms(atlas.getConfig());

      // Recreate frame resources object
      frameResourcesDevice = newDevice;
      frameResources = {
        ...geometryBuffers,
        uniformBuffer: uniformResources.uniformBuffer,
        uniformBindGroupLayout: uniformResources.uniformBindGroupLayout,
        textureBindGroupLayout,
        renderPipeline,
        transparentPipeline,
        overlayPipeline,
        uniformBindGroup,
        uniformData: uniformResources.uniformData,
        timestampQuerySet,
        timestampResolveBuffer,
        timestampReadBuffer,
        timestampPeriod: getTimestampPeriod(newDevice, newAdapter),
        sideTexture: atlasTexture,
        topTexture: atlasTexture,
        normalAtlasTexture,
        sampler,
        textureBindGroup,
        atlasMetaBuffer,
        depthTexture,
        msaaColorTexture,
        depthTextureView,
        msaaColorView,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ bufferPool, atlas } as any),
      } as FrameResources;

      // Recreate environment renderer
      if (environmentRenderer) {
        try {
          await environmentRenderer.initialize({
            device: newDevice,
            presentationFormat: 'rgba16float',
            sampleCount: renderSettings.msaaSampleCount,
          });
        } catch (e) {
          Logger.warn('Failed to recreate environment renderer', e);
        }
      }

      // Recreate water renderer
      if (waterRenderer) {
        try {
          await waterRenderer.initialize({
            device: newDevice,
            presentationFormat: 'rgba16float',
            sampleCount: renderSettings.msaaSampleCount,
          });
        } catch (e) {
          Logger.warn('Failed to recreate water renderer', e);
        }
      }

      // Recreate IBL resources (best-effort)
      if (environmentRenderer) {
        try {
          const shadowPlaceholder = newDevice.createTexture({
            label: 'shadow-atlas-placeholder-r',
            size: [1, 1, 1],
            format: 'depth32float',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
          });
          const shadowSamplerCmp = newDevice.createSampler({
            label: 'shadow-comparison-sampler-r',
            compare: 'less-equal',
            magFilter: 'linear',
            minFilter: 'linear',
          });
          const defaultEnv = new EnvironmentComponent();
          environmentRenderer.updateParams(defaultEnv);

          const { brdfLut, envCube } = await environmentRenderer.prepareIBLResources(defaultEnv, 128);
          const newBg = newDevice.createBindGroup({
            label: 'material-atlas-bg+ibl',
            layout: textureBindGroupLayout,
            entries: [
              { binding: 0, resource: sampler },
              { binding: 1, resource: atlasTexture.createView({ label: 'atlas-texture-view' }) },
              { binding: 2, resource: normalAtlasTexture.createView({ label: 'atlas-normal-texture-view' }) },
              { binding: 3, resource: { buffer: atlasMetaBuffer } },
              { binding: 4, resource: shadowPlaceholder.createView() },
              { binding: 5, resource: shadowSamplerCmp },
              { binding: 6, resource: brdfLut.createView() },
              { binding: 7, resource: envCube.createView({ dimension: 'cube' }) },
            ],
          });
          (frameResources as any).textureBindGroup = newBg;
        } catch (e) {
          Logger.debug('IBL resource recreation failed (non-critical)', e);
        }
      }

      // Recreate logic connection renderer
      if (logicConnectionRenderer) {
        try {
          await logicConnectionRenderer.initialize(newDevice, presentationFormat);
        } catch (e) {
          Logger.warn('Failed to recreate logic connection renderer', e);
        }
      }

      // Recreate grid renderer if it exists
      if (gridRenderer) {
        try {
          await gridRenderer.initialize(newDevice, 'rgba16float', 'depth24plus');
        } catch (e) {
          Logger.warn('Failed to recreate grid renderer', e);
        }
      }

      Logger.info('Frame resources recreated successfully');
    } catch (err) {
      Logger.error('Failed to recreate frame resources', err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Attempts to recreate the device and reconfigure the context after device loss.
   * Implements Tier downgrade strategy: if recreation fails, try lower Tier.
   * This allows the renderer to recover from transient device loss.
   */
  async function recreateDeviceAndReconfigure(downgradeTier = false): Promise<GPUDevice | null> {
    if (isRecreatingDevice || cleanedUp || renderAbortSignal.aborted) {
      return null;
    }
    
    if (deviceRecreationAttempts >= MAX_DEVICE_RECREATION_ATTEMPTS) {
      Logger.error('Max device recreation attempts reached. Manual reload required.');
      statusEl.textContent = 'WebGPU device lost. Please reload the page.';
      return null;
    }

    isRecreatingDevice = true;
    deviceRecreationAttempts++;
    
    try {
      Logger.info(`Attempting to recreate device (attempt ${deviceRecreationAttempts}/${MAX_DEVICE_RECREATION_ATTEMPTS}, tier: ${currentTier})`);
      statusEl.textContent = 'Recreating WebGPU device...';
      
      // Dispose old resources before creating new ones
      disposeFrameResources();
      
      // Use adapter probing with potential Tier downgrade
      let targetTier = downgradeTier ? Math.max(0, currentTier - 1) : currentTier;
      const newAdapter = await pickAdapter();
      if (!newAdapter) {
        throw new Error('Failed to acquire GPU adapter');
      }

      // Probe capabilities
      const newProbeResult = await probeAdapterCapabilities(newAdapter);
      
      // If we're trying to downgrade but adapter supports higher tier, use it
      if (newProbeResult.tier > targetTier && !downgradeTier) {
        targetTier = newProbeResult.tier;
      } else if (newProbeResult.tier < targetTier) {
        // Adapter doesn't support requested tier, use what's available
        targetTier = newProbeResult.tier;
        Logger.warn(`Adapter supports Tier ${newProbeResult.tier}, downgrading from Tier ${currentTier}`);
      }

      // Build required features based on target tier
      const newRequiredFeatures: GPUFeatureName[] = [];
      if (targetTier >= 2 && newProbeResult.timestampQuery) {
        newRequiredFeatures.push('timestamp-query');
      }

      const newDevice = await newAdapter.requestDevice({ requiredFeatures: newRequiredFeatures });
      
      // Update capabilities
      const newCapabilities = probeResultToCapabilities(newProbeResult);
      // Override tier to match what we're actually using
      newCapabilities.tier = targetTier as FeatureTier;
      currentTier = targetTier as FeatureTier;
      
      // Reconfigure the context with the new device
      try {
        webgpuContext.configure({ device: newDevice, format: presentationFormat, alphaMode: 'opaque' });
      } catch (err) {
        const altFormat: GPUTextureFormat = presentationFormat === 'rgba8unorm' ? 'bgra8unorm' : 'rgba8unorm';
        try {
          webgpuContext.configure({ device: newDevice, format: altFormat, alphaMode: 'opaque' });
          Logger.warn('Canvas configure fallback format used on device recreation:', { from: presentationFormat, to: altFormat });
        } catch (err2) {
          throw new Error(`Failed to reconfigure canvas: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Update the configured device reference and capabilities
      configuredDevice = newDevice;
      // Update capabilities object (mutable reference)
      Object.assign(capabilities, newCapabilities);
      
      // Update texture compression manager with new capabilities
      textureCompressionManager.updateCapabilities(newCapabilities);
      
      // Recreate all frame resources with the new device
      try {
        await recreateFrameResources(newDevice, newAdapter);
        Logger.info(`Device recreated successfully at Tier ${targetTier}`);
        statusEl.textContent = DEFAULT_STATUS_MESSAGE;
      } catch (resourceErr) {
        Logger.error('Failed to recreate frame resources after device recreation', resourceErr instanceof Error ? resourceErr : new Error(String(resourceErr)));
        throw resourceErr;
      }
      
      return newDevice;
    } catch (err) {
      Logger.error('Device recreation failed:', err instanceof Error ? err : new Error(String(err)));
      
      // Try downgrade if we haven't already
      if (!downgradeTier && currentTier > 0) {
        Logger.info('Attempting Tier downgrade for device recreation');
        isRecreatingDevice = false; // Reset flag to allow retry
        return recreateDeviceAndReconfigure(true);
      }
      
      statusEl.textContent = 'Failed to recreate WebGPU device. Please reload.';
      return null;
    } finally {
      isRecreatingDevice = false;
    }
  }

  // Handle device loss with recreation attempt
  device.lost
    .then(async (info) => {
      if (!cleanedUp && !renderAbortSignal.aborted) {
        // Classify device loss reason for telemetry
        const reason = info.reason || 'unknown';
        Logger.error('WebGPU device lost', {
          reason,
          message: info.message || 'No message provided',
        } as unknown as Error);
        
        // Attempt to recreate the device if the loss was transient (reason: 'destroyed')
        // Permanent losses (e.g., GPU crash, out-of-memory) may be recoverable with downgrade
        if (reason === 'destroyed' || reason === 'unknown') {
          const newDevice = await recreateDeviceAndReconfigure();
          if (newDevice) {
            // Device and resources are now recreated
            device = newDevice;
            frameResourcesDevice = newDevice;
            Logger.info('Device recreated successfully');
          } else {
            // Recreation failed - cleanup and show error
            statusEl.textContent = 'WebGPU device lost. Please reload the page.';
            try {
              cleanup();
            } catch (cleanupErr) {
              Logger.warn('Cleanup after device recreation failure threw', cleanupErr);
            }
          }
        } else {
          // Permanent device loss (e.g., 'out-of-memory') - try recovery with downgrade
          Logger.warn(`Permanent device loss detected (${reason}), attempting recovery with Tier downgrade`);
          const newDevice = await recreateDeviceAndReconfigure(true); // Force downgrade
          if (newDevice) {
            device = newDevice;
            frameResourcesDevice = newDevice;
            Logger.info('Device recovered with Tier downgrade');
          } else {
            statusEl.textContent = 'WebGPU device lost. Please reload the page.';
            try {
              cleanup();
            } catch (cleanupErr) {
              Logger.warn('Cleanup after device loss threw', cleanupErr);
            }
          }
        }
      }
    })
    .catch((err) => Logger.error('device.lost failed', err as unknown as Error));

  // Also handle uncaptured errors
  device.addEventListener('uncapturederror', (event) => {
    Logger.error('WebGPU uncaptured error', (event as any).error);
    // Don't trigger device recreation for uncaptured errors - they're usually shader/validation errors
    // But log them for debugging
  });

  let resizeObserver: ResizeObserver | null = null;
  let animationFrameHandle: number | null = null;
  let scheduleNextFrame: () => void;
  let frame: () => void;
  let frameResources: FrameResources;
  let frameRenderer: FrameRenderer;
  let scriptSystem: ScriptSystem | null = null;
  let logicCubeSystem: LogicCubeSystem | null = null;
  let logicConnectionRenderer: LogicConnectionRenderer | null = null;
  let lastFrameTimeMs: number | null = null;
  let uniformManager: UniformManager;
  let cameraSystem: CameraSystem;
  let collisionWorld: CollisionWorld | null = null;

  // Prepare geometry from scene or use default
  let geometry = options.geometry ?? DEFAULT_GEOMETRY;
  geometry = { ...geometry, opaqueCount: geometry.opaqueCount ?? geometry.instanceCount };
  let gridRenderer: GridRenderer | null = null;
  let environmentRenderer: EnvironmentRenderer | null = null;
  let waterRenderer: WaterRenderer | null = null;

  try {
    resizeObserver = new ResizeObserver(() => {
      updateCanvasSize(canvas, renderSettings.resolutionScale);
    });
    resizeObserver.observe(canvas);

    // Update geometry if scene is provided
    if (currentScene) {
      const instanceManager = new InstanceManager();
      const sceneData = instanceManager.buildFromScene(currentScene);
      geometry = {
        ...DEFAULT_GEOMETRY,
        ...sceneData,
      };
      if (!currentCameraEntity) {
        currentCameraEntity = currentScene.primaryCamera;
      }
      // Initialize scripting runtime for scene
      scriptSystem = new ScriptSystem(currentScene);
      // Initialize logic cube system for scene
      logicCubeSystem = new LogicCubeSystem(currentScene);
      // Initialize logic connection renderer
      logicConnectionRenderer = new LogicConnectionRenderer(
        currentScene,
        logicCubeSystem.getConnectionManager()
      );
    }
    const geometryBuffers = createGeometryBuffers(device, geometry);

    // Initialize WASM texture processor for faster texture generation
    try {
      const wasmAvailable = await initializeWasmTextureProcessor();
      if (wasmAvailable) {
        Logger.info('[Renderer] WASM texture processor initialized - 25x faster texture generation');
      }
    } catch (e) {
      Logger.warn('[Renderer] WASM texture processor not available, using GPU/CPU fallback');
    }

    const uniformResources = createUniformResources(device, {
      bufferSize: UNIFORM_BUFFER_SIZE,
      dataLength: UNIFORM_DATA_LENGTH,
    });
    const vertexBuffers = createVertexBufferLayouts();
    const { textureBindGroupLayout, textureBindGroup, atlasTexture, normalAtlasTexture, sampler, atlas, atlasMetaBuffer } =
      createTextureAtlas(device, undefined, 2048, 128, { useGPU: true });

    const { renderPipeline, transparentPipeline, overlayPipeline } = await createPipelines(
      device,
      'rgba16float',
      uniformResources.uniformBindGroupLayout,
      textureBindGroupLayout,
      vertexBuffers,
      { sampleCount: renderSettings.msaaSampleCount, statusEl }
    );

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

    const depthTexture = createDepthTexture(device, canvas, renderSettings.msaaSampleCount);
    const depthTextureView = depthTexture.createView({ label: 'frame-depth-view' });
    const msaaColorTexture = createMsaaColorTarget(
      device,
      canvas,
      presentationFormat,
      renderSettings.msaaSampleCount
    );
    const msaaColorView = msaaColorTexture.createView({ label: 'frame-msaa-color-view' });

    // Initialize rendering systems
    uniformManager = new UniformManager(device, uniformResources.uniformBuffer);
    cameraSystem = new CameraSystem();
    frameRenderer = new FrameRenderer(geometry.instanceCount);
    
    // Initialize collision world
    try {
      const wasm = await initWasmCollision();
      collisionWorld = new wasm.CollisionWorld();
      // Initialize occlusion culling with low resolution buffer
      collisionWorld.init_occlusion_culling(OCCLUSION_BUFFER_WIDTH, OCCLUSION_BUFFER_HEIGHT);
      frameRenderer.setCollisionWorld(wasm, collisionWorld);
    } catch (e) {
      Logger.warn('Failed to initialize CollisionWorld:', e);
    }
    
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
    // Record which device created these resources
    frameResourcesDevice = device;
    frameResources = {
      ...geometryBuffers,
      uniformBuffer: uniformResources.uniformBuffer,
      uniformBindGroupLayout: uniformResources.uniformBindGroupLayout,
      textureBindGroupLayout,
      renderPipeline,
      transparentPipeline,
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
      ...({ bufferPool, atlas } as any),
    } as FrameResources;

    // Initialize environment renderer (match frame pass color format: rgba16float)
    environmentRenderer = new EnvironmentRenderer();
    await environmentRenderer.initialize({
      device,
      presentationFormat: 'rgba16float',
      sampleCount: renderSettings.msaaSampleCount,
    });

    // Initialize water renderer
    waterRenderer = new WaterRenderer();
    await waterRenderer.initialize({
      device,
      presentationFormat: 'rgba16float',
      sampleCount: renderSettings.msaaSampleCount,
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

      const { brdfLut, envCube } = await environmentRenderer.prepareIBLResources(defaultEnv, 128);
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
      (frameResources as any).textureBindGroup = newBg;
    } catch (e) {
      // IBL generation may fail in minimal/test environments - non-critical
      Logger.debug('IBL generation failed in minimal environment', e);
    }

    // Initialize logic connection renderer
    if (logicConnectionRenderer) {
      try {
        await logicConnectionRenderer.initialize(device, presentationFormat);
        Logger.info('Logic connection renderer initialized');
      } catch (err) {
        Logger.warn('Failed to initialize logic connection renderer:', err);
        logicConnectionRenderer = null;
      }
    }

    frame = () => {
      if (animationFrameHandle !== null) {
        try {
          cancelAnimationFrame(animationFrameHandle);
        } catch (e) {
          Logger.warn('cancelAnimationFrame failed', e);
        }
        animationFrameHandle = null;
      }

      if (cleanedUp || renderAbortSignal.aborted) {
        return;
      }

      updateCanvasSize(canvas, renderSettings.resolutionScale);
      if (canvas.height === 0 || canvas.width === 0) {
        Logger.debug('Skipping frame: canvas has zero dimension', { w: canvas.width, h: canvas.height });
        scheduleNextFrame();
        return;
      }
      // Compute delta time (seconds) for systems
      let dtSec = 0;
      try {
        const nowMs =
          typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
        if (lastFrameTimeMs !== null) {
          dtSec = Math.max(0, (nowMs - lastFrameTimeMs) / 1000);
          // Clamp dt to avoid huge spikes (e.g., after tab switch)
          if (!Number.isFinite(dtSec) || dtSec > MAX_DELTA_TIME_SEC) dtSec = MAX_DELTA_TIME_SEC;
        }
        lastFrameTimeMs = nowMs;
      } catch (e) {
        Logger.debug('Delta time calculation failed', e);
        dtSec = 0;
      }
      const aspect = canvas.width / canvas.height;

      // Update camera matrices using CameraSystem
      cameraSystem.updateCamera(
        currentCameraEntity,
        currentScene,
        getOrbitState,
        aspect,
        orbitTarget
      );
      const viewProjectionMatrix = cameraSystem.getViewProjectionMatrix();
      const eyePos = cameraSystem.getEyePosition();
      const eyeX = eyePos[0];
      const eyeY = eyePos[1];
      const eyeZ = eyePos[2];

    // Render frame (handles all rendering operations)
    // Calculate time for animations
    const currentTime = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now() / 1000.0 // Convert to seconds
      : Date.now() / 1000.0;

      // Call frame update callback (for play mode, physics, etc.)
      if (onFrameUpdateFn && dtSec > 0) {
        try {
          onFrameUpdateFn(dtSec);
        } catch (err) {
          Logger.warn('Frame update callback failed:', err);
        }
      }

      // Per-frame system updates (runtime simulation)
      if (scriptSystem && dtSec > 0 && shouldSimulateFn()) {
        try {
          scriptSystem.update(dtSec);
          scriptSystem.lateUpdate(dtSec);
        } catch (err) {
          Logger.warn('ScriptSystem update failed:', err);
        }
      }

      // Update logic cube system
      if (logicCubeSystem && dtSec > 0 && shouldSimulateFn()) {
        try {
          logicCubeSystem.update(dtSec);
        } catch (err) {
          Logger.warn('LogicCubeSystem update failed:', err);
        }
      }

      // Update logic connection renderer animations
      if (logicConnectionRenderer && dtSec > 0) {
        try {
          logicConnectionRenderer.update(dtSec);
        } catch (err) {
          Logger.warn('Logic connection renderer update failed:', err);
        }
      }

      // Update all dynamic uniforms (matrices, camera, lighting)
      const lightingData = lightManager ? lightManager.getLightingData(frameId) : undefined;
      uniformManager.updateDynamicUniforms(viewProjectionMatrix, [eyeX, eyeY, eyeZ], lightingData);
      frameId++;

      // Optional timestamp tracking for render pass
      let passDesc: GPURenderPassDescriptor | undefined;
      if (capabilities.features.timestampQuery && frameResources.timestampQuerySet) {
        passDesc = {
          timestampWrites: {
            querySet: frameResources.timestampQuerySet,
            beginningOfPassWriteIndex: TIMESTAMP_INDICES.MAIN_PASS_BEGIN,
            endOfPassWriteIndex: TIMESTAMP_INDICES.MAIN_PASS_END,
          },
        } as GPURenderPassDescriptor;
      }

    // Validate device consistency before rendering
    // The device used for rendering must match the device that configured the context
    // This prevents WebGPU errors like "texture view associated with different device"
    if (device !== configuredDevice) {
      Logger.warn('Device mismatch detected - skipping frame render. Device may have been recreated.');
      scheduleNextFrame();
      return;
    }

    // Apply visual preset from environment component if changed
    if (currentScene) {
      const environmentEntities = currentScene.queryEntities(EnvironmentComponent);
      const environmentEntity = environmentEntities.find((entity: Entity) => entity.active);
      if (environmentEntity) {
        const envComponent = environmentEntity.getComponent(EnvironmentComponent);
        if (envComponent && envComponent.visualPreset && envComponent.visualPreset !== lastAppliedPreset) {
          const presetSettings = applyVisualPreset(envComponent.visualPreset);
          renderSettings = { ...renderSettings, ...presetSettings };
          lastAppliedPreset = envComponent.visualPreset;
        } else if (!envComponent?.visualPreset && lastAppliedPreset !== undefined) {
          // Reset to defaults if preset removed
          lastAppliedPreset = undefined;
        }
      }
    }

    // Render frame (handles all rendering operations)
    // Calculate time for animations
    // currentTime already calculated above

    // Final cleanup check - prevent rendering if cleanup started mid-frame
    // This can happen in React StrictMode when components unmount during render
    if (cleanedUp || renderAbortSignal.aborted) {
      return;
    }

    geometry = frameRenderer.renderFrame(
      {
        device,
        canvas,
        context: webgpuContext,
        presentationFormat,
        frameResources,
        scene: currentScene,
        geometry,
        environmentRenderer,
        waterRenderer,
        gridRenderer,
        logicConnectionRenderer,
        uniformManager,
        lightingData,
        featureFlags: {
          enableComputePrepass: renderSettings.enableComputePrepass,
          enableAsyncCompute: renderSettings.enableAsyncCompute,
          enableShadows: renderSettings.enableShadows,
          enableBloom: renderSettings.enableBloom,
          enableHDR: renderSettings.enableHDR,
          enableSSAO: renderSettings.enableSSAO,
          enableSSGI: renderSettings.enableSSGI,
          enableFXAA: renderSettings.enableFXAA,
          enableOutlines: renderSettings.enableOutlines,
          enableForwardPlus: renderSettings.enableForwardPlus,
          enableScreenLOD: renderSettings.enableScreenLOD,
        },
        shadowQuality: renderSettings.shadowQuality,
        outlineQuality: renderSettings.outlineQuality,
        msaaSampleCount: renderSettings.msaaSampleCount,
        time: currentTime,
        configuredDevice, // Pass the device that configured the context for validation
        frameResourcesDevice, // Pass the device that created frameResources for validation
        ...(gpuTimingListeners.length && capabilities.features.timestampQuery && frameResources.timestampQuerySet
          ? {
              onGpuTimings: (timings) => {
                for (const listener of gpuTimingListeners) {
                  try {
                    listener(timings);
                  } catch (err) {
                    Logger.warn('GPU timing listener failed', err);
                  }
                }
              },
            }
          : {}),
        ...(cpuTimingListeners.length
          ? {
              onCpuTimings: (timings) => {
                for (const listener of cpuTimingListeners) {
                  try {
                    listener(timings);
                  } catch (err) {
                    Logger.warn('CPU timing listener failed', err);
                  }
                }
              },
            }
          : {}),
        ...(shadowMetricsListeners.length
          ? {
              onShadowMetrics: (metrics) => {
                for (const listener of shadowMetricsListeners) {
                  try {
                    listener(metrics);
                  } catch (err) {
                    Logger.warn('Shadow metrics listener failed', err);
                  }
                }
              },
            }
          : {}),
        ...(renderStatsListeners.length
          ? {
              onRenderStats: (stats) => {
                for (const listener of renderStatsListeners) {
                  try {
                    listener(stats);
                  } catch (err) {
                    Logger.warn('Render stats listener failed', err);
                  }
                }
              },
            }
          : {}),
      },
      viewProjectionMatrix,
      [eyeX, eyeY, eyeZ],
      passDesc,
      cameraSystem.getViewMatrix(),
      cameraSystem.getProjectionMatrix()
    );

      // For tests, ensure timestamp resolves happen (resolve/copy handled below)
      scheduleNextFrame();
    };
  } catch (err) {
    try {
      resizeObserver?.disconnect();
    } catch (e) {
      Logger.warn('ResizeObserver disconnect failed during init failure', e);
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;

    // Helper to safely destroy GPU resources
    const safeDestroy = (resource: { destroy?: () => void } | null | undefined) => {
      try {
        resource?.destroy?.();
      } catch (e) {
        Logger.warn('Destroy failed', e);
      }
    };

    // Stop rendering
    if (!renderAbortSignal.aborted) {
      try {
        renderAbortController.abort();
      } catch (e) {
        Logger.warn('Abort controller abort failed', e);
      }
    }
    if (animationFrameHandle !== null) {
      try {
        cancelAnimationFrame(animationFrameHandle);
      } catch (e) {
        Logger.warn('cancelAnimationFrame during cleanup failed', e);
      }
      animationFrameHandle = null;
    }
    try {
      resizeObserver?.disconnect();
    } catch (e) {
      Logger.warn('ResizeObserver disconnect during cleanup failed', e);
    }

    // Destroy all GPU resources
    safeDestroy(frameResources.timestampReadBuffer);
    safeDestroy(frameResources.timestampResolveBuffer);
    safeDestroy(frameResources.timestampQuerySet);
    safeDestroy(frameResources.uniformBuffer);
    safeDestroy(frameResources.vertexBuffer);
    safeDestroy(frameResources.indexBuffer);
    safeDestroy(frameResources.instanceInterleavedBuffer);
    safeDestroy(frameResources.instanceInterleavedStagingBuffer);
    safeDestroy(frameResources.instanceBoundsBuffer);
    safeDestroy(frameResources.instanceIndirectArgsBuffer);
    safeDestroy(frameResources.sideTexture);
    safeDestroy(frameResources.topTexture);
    safeDestroy(frameResources.msaaColorTexture);
    safeDestroy(frameResources.depthTexture);
    safeDestroy(device);

    // Cleanup renderers and systems
    try {
      environmentRenderer?.cleanup();
      environmentRenderer = null;
      waterRenderer?.dispose();
      waterRenderer = null;
      // Phase 4 cleanup
      logicConnectionRenderer?.dispose();
      logicConnectionRenderer = null;
      scriptSystem = null;
      logicCubeSystem = null;
      lastFrameTimeMs = null;
      if (collisionWorld) {
        collisionWorld.free();
        collisionWorld = null;
      }
      // Dispose ResourceManager
      resourceManager.dispose();
    } catch (e) {
      Logger.warn('Renderer systems cleanup failed', e);
    }

    // Unconfigure the WebGPU canvas context LAST - this is critical for React StrictMode
    // Without this, the canvas remains bound to the old context and re-initialization fails
    // Must be called after all GPU resources are destroyed to avoid race conditions
    try {
      webgpuContext.unconfigure();
    } catch (e) {
      Logger.warn('WebGPU context unconfigure failed', e);
    }
  }

  renderAbortSignal.addEventListener(
    'abort',
    () => {
      try {
        cleanup();
      } catch (e) {
        Logger.warn('Cleanup during abort failed', e);
      }
    },
    { once: true }
  );

  window.addEventListener('beforeunload', cleanup, { once: true });
  statusEl.textContent = DEFAULT_STATUS_MESSAGE;
  scheduleNextFrame();

  /**
   * Updates instance buffers from the current scene.
   * Note: Per-frame updates are handled automatically by FrameRenderer.
   */
  function updateScene(): void {
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
      } catch (e) {
        Logger.warn('Abort controller abort failed', e);
      }
    },
    updateScene,
    getScene: () => currentScene,
    setGridRenderer: (renderer: GridRenderer | null) => {
      gridRenderer = renderer;
    },
    initializeGridRenderer: async (renderer: GridRenderer) => {
      if (!renderer || typeof renderer.initialize !== 'function') {
        throw new Error('Invalid grid renderer');
      }
      // Match frame pass color format to avoid attachment state mismatches
      // Use configuredDevice to ensure consistency with context
      await renderer.initialize(configuredDevice, 'rgba16float', 'depth24plus');
      gridRenderer = renderer;
    },
    getDevice: () => configuredDevice,
    getPresentationFormat: () => presentationFormat,
    getCapabilities: () => capabilities,
    supportsTimestampQueries: () => capabilities.features.timestampQuery,
    supportsOcclusionQueries: () => capabilities.features.occlusionQuery,
    supportsTextureCompression: () =>
      capabilities.features.textureCompression.bc ||
      capabilities.features.textureCompression.etc2 ||
      capabilities.features.textureCompression.astc,
    getFrameRenderer: () => frameRenderer,
    onGpuTimings: (handler: GpuTimingsHandler) => {
      gpuTimingListeners.push(handler);
    },
    offGpuTimings: (handler: GpuTimingsHandler) => {
      const idx = gpuTimingListeners.indexOf(handler);
      if (idx !== -1) gpuTimingListeners.splice(idx, 1);
    },
    onCpuTimings: (handler: CpuTimingsHandler) => {
      cpuTimingListeners.push(handler);
    },
    offCpuTimings: (handler: CpuTimingsHandler) => {
      const idx = cpuTimingListeners.indexOf(handler);
      if (idx !== -1) cpuTimingListeners.splice(idx, 1);
    },
    onShadowMetrics: (handler: ShadowMetricsHandler) => {
      shadowMetricsListeners.push(handler);
    },
    offShadowMetrics: (handler: ShadowMetricsHandler) => {
      const idx = shadowMetricsListeners.indexOf(handler);
      if (idx !== -1) shadowMetricsListeners.splice(idx, 1);
    },
    onRenderStats: (handler: RenderStatsHandler) => {
      renderStatsListeners.push(handler);
    },
    offRenderStats: (handler: RenderStatsHandler) => {
      const idx = renderStatsListeners.indexOf(handler);
      if (idx !== -1) renderStatsListeners.splice(idx, 1);
    },
    updateRenderSettings: (settings: Partial<typeof renderSettings>) => {
      renderSettings = { ...renderSettings, ...settings };
    },
    getRenderSettings: () => ({ ...renderSettings }),
    getTextureCompressionManager: () => textureCompressionManager,
    setTextureCompressionFormat: (format: CompressionFormat | null) => {
      textureCompressionManager.setForceFormat(format);
    },
    setTextureCompressionEnabled: (enabled: boolean) => {
      textureCompressionManager.setEnabled(enabled);
    },
    getCollisionWorld: () => collisionWorld,
    getResourceManager: () => resourceManager,
  };
}

// validateGeometry moved to resources.validateGeometryData
