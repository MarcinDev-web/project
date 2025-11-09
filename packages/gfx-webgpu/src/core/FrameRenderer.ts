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
import { EnvironmentComponent } from '@engine/world';
import type { FrameResources, GeometryData } from '../resources/resources';
import { FrustumCuller } from './FrustumCuller';
import { InstanceDataBuilder, type CustomGeometryEntity } from './InstanceManager';
import { GeometryCache } from './GeometryCache';
import { ComputePrepass } from './ComputePrepass';
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

interface ResolvedFeatureFlags extends PostProcessFeatureFlags {
  enableComputePrepass: boolean;
  enableShadows: boolean;
  enableForwardPlus: boolean;
  enableScreenLOD: boolean;
}

interface SceneUpdateResult {
  geometry: GeometryData;
  timings?: {
    cullingTime: number;
    instanceUpdateTime: number;
    totalCPUTime: number;
  };
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
  gridRenderer: { render?: (p: GPURenderPassEncoder, vp: Mat4) => void } | null;
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
    enableFXAA?: boolean;
    enableOutlines?: boolean;
    enableForwardPlus?: boolean;
    enableScreenLOD?: boolean;
  };
  shadowQuality?: 'low' | 'med' | 'high' | 'ultra';
  outlineQuality?: 'low' | 'med';
  msaaSampleCount?: number;
  time?: number;
  configuredDevice?: GPUDevice;
  frameResourcesDevice?: GPUDevice;
}

/**
 * FrameRenderer manages the per-frame rendering operations.
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
  private computePrepass: ComputePrepass | null = null;
  private pendingTimestampRead = false;
  private staticBundle: GPURenderBundle | null = null;
  private bundleDirty = true;
  private bundleInstanceCount = 0;
  private bundleIndexCount = 0;
  private bundleOpaqueCount = 0;
  private bundleRenderPipeline: GPURenderPipeline | null = null;
  private bundleTransparentPipeline: GPURenderPipeline | null = null;
  private bundleOverlayPipeline: GPURenderPipeline | null = null;
  private bundleUniformBindGroup: GPUBindGroup | null = null;
  private bundleTextureBindGroup: GPUBindGroup | null = null;
  private forwardPlus: ForwardPlus | null = null;
  private screenSpaceLOD: ScreenSpaceLOD | null = null;
  private shadowPass: ShadowPass | null = null;
  private instanceScaleScratch = new Float32Array(0);
  private ownedLodScaleBuffer: GPUBuffer | null = null;

  constructor(initialCapacity = 1000) {
    this.frustumCuller = new FrustumCuller();
    this.instanceBuilder = new InstanceDataBuilder(initialCapacity);
    this.geometryCache = new GeometryCache();
    this.customRenderer = new CustomGeometryRenderer(this.geometryCache);
    this.frameTargets = new FrameTargetManager();
    this.postProcess = new PostProcessPipeline();
  }

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

    const configuredDevice = this.validateConfiguredDevice(ctx);
    if (!configuredDevice) {
      return geometry;
    }
    if (!this.validateFrameResourcesDevice(ctx)) {
      return geometry;
    }

    const featureFlags = this.resolveFeatureFlags(ctx.featureFlags);
    const sampleCount = ctx.msaaSampleCount ?? MSAA_SAMPLE_COUNT;

    const targetState = this.frameTargets.ensureTargets(ctx, frameResources, {
      sampleCount,
      enableHDR: featureFlags.enableHDR,
      enableBloom: featureFlags.enableBloom,
      enableSSAO: featureFlags.enableSSAO,
      enableFXAA: featureFlags.enableFXAA,
      enableOutlines: featureFlags.enableOutlines,
    });

    const encoder = configuredDevice.createCommandEncoder({ label: 'frame-encoder' });
    const swapChainTexture = this.acquireSwapChainTexture(ctx, configuredDevice, encoder);
    if (!swapChainTexture) {
      return geometry;
    }
    const swapChainView = swapChainTexture.createView({ label: 'frame-color-resolve-view' });

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

    this.runForwardPlus(ctx, featureFlags, encoder, viewProjectionMatrix, viewMatrix, eyePosition);
    this.runComputePrepass(ctx, featureFlags, encoder, frameResources);

    const renderPass = this.beginMainPass(
      encoder,
      frameResources,
      targetState,
      swapChainView,
      featureFlags,
      passDescriptor
    );

    this.renderEnvironment(ctx, renderPass, viewProjectionMatrix, eyePosition);
    this.renderStaticGeometry(renderPass, ctx, geometry, frameResources, sampleCount);
    this.customRenderer.render({
      encoder: renderPass,
      device,
      frameResources,
      entities: this.customGeometryEntitiesCache,
    });
    this.renderWater(ctx, renderPass, viewProjectionMatrix, eyePosition);
    this.renderGrid(ctx, renderPass, viewProjectionMatrix);
    this.renderLogicConnections(ctx, renderPass, viewProjectionMatrix, eyePosition);

    renderPass.end();

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

    this.writeFrameEndTimestamp(frameResources, encoder);
    this.resolveTimestampQueries(frameResources, encoder);

    const commandBuffer = encoder.finish();
    this.submitAndCleanup(configuredDevice, commandBuffer, encoder);
    this.frameTargets.flush(configuredDevice.queue);
    this.postProcess.flush(configuredDevice.queue);

    this.handleTimestampRead(ctx, device, frameResources);

    if (sceneUpdate.timings && ctx.onCpuTimings) {
      ctx.onCpuTimings(sceneUpdate.timings);
    }

    // Calculate and report render stats
    if (ctx.onRenderStats) {
      const drawCalls = this.calculateDrawCalls(geometry);
      const triangles = this.calculateTriangles(geometry);
      ctx.onRenderStats({ drawCalls, triangles });
    }

    return geometry;
  }

  dispose(): void {
    try {
      this.computePrepass?.dispose();
    } catch {
      // ignore
    }
    this.computePrepass = null;
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
    try {
      this.ownedLodScaleBuffer?.destroy();
    } catch {
      // ignore
    }
    this.ownedLodScaleBuffer = null;
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

    // Custom geometry triangles (approximate - each custom geometry entity contributes)
    // This is a rough estimate since we don't track exact triangle counts for custom geometry
    const customGeometryTriangles = this.customGeometryEntitiesCache.length * 12; // Estimate: 12 triangles per custom entity

    return Math.round(instancedTriangles + customGeometryTriangles);
  }

  private resolveFeatureFlags(flags: FrameRenderContext['featureFlags']): ResolvedFeatureFlags {
    return {
      enableComputePrepass: flags?.enableComputePrepass !== false,
      enableShadows: flags?.enableShadows !== false,
      enableBloom: flags?.enableBloom !== false,
      enableHDR: flags?.enableHDR !== false,
      enableSSAO: flags?.enableSSAO !== false,
      enableFXAA: flags?.enableFXAA === true,
      enableOutlines: flags?.enableOutlines === true,
      enableForwardPlus: flags?.enableForwardPlus !== false,
      enableScreenLOD: flags?.enableScreenLOD !== false,
    };
  }

  private validateConfiguredDevice(ctx: FrameRenderContext): GPUDevice | null {
    const configuredDevice = ctx.configuredDevice ?? ctx.device;
    if (ctx.device !== configuredDevice) {
      Logger.warn('Device mismatch in FrameRenderer - skipping frame to avoid WebGPU errors');
      return null;
    }
    return configuredDevice;
  }

  private validateFrameResourcesDevice(ctx: FrameRenderContext): boolean {
    const frameResourcesDevice = ctx.frameResourcesDevice ?? ctx.device;
    if (ctx.device !== frameResourcesDevice) {
      Logger.warn(
        'FrameResources device mismatch - resources were created with different device. Skipping frame.'
      );
      return false;
    }
    return true;
  }

  private acquireSwapChainTexture(
    ctx: FrameRenderContext,
    configuredDevice: GPUDevice,
    encoder: GPUCommandEncoder
  ): GPUTexture | null {
    try {
      const texture = ctx.context.getCurrentTexture();
      const currentConfigured = ctx.configuredDevice ?? ctx.device;
      if (currentConfigured !== configuredDevice) {
        Logger.warn('Device changed between encoder creation and texture acquisition - aborting');
        try {
          encoder.finish();
        } catch {
          // ignore
        }
        return null;
      }
      return texture;
    } catch (err) {
      Logger.warn('Failed to get current swap chain texture - device may have changed:', err);
      try {
        encoder.finish();
      } catch {
        // ignore
      }
      return null;
    }
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

  private submitAndCleanup(device: GPUDevice, commandBuffer: GPUCommandBuffer, encoder: GPUCommandEncoder): void {
    device.queue.submit([commandBuffer]);
    // Clear bloom temp textures reference - they'll be destroyed in next frame by BloomPass
    (encoder as any).__bloomTempTextures = undefined;
  }

  private updateScene(
    ctx: FrameRenderContext,
    geometry: GeometryData,
    viewProjectionMatrix: Mat4
  ): SceneUpdateResult {
    const { scene, device, frameResources } = ctx;
    if (!scene) {
      return { geometry };
    }

    try {
      const cullStart = performance.now();
      const frustum = this.frustumCuller.extractFrustumFromVP(viewProjectionMatrix);
      const allEntities = scene.getActiveEntities();
      this.frustumCuller.cullEntitiesToArray(allEntities, frustum, this.visibleEntitiesCache);
      const cullingTime = performance.now() - cullStart;

      const { defaultGeometry, customGeometry } = this.instanceBuilder.separateCustomGeometry(
        this.visibleEntitiesCache
      );
      this.customGeometryEntitiesCache = customGeometry;

      const instanceStart = performance.now();
      const sceneData = this.instanceBuilder.build(defaultGeometry);
      const instanceData: InstanceBufferData = {
        instanceOffsetData: sceneData.instanceOffsetData,
        instanceColorScaleData: sceneData.instanceColorScaleData,
        instanceSecondaryColorData: sceneData.instanceSecondaryColorData,
        instanceEmissiveColorData: sceneData.instanceEmissiveColorData,
        instanceMaterialParamsData: sceneData.instanceMaterialParamsData,
        instanceRotationData: sceneData.instanceRotationData,
        instanceMaterialIdData: sceneData.instanceMaterialIdData,
      };

      if (geometry.instanceCount === sceneData.instanceCount) {
        updateInstanceBuffers(device, frameResources, instanceData);
      } else {
        reallocateInstanceBuffers(device, frameResources, instanceData);
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
      if (!this.screenSpaceLOD) {
        this.screenSpaceLOD = new ScreenSpaceLOD(ctx.device);
      }
      const scaleBuffer = this.extractInstanceScales(ctx.device, frameResources, geometry);
      this.screenSpaceLOD.selectLOD(
        encoder,
        viewProjectionMatrix,
        eyePosition,
        ctx.canvas.width,
        ctx.canvas.height,
        frameResources.instanceOffsetBuffer,
        scaleBuffer,
        geometry.instanceCount
      );
    } catch (err) {
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
      if (!this.shadowPass) {
        this.shadowPass = new ShadowPass(ctx.device);
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
      Logger.warn('Shadow pass failed:', err);
    }
  }

  private runForwardPlus(
    ctx: FrameRenderContext,
    featureFlags: ResolvedFeatureFlags,
    encoder: GPUCommandEncoder,
    viewProjectionMatrix: Mat4,
    viewMatrix: Mat4 | undefined,
    eyePosition: Vec3
  ): void {
    if (!featureFlags.enableForwardPlus || !ctx.lightingData || !viewMatrix) {
      return;
    }
    try {
      if (!this.forwardPlus) {
        this.forwardPlus = new ForwardPlus(ctx.device);
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
          viewProjectionMatrix,
          viewMatrix,
          eyePosition,
          ctx.canvas.width,
          ctx.canvas.height,
          pointLights.length
        );
      }
    } catch (err) {
      Logger.warn('Forward+ light culling failed:', err);
    }
  }

  private runComputePrepass(
    ctx: FrameRenderContext,
    featureFlags: ResolvedFeatureFlags,
    encoder: GPUCommandEncoder,
    frameResources: FrameResources
  ): void {
    if (!featureFlags.enableComputePrepass) {
      return;
    }
    try {
      if (!this.computePrepass && typeof encoder.beginComputePass === 'function') {
        this.computePrepass = new ComputePrepass(ctx.device);
      }
      if (!this.computePrepass) {
        return;
      }
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
      this.computePrepass.run(encoder);
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
    } catch (err) {
      Logger.warn('Compute prepass failed:', err);
    }
  }

  private beginMainPass(
    encoder: GPUCommandEncoder,
    frameResources: FrameResources,
    targetState: ReturnType<FrameTargetManager['ensureTargets']>,
    swapChainView: GPUTextureView,
    featureFlags: ResolvedFeatureFlags,
    passDescriptor?: GPURenderPassDescriptor
  ): GPURenderPassEncoder {
    const enableHDR = featureFlags.enableHDR;
    const colorAttachment: GPURenderPassColorAttachment = {
      view: frameResources.msaaColorView,
      resolveTarget: enableHDR ? targetState.hdrView ?? swapChainView : swapChainView,
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
    } catch (err) {
      Logger.warn('Environment render failed:', err);
    }
  }

  private renderStaticGeometry(
    passEncoder: GPURenderPassEncoder,
    ctx: FrameRenderContext,
    geometry: GeometryData,
    frameResources: FrameResources,
    sampleCount: number
  ): void {
    const { device } = ctx;
    const geometryChanged =
      this.bundleInstanceCount !== geometry.instanceCount ||
      this.bundleIndexCount !== geometry.indices.length ||
      this.bundleOpaqueCount !== (geometry.opaqueCount ?? geometry.instanceCount);
    const pipelineChanged =
      this.bundleRenderPipeline !== frameResources.renderPipeline ||
      this.bundleTransparentPipeline !== frameResources.transparentPipeline ||
      this.bundleOverlayPipeline !== frameResources.overlayPipeline ||
      this.bundleUniformBindGroup !== frameResources.uniformBindGroup ||
      this.bundleTextureBindGroup !== frameResources.textureBindGroup;

    if (geometryChanged || pipelineChanged) {
      this.invalidateBundle();
    }

    if (this.bundleDirty || !this.staticBundle) {
      try {
        this.staticBundle = this.recordStaticBundle(device, frameResources, geometry, sampleCount);
        this.bundleDirty = false;
        this.bundleInstanceCount = geometry.instanceCount;
        this.bundleIndexCount = geometry.indices.length;
        this.bundleOpaqueCount = geometry.opaqueCount ?? geometry.instanceCount;
        this.bundleRenderPipeline = frameResources.renderPipeline;
        this.bundleTransparentPipeline = frameResources.transparentPipeline;
        this.bundleOverlayPipeline = frameResources.overlayPipeline;
        this.bundleUniformBindGroup = frameResources.uniformBindGroup;
        this.bundleTextureBindGroup = frameResources.textureBindGroup;
      } catch (err) {
        Logger.warn('Render bundle creation failed', err);
        this.invalidateBundle();
      }
    }

    if (this.staticBundle) {
      try {
        passEncoder.executeBundles([this.staticBundle]);
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
      Logger.warn('Water render failed:', err);
    }
  }

  private renderGrid(
    ctx: FrameRenderContext,
    passEncoder: GPURenderPassEncoder,
    viewProjectionMatrix: Mat4
  ): void {
    const { gridRenderer } = ctx;
    if (!gridRenderer?.render) {
      return;
    }
    try {
      gridRenderer.render(passEncoder, viewProjectionMatrix);
    } catch (err) {
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
        enableFXAA: featureFlags.enableFXAA,
      },
      targets: {
        hdrView: targetState.hdrView,
        bloomView: targetState.bloomView,
        normalView: targetState.normalView,
        ssaoView: targetState.ssaoView,
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

  private extractInstanceScales(
    device: GPUDevice,
    frameResources: FrameResources,
    geometry: GeometryData
  ): GPUBuffer | null {
    const { instanceCount } = geometry;
    if (instanceCount === 0) {
      return null;
    }
    const source = geometry.instanceColorScaleData;
    if (!source || source.length < instanceCount * 4) {
      return null;
    }
    if (this.instanceScaleScratch.length < instanceCount) {
      this.instanceScaleScratch = new Float32Array(
        Math.max(instanceCount, this.instanceScaleScratch.length * 2 || 128)
      );
    }
    const scratch = this.instanceScaleScratch;
    for (let i = 0; i < instanceCount; i++) {
      scratch[i] = source[i * 4 + 3] ?? 1;
    }
    const byteLength = instanceCount * Float32Array.BYTES_PER_ELEMENT;
    const pool = (frameResources as unknown as { bufferPool?: GPUBufferPool }).bufferPool;

    if (pool) {
      const buffer = pool.getOrCreate(
        'lod-instance-scale',
        byteLength,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        'lod-instance-scale-buffer'
      );
      device.queue.writeBuffer(buffer, 0, scratch.buffer, 0, byteLength);
      return buffer;
    }

    if (!this.ownedLodScaleBuffer || this.ownedLodScaleBuffer.size < byteLength) {
      try {
        this.ownedLodScaleBuffer?.destroy();
      } catch {
        // ignore
      }
      this.ownedLodScaleBuffer = device.createBuffer({
        label: 'lod-instance-scale-buffer',
        size: byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }
    const buffer = this.ownedLodScaleBuffer;
    if (buffer) {
      device.queue.writeBuffer(buffer, 0, scratch.buffer, 0, byteLength);
    }
    return buffer ?? null;
  }

  private drawStaticGeometry(
    encoder: GPURenderPassEncoder | GPURenderBundleEncoder,
    frameResources: FrameResources,
    geometry: GeometryData
  ): void {
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
      .then(() => readBuffer.mapAsync(GPUMapMode.READ))
      .then(() => {
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
        Logger.warn('GPU timestamp read failed', err);
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
