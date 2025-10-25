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

import type { Scene, Entity } from '../../engine/scene';
import type { FrameResources, GeometryData } from '../resources/resources';
import { createDepthTexture, createMsaaColorTarget, createHdrColorTarget } from '../resources/resources';
import { FrustumCuller } from './FrustumCuller';
import { InstanceDataBuilder } from './InstanceManager';
import { GPUBufferPool } from './bufferPool';
import { ComputePrepass } from './ComputePrepass';
import { EnvironmentComponent } from '../../scene/components/EnvironmentComponent';
import type { EnvironmentRenderer } from '../renderers/EnvironmentRenderer';
import type { LogicConnectionRenderer } from '../LogicConnectionRenderer';
import { mat4Invert } from '@engine/core/math';
import type { Mat4, Vec3 } from '@engine/core/math';
import { Logger } from '../../app/utils/logger';
import { CLEAR_COLOR, MSAA_SAMPLE_COUNT, TIMESTAMP_QUERY_COUNT, TIMESTAMP_BUFFER_SIZE, GPU_TIMESTAMP_PAIRS } from '../config';
import { TonemapLutPass } from '../postprocess/TonemapLut';
import { BloomPass } from '../postprocess/Bloom';
import { UniformManager } from './UniformManager';
import { ShadowPass } from '../shadows/ShadowPass';

export interface FrameRenderContext {
  device: GPUDevice;
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  presentationFormat: GPUTextureFormat;
  frameResources: FrameResources;
  scene: Scene | null;
  geometry: GeometryData;
  environmentRenderer: EnvironmentRenderer | null;
  gridRenderer: { render?: (p: GPURenderPassEncoder, vp: Mat4) => void } | null;
  logicConnectionRenderer: LogicConnectionRenderer | null;
  onGpuTimings?: (timings: { label: string; timeMs: number }[]) => void;
  uniformManager: UniformManager;
  lightingData?: import('../lighting/LightManager').LightingData;
}

/**
 * FrameRenderer manages the per-frame rendering operations.
 */
export class FrameRenderer {
  private frustumCuller: FrustumCuller;
  private instanceBuilder: InstanceDataBuilder;
  private visibleEntitiesCache: Entity[] = [];
  private depthTextureSize = { width: 0, height: 0 };
  private computePrepass: ComputePrepass | null = null;
  private pendingTimestampRead = false;
  private staticBundle: GPURenderBundle | null = null;
  private bundleDirty = true;
  private bundleInstanceCount = 0;
  private bundleIndexCount = 0;
  private bundleRenderPipeline: GPURenderPipeline | null = null;
  private bundleOverlayPipeline: GPURenderPipeline | null = null;
  private bundleUniformBindGroup: GPUBindGroup | null = null;
  private bundleTextureBindGroup: GPUBindGroup | null = null;
  // Postprocess resources
  private hdrColorTexture: GPUTexture | null = null;
  private bloomTexture: GPUTexture | null = null;
  private tonemapPass: TonemapLutPass | null = null;
  private bloomPass: BloomPass | null = null;
  private shadowPass: ShadowPass | null = null;

  constructor(initialCapacity = 1000) {
    this.frustumCuller = new FrustumCuller();
    this.instanceBuilder = new InstanceDataBuilder(initialCapacity);
  }

  /**
   * Renders a single frame.
   * Returns updated geometry data.
   */
  renderFrame(
    ctx: FrameRenderContext,
    viewProjectionMatrix: Mat4,
    eyePosition: Vec3,
    passDescriptor?: GPURenderPassDescriptor,
    viewMatrix?: Mat4,
    projectionMatrix?: Mat4
  ): GeometryData {
    const { device, canvas, context, frameResources, scene, environmentRenderer, gridRenderer } = ctx;
    let { geometry } = ctx;

    // Handle canvas resize (recreate depth/MSAA textures if needed)
    if (this.depthTextureSize.width !== canvas.width || this.depthTextureSize.height !== canvas.height) {
      frameResources.depthTexture.destroy();
      frameResources.msaaColorTexture.destroy();
      this.hdrColorTexture?.destroy();
      this.bloomTexture?.destroy();
      frameResources.depthTexture = createDepthTexture(device, canvas, MSAA_SAMPLE_COUNT);
      frameResources.depthTextureView = frameResources.depthTexture.createView({
        label: 'frame-depth-view',
      });
      frameResources.msaaColorTexture = createMsaaColorTarget(
        device,
        canvas,
        'rgba16float',
        MSAA_SAMPLE_COUNT
      );
      frameResources.msaaColorView = frameResources.msaaColorTexture.createView({
        label: 'frame-msaa-color-view',
      });
      this.hdrColorTexture = createHdrColorTarget(device, canvas);
      this.bloomTexture = device.createTexture({
        label: 'frame-bloom-texture',
        size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      this.depthTextureSize = { width: canvas.width, height: canvas.height };
    }

    const encoder = device.createCommandEncoder({ label: 'frame-encoder' });

    // Shadow map pre-pass before main render pass
    try {
      // Lazy initialize shadow pass
      if (!this.shadowPass) {
        this.shadowPass = new ShadowPass(device);
      }
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
            brdfLut: ctx.environmentRenderer && (ctx.environmentRenderer as any).getBrdfLutTexture?.(),
            envCube: ctx.environmentRenderer && (ctx.environmentRenderer as any).getEnvCubeTexture?.(),
          },
        });
      }
    } catch (err) {
      Logger.warn('Shadow pass failed:', err);
    }

    // Compute prepass (runs before render pass)
    try {
      if (!this.computePrepass) {
        if (typeof (encoder as GPUCommandEncoder).beginComputePass === 'function') {
          this.computePrepass = new ComputePrepass(device);
        }
      }
      this.computePrepass?.run(encoder);
    } catch (err) {
      Logger.warn('Compute prepass failed:', err);
    }
    const swapChainView = context.getCurrentTexture().createView({ label: 'frame-color-resolve-view' });

    // Base pass descriptor with required attachments
    const basePassDesc: GPURenderPassDescriptor = {
      label: 'frame-render-pass',
      colorAttachments: [
        {
          view: frameResources.msaaColorView,
          resolveTarget: (this.hdrColorTexture ??= createHdrColorTarget(device, canvas)).createView({ label: 'frame-hdr-view' }),
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
    const finalPassDesc: GPURenderPassDescriptor = {
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

    // Per-frame frustum culling and dynamic instance buffer updates
    if (scene) {
      try {
        const frustum = this.frustumCuller.extractFrustumFromVP(viewProjectionMatrix);
        const allEntities = scene.getActiveEntities();
        this.frustumCuller.cullEntitiesToArray(allEntities, frustum, this.visibleEntitiesCache);
        const sceneData = this.instanceBuilder.build(this.visibleEntitiesCache);

        if (geometry.instanceCount === sceneData.instanceCount) {
          // Same count: update in place
          this.updateInstanceBuffers(device, frameResources, sceneData);
        } else {
          // Different count: reallocate
          this.reallocateInstanceBuffers(device, frameResources, sceneData);
        }
        geometry = { ...geometry, ...sceneData };
      } catch (err) {
        Logger.warn('Frustum culling/update failed:', err);
      }
    }

    // Optional: write a timestamp before starting the render pass for tests
    if (frameResources.timestampQuerySet) {
      try {
        (encoder as any).writeTimestamp?.(frameResources.timestampQuerySet, 0);
      } catch {
        // ignore when not supported by mock
      }
    }

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
    if (
      this.bundleRenderPipeline !== frameResources.renderPipeline ||
      this.bundleOverlayPipeline !== frameResources.overlayPipeline ||
      this.bundleUniformBindGroup !== frameResources.uniformBindGroup ||
      this.bundleTextureBindGroup !== frameResources.textureBindGroup
    ) {
      this.invalidateBundle();
    }
    if (
      this.bundleInstanceCount !== geometry.instanceCount ||
      this.bundleIndexCount !== geometry.indices.length
    ) {
      this.invalidateBundle();
    }

    if (this.bundleDirty || !this.staticBundle) {
      try {
        this.staticBundle = this.recordStaticBundle(
          device,
          frameResources,
          ctx.presentationFormat,
          geometry
        );
        this.bundleDirty = false;
        this.bundleInstanceCount = geometry.instanceCount;
        this.bundleIndexCount = geometry.indices.length;
        this.bundleRenderPipeline = frameResources.renderPipeline;
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
      } catch {
        this.drawStaticGeometry(passEncoder, frameResources, geometry);
      }
    } else {
      this.drawStaticGeometry(passEncoder, frameResources, geometry);
    }

    // Render grid overlay if available
    if (gridRenderer && typeof gridRenderer.render === 'function') {
      try {
        gridRenderer.render(passEncoder, viewProjectionMatrix);
      } catch (err) {
        Logger.warn('Grid render failed:', err);
      }
    }

    // Render logic cube connections if available
    const { logicConnectionRenderer } = ctx;
    if (logicConnectionRenderer && ctx.scene) {
      try {
        logicConnectionRenderer.render(passEncoder, viewProjectionMatrix, eyePosition);
      } catch (err) {
        Logger.warn('Logic connection render failed:', err);
      }
    }

    passEncoder.end();
    // Optional: write a timestamp after the render pass for tests
    if (frameResources.timestampQuerySet) {
      try {
        (encoder as any).writeTimestamp?.(frameResources.timestampQuerySet, 1);
      } catch {
        // ignore when not supported by mock
      }
    }
    if (frameResources.timestampQuerySet && frameResources.timestampResolveBuffer && frameResources.timestampReadBuffer) {
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
    // Postprocess: Bloom then Tonemap+LUT to the swap chain
    // Initialize passes lazily
    if (!this.bloomPass) { this.bloomPass = new BloomPass(device); this.bloomPass.initialize('rgba16float'); }
    if (!this.tonemapPass) { this.tonemapPass = new TonemapLutPass(device); this.tonemapPass.initialize(ctx.presentationFormat); }
    const hdrView = (this.hdrColorTexture ?? createHdrColorTarget(device, canvas)).createView();
    const bloomView = (this.bloomTexture ?? device.createTexture({
      label: 'frame-bloom-texture',
      size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })).createView();
    this.bloomPass.render(encoder, hdrView, bloomView);
    this.tonemapPass.render(encoder, hdrView, bloomView, swapChainView);

    device.queue.submit([encoder.finish()]);

    if (
      frameResources.timestampQuerySet &&
      frameResources.timestampResolveBuffer &&
      frameResources.timestampReadBuffer &&
      typeof ctx.onGpuTimings === 'function'
    ) {
      this.scheduleTimestampRead(device, frameResources, ctx.onGpuTimings);
    }

    return geometry;
  }

  /**
   * Releases resources owned by the FrameRenderer
   */
  dispose(): void {
    try {
      this.computePrepass?.dispose();
    } catch {
      // ignore
    }
    this.computePrepass = null;
    this.pendingTimestampRead = false;
    this.invalidateBundle();
    try { this.hdrColorTexture?.destroy(); } catch {}
    try { this.bloomTexture?.destroy(); } catch {}
    this.hdrColorTexture = null;
    this.bloomTexture = null;
  }

  /**
   * Updates instance buffers in place (same count).
   */
  private updateInstanceBuffers(
    device: GPUDevice,
    frameResources: FrameResources,
    sceneData: {
      instanceOffsetData: Float32Array;
      instanceColorScaleData: Float32Array;
      instanceRotationData: Float32Array;
      instanceMaterialIdData: Float32Array;
    }
  ): void {
    device.queue.writeBuffer(
      frameResources.instanceOffsetBuffer,
      0,
      sceneData.instanceOffsetData.buffer as ArrayBuffer,
      sceneData.instanceOffsetData.byteOffset,
      sceneData.instanceOffsetData.byteLength
    );
    device.queue.writeBuffer(
      frameResources.instanceColorScaleBuffer,
      0,
      sceneData.instanceColorScaleData.buffer as ArrayBuffer,
      sceneData.instanceColorScaleData.byteOffset,
      sceneData.instanceColorScaleData.byteLength
    );
    device.queue.writeBuffer(
      frameResources.instanceRotationBuffer,
      0,
      sceneData.instanceRotationData.buffer as ArrayBuffer,
      sceneData.instanceRotationData.byteOffset,
      sceneData.instanceRotationData.byteLength
    );

    // Ensure materialId buffer has enough capacity
    if (
      (frameResources.instanceMaterialIdBuffer.size ?? 0) <
      sceneData.instanceMaterialIdData.byteLength
    ) {
      const pool = (frameResources as unknown as { bufferPool: GPUBufferPool }).bufferPool;
      const materialIdBuf = pool.getOrCreate(
        'instance-material-id',
        sceneData.instanceMaterialIdData.byteLength,
        GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        'instance-material-id-buffer'
      );
      try {
        const prev = frameResources.instanceMaterialIdBuffer;
        if (pool.get('instance-material-id') !== prev && prev !== materialIdBuf) prev.destroy();
      } catch {
        // ignore
      }
      frameResources.instanceMaterialIdBuffer = materialIdBuf;
    }
    device.queue.writeBuffer(
      frameResources.instanceMaterialIdBuffer,
      0,
      sceneData.instanceMaterialIdData.buffer as ArrayBuffer,
      sceneData.instanceMaterialIdData.byteOffset,
      sceneData.instanceMaterialIdData.byteLength
    );
  }

  /**
   * Reallocates instance buffers (different count).
   */
  private reallocateInstanceBuffers(
    device: GPUDevice,
    frameResources: FrameResources,
    sceneData: {
      instanceOffsetData: Float32Array;
      instanceColorScaleData: Float32Array;
      instanceRotationData: Float32Array;
      instanceMaterialIdData: Float32Array;
    }
  ): void {
    const pool = (frameResources as unknown as { bufferPool: GPUBufferPool }).bufferPool;

    // Keep references and check if pooled
    const prevOffsetBuf = frameResources.instanceOffsetBuffer;
    const prevColorScaleBuf = frameResources.instanceColorScaleBuffer;
    const prevRotationBuf = frameResources.instanceRotationBuffer;
    const prevMaterialIdBuf = frameResources.instanceMaterialIdBuffer;

    const wasPooledOffset = pool.get('instance-offset') === prevOffsetBuf;
    const wasPooledColorScale = pool.get('instance-color-scale') === prevColorScaleBuf;
    const wasPooledRotation = pool.get('instance-rotation') === prevRotationBuf;
    const wasPooledMaterialId = pool.get('instance-material-id') === prevMaterialIdBuf;

    // Reallocate via pool
    const offsetBuf = pool.getOrCreate(
      'instance-offset',
      sceneData.instanceOffsetData.byteLength,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      'instance-offset-buffer'
    );
    const colorScaleBuf = pool.getOrCreate(
      'instance-color-scale',
      sceneData.instanceColorScaleData.byteLength,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      'instance-color-scale-buffer'
    );
    const rotationBuf = pool.getOrCreate(
      'instance-rotation',
      sceneData.instanceRotationData.byteLength,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      'instance-rotation-buffer'
    );
    const materialIdBuf = pool.getOrCreate(
      'instance-material-id',
      sceneData.instanceMaterialIdData.byteLength,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      'instance-material-id-buffer'
    );

    frameResources.instanceOffsetBuffer = offsetBuf;
    frameResources.instanceColorScaleBuffer = colorScaleBuf;
    frameResources.instanceRotationBuffer = rotationBuf;
    frameResources.instanceMaterialIdBuffer = materialIdBuf;

    // Upload data
    this.updateInstanceBuffers(device, frameResources, sceneData);

    this.invalidateBundle();

    // Destroy previous non-pooled buffers
    try {
      if (!wasPooledOffset && prevOffsetBuf !== offsetBuf) prevOffsetBuf.destroy();
    } catch {
      // ignore
    }
    try {
      if (!wasPooledColorScale && prevColorScaleBuf !== colorScaleBuf) prevColorScaleBuf.destroy();
    } catch {
      // ignore
    }
    try {
      if (!wasPooledRotation && prevRotationBuf !== rotationBuf) prevRotationBuf.destroy();
    } catch {
      // ignore
    }
    try {
      if (!wasPooledMaterialId && prevMaterialIdBuf !== materialIdBuf) prevMaterialIdBuf.destroy();
    } catch {
      // ignore
    }
  }

  private scheduleTimestampRead(
    device: GPUDevice,
    frameResources: FrameResources,
    callback: (timings: { label: string; timeMs: number }[]) => void
  ): void {
    if (this.pendingTimestampRead) {
      return;
    }
    this.pendingTimestampRead = true;

    const readBuffer = frameResources.timestampReadBuffer!;

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
    this.bundleRenderPipeline = null;
    this.bundleOverlayPipeline = null;
    this.bundleUniformBindGroup = null;
    this.bundleTextureBindGroup = null;
  }

  private drawStaticGeometry(
    encoder: GPURenderPassEncoder | GPURenderBundleEncoder,
    frameResources: FrameResources,
    geometry: GeometryData
  ): void {
    encoder.setPipeline(frameResources.renderPipeline);
    encoder.setVertexBuffer(0, frameResources.vertexBuffer);
    encoder.setVertexBuffer(1, frameResources.instanceOffsetBuffer);
    encoder.setVertexBuffer(2, frameResources.instanceColorScaleBuffer);
    encoder.setVertexBuffer(3, frameResources.instanceRotationBuffer);
    encoder.setVertexBuffer(4, frameResources.instanceMaterialIdBuffer);
    encoder.setIndexBuffer(frameResources.indexBuffer, 'uint16');
    encoder.setBindGroup(0, frameResources.uniformBindGroup);
    encoder.setBindGroup(1, frameResources.textureBindGroup);
    encoder.drawIndexed(geometry.indices.length, geometry.instanceCount, 0, 0, 0);

    encoder.setPipeline(frameResources.overlayPipeline);
    encoder.setBindGroup(0, frameResources.uniformBindGroup);
    encoder.setBindGroup(1, frameResources.textureBindGroup);
    encoder.drawIndexed(geometry.indices.length, geometry.instanceCount, 0, 0, 0);
  }

  private recordStaticBundle(
    device: GPUDevice,
    frameResources: FrameResources,
    presentationFormat: GPUTextureFormat,
    geometry: GeometryData
  ): GPURenderBundle {
    if (typeof (device as any).createRenderBundleEncoder !== 'function') {
      // Fallback path when mock device lacks bundle encoder support
      throw new Error('RenderBundleEncoder not supported');
    }
    const bundleEncoder = device.createRenderBundleEncoder({
      label: 'frame-static-bundle',
      colorFormats: ['rgba16float'],
      depthStencilFormat: 'depth24plus',
      sampleCount: MSAA_SAMPLE_COUNT,
    });

    this.drawStaticGeometry(bundleEncoder, frameResources, geometry);

    return bundleEncoder.finish();
  }
}

