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

import type { Scene, Entity } from '@engine/world';
import { EnvironmentComponent, Transform, CameraComponent } from '@engine/world';
import type { FrameResources, GeometryData } from '../resources/resources';
import { FrustumCuller } from './FrustumCuller';
import { InstanceDataBuilder, type CustomGeometryEntity } from './InstanceManager';
import { GeometryCache } from './GeometryCache';
import type { CollisionWorld, WasmCollision } from '@engine/wasm-collision';
import { GpuInstancePipeline } from './GpuInstancePipeline';
import { AsyncComputeManager, type CullingFrame, type AsyncComputeMetrics } from './AsyncComputeManager';
import type { EnvironmentRenderer } from '../renderers/EnvironmentRenderer';
import type { WaterRenderer } from '../renderers/WaterRenderer';
import type { LogicConnectionRenderer } from '../LogicConnectionRenderer';
import { Logger } from '@engine/core/utils';
import { mat4Invert, type Mat4, type Vec3 } from '@engine/core/math';
import {
  CLEAR_COLOR,
  MSAA_SAMPLE_COUNT,
  TIMESTAMP_QUERY_COUNT,
  TIMESTAMP_BUFFER_SIZE,
  GPU_TIMESTAMP_PAIRS,
  TIMESTAMP_INDICES,
} from '../config';

const ESTIMATED_TRIANGLES_PER_UNKNOWN_ENTITY = 12;

// WASM memory layout constants
const WASM_FLOATS_PER_POSITION = 3;
const WASM_FLOATS_PER_ROTATION = 4; // quaternion (x, y, z, w)
const WASM_FLOATS_PER_SCALE = 3;
const WASM_BYTES_TO_FLOAT32_SHIFT = 2; // divide by 4 (sizeof float32)

import { ForwardPlus, type PointLight } from '../lighting/ForwardPlus';
import { ScreenSpaceLOD } from './ScreenSpaceLOD';
import { UniformManager } from './UniformManager';
import { ShadowPass } from '../shadows/ShadowPass';
import { FrameTargetManager } from './FrameTargetManager';
import {
  PostProcessPipeline,
  type PostProcessFeatureFlags,
  type PostProcessInputs,
} from './PostProcessPipeline';
import { CustomGeometryRenderer } from './CustomGeometryRenderer';
import {
  updateInstanceBuffers,
  reallocateInstanceBuffers,
  type InstanceBufferData,
} from './InstanceBufferUtils';
import type { GPUBufferPool } from './bufferPool';
import { DeviceValidator, type DeviceSnapshot } from './DeviceValidator';
import { buildIndirectDrawArgs, IndirectCommandOffset } from './InstancePipelineTypes';

interface ResolvedFeatureFlags extends PostProcessFeatureFlags {
  enableComputePrepass: boolean;
  enableShadows: boolean;
  enableForwardPlus: boolean;
  enableScreenLOD: boolean;
  enableSSGI?: boolean;
  enableAsyncCompute?: boolean;
  enableStylizedColorGrading?: boolean;
}

interface SceneUpdateResult {
  geometry: GeometryData;
  timings?: {
    cullingTime: number;
    instanceUpdateTime: number;
    totalCPUTime: number;
  };
}

interface BundleState {
  bundle: GPURenderBundle;
  instanceCount: number;
  indexCount: number;
  opaqueCount: number;
  renderPipeline: GPURenderPipeline;
  transparentPipeline: GPURenderPipeline | null;
  overlayPipeline: GPURenderPipeline;
  uniformBindGroup: GPUBindGroup;
  textureBindGroup: GPUBindGroup;
}

export interface FrameRenderContext {
  device: GPUDevice;
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  presentationFormat: GPUTextureFormat;
  frameResources: FrameResources;
  scene: Scene | null;
  geometry: GeometryData;
  environmentRenderer: EnvironmentRenderer | null;
  waterRenderer: WaterRenderer | null;
  gridRenderer: { render?: (p: GPURenderPassEncoder, vp: Mat4, eye?: Vec3 | number[]) => void } | null;
  logicConnectionRenderer: LogicConnectionRenderer | null;
  onGpuTimings?: (timings: { label: string; timeMs: number }[]) => void;
  onCpuTimings?: (timings: {
    cullingTime: number;
    instanceUpdateTime: number;
    totalCPUTime: number;
  }) => void;
  uniformManager: UniformManager;
  lightingData?: import('../lighting/LightManager').LightingData;
  onShadowMetrics?: (counts: readonly [number, number, number, number]) => void;
  onRenderStats?: (stats: { drawCalls: number; triangles: number }) => void;
  featureFlags?: {
    enableComputePrepass?: boolean;
    enableShadows?: boolean;
    enableBloom?: boolean;
    enableHDR?: boolean;
    enableSSAO?: boolean;
    enableSSGI?: boolean;
    enableFXAA?: boolean;
    enableOutlines?: boolean;
    enableForwardPlus?: boolean;
    enableScreenLOD?: boolean;
    enableAsyncCompute?: boolean;
    /** Enable stylized color grading for cartoon look */
    enableStylizedColorGrading?: boolean;
  };
  shadowQuality?: 'low' | 'med' | 'high' | 'ultra';
  outlineQuality?: 'low' | 'med';
  msaaSampleCount?: number;
  time?: number;
  configuredDevice?: GPUDevice;
  frameResourcesDevice?: GPUDevice;
}

/**
 * Error metrics tracked by FrameRenderer for monitoring and debugging.
 */
export interface ErrorMetrics {
  totalErrors: number;
  lastError: { type: string; time: number } | null;
}

/**
 * FrameRenderer manages the per-frame rendering operations.
 *
 * Key features:
 * - Centralized device validation via DeviceValidator
 * - Error metrics tracking for monitoring and debugging
 * - Cache cleanup to prevent unbounded memory growth
 * - Accurate custom geometry triangle counting
 * - Comprehensive error handling with graceful degradation
 */
export class FrameRenderer {
  private frustumCuller: FrustumCuller;
  private instanceBuilder: InstanceDataBuilder;
  private geometryCache: GeometryCache;
  private customRenderer: CustomGeometryRenderer;
  private frameTargets: FrameTargetManager;
  private postProcess: PostProcessPipeline;
  private visibleEntitiesCache: Entity[] = [];
  private customGeometryEntitiesCache: CustomGeometryEntity[] = [];
  private customGeometryTriangleCounts: Map<Entity, number> = new Map();
  private instancePipeline: GpuInstancePipeline | null = null;
  private instancePipelineDevice: GPUDevice | null = null;
  private pendingTimestampRead = false;
  private bundleState: BundleState | null = null;
  private forwardPlus: ForwardPlus | null = null;
  private screenSpaceLOD: ScreenSpaceLOD | null = null;
  private shadowPass: ShadowPass | null = null;
  private errorMetrics: ErrorMetrics = {
    totalErrors: 0,
    lastError: null,
  };
  private readonly MAX_VISIBLE_ENTITIES_CACHE_SIZE = 10000;
  private collisionWorld: CollisionWorld | null = null;
  private wasmCollision: WasmCollision | null = null;
  private lastFrameVisibleIndices: Uint32Array | null = null;
  private lastFrameVisibleIndicesCount = 0;
  private vpScratch = new Float32Array(16);
  private disposed = false;
  
  // Depth resolve resources for volumetric clouds
  private depthResolvePipeline: GPURenderPipeline | null = null;
  private depthResolveLayout: GPUBindGroupLayout | null = null;
  private depthResolveUniformBuffer: GPUBuffer | null = null;
  private depthResolveDevice: GPUDevice | null = null;
  
  // Async compute resources for frame overlap
  private asyncComputeManager: AsyncComputeManager | null = null;
  private asyncComputeDevice: GPUDevice | null = null;
  private pendingCullingSlot: CullingFrame | null = null;
  private lastAsyncCullingFrameId = -1;

  constructor(initialCapacity = 1000) {
    this.frustumCuller = new FrustumCuller();
    this.instanceBuilder = new InstanceDataBuilder(initialCapacity);
    this.geometryCache = new GeometryCache();
    this.customRenderer = new CustomGeometryRenderer(this.geometryCache);
    this.frameTargets = new FrameTargetManager();
    this.postProcess = new PostProcessPipeline();
  }

  /**
   * Sets the WASM collision world for accelerated frustum and occlusion culling.
   * When set, the renderer will use WASM-based culling instead of the TypeScript implementation.
   * @param wasm - WASM collision module instance providing memory access
   * @param world - CollisionWorld instance from WASM for spatial queries
   */
  setCollisionWorld(wasm: WasmCollision, world: CollisionWorld): void {
    this.wasmCollision = wasm;
    this.collisionWorld = world;
  }

  /**
   * Ensures the async compute manager is initialized for the given device.
   * @param device - GPU device to create the manager for
   * @returns The AsyncComputeManager instance
   */
  private ensureAsyncComputeManager(device: GPUDevice): AsyncComputeManager {
    if (!this.asyncComputeManager || this.asyncComputeDevice !== device) {
      try {
        this.asyncComputeManager?.dispose();
      } catch {
        // ignore
      }
      this.asyncComputeManager = new AsyncComputeManager(device, {
        slotCount: 3,
        initialCapacity: 1024,
        labelPrefix: 'frame-async-cull',
      });
      this.asyncComputeDevice = device;
    }
    return this.asyncComputeManager;
  }

  /**
   * Prepares and submits async culling for the next frame.
   * This should be called at the start of frame rendering to overlap
   * with the previous frame's GPU work.
   * 
   * @param ctx - Frame render context
   * @param viewProjectionMatrix - View-projection matrix for culling
   * @param geometry - Current geometry data
   */
  prepareAsyncCulling(
    ctx: FrameRenderContext,
    viewProjectionMatrix: Mat4,
    geometry: GeometryData
  ): void {
    if (!ctx.featureFlags?.enableAsyncCompute) {
      return;
    }

    const configuredDevice = ctx.configuredDevice ?? ctx.device;
    const asyncManager = this.ensureAsyncComputeManager(configuredDevice);

    // Prepare culling work for this frame
    const cullingResult = asyncManager.prepareCulling({
      viewProjectionMatrix,
      geometry,
      frameResources: ctx.frameResources,
    });

    if (cullingResult) {
      // Submit culling work immediately (runs async on GPU)
      asyncManager.submitCulling(cullingResult);
    }
  }

  /**
   * Tries to use async culling results for rendering.
   * Returns true if async culling was used, false if fallback to sync is needed.
   * 
   * @param ctx - Frame render context
   * @param encoder - Command encoder for the current frame
   * @param frameResources - Frame resources
   * @param geometry - Current geometry data
   * @returns The CullingFrame to use for rendering, or null if sync fallback needed
   */
  private tryUseAsyncCulling(
    ctx: FrameRenderContext,
    encoder: GPUCommandEncoder,
    frameResources: FrameResources,
    geometry: GeometryData
  ): CullingFrame | null {
    if (!this.asyncComputeManager?.isEnabled()) {
      return null;
    }

    // Try to acquire ready culling results
    const readySlot = this.asyncComputeManager.acquireReadyCulling();
    
    if (readySlot) {
      // Copy async culling results to frame resources for rendering
      // The compacted buffer and indirect args are in the slot
      encoder.copyBufferToBuffer(
        readySlot.compactedInterleavedBuffer,
        0,
        frameResources.instanceInterleavedBuffer,
        0,
        Math.min(
          readySlot.compactedInterleavedBuffer.size,
          frameResources.instanceInterleavedBuffer.size
        )
      );
      encoder.copyBufferToBuffer(
        readySlot.indirectArgsBuffer,
        0,
        frameResources.instanceIndirectArgsBuffer,
        0,
        Math.min(
          readySlot.indirectArgsBuffer.size,
          frameResources.instanceIndirectArgsBuffer.size
        )
      );
      
      this.pendingCullingSlot = readySlot;
      return readySlot;
    }

    return null;
  }

  /**
   * Releases the current async culling slot after rendering is submitted.
   */
  private releaseAsyncCullingSlot(): void {
    if (this.pendingCullingSlot && this.asyncComputeManager) {
      this.asyncComputeManager.releaseRendering(this.pendingCullingSlot);
      this.pendingCullingSlot = null;
    }
  }

  /**
   * Gets async compute performance metrics.
   * @returns Metrics or null if async compute is not enabled
   */
  getAsyncComputeMetrics(): AsyncComputeMetrics | null {
    return this.asyncComputeManager?.getMetrics() ?? null;
  }

  /**
   * Checks if async compute is currently enabled and active.
   */
  isAsyncComputeEnabled(): boolean {
    return this.asyncComputeManager?.isEnabled() ?? false;
  }

  /**
   * Renders a single frame with the complete rendering pipeline.
   * 
   * Pipeline stages:
   * 1. Device validation and swap chain setup
   * 2. Scene update with frustum/occlusion culling
   * 3. Screen-space LOD selection (optional)
   * 4. Shadow pass (optional)
   * 5. Forward+ light culling (optional)
   * 6. Compute prepass for instance culling (optional)
   * 7. Main render pass (environment, geometry, water, grid, connections)
   * 8. Post-processing (HDR, bloom, SSAO, FXAA, etc.)
   * 
   * @param ctx - Frame render context containing device, resources, and scene
   * @param viewProjectionMatrix - Combined view-projection matrix for culling and rendering
   * @param eyePosition - Camera position in world space
   * @param passDescriptor - Optional custom render pass descriptor for timestamp/occlusion queries
   * @param viewMatrix - Optional separate view matrix for shadow/LOD calculations
   * @param projectionMatrix - Optional separate projection matrix for shadow/LOD calculations
   * @returns Updated geometry data with current instance counts
   */
  renderFrame(
    ctx: FrameRenderContext,
    viewProjectionMatrix: Mat4,
    eyePosition: Vec3,
    passDescriptor?: GPURenderPassDescriptor,
    viewMatrix?: Mat4,
    projectionMatrix?: Mat4
  ): GeometryData {
    const { device, frameResources } = ctx;
    let geometry = ctx.geometry;

    // Create device snapshot at start of frame for consistent validation
    const deviceSnapshot = DeviceValidator.createSnapshot(ctx);
    const deviceValidation = DeviceValidator.validateSnapshot(deviceSnapshot);
    
    if (!deviceValidation.valid) {
      this.recordError('deviceValidation');
      Logger.warn(`[FrameRenderer] ${deviceValidation.error} - skipping frame`);
      return geometry;
    }

    const configuredDevice = deviceSnapshot.configuredDevice;

    const featureFlags = this.resolveFeatureFlags(ctx.featureFlags);
    const sampleCount = ctx.msaaSampleCount ?? MSAA_SAMPLE_COUNT;

    const targetState = this.frameTargets.ensureTargets(ctx, frameResources, {
      sampleCount,
      enableHDR: featureFlags.enableHDR,
      enableBloom: featureFlags.enableBloom,
      enableSSAO: featureFlags.enableSSAO,
      enableSSGI: featureFlags.enableSSGI,
      enableFXAA: featureFlags.enableFXAA,
      enableOutlines: featureFlags.enableOutlines,
    });

    const encoder = configuredDevice.createCommandEncoder({ label: 'frame-encoder' });
    
    // Register all textures used by this encoder to prevent premature destruction
    const texturesUsedByEncoder: GPUTexture[] = [
      frameResources.depthTexture,
      frameResources.msaaColorTexture,
      this.frameTargets.getHdrColorTexture(),
      this.frameTargets.getBloomTexture(),
      this.frameTargets.getNormalTexture(),
      this.frameTargets.getSsaoTexture(),
      this.frameTargets.getSsgiTexture(),
      this.frameTargets.getResolvedDepthTexture(),
      this.frameTargets.getTonemapTexture(),
    ].filter((t): t is GPUTexture => t !== null);
    
    this.frameTargets.registerEncoderTextures(encoder, texturesUsedByEncoder);
    
    const swapChainView = this.setupSwapChain(ctx);
    if (!swapChainView) {
      // Cleanup encoder on swap chain failure
      try {
        encoder.finish();
      } catch {
        // ignore
      }
      this.frameTargets.unregisterEncoderTextures(encoder);
      return geometry;
    }

    this.writeFrameBeginTimestamp(frameResources, encoder);

    const sceneUpdate = this.updateScene(ctx, geometry, viewProjectionMatrix);
    geometry = sceneUpdate.geometry;

    this.runScreenSpaceLOD(
      ctx,
      featureFlags,
      encoder,
      viewProjectionMatrix,
      eyePosition,
      geometry,
      frameResources,
      viewMatrix,
      projectionMatrix
    );

    this.runShadowPass(ctx, featureFlags, encoder, frameResources, geometry, viewMatrix, projectionMatrix);

    this.runForwardPlus(ctx, featureFlags, encoder, projectionMatrix, viewMatrix, eyePosition);
    const usedGpuInstancePipeline = this.runComputePrepass(
      ctx,
      featureFlags,
      encoder,
      frameResources,
      geometry,
      viewProjectionMatrix
    );
    if (!usedGpuInstancePipeline) {
      this.updateCpuIndirectArgs(configuredDevice, frameResources, geometry);
    }

    const renderPass = this.beginMainPass(
      encoder,
      frameResources,
      targetState,
      swapChainView,
      featureFlags,
      sampleCount,
      passDescriptor
    );

    this.renderEnvironment(ctx, renderPass, viewProjectionMatrix, eyePosition);
    this.renderStaticGeometry(renderPass, ctx, geometry, frameResources, sampleCount);
    this.customRenderer.render({
      encoder: renderPass,
      device: configuredDevice, // Use configuredDevice to ensure consistency
      frameResources,
      entities: this.customGeometryEntitiesCache,
    });
    this.renderWater(ctx, renderPass, viewProjectionMatrix, eyePosition);
    this.renderGrid(ctx, renderPass, viewProjectionMatrix, eyePosition);
    this.renderLogicConnections(ctx, renderPass, viewProjectionMatrix, eyePosition);

    renderPass.end();

    // Render volumetric clouds in a separate pass (after main pass ends)
    // This is required because clouds sample the depth texture, which cannot be
    // sampled while it's attached as a render target (WebGPU validation requirement)
    if (sampleCount > 1 && targetState.resolvedDepthView && frameResources.depthTextureView) {
      // Resolve MSAA depth to single-sampled texture for cloud occlusion sampling
      this.resolveDepthForClouds(
        configuredDevice,
        encoder,
        frameResources.depthTextureView,
        targetState.resolvedDepthView,
        ctx.canvas.width,
        ctx.canvas.height
      );
    }
    
    // Render volumetric clouds with the resolved depth
    this.renderVolumetricCloudsPass(
      ctx,
      encoder,
      targetState,
      swapChainView,
      viewProjectionMatrix,
      eyePosition,
      featureFlags,
      sampleCount
    );

    // Validate device consistency before post-processing
    // Post-process may use swapChainView, so we need to ensure device hasn't changed
    if (!this.validateDeviceAndCleanupEncoder(ctx, deviceSnapshot, encoder, 'post-processing')) {
      return geometry;
    }

    try {
      this.postProcess.run(
        this.buildPostProcessInputs(ctx, featureFlags, targetState, {
          encoder,
          geometry,
          frameResources,
          swapChainView,
          sampleCount,
          viewMatrix,
          projectionMatrix,
        })
      );
    } catch (err) {
      this.recordError('postProcess');
      Logger.warn('[FrameRenderer] Post-process failed:', err);
      // Continue with frame submission even if post-process failed
    }

    this.finalizeFrame(ctx, configuredDevice, encoder, frameResources, geometry, sceneUpdate);

    return geometry;
  }

  /**
   * Finalizes frame rendering: timestamps, command buffer submission, callbacks.
   * @param ctx Frame render context
   * @param configuredDevice Configured GPU device
   * @param encoder Command encoder
   * @param frameResources Frame resources
   * @param geometry Current geometry data
   * @param sceneUpdate Scene update result with timings
   */
  private finalizeFrame(
    ctx: FrameRenderContext,
    configuredDevice: GPUDevice,
    encoder: GPUCommandEncoder,
    frameResources: FrameResources,
    geometry: GeometryData,
    sceneUpdate: SceneUpdateResult
  ): void {
    this.writeFrameEndTimestamp(frameResources, encoder);
    this.resolveTimestampQueries(frameResources, encoder);

    const commandBuffer = encoder.finish();
    // Unregister encoder textures after finish - textures are now safe to destroy after submit
    this.frameTargets.unregisterEncoderTextures(encoder);
    this.submitAndCleanup(configuredDevice, commandBuffer);
    this.frameTargets.flush(configuredDevice.queue);
    this.postProcess.flush(configuredDevice.queue);

    // Release async culling slot after submit (frees it for next frame's culling)
    this.releaseAsyncCullingSlot();

    this.handleTimestampRead(ctx, ctx.device, frameResources);

    if (sceneUpdate.timings && ctx.onCpuTimings) {
      ctx.onCpuTimings(sceneUpdate.timings);
    }

    // Calculate and report render stats
    if (ctx.onRenderStats) {
      const drawCalls = this.calculateDrawCalls(geometry);
      const triangles = this.calculateTriangles(geometry);
      ctx.onRenderStats({ drawCalls, triangles });
    }
  }

  /**
   * Releases all GPU resources and internal state.
   * 
   * After disposal:
   * - All GPU buffers and pipelines are destroyed
   * - Pending async operations are safely cancelled
   * - WASM references are cleared
   * - The instance should not be reused
   */
  dispose(): void {
    this.disposed = true;
    
    try {
      this.instancePipeline?.dispose();
    } catch {
      // ignore
    }
    this.instancePipeline = null;
    this.instancePipelineDevice = null;
    this.forwardPlus?.dispose?.();
    this.forwardPlus = null;
    this.screenSpaceLOD?.dispose?.();
    this.screenSpaceLOD = null;
    this.shadowPass?.dispose?.();
    this.shadowPass = null;
    this.postProcess.dispose();
    this.frameTargets.dispose();
    this.invalidateBundle();
    this.pendingTimestampRead = false;
    
    // Cleanup depth resolve resources for volumetric clouds
    try {
      this.depthResolveUniformBuffer?.destroy();
    } catch {
      // ignore
    }
    this.depthResolveUniformBuffer = null;
    this.depthResolvePipeline = null;
    this.depthResolveLayout = null;
    this.depthResolveDevice = null;
    
    // Cleanup async compute resources
    try {
      this.asyncComputeManager?.dispose();
    } catch {
      // ignore
    }
    this.asyncComputeManager = null;
    this.asyncComputeDevice = null;
    this.pendingCullingSlot = null;
    this.lastAsyncCullingFrameId = -1;
    
    // Cleanup WASM resources
    this.collisionWorld = null;
    this.wasmCollision = null;
    this.lastFrameVisibleIndices = null;
    this.lastFrameVisibleIndicesCount = 0;
    
    // Cleanup caches
    this.visibleEntitiesCache = [];
    this.customGeometryEntitiesCache = [];
    this.customGeometryTriangleCounts.clear();
  }

  /**
   * Calculates the number of draw calls based on geometry.
   * Draw calls = number of drawIndexed calls (opaque + transparent + overlay + custom geometry)
   */
  private calculateDrawCalls(geometry: GeometryData): number {
    let drawCalls = 0;
    const totalInstances = geometry.instanceCount;
    const opaqueCount = Math.min(Math.max(geometry.opaqueCount ?? totalInstances, 0), totalInstances);
    const transparentCount = Math.max(totalInstances - opaqueCount, 0);

    // Opaque geometry draw call
    if (opaqueCount > 0) {
      drawCalls++;
    }

    // Transparent geometry draw call
    if (transparentCount > 0) {
      drawCalls++;
    }

    // Overlay draw call (always present if there are instances)
    if (totalInstances > 0) {
      drawCalls++;
    }

    // Custom geometry draw calls (approximate - one per custom geometry entity)
    drawCalls += this.customGeometryEntitiesCache.length;

    return drawCalls;
  }

  /**
   * Calculates the total number of triangles rendered.
   * Triangles = (indices.length / 3) * instanceCount + custom geometry triangles
   */
  private calculateTriangles(geometry: GeometryData): number {
    // Base geometry triangles (instanced)
    const baseTriangles = geometry.indices.length / 3;
    const instancedTriangles = baseTriangles * geometry.instanceCount;

    // Custom geometry triangles - use tracked counts when available
    let customGeometryTriangles = 0;
    for (const { entity } of this.customGeometryEntitiesCache) {
      const count = this.customGeometryTriangleCounts.get(entity);
      if (count !== undefined) {
        customGeometryTriangles += count;
      } else {
        // Fallback estimate if count not tracked yet
        customGeometryTriangles += ESTIMATED_TRIANGLES_PER_UNKNOWN_ENTITY;
      }
    }

    return Math.round(instancedTriangles + customGeometryTriangles);
  }

  private resolveFeatureFlags(flags: FrameRenderContext['featureFlags']): ResolvedFeatureFlags {
    return {
      enableComputePrepass: flags?.enableComputePrepass !== false,
      enableShadows: flags?.enableShadows !== false,
      enableBloom: flags?.enableBloom !== false,
      enableHDR: flags?.enableHDR !== false,
      enableSSAO: flags?.enableSSAO !== false,
      enableSSGI: flags?.enableSSGI === true,
      enableFXAA: flags?.enableFXAA === true,
      enableOutlines: flags?.enableOutlines === true,
      enableForwardPlus: flags?.enableForwardPlus !== false,
      enableScreenLOD: flags?.enableScreenLOD !== false,
      enableStylizedColorGrading: flags?.enableStylizedColorGrading === true,
    };
  }

  /**
   * Validates device consistency before an operation and handles cleanup on failure.
   * @param ctx Frame render context
   * @param deviceSnapshot Device snapshot from start of frame
   * @param encoder Command encoder to cleanup on failure
   * @param operationName Name of operation for logging
   * @returns true if validation passed, false otherwise
   */
  private validateDeviceAndCleanupEncoder(
    ctx: FrameRenderContext,
    deviceSnapshot: DeviceSnapshot,
    encoder: GPUCommandEncoder,
    operationName: string
  ): boolean {
    if (!DeviceValidator.validateBeforeOperation(ctx, deviceSnapshot, operationName)) {
      this.recordError('deviceValidation');
      try {
        encoder.finish();
        // Unregister encoder textures after finish
        this.frameTargets.unregisterEncoderTextures(encoder);
      } catch {
        // ignore - but still unregister to prevent leaks
        this.frameTargets.unregisterEncoderTextures(encoder);
      }
      return false;
    }
    return true;
  }

  /**
   * Sets up swap chain texture and view.
   * Device validation is done once at frame start in renderFrame().
   */
  private setupSwapChain(ctx: FrameRenderContext): GPUTextureView | null {
    const swapChainTexture = this.acquireSwapChainTexture(ctx);
    if (!swapChainTexture) {
      return null;
    }
    
    try {
      return swapChainTexture.createView({ label: 'frame-color-resolve-view' });
    } catch (err) {
      this.recordError('swapChain');
      Logger.warn('[FrameRenderer] Failed to create swap chain view:', err);
      return null;
    }
  }

  private acquireSwapChainTexture(ctx: FrameRenderContext): GPUTexture | null {
    try {
      return ctx.context.getCurrentTexture();
    } catch (err) {
      // Check if the error is due to unconfigured context
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('not configured')) {
        // Try to reconfigure the context and retry once
        try {
          Logger.info('[FrameRenderer] Context unconfigured, attempting reconfiguration...');
          ctx.context.configure({
            device: ctx.device,
            format: ctx.presentationFormat,
            alphaMode: 'opaque',
          });
          // Retry getting the texture
          return ctx.context.getCurrentTexture();
        } catch (reconfigureErr) {
          this.recordError('swapChain');
          Logger.warn('[FrameRenderer] Failed to reconfigure context:', reconfigureErr);
          return null;
        }
      }
      
      this.recordError('swapChain');
      Logger.warn('[FrameRenderer] Failed to get current swap chain texture:', err);
      return null;
    }
  }
  
  /**
   * Updates custom geometry triangle counts by examining mesh data.
   */
  private updateCustomGeometryTriangleCounts(entities: CustomGeometryEntity[]): void {
    // Clear counts for entities that are no longer in the cache
    const currentEntitySet = new Set(entities.map(e => e.entity));
    for (const [entity] of this.customGeometryTriangleCounts) {
      if (!currentEntitySet.has(entity)) {
        this.customGeometryTriangleCounts.delete(entity);
      }
    }
    
    // Update counts for current entities
    for (const { entity, meshComponent } of entities) {
      const meshData = meshComponent.meshData;
      if (meshData?.indices) {
        // Calculate triangle count from indices
        const triangleCount = meshData.indices.length / 3;
        this.customGeometryTriangleCounts.set(entity, triangleCount);
      }
    }
  }
  
  /**
   * Cleans up caches to prevent unbounded memory growth.
   */
  private cleanupCaches(currentInstanceCount: number): void {
    if (this.visibleEntitiesCache.length > this.MAX_VISIBLE_ENTITIES_CACHE_SIZE) {
      // Reset with a new array to release memory of the oversized one
      // We don't need to preserve content as it is regenerated every frame
      this.visibleEntitiesCache = [];
    }
  }
  
  /**
   * Gets current error metrics for monitoring and debugging.
   * 
   * Error metrics track:
   * - Total number of errors since last reset
   * - Type and timestamp of the last error
   * 
   * @returns Readonly copy of current error metrics
   */
  getErrorMetrics(): Readonly<ErrorMetrics> {
    return { ...this.errorMetrics };
  }
  
  /**
   * Resets all error metrics to initial state.
   * Useful for testing, periodic metric collection, or after recovering from errors.
   */
  resetErrorMetrics(): void {
    this.errorMetrics = {
      totalErrors: 0,
      lastError: null,
    };
  }

  /**
   * Records an error occurrence.
   */
  private recordError(type: string): void {
    this.errorMetrics.totalErrors++;
    this.errorMetrics.lastError = { type, time: performance.now() };
  }

  private writeFrameBeginTimestamp(frameResources: FrameResources, encoder: GPUCommandEncoder): void {
    if (!frameResources.timestampQuerySet) {
      return;
    }
    try {
      (encoder as any).writeTimestamp?.(
        frameResources.timestampQuerySet,
        TIMESTAMP_INDICES.FRAME_BEGIN
      );
    } catch {
      // ignore unsupported timestamp writes
    }
  }

  private writeFrameEndTimestamp(frameResources: FrameResources, encoder: GPUCommandEncoder): void {
    if (!frameResources.timestampQuerySet) {
      return;
    }
    try {
      (encoder as any).writeTimestamp?.(
        frameResources.timestampQuerySet,
        TIMESTAMP_INDICES.FRAME_END
      );
    } catch {
      // ignore unsupported timestamp writes
    }
  }

  private resolveTimestampQueries(frameResources: FrameResources, encoder: GPUCommandEncoder): void {
    if (
      !frameResources.timestampQuerySet ||
      !frameResources.timestampResolveBuffer ||
      !frameResources.timestampReadBuffer
    ) {
      return;
    }
    encoder.resolveQuerySet(
      frameResources.timestampQuerySet,
      0,
      TIMESTAMP_QUERY_COUNT,
      frameResources.timestampResolveBuffer,
      0
    );
    encoder.copyBufferToBuffer(
      frameResources.timestampResolveBuffer,
      0,
      frameResources.timestampReadBuffer,
      0,
      TIMESTAMP_BUFFER_SIZE
    );
  }

  private submitAndCleanup(device: GPUDevice, commandBuffer: GPUCommandBuffer): void {
    device.queue.submit([commandBuffer]);
  }

  private updateScene(
    ctx: FrameRenderContext,
    geometry: GeometryData,
    viewProjectionMatrix: Mat4
  ): SceneUpdateResult {
    const { scene, frameResources } = ctx;
    if (!scene) {
      return { geometry };
    }

    try {
      const configuredDevice = ctx.configuredDevice ?? ctx.device;
      const cullStart = performance.now();
      
      // Frustum Culling: Prefer WASM CollisionWorld if available
      if (this.collisionWorld && this.wasmCollision && scene) {
        // Sync all entity transforms to WASM
        const allEntities = scene.getActiveEntities();
        const count = allEntities.length;
        
        if (count > 0) {
          // 1. Resize WASM world to fit entities
          this.collisionWorld.resize(count);

          // 2. Get pointers to WASM memory buffers
          const posPtr = this.collisionWorld.get_positions_ptr();
          const rotPtr = this.collisionWorld.get_rotations_ptr();
          const sclPtr = this.collisionWorld.get_scales_ptr();

            const memory = this.wasmCollision.memory;
            if (memory) {
               const f32 = new Float32Array(memory.buffer);
               
               // 3. Copy transform data to WASM memory
               // Convert byte pointers to float32 indices using bit shift (>> 2 = / 4)
               const pStart = posPtr >> WASM_BYTES_TO_FLOAT32_SHIFT;
               const rStart = rotPtr >> WASM_BYTES_TO_FLOAT32_SHIFT;
               const sStart = sclPtr >> WASM_BYTES_TO_FLOAT32_SHIFT;
               
              for (let i = 0; i < count; i++) {
                const entity = allEntities[i];
                if (!entity) continue;
                const transform = entity.getComponent(Transform);
                 
                 // Calculate indices using WASM memory layout constants
                 const pBase = pStart + (i * WASM_FLOATS_PER_POSITION);
                 const rBase = rStart + (i * WASM_FLOATS_PER_ROTATION);
                 const sBase = sStart + (i * WASM_FLOATS_PER_SCALE);
                 
                 if (transform) {
                   f32[pBase] = transform.position[0];
                   f32[pBase + 1] = transform.position[1];
                   f32[pBase + 2] = transform.position[2];

                   f32[rBase] = transform.rotation[0];
                   f32[rBase + 1] = transform.rotation[1];
                   f32[rBase + 2] = transform.rotation[2];
                   f32[rBase + 3] = transform.rotation[3];

                   f32[sBase] = transform.scale[0];
                   f32[sBase + 1] = transform.scale[1];
                   f32[sBase + 2] = transform.scale[2];
                 } else {
                   // Default transform (identity)
                   f32[pBase] = 0; f32[pBase+1] = 0; f32[pBase+2] = 0;
                   f32[rBase] = 0; f32[rBase+1] = 0; f32[rBase+2] = 0; f32[rBase+3] = 1;
                   f32[sBase] = 1; f32[sBase+1] = 1; f32[sBase+2] = 1;
                 }
               }
             
             // 4. Occlusion Culling & Frustum Query
             // Use scratch buffer to avoid allocation in hot path
             let vp: Float32Array;
             if (viewProjectionMatrix instanceof Float32Array) {
               vp = viewProjectionMatrix;
             } else {
               this.vpScratch.set(viewProjectionMatrix);
               vp = this.vpScratch;
             }

             this.collisionWorld.clear_occlusion_buffer();
             
             // Use last frame's visible entities as potential occluders for this frame
             // This exploits temporal coherence: what was visible is likely still visible and occluding
             // We filter indices to ensure they are still valid (within range)
             if (this.lastFrameVisibleIndices && this.lastFrameVisibleIndicesCount > 0) {
               // Note: Indices are valid only if entity count hasn't decreased or order changed significantly.
               // Since we rebuild the world every frame in sequential order of activeEntities,
               // indices from last frame are only valid if activeEntities array is somewhat stable.
               // A more robust way would be to track Entity IDs, but for now we rely on stability.
               // We clamp indices to be safe.
               
               // Filter valid indices - reuse scratch array
               const validIndices = new Uint32Array(this.lastFrameVisibleIndicesCount);
               let validCount = 0;
              for (let i = 0; i < this.lastFrameVisibleIndicesCount; i++) {
                const idx = this.lastFrameVisibleIndices[i];
                if (idx !== undefined && idx < count) {
                  validIndices[validCount++] = idx;
                }
              }
               
               // Rasterize
               const occluders = validIndices.subarray(0, validCount);
               this.collisionWorld.rasterize_occluders(occluders, vp);
             } else {
               // First frame or no previous visible: Rasterize everything (or nothing?)
               // Rasterizing everything is too slow. Rasterizing nothing means no occlusion culling this frame.
               // Let's try rasterizing a subset? Or just nothing for the first frame.
               // Occlusion will kick in from 2nd frame.
             }

             // 5. Query Frustum (with Occlusion check)
             const visibleIndices = this.collisionWorld.query_frustum(vp);
             
             // Cache for next frame - reuse array to avoid allocations
             const visibleCount = visibleIndices.length;
             if (!this.lastFrameVisibleIndices || this.lastFrameVisibleIndices.length < visibleCount) {
               // Allocate with 2x buffer to reduce reallocations
               this.lastFrameVisibleIndices = new Uint32Array(Math.max(visibleCount * 2, 256));
             }
             this.lastFrameVisibleIndices.set(visibleIndices);
             this.lastFrameVisibleIndicesCount = visibleCount;

             // 6. Update visible entities cache
             this.visibleEntitiesCache.length = 0;
            for (let i = 0; i < visibleIndices.length; i++) {
              const idx = visibleIndices[i];
              if (idx !== undefined && idx < count) {
                const entity = allEntities[idx];
                if (entity) this.visibleEntitiesCache.push(entity);
              }
            }
          } else {
             // Fallback if memory access fails
             const frustum = this.frustumCuller.extractFrustumFromVP(viewProjectionMatrix);
             this.frustumCuller.cullEntitiesToArray(allEntities, frustum, this.visibleEntitiesCache);
          }
        } else {
          this.visibleEntitiesCache.length = 0;
        }
      } else {
        // Fallback to TS implementation
        const frustum = this.frustumCuller.extractFrustumFromVP(viewProjectionMatrix);
        const allEntities = scene ? scene.getActiveEntities() : [];
        this.frustumCuller.cullEntitiesToArray(allEntities, frustum, this.visibleEntitiesCache);
      }

      const cullingTime = performance.now() - cullStart;

      const { defaultGeometry, customGeometry } = this.instanceBuilder.separateCustomGeometry(
        this.visibleEntitiesCache
      );
      this.customGeometryEntitiesCache = customGeometry;
      
      // Update custom geometry triangle counts
      this.updateCustomGeometryTriangleCounts(customGeometry);
      
      const instanceStart = performance.now();
      const sceneData = this.instanceBuilder.build(defaultGeometry);

      // Cleanup caches based on current instance count
      this.cleanupCaches(sceneData.instanceCount);

      const instanceData: InstanceBufferData = {
        instanceInterleavedData: sceneData.instanceInterleavedData,
        instanceBoundsData: sceneData.instanceBoundsData,
      };

      if (geometry.instanceCount === sceneData.instanceCount) {
        updateInstanceBuffers(configuredDevice, frameResources, instanceData);
      } else {
        reallocateInstanceBuffers(configuredDevice, frameResources, instanceData);
      }

      const instanceUpdateTime = performance.now() - instanceStart;
      geometry = { ...geometry, ...sceneData };
      this.geometryCache.tick();

      const totalCPUTime = cullingTime + instanceUpdateTime;
      return {
        geometry,
        timings: { cullingTime, instanceUpdateTime, totalCPUTime },
      };
    } catch (err) {
      this.recordError('sceneUpdate');
      Logger.warn('Frustum culling/update failed:', err);
      return { geometry };
    }
  }

  private runScreenSpaceLOD(
    ctx: FrameRenderContext,
    featureFlags: ResolvedFeatureFlags,
    encoder: GPUCommandEncoder,
    viewProjectionMatrix: Mat4,
    eyePosition: Vec3,
    geometry: GeometryData,
    frameResources: FrameResources,
    viewMatrix?: Mat4,
    projectionMatrix?: Mat4
  ): void {
    if (
      !featureFlags.enableScreenLOD ||
      !ctx.scene ||
      !viewMatrix ||
      !projectionMatrix ||
      geometry.instanceCount === 0
    ) {
      return;
    }
    try {
      const configuredDevice = ctx.configuredDevice ?? ctx.device;
      if (!this.screenSpaceLOD) {
        this.screenSpaceLOD = new ScreenSpaceLOD(configuredDevice);
      }
      this.screenSpaceLOD.selectLOD(
        encoder,
        viewProjectionMatrix,
        eyePosition,
        ctx.canvas.width,
        ctx.canvas.height,
        frameResources.instanceInterleavedBuffer,
        geometry.instanceCount
      );
    } catch (err) {
      this.recordError('screenLod');
      Logger.warn('Screen-space LOD selection failed:', err);
    }
  }

  private runShadowPass(
    ctx: FrameRenderContext,
    featureFlags: ResolvedFeatureFlags,
    encoder: GPUCommandEncoder,
    frameResources: FrameResources,
    geometry: GeometryData,
    viewMatrix?: Mat4,
    projectionMatrix?: Mat4
  ): void {
    if (!featureFlags.enableShadows || !viewMatrix || !projectionMatrix) {
      return;
    }
    try {
      const configuredDevice = ctx.configuredDevice ?? ctx.device;
      if (!this.shadowPass) {
        this.shadowPass = new ShadowPass(configuredDevice);
      }
      try {
        const q = ctx.shadowQuality ?? 'med';
        this.shadowPass.setQualityPreset(q);
      } catch {
        // ignore invalid quality preset
      }
      this.shadowPass.render({
        encoder,
        frameResources,
        geometry,
        viewMatrix,
        projectionMatrix,
        uniformManager: ctx.uniformManager,
        lightingData: ctx.lightingData,
        ibl: {
          brdfLut: ctx.environmentRenderer?.getBrdfLutTexture?.() ?? null,
          envCube: ctx.environmentRenderer?.getEnvCubeTexture?.() ?? null,
        },
      });
      if (typeof ctx.onShadowMetrics === 'function') {
        try {
          ctx.onShadowMetrics(this.shadowPass.getLastCascadeInstanceCounts());
        } catch {
          // ignore metric failures
        }
      }
    } catch (err) {
      this.recordError('shadowPass');
      Logger.warn('Shadow pass failed:', err);
    }
  }

  private runForwardPlus(
    ctx: FrameRenderContext,
    featureFlags: ResolvedFeatureFlags,
    encoder: GPUCommandEncoder,
    projectionMatrix: Mat4 | undefined,
    viewMatrix: Mat4 | undefined,
    eyePosition: Vec3
  ): void {
    if (!featureFlags.enableForwardPlus || !ctx.lightingData || !viewMatrix || !projectionMatrix) {
      return;
    }
    try {
      const configuredDevice = ctx.configuredDevice ?? ctx.device;
      if (!this.forwardPlus) {
        this.forwardPlus = new ForwardPlus(configuredDevice);
      }
      const pointLights: PointLight[] = [];
      if (ctx.lightingData?.lights) {
        for (const light of ctx.lightingData.lights) {
          if (light && light.type === 1) {
            pointLights.push({
              position: light.position,
              color: light.color,
              range: light.range ?? 10.0,
              intensity: 1.0,
            });
          }
        }
      }
      if (pointLights.length > 0) {
        this.forwardPlus.updateLights(pointLights);
        this.forwardPlus.cullLights(
          encoder,
          projectionMatrix,
          viewMatrix,
          eyePosition,
          ctx.canvas.width,
          ctx.canvas.height,
          pointLights.length
        );
      }
    } catch (err) {
      this.recordError('forwardPlus');
      Logger.warn('Forward+ light culling failed:', err);
    }
  }

  private runComputePrepass(
    ctx: FrameRenderContext,
    featureFlags: ResolvedFeatureFlags,
    encoder: GPUCommandEncoder,
    frameResources: FrameResources,
    geometry: GeometryData,
    viewProjectionMatrix: Mat4
  ): boolean {
    if (!featureFlags.enableComputePrepass) {
      this.instancePipeline?.dispose();
      this.instancePipeline = null;
      this.instancePipelineDevice = null;
      return false;
    }

    // Try to use async culling results if enabled
    if (featureFlags.enableAsyncCompute) {
      const asyncSlot = this.tryUseAsyncCulling(ctx, encoder, frameResources, geometry);
      if (asyncSlot) {
        // Async culling was used, prepare next frame's culling
        this.prepareAsyncCulling(ctx, viewProjectionMatrix, geometry);
        return true;
      }
      // Fall through to sync path if async not ready
    }

    try {
      const configuredDevice = ctx.configuredDevice ?? ctx.device;
      const pipeline = this.ensureInstancePipeline(configuredDevice);
      if (frameResources.timestampQuerySet) {
        try {
          (encoder as any).writeTimestamp?.(
            frameResources.timestampQuerySet,
            TIMESTAMP_INDICES.COMPUTE_BEGIN
          );
        } catch {
          // ignore
        }
      }
      const success = pipeline.execute({
        encoder,
        frameResources,
        geometry,
        viewProjectionMatrix,
      });
      if (frameResources.timestampQuerySet) {
        try {
          (encoder as any).writeTimestamp?.(
            frameResources.timestampQuerySet,
            TIMESTAMP_INDICES.COMPUTE_END
          );
        } catch {
          // ignore
        }
      }
      return success;
    } catch (err) {
      this.recordError('computePrepass');
      Logger.warn('Compute prepass failed:', err);
      return false;
    }
  }

  private ensureInstancePipeline(device: GPUDevice): GpuInstancePipeline {
    if (!this.instancePipeline || this.instancePipelineDevice !== device) {
      try {
        this.instancePipeline?.dispose();
      } catch {
        // ignore
      }
      this.instancePipeline = new GpuInstancePipeline(device);
      this.instancePipelineDevice = device;
    }
    return this.instancePipeline;
  }

  private updateCpuIndirectArgs(
    device: GPUDevice,
    frameResources: FrameResources,
    geometry: GeometryData
  ): void {
    const totalInstances = geometry.instanceCount;
    const opaqueCount = Math.min(Math.max(geometry.opaqueCount ?? totalInstances, 0), totalInstances);
    const transparentCount = Math.max(totalInstances - opaqueCount, 0);
    const args = buildIndirectDrawArgs(geometry.indices.length, opaqueCount, transparentCount);
    device.queue.writeBuffer(
      frameResources.instanceIndirectArgsBuffer,
      0,
      args.buffer as ArrayBuffer,
      args.byteOffset,
      args.byteLength
    );
  }

  private beginMainPass(
    encoder: GPUCommandEncoder,
    frameResources: FrameResources,
    targetState: ReturnType<FrameTargetManager['ensureTargets']>,
    swapChainView: GPUTextureView,
    featureFlags: ResolvedFeatureFlags,
    sampleCount: number,
    passDescriptor?: GPURenderPassDescriptor
  ): GPURenderPassEncoder {
    const enableHDR = featureFlags.enableHDR;
    
    // Only set resolveTarget when MSAA is enabled (sampleCount > 1)
    // WebGPU spec: resolveTarget is only valid when sampleCount > 1
    let resolveTarget: GPUTextureView | undefined;
    if (sampleCount > 1) {
    try {
      resolveTarget = enableHDR ? targetState.hdrView ?? swapChainView : swapChainView;
      // Test if view is still valid by checking if we can create a render pass
      // (WebGPU will validate this when we call beginRenderPass)
    } catch (err) {
      Logger.warn('[FrameRenderer] Invalid resolve target, using swap chain view:', err);
      resolveTarget = swapChainView;
      }
    }
    
    const colorAttachment: GPURenderPassColorAttachment = {
      view: frameResources.msaaColorView,
      ...(resolveTarget && { resolveTarget }),
      clearValue: CLEAR_COLOR,
      loadOp: 'clear',
      storeOp: 'store',
    };
    const depthAttachment: GPURenderPassDepthStencilAttachment = {
      view: frameResources.depthTextureView,
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: targetState.needsDepthStore ? 'store' : 'discard',
    };

    const baseDescriptor: GPURenderPassDescriptor = {
      label: 'frame-render-pass',
      colorAttachments: [colorAttachment],
      depthStencilAttachment: depthAttachment,
    };

    return encoder.beginRenderPass({
      ...baseDescriptor,
      ...(passDescriptor?.timestampWrites ? { timestampWrites: passDescriptor.timestampWrites } : {}),
      ...(passDescriptor?.occlusionQuerySet ? { occlusionQuerySet: passDescriptor.occlusionQuerySet } : {}),
      ...(typeof passDescriptor?.maxDrawCount === 'number'
        ? { maxDrawCount: passDescriptor.maxDrawCount }
        : {}),
    });
  }

  private renderEnvironment(
    ctx: FrameRenderContext,
    passEncoder: GPURenderPassEncoder,
    viewProjectionMatrix: Mat4,
    eyePosition: Vec3
  ): void {
    const { environmentRenderer, scene } = ctx;
    if (!environmentRenderer || !scene) {
      return;
    }
    const environmentEntities = scene.queryEntities(EnvironmentComponent);
    const environmentEntity = environmentEntities.find((entity: Entity) => entity.active);
    if (!environmentEntity) {
      return;
    }
    const envComponent = environmentEntity.getComponent(EnvironmentComponent);
    if (!envComponent || !envComponent.enabled) {
      return;
    }
    try {
      const inverseVP = new Float32Array(16);
      mat4Invert(inverseVP, viewProjectionMatrix);
      environmentRenderer.updateUniforms(inverseVP, eyePosition);
      environmentRenderer.updateParams(envComponent);
      environmentRenderer.render(passEncoder, envComponent);
      
      // Note: Volumetric clouds are rendered in a separate pass after the main pass ends
      // to avoid sampling the depth texture while it's attached as a render target.
      // See renderVolumetricCloudsPass() which is called after the main render pass.
    } catch (err) {
      this.recordError('environmentRender');
      Logger.warn('Environment render failed:', err);
    }
  }

  /**
   * Renders volumetric clouds in a separate pass after the main render pass.
   * This is necessary because clouds sample the depth texture, which cannot be
   * sampled while it's attached as a render target (WebGPU validation requirement).
   */
  private renderVolumetricCloudsPass(
    ctx: FrameRenderContext,
    encoder: GPUCommandEncoder,
    targetState: ReturnType<FrameTargetManager['ensureTargets']>,
    swapChainView: GPUTextureView,
    viewProjectionMatrix: Mat4,
    eyePosition: Vec3,
    featureFlags: { enableHDR: boolean },
    sampleCount: number
  ): void {
    const { environmentRenderer, scene, frameResources, canvas } = ctx;
    if (!environmentRenderer || !scene) {
      return;
    }
    const environmentEntities = scene.queryEntities(EnvironmentComponent);
    const environmentEntity = environmentEntities.find((entity: Entity) => entity.active);
    if (!environmentEntity) {
      return;
    }
    const envComponent = environmentEntity.getComponent(EnvironmentComponent);
    if (!envComponent || !envComponent.enabled || !envComponent.cloudsEnabled) {
      return;
    }

    try {
      // For volumetric clouds, we need a single-sampled depth texture that is not 
      // currently attached as a render target.
      // - For MSAA (sampleCount > 1): use the resolved depth texture
      // - For non-MSAA (sampleCount === 1): use the original depth texture (safe since main pass ended)
      let depthViewForClouds: GPUTextureView | null = null;
      
      if (sampleCount > 1) {
        // MSAA: use resolved depth (already resolved before this method is called)
        depthViewForClouds = targetState.resolvedDepthView;
      } else {
        // Non-MSAA: original depth texture is single-sampled and safe to use
        depthViewForClouds = frameResources.depthTextureView;
      }
      
      if (!depthViewForClouds) {
        // No depth available - skip cloud rendering
        return;
      }

      // Update the cloud pass with the depth texture for occlusion sampling
      environmentRenderer.updateDepthTexture(depthViewForClouds);

      // Determine resolve target based on HDR mode
      let resolveTarget: GPUTextureView | undefined;
      if (sampleCount > 1) {
        resolveTarget = featureFlags.enableHDR ? targetState.hdrView ?? swapChainView : swapChainView;
      }

      // Create a separate render pass for clouds
      const cloudPass = encoder.beginRenderPass({
        label: 'volumetric-clouds-pass',
        colorAttachments: [{
          view: frameResources.msaaColorView,
          ...(resolveTarget && { resolveTarget }),
          loadOp: 'load', // Preserve existing content (skybox, geometry)
          storeOp: 'store',
        }],
        // No depth attachment - clouds don't write depth and we're sampling it
      });

      // Get camera near/far planes from primary camera for correct depth linearization
      let nearPlane = 0.1;
      let farPlane = 10000;
      const primaryCamera = scene.primaryCamera;
      if (primaryCamera) {
        const cameraComponent = primaryCamera.getComponent(CameraComponent);
        if (cameraComponent) {
          nearPlane = cameraComponent.near;
          farPlane = cameraComponent.far;
        }
      }

      // Render volumetric clouds
      const vpMatrix = viewProjectionMatrix instanceof Float32Array 
        ? viewProjectionMatrix 
        : new Float32Array(viewProjectionMatrix);
      environmentRenderer.renderVolumetricClouds(
        cloudPass, 
        envComponent, 
        vpMatrix,
        canvas?.width ?? 1920,
        canvas?.height ?? 1080,
        nearPlane,
        farPlane
      );

      cloudPass.end();
    } catch (err) {
      this.recordError('volumetricClouds');
      Logger.warn('Volumetric clouds render failed:', err);
    }
  }

  /**
   * Resolves MSAA depth to a single-sampled texture for use in volumetric clouds.
   * This must be called before renderVolumetricCloudsPass when MSAA is enabled.
   */
  private resolveDepthForClouds(
    device: GPUDevice,
    encoder: GPUCommandEncoder,
    multisampledDepthView: GPUTextureView,
    resolvedDepthView: GPUTextureView,
    width: number,
    height: number
  ): void {
    this.initializeDepthResolve(device);
    if (!this.depthResolvePipeline || !this.depthResolveLayout || !this.depthResolveUniformBuffer) {
      Logger.warn('Depth resolve pipeline not initialized for clouds');
      return;
    }
    
    const uniformData = new Float32Array([width, height]);
    device.queue.writeBuffer(this.depthResolveUniformBuffer, 0, uniformData);
    
    const bindGroup = device.createBindGroup({
      label: 'cloud-depth-resolve-bg',
      layout: this.depthResolveLayout,
      entries: [
        { binding: 0, resource: multisampledDepthView },
        { binding: 1, resource: { buffer: this.depthResolveUniformBuffer } },
      ],
    });
    
    const pass = encoder.beginRenderPass({
      label: 'cloud-depth-resolve-pass',
      colorAttachments: [],
      depthStencilAttachment: {
        view: resolvedDepthView,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0,
      },
    });
    pass.setPipeline(this.depthResolvePipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }

  /**
   * Initializes the depth resolve pipeline for volumetric cloud depth sampling.
   */
  private initializeDepthResolve(device: GPUDevice): void {
    if (this.depthResolvePipeline && this.depthResolveDevice === device) {
      return;
    }
    
    // Cleanup old resources if device changed
    if (this.depthResolveDevice !== device) {
      try {
        this.depthResolveUniformBuffer?.destroy();
      } catch {
        // ignore
      }
      this.depthResolvePipeline = null;
      this.depthResolveLayout = null;
      this.depthResolveUniformBuffer = null;
    }
    this.depthResolveDevice = device;
    
    this.depthResolveLayout = device.createBindGroupLayout({
      label: 'cloud-depth-resolve-bgl',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'depth', multisampled: true },
        },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });
    
    this.depthResolveUniformBuffer = device.createBuffer({
      label: 'cloud-depth-resolve-uniforms',
      size: 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    const vs = device.createShaderModule({
      label: 'cloud-depth-resolve-vs',
      code: `
struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
}
@vertex
fn vs_fullscreen(@builtin(vertex_index) vid: u32) -> VSOut {
  var o: VSOut;
  let x = f32((vid << 1u) & 2u);
  let y = f32(vid & 2u);
  o.pos = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
  o.uv = vec2<f32>(x, y);
  return o;
}
`,
    });
    
    const fs = device.createShaderModule({
      label: 'cloud-depth-resolve-fs',
      code: `
@group(0) @binding(0) var depthTex : texture_depth_multisampled_2d;

struct Uniforms {
  width: f32,
  height: f32,
}

@group(0) @binding(1) var<uniform> uniforms : Uniforms;

@fragment
fn fs_main(@location(0) v_uv: vec2<f32>) -> @builtin(frag_depth) f32 {
  let texCoord = vec2<i32>(v_uv * vec2<f32>(uniforms.width, uniforms.height));
  let depth = textureLoad(depthTex, texCoord, 0);
  return depth;
}
`,
    });
    
    this.depthResolvePipeline = device.createRenderPipeline({
      label: 'cloud-depth-resolve-pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.depthResolveLayout],
      }),
      vertex: {
        module: vs,
        entryPoint: 'vs_fullscreen',
      },
      fragment: {
        module: fs,
        entryPoint: 'fs_main',
        targets: [],
      },
      primitive: {
        topology: 'triangle-list',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'always',
      },
      multisample: {
        count: 1,
      },
    });
  }

  private renderStaticGeometry(
    passEncoder: GPURenderPassEncoder,
    ctx: FrameRenderContext,
    geometry: GeometryData,
    frameResources: FrameResources,
    sampleCount: number
  ): void {
    const { device } = ctx;
    const state = this.bundleState;
    
    const needsRebuild = !state ||
      state.instanceCount !== geometry.instanceCount ||
      state.indexCount !== geometry.indices.length ||
      state.opaqueCount !== (geometry.opaqueCount ?? geometry.instanceCount) ||
      state.renderPipeline !== frameResources.renderPipeline ||
      state.transparentPipeline !== frameResources.transparentPipeline ||
      state.overlayPipeline !== frameResources.overlayPipeline ||
      state.uniformBindGroup !== frameResources.uniformBindGroup ||
      state.textureBindGroup !== frameResources.textureBindGroup;

    if (needsRebuild) {
      try {
        const bundle = this.recordStaticBundle(device, frameResources, geometry, sampleCount);
        this.bundleState = {
          bundle,
          instanceCount: geometry.instanceCount,
          indexCount: geometry.indices.length,
          opaqueCount: geometry.opaqueCount ?? geometry.instanceCount,
          renderPipeline: frameResources.renderPipeline,
          transparentPipeline: frameResources.transparentPipeline,
          overlayPipeline: frameResources.overlayPipeline,
          uniformBindGroup: frameResources.uniformBindGroup,
          textureBindGroup: frameResources.textureBindGroup,
        };
      } catch (err) {
        Logger.warn('Render bundle creation failed', err);
        this.bundleState = null;
      }
    }

    if (this.bundleState) {
      try {
        passEncoder.executeBundles([this.bundleState.bundle]);
        return;
      } catch {
        // fallthrough to direct draw
      }
    }

    this.drawStaticGeometry(passEncoder, frameResources, geometry);
  }

  private renderWater(
    ctx: FrameRenderContext,
    passEncoder: GPURenderPassEncoder,
    viewProjectionMatrix: Mat4,
    eyePosition: Vec3
  ): void {
    const { waterRenderer, scene, environmentRenderer, frameResources } = ctx;
    if (!waterRenderer || !scene) {
      return;
    }
    try {
      const envCubemap = environmentRenderer?.getEnvCubeTexture?.() ?? null;
      const time = ctx.time ?? 0;
      waterRenderer.render(
        passEncoder,
        scene,
        viewProjectionMatrix,
        eyePosition,
        time,
        envCubemap,
        frameResources.depthTexture,
        frameResources.msaaColorTexture
      );
    } catch (err) {
      this.recordError('waterRender');
      Logger.warn('Water render failed:', err);
    }
  }

  private renderGrid(
    ctx: FrameRenderContext,
    passEncoder: GPURenderPassEncoder,
    viewProjectionMatrix: Mat4,
    eyePosition?: Vec3
  ): void {
    const { gridRenderer } = ctx;
    if (!gridRenderer?.render) {
      return;
    }
    try {
      gridRenderer.render(passEncoder, viewProjectionMatrix, eyePosition);
    } catch (err) {
      this.recordError('gridRender');
      Logger.warn('Grid render failed:', err);
    }
  }

  private renderLogicConnections(
    ctx: FrameRenderContext,
    passEncoder: GPURenderPassEncoder,
    viewProjectionMatrix: Mat4,
    eyePosition: Vec3
  ): void {
    const { logicConnectionRenderer, scene } = ctx;
    if (!logicConnectionRenderer || !scene) {
      return;
    }
    try {
      logicConnectionRenderer.render(passEncoder, viewProjectionMatrix, eyePosition);
    } catch (err) {
      this.recordError('logicConnection');
      Logger.warn('Logic connection render failed:', err);
    }
  }

  private buildPostProcessInputs(
    ctx: FrameRenderContext,
    featureFlags: ResolvedFeatureFlags,
    targetState: ReturnType<FrameTargetManager['ensureTargets']>,
    params: {
      encoder: GPUCommandEncoder;
      geometry: GeometryData;
      frameResources: FrameResources;
      swapChainView: GPUTextureView;
      sampleCount: number;
      viewMatrix?: Mat4;
      projectionMatrix?: Mat4;
    }
  ): PostProcessInputs {
    return {
      ctx,
      encoder: params.encoder,
      frameResources: params.frameResources,
      featureFlags: {
        enableHDR: featureFlags.enableHDR,
        enableBloom: featureFlags.enableBloom,
        enableSSAO: featureFlags.enableSSAO,
        enableSSGI: featureFlags.enableSSGI,
        enableFXAA: featureFlags.enableFXAA,
        enableOutlines: featureFlags.enableOutlines,
        enableStylizedColorGrading: featureFlags.enableStylizedColorGrading,
      },
      targets: {
        hdrView: targetState.hdrView,
        bloomView: targetState.bloomView,
        normalView: targetState.normalView,
        ssaoView: targetState.ssaoView,
        ssgiView: targetState.ssgiView,
        resolvedDepthView: targetState.resolvedDepthView,
        tonemapIntermediateView: targetState.tonemapIntermediateView,
        needsDepthStore: targetState.needsDepthStore,
      },
      geometry: params.geometry,
      viewMatrix: params.viewMatrix,
      projectionMatrix: params.projectionMatrix,
      sampleCount: params.sampleCount,
      swapChainView: params.swapChainView,
    };
  }

  private drawStaticGeometry(
    encoder: GPURenderPassEncoder | GPURenderBundleEncoder,
    frameResources: FrameResources,
    geometry: GeometryData
  ): void {
    encoder.setVertexBuffer(0, frameResources.vertexBuffer);
    encoder.setVertexBuffer(1, frameResources.instanceInterleavedBuffer);
    encoder.setIndexBuffer(frameResources.indexBuffer, 'uint16');

    encoder.setPipeline(frameResources.renderPipeline);
    encoder.setBindGroup(0, frameResources.uniformBindGroup);
    encoder.setBindGroup(1, frameResources.textureBindGroup);
    encoder.drawIndexedIndirect(frameResources.instanceIndirectArgsBuffer, IndirectCommandOffset.OPAQUE);

    if (frameResources.transparentPipeline) {
      encoder.setPipeline(frameResources.transparentPipeline);
      encoder.setBindGroup(0, frameResources.uniformBindGroup);
      encoder.setBindGroup(1, frameResources.textureBindGroup);
      encoder.drawIndexedIndirect(frameResources.instanceIndirectArgsBuffer, IndirectCommandOffset.TRANSPARENT);
    }

    encoder.setPipeline(frameResources.overlayPipeline);
    encoder.setBindGroup(0, frameResources.uniformBindGroup);
    encoder.setBindGroup(1, frameResources.textureBindGroup);
    encoder.drawIndexedIndirect(frameResources.instanceIndirectArgsBuffer, IndirectCommandOffset.OVERLAY);
  }

  private recordStaticBundle(
    device: GPUDevice,
    frameResources: FrameResources,
    geometry: GeometryData,
    sampleCount: number
  ): GPURenderBundle {
    const createRenderBundleEncoder = (device as any).createRenderBundleEncoder;
    if (typeof createRenderBundleEncoder !== 'function') {
      throw new Error('RenderBundleEncoder not supported');
    }
    const bundleEncoder = createRenderBundleEncoder.call(device, {
      label: 'frame-static-bundle',
      colorFormats: ['rgba16float'],
      depthStencilFormat: 'depth24plus',
      sampleCount,
    });
    this.drawStaticGeometry(bundleEncoder, frameResources, geometry);
    return bundleEncoder.finish();
  }

  private scheduleTimestampRead(
    device: GPUDevice,
    frameResources: FrameResources,
    callback: (timings: { label: string; timeMs: number }[]) => void
  ): void {
    // Guard: ensure timestamp queries are available
    if (
      !frameResources.timestampQuerySet ||
      !frameResources.timestampResolveBuffer ||
      !frameResources.timestampReadBuffer
    ) {
      // Timestamp queries not available - call callback with empty timings
      callback([]);
      return;
    }

    if (this.pendingTimestampRead) {
      return;
    }
    this.pendingTimestampRead = true;
    const readBuffer = frameResources.timestampReadBuffer;
    device.queue
      .onSubmittedWorkDone()
      .then(() => {
        // Check if disposed before async operation
        if (this.disposed) return;
        return readBuffer.mapAsync(GPUMapMode.READ);
      })
      .then(() => {
        // Check if disposed after mapping
        if (this.disposed) {
          try {
            readBuffer.unmap();
          } catch {
            // ignore - buffer may already be destroyed
          }
          return;
        }
        
        let snapshot: ArrayBuffer;
        try {
          const mapped = readBuffer.getMappedRange();
          snapshot = mapped.slice(0);
        } finally {
          try {
            readBuffer.unmap();
          } catch {
            // ignore
          }
        }

        // Final check before callback
        if (this.disposed) return;

        const values = new BigUint64Array(snapshot);
        const timings: { label: string; timeMs: number }[] = [];
        for (const pair of GPU_TIMESTAMP_PAIRS) {
          const begin = values[pair.beginIndex];
          const end = values[pair.endIndex];
          if (begin === undefined || end === undefined || begin === 0n || end <= begin) {
            continue;
          }
          const delta = end - begin;
          if (delta <= 0n) {
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
        // Don't log errors if disposed - expected behavior
        if (!this.disposed) {
          Logger.warn('GPU timestamp read failed', err);
        }
        try {
          readBuffer.unmap();
        } catch {
          // ignore
        }
      })
      .finally(() => {
        this.pendingTimestampRead = false;
      });
  }

  private invalidateBundle(): void {
    this.bundleState = null;
  }

  private handleTimestampRead(
    ctx: FrameRenderContext,
    device: GPUDevice,
    frameResources: FrameResources
  ): void {
    if (
      frameResources.timestampQuerySet &&
      frameResources.timestampResolveBuffer &&
      frameResources.timestampReadBuffer &&
      typeof ctx.onGpuTimings === 'function'
    ) {
      this.scheduleTimestampRead(device, frameResources, ctx.onGpuTimings);
    }
  }

}
