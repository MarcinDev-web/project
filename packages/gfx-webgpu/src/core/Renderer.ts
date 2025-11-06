import type { OrbitControlsState } from '@engine/camera';
import { updateCanvasSize, getTimestampPeriod } from './helpers';
import {
  DEFAULT_GEOMETRY,
  createGeometryBuffers,
  createTimestampResources,
  createUniformResources,
  createTextureAtlas, // NEW: Texture atlas system
  createPipelines,
  createDepthTexture,
  createMsaaColorTarget,
} from '../resources/resources';
import type { FrameResources, GeometryData } from '../resources/resources';
import { GPUBufferPool } from './bufferPool';
import type { Scene, Entity } from '@engine/world';
import { EnvironmentComponent } from '@engine/world';
import { LightManager } from '../lighting/LightManager';
import { ScriptSystem } from '@engine/script';
import { LogicCubeSystem } from '@engine/script';
import { LogicConnectionRenderer } from '../LogicConnectionRenderer';
import { EnvironmentRenderer } from '../renderers/EnvironmentRenderer';
import { WaterRenderer } from '../renderers/WaterRenderer';
import { Logger } from '@engine/core/utils';
import { CameraSystem } from './CameraSystem';
import { UniformManager } from './UniformManager';
import { FrameRenderer } from './FrameRenderer';
import { createInstanceDataFromScene } from './InstanceManager';
import {
  DEFAULT_STATUS_MESSAGE,
  MSAA_SAMPLE_COUNT,
  TIMESTAMP_QUERY_COUNT,
  UNIFORM_BUFFER_SIZE,
  UNIFORM_DATA_LENGTH,
  TIMESTAMP_BUFFER_SIZE,
} from '../config';
import { TIMESTAMP_INDICES } from '../config';
import type { RendererCapabilities } from '../config';

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
const INSTANCE_OFFSET_STRIDE = 12;

function createVertexBufferLayouts(): GPUVertexBufferLayout[] {
  return [
    {
      arrayStride: VERTEX_STRIDE,
      stepMode: 'vertex',
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
        { shaderLocation: 1, offset: 12, format: 'snorm8x4' }, // normal
        { shaderLocation: 2, offset: 16, format: 'float16x2' }, // uv
        { shaderLocation: 3, offset: 20, format: 'unorm8x4' }, // AO (x), rest unused
      ],
    },
    {
      arrayStride: INSTANCE_OFFSET_STRIDE,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x3' }],
    },
    {
      arrayStride: 16,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 5, offset: 0, format: 'float32x4' }],
    },
    {
      arrayStride: 16,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 6, offset: 0, format: 'float32x4' }],
    },
    {
      arrayStride: 16,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 7, offset: 0, format: 'float32x4' }],
    },
    {
      arrayStride: 16,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 8, offset: 0, format: 'float32x4' }],
    },
    {
      arrayStride: 16,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 9, offset: 0, format: 'float32x4' }],
    },
    {
      arrayStride: 4,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 10, offset: 0, format: 'float32' }],
    },
  ];
}

export interface Renderer {
  cleanup(): void;
  abort(): void;
  /** Updates instance data from the scene */
  updateScene(): void;
  /** Gets the current scene */
  getScene(): Scene | null;
  /** Sets the grid renderer (optional) */
  setGridRenderer(gridRenderer: GridRenderer | null): void;
  /** Initializes a grid renderer with device info */
  initializeGridRenderer(gridRenderer: GridRenderer): Promise<void>;
  /** Returns the underlying GPUDevice */
  getDevice(): GPUDevice;
  /** Returns the current presentation format */
  getPresentationFormat(): GPUTextureFormat;
  /** Returns renderer capabilities determined at init time */
  getCapabilities(): RendererCapabilities;
  /** Feature helpers */
  supportsTimestampQueries(): boolean;
  supportsOcclusionQueries(): boolean;
  supportsTextureCompression(): boolean;
  getFrameRenderer(): FrameRenderer;
  onGpuTimings(handler: (timings: { label: string; timeMs: number }[]) => void): void;
  onCpuTimings(handler: (timings: {
    cullingTime: number;
    instanceUpdateTime: number;
    totalCPUTime: number;
  }) => void): void;
  onShadowMetrics(handler: (metrics: readonly [number, number, number, number]) => void): void;
  onRenderStats(handler: (stats: { drawCalls: number; triangles: number }) => void): void;
  updateRenderSettings(settings: Partial<{
    enableHDR: boolean;
    enableBloom: boolean;
    enableFXAA: boolean;
    enableSSAO: boolean;
    enableShadows: boolean;
    enableForwardPlus: boolean;
    enableScreenLOD: boolean;
    shadowQuality: 'low' | 'med' | 'high' | 'ultra';
    enableComputePrepass: boolean;
    msaaSampleCount: 1 | 2 | 4;
  }>): void;
  getRenderSettings(): Readonly<{
    enableHDR: boolean;
    enableBloom: boolean;
    enableFXAA: boolean;
    enableSSAO: boolean;
    enableShadows: boolean;
    enableForwardPlus: boolean;
    enableScreenLOD: boolean;
    shadowQuality: 'low' | 'med' | 'high' | 'ultra';
    enableComputePrepass: boolean;
    msaaSampleCount: 1 | 2 | 4;
  }>;
  [key: string]: unknown;
}

// Lightweight grid renderer interface used by the core renderer
export interface GridRenderer {
  initialize(device: GPUDevice, format: GPUTextureFormat, depthFormat: GPUTextureFormat): Promise<void>;
  render(passEncoder: GPURenderPassEncoder, viewProjectionMatrix: Float32Array): void;
  dispose(): void;
}

interface RendererOptions {
  canvas: HTMLCanvasElement;
  statusEl: HTMLElement;
  getOrbitState: () => OrbitControlsState;
  geometry?: GeometryData;
  scene?: Scene;
  cameraEntity?: Entity | null;
  /**
   * Optional predicate indicating whether runtime simulation should run this frame.
   * If not provided, simulation (e.g., ScriptSystem) always runs when available.
   */
  shouldSimulate?: () => boolean;
  /**
   * Optional callback for per-frame updates (called before rendering).
   * Use this for play mode updates, physics, character controllers, etc.
   */
  onFrameUpdate?: (deltaTime: number) => void;
  // Performance/quality flags
  enableHDR?: boolean;
  enableBloom?: boolean;
  enableShadows?: boolean;
  enableSSAO?: boolean; // Screen Space Ambient Occlusion
  shadowQuality?: 'low' | 'med' | 'high' | 'ultra';
  enableComputePrepass?: boolean;
  msaaSampleCount?: 1 | 2 | 4;
}

export async function initRenderer(options: RendererOptions): Promise<Renderer> {
  const { canvas, statusEl, getOrbitState } = options;
  const shouldSimulateFn = typeof options.shouldSimulate === 'function' ? options.shouldSimulate : () => true;
  const onFrameUpdateFn = options.onFrameUpdate;
  const currentScene = options.scene ?? null;
  let currentCameraEntity = options.cameraEntity ?? null;

  // Resolve render settings with defaults (mutable for runtime updates)
  let renderSettings = {
    enableHDR: options.enableHDR !== false,
    enableBloom: options.enableBloom !== false,
    enableShadows: options.enableShadows !== false,
    enableSSAO: options.enableSSAO !== false,
    enableFXAA: false,
    enableForwardPlus: false,
    enableScreenLOD: false,
    shadowQuality: (options.shadowQuality ?? 'med') as 'low' | 'med' | 'high' | 'ultra',
    enableComputePrepass: options.enableComputePrepass !== false,
    msaaSampleCount: (options.msaaSampleCount ?? MSAA_SAMPLE_COUNT) as 1 | 2 | 4,
  };

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

  const requiredFeatures: GPUFeatureName[] = [];
  if (adapter.features.has('timestamp-query')) {
    requiredFeatures.push('timestamp-query');
  }
  // Do not request occlusion-query proactively due to limited support in some runtimes

  let device = await adapter.requestDevice({ requiredFeatures });

  const supportsTimestampQueries = device.features.has('timestamp-query');
  const supportsOcclusionQueries = (device.features as unknown as Set<string>).has('occlusion-query');

  // Query adapter/device info (best-effort)
  let adapterInfo: { vendor?: string; architecture?: string; device?: string; description?: string } | undefined;
  let adapterName: string | undefined;
  try {
    const anyAdapter = adapter as unknown as { requestAdapterInfo?: () => Promise<{ vendor?: string; architecture?: string; device?: string; description?: string; name?: string }> };
    if (typeof anyAdapter.requestAdapterInfo === 'function') {
      const info = await anyAdapter.requestAdapterInfo!();
      const normalized: { vendor?: string; architecture?: string; device?: string; description?: string } = {};
      if (typeof info.vendor === 'string') normalized.vendor = info.vendor;
      if (typeof info.architecture === 'string') normalized.architecture = info.architecture;
      if (typeof info.device === 'string') normalized.device = info.device;
      if (typeof info.description === 'string') normalized.description = info.description;
      adapterInfo = Object.keys(normalized).length > 0 ? normalized : undefined;
      adapterName = typeof (info as any).name === 'string' ? (info as any).name : undefined;
    }
  } catch {
    // ignore
  }

  const textureCompressionSupport = {
    bc: device.features.has('texture-compression-bc'),
    etc2: device.features.has('texture-compression-etc2'),
    astc: device.features.has('texture-compression-astc'),
  } as const;

  const capabilitiesBase: RendererCapabilities = {
    // adapterName and adapterInfo will be conditionally assigned below to avoid explicit undefined
    features: {
      timestampQuery: supportsTimestampQueries,
      occlusionQuery: supportsOcclusionQueries,
      compute: true, // WebGPU devices support compute; may be restricted by limits
      textureCompression: textureCompressionSupport,
    },
    limits: {
      maxTextureDimension2D: (adapter as any)?.limits?.maxTextureDimension2D ?? (device as any)?.limits?.maxTextureDimension2D ?? 4096,
      maxBufferSize: (adapter as any)?.limits?.maxBufferSize ?? (device as any)?.limits?.maxBufferSize ?? 256 * 1024 * 1024,
      maxBindGroups: (device as any)?.limits?.maxBindGroups,
      maxStorageBufferBindingSize: (device as any)?.limits?.maxStorageBufferBindingSize,
      maxUniformBufferBindingSize: (device as any)?.limits?.maxUniformBufferBindingSize,
      maxComputeWorkgroupSizeX: (device as any)?.limits?.maxComputeWorkgroupSizeX,
      maxComputeWorkgroupSizeY: (device as any)?.limits?.maxComputeWorkgroupSizeY,
      maxComputeWorkgroupSizeZ: (device as any)?.limits?.maxComputeWorkgroupSizeZ,
    },
  };
  const capabilities: RendererCapabilities = capabilitiesBase as RendererCapabilities;
  if (typeof adapterName === 'string') {
    (capabilities as any).adapterName = adapterName;
  }
  if (adapterInfo) {
    (capabilities as any).adapterInfo = adapterInfo;
  }

  const {
    querySet: timestampQuerySet,
    resolveBuffer: timestampResolveBuffer,
    readBuffer: timestampReadBuffer,
  } = createTimestampResources(device, supportsTimestampQueries, {
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
  const gpuTimingListeners: Array<(timings: { label: string; timeMs: number }[]) => void> = [];
  const cpuTimingListeners: Array<(timings: {
    cullingTime: number;
    instanceUpdateTime: number;
    totalCPUTime: number;
  }) => void> = [];
  const shadowMetricsListeners: Array<(metrics: readonly [number, number, number, number]) => void> = [];
  const renderStatsListeners: Array<(stats: { drawCalls: number; triangles: number }) => void> = [];

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

  /**
   * Attempts to recreate the device and reconfigure the context after device loss.
   * This allows the renderer to recover from transient device loss.
   */
  async function recreateDeviceAndReconfigure(): Promise<GPUDevice | null> {
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
      Logger.info(`Attempting to recreate device (attempt ${deviceRecreationAttempts}/${MAX_DEVICE_RECREATION_ATTEMPTS})`);
      statusEl.textContent = 'Recreating WebGPU device...';
      
      // Request a new adapter and device
      const newAdapter = await navigator.gpu.requestAdapter();
      if (!newAdapter) {
        throw new Error('Failed to acquire GPU adapter');
      }

      const newDevice = await newAdapter.requestDevice({ requiredFeatures });
      
      // Reconfigure the context with the new device
      try {
        webgpuContext.configure({ device: newDevice, format: presentationFormat, alphaMode: 'opaque' });
      } catch (err) {
        const altFormat: GPUTextureFormat = presentationFormat === 'rgba8unorm' ? 'bgra8unorm' : 'rgba8unorm';
        try {
          webgpuContext.configure({ device: newDevice, format: altFormat, alphaMode: 'opaque' });
          Logger.warn('Canvas configure fallback format used on device recreation:', { from: presentationFormat, to: altFormat });
          // Note: We don't update presentationFormat here to maintain consistency
        } catch (err2) {
          throw new Error(`Failed to reconfigure canvas: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Update the configured device reference
      configuredDevice = newDevice;
      
      Logger.info('Device recreated and context reconfigured successfully');
      statusEl.textContent = DEFAULT_STATUS_MESSAGE;
      
      return newDevice;
    } catch (err) {
      Logger.error('Device recreation failed:', err instanceof Error ? err : new Error(String(err)));
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
        Logger.error('WebGPU device lost', info as unknown as Error);
        
        // Attempt to recreate the device if the loss was transient (reason: 'destroyed')
        // Permanent losses (e.g., GPU crash) won't be recoverable
        if (info.reason === 'destroyed') {
          const newDevice = await recreateDeviceAndReconfigure();
          if (newDevice) {
            // Update the device reference - resources will need to be recreated on next frame
            // Mark that frameResources are now invalid (they were created with old device)
            device = newDevice;
            frameResourcesDevice = newDevice;
            Logger.info('Device recreated successfully, rendering will skip until resources are recreated');
          } else {
            // Recreation failed - cleanup and show error
            try {
              cleanup();
            } catch (cleanupErr) {
              Logger.warn('Cleanup after device recreation failure threw', cleanupErr);
            }
          }
        } else {
          // Permanent device loss - cleanup immediately
          statusEl.textContent = 'WebGPU device lost. Please reload.';
          try {
            cleanup();
          } catch (cleanupErr) {
            Logger.warn('Cleanup after device loss threw', cleanupErr);
          }
        }
      }
    })
    .catch((err) => Logger.error('device.lost failed', err as unknown as Error));

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

  // Prepare geometry from scene or use default
  let geometry = options.geometry ?? DEFAULT_GEOMETRY;
  geometry = { ...geometry, opaqueCount: geometry.opaqueCount ?? geometry.instanceCount };
  let gridRenderer: GridRenderer | null = null;
  let environmentRenderer: EnvironmentRenderer | null = null;
  let waterRenderer: WaterRenderer | null = null;

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

    const uniformResources = createUniformResources(device, {
      bufferSize: UNIFORM_BUFFER_SIZE,
      dataLength: UNIFORM_DATA_LENGTH,
    });
    const vertexBuffers = createVertexBufferLayouts();
    const { textureBindGroupLayout, textureBindGroup, atlasTexture, normalAtlasTexture, sampler, atlas, atlasMetaBuffer } =
      createTextureAtlas(device, undefined, 2048, 128);

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
    } catch {
      // ignore if IBL generation fails in minimal environments
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

      updateCanvasSize(canvas);
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
          // Clamp dt to avoid huge spikes
          if (!Number.isFinite(dtSec) || dtSec > 0.1) dtSec = 0.1;
        }
        lastFrameTimeMs = nowMs;
      } catch {
        dtSec = 0;
      }
      const aspect = canvas.width / canvas.height;

      // Update camera matrices using CameraSystem
      const { viewProjection: viewProjectionMatrix, eyePosition: eyePos } = cameraSystem.updateCamera(
        currentCameraEntity,
        currentScene,
        getOrbitState,
        aspect
      );
      const eyeX = eyePos[0];
      const eyeY = eyePos[1];
      const eyeZ = eyePos[2];

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
      if (supportsTimestampQueries && frameResources.timestampQuerySet) {
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
      // If device was recreated, frameResources and other GPU resources are now invalid
      // because they were created with the old device. Skip this frame to avoid errors.
      // TODO: Full resource recreation would be needed for proper device recovery
      // This would require recreating all buffers, textures, pipelines, etc. with the new device
      scheduleNextFrame();
      return;
    }

    // Render frame (handles all rendering operations)
    // Calculate time for animations
    const currentTime = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now() / 1000.0 // Convert to seconds
      : Date.now() / 1000.0;

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
          enableShadows: renderSettings.enableShadows,
          enableBloom: renderSettings.enableBloom,
          enableHDR: renderSettings.enableHDR,
          enableSSAO: renderSettings.enableSSAO,
          enableFXAA: renderSettings.enableFXAA,
          enableForwardPlus: renderSettings.enableForwardPlus,
          enableScreenLOD: renderSettings.enableScreenLOD,
        },
        shadowQuality: renderSettings.shadowQuality,
        msaaSampleCount: renderSettings.msaaSampleCount,
        time: currentTime,
        configuredDevice, // Pass the device that configured the context for validation
        frameResourcesDevice, // Pass the device that created frameResources for validation
        ...(gpuTimingListeners.length
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
    safeDestroy(frameResources.instanceOffsetBuffer);
    safeDestroy(frameResources.instanceColorScaleBuffer);
    safeDestroy(frameResources.instanceSecondaryColorBuffer);
    safeDestroy(frameResources.instanceEmissiveColorBuffer);
    safeDestroy(frameResources.instanceMaterialParamsBuffer);
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
      waterRenderer?.dispose();
      waterRenderer = null;
      // TODO: Phase 4
      // logicConnectionRenderer?.dispose();
      // logicConnectionRenderer = null;
      // scriptSystem = null;
      // logicCubeSystem = null;
      lastFrameTimeMs = null;
    } catch (e) {
      Logger.warn('Renderer systems cleanup failed', e);
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
    onGpuTimings: (handler: (timings: { label: string; timeMs: number }[]) => void) => {
      gpuTimingListeners.push(handler);
    },
    onCpuTimings: (handler: (timings: {
      cullingTime: number;
      instanceUpdateTime: number;
      totalCPUTime: number;
    }) => void) => {
      cpuTimingListeners.push(handler);
    },
    onShadowMetrics: (handler: (metrics: readonly [number, number, number, number]) => void) => {
      shadowMetricsListeners.push(handler);
    },
    onRenderStats: (handler: (stats: { drawCalls: number; triangles: number }) => void) => {
      renderStatsListeners.push(handler);
    },
    updateRenderSettings: (settings: Partial<typeof renderSettings>) => {
      renderSettings = { ...renderSettings, ...settings };
    },
    getRenderSettings: () => ({ ...renderSettings }),
  };
}

// validateGeometry moved to resources.validateGeometryData
