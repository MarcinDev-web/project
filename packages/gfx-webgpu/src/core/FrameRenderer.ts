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

import type { Scene, Entity, RgbaColor } from '@engine/world';
import { MaterialComponent } from '@engine/world';
import type { FrameResources, GeometryData } from '../resources/resources';
import { createDepthTexture, createMsaaColorTarget, createHdrColorTarget } from '../resources/resources';
import { FrustumCuller } from './FrustumCuller';
import { InstanceDataBuilder, type CustomGeometryEntity } from './InstanceManager';
import { GeometryCache } from './GeometryCache';
import { GPUBufferPool } from './bufferPool';
import { ComputePrepass } from './ComputePrepass';
import { EnvironmentComponent } from '@engine/world';
import type { EnvironmentRenderer } from '../renderers/EnvironmentRenderer';
import type { WaterRenderer } from '../renderers/WaterRenderer';
import type { LogicConnectionRenderer } from '../LogicConnectionRenderer';
import { mat4Invert, mat4FromQuatTranslation, mat4Scale, type Mat4, type Vec3, type Quat } from '@engine/core/math';
import { Logger } from '@engine/core/utils';
import { CLEAR_COLOR, MSAA_SAMPLE_COUNT, TIMESTAMP_QUERY_COUNT, TIMESTAMP_BUFFER_SIZE, GPU_TIMESTAMP_PAIRS, TIMESTAMP_INDICES } from '../config';
import { TonemapLutPass } from '../postprocess/TonemapLut';
import { BloomPass } from '../postprocess/Bloom';
import { SSAOPass } from '../postprocess/SSAO';
import { UniformManager } from './UniformManager';
import { ShadowPass } from '../shadows/ShadowPass';
import { NormalRenderPass } from './NormalRenderPass';

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
  uniformManager: UniformManager;
  lightingData?: import('../lighting/LightManager').LightingData;
  onShadowMetrics?: (counts: readonly [number, number, number, number]) => void;
  // Performance/quality flags
  featureFlags?: {
    enableComputePrepass?: boolean;
    enableShadows?: boolean;
    enableBloom?: boolean;
    enableHDR?: boolean; // reserved for HDR toggle path (later todo)
    enableSSAO?: boolean; // Screen Space Ambient Occlusion
  };
  shadowQuality?: 'low' | 'med' | 'high' | 'ultra';
  msaaSampleCount?: number;
  time?: number; // Current time for animation
}

/**
 * FrameRenderer manages the per-frame rendering operations.
 */
export class FrameRenderer {
  private frustumCuller: FrustumCuller;
  private instanceBuilder: InstanceDataBuilder;
  private geometryCache: GeometryCache;
  private visibleEntitiesCache: Entity[] = [];
  private customGeometryEntitiesCache: CustomGeometryEntity[] = [];
  private depthTextureSize = { width: 0, height: 0 };
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
  // Postprocess resources
  private hdrColorTexture: GPUTexture | null = null;
  private bloomTexture: GPUTexture | null = null;
  private normalTexture: GPUTexture | null = null;
  private ssaoTexture: GPUTexture | null = null;
  private hdrColorView: GPUTextureView | null = null;
  private bloomTextureView: GPUTextureView | null = null;
  private normalTextureView: GPUTextureView | null = null;
  private ssaoTextureView: GPUTextureView | null = null;
  private tonemapPass: TonemapLutPass | null = null;
  private bloomPass: BloomPass | null = null;
  private ssaoPass: SSAOPass | null = null;
  private shadowPass: ShadowPass | null = null;
  private normalRenderPass: NormalRenderPass | null = null;

  constructor(initialCapacity = 1000) {
    this.frustumCuller = new FrustumCuller();
    this.instanceBuilder = new InstanceDataBuilder(initialCapacity);
    this.geometryCache = new GeometryCache();
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
      this.normalTexture?.destroy();
      this.ssaoTexture?.destroy();
      this.hdrColorView = null;
      this.bloomTextureView = null;
      this.normalTextureView = null;
      this.ssaoTextureView = null;
      const sampleCount = ctx.msaaSampleCount ?? MSAA_SAMPLE_COUNT;
      frameResources.depthTexture = createDepthTexture(device, canvas, sampleCount);
      frameResources.depthTextureView = frameResources.depthTexture.createView({
        label: 'frame-depth-view',
      });
      frameResources.msaaColorTexture = createMsaaColorTarget(
        device,
        canvas,
        'rgba16float',
        sampleCount
      );
      frameResources.msaaColorView = frameResources.msaaColorTexture.createView({
        label: 'frame-msaa-color-view',
      });
      const enableHDR = ctx.featureFlags?.enableHDR !== false;
      const enableBloom = ctx.featureFlags?.enableBloom !== false;
      const enableSSAO = ctx.featureFlags?.enableSSAO !== false;
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
      // Normal texture for G-buffer (SSAO needs normals)
      if (enableSSAO) {
        this.normalTexture = device.createTexture({
          label: 'frame-normal-texture',
          size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
          format: 'rgba16float',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        this.normalTextureView = this.normalTexture.createView();
        // SSAO output texture
        this.ssaoTexture = device.createTexture({
          label: 'frame-ssao-texture',
          size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
          format: 'rgba16float',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        this.ssaoTextureView = this.ssaoTexture.createView();
      }
      this.depthTextureSize = { width: canvas.width, height: canvas.height };
    }

    const encoder = device.createCommandEncoder({ label: 'frame-encoder' });
    // Frame begin timestamp (surround entire frame)
    if (frameResources.timestampQuerySet) {
      try {
        (encoder as any).writeTimestamp?.(frameResources.timestampQuerySet, TIMESTAMP_INDICES.FRAME_BEGIN);
      } catch {
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
        } else {
          // Different count: reallocate
          this.reallocateInstanceBuffers(device, frameResources, sceneData);
        }
        geometry = { ...geometry, ...sceneData };
        
        // Update geometry cache frame counter (for LRU)
        this.geometryCache.tick();
      } catch (err) {
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
        } catch {}
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
          if (typeof ctx.onShadowMetrics === 'function') {
            try {
              ctx.onShadowMetrics(this.shadowPass.getLastCascadeInstanceCounts());
            } catch {}
          }
        }
      } catch (err) {
        Logger.warn('Shadow pass failed:', err);
      }
    }

    // Compute prepass (runs before render pass)
    try {
      if (ctx.featureFlags?.enableComputePrepass !== false) {
        if (!this.computePrepass) {
          if (typeof (encoder as GPUCommandEncoder).beginComputePass === 'function') {
            this.computePrepass = new ComputePrepass(device);
          }
        }
        if (frameResources.timestampQuerySet) {
          try {
            (encoder as any).writeTimestamp?.(frameResources.timestampQuerySet, TIMESTAMP_INDICES.COMPUTE_BEGIN);
          } catch {}
        }
        this.computePrepass?.run(encoder);
        if (frameResources.timestampQuerySet) {
          try {
            (encoder as any).writeTimestamp?.(frameResources.timestampQuerySet, TIMESTAMP_INDICES.COMPUTE_END);
          } catch {}
        }
      }
    } catch (err) {
      Logger.warn('Compute prepass failed:', err);
    }
    const swapChainView = context.getCurrentTexture().createView({ label: 'frame-color-resolve-view' });

    // Base pass descriptor with required attachments
    const enableHDR = ctx.featureFlags?.enableHDR !== false;
    const basePassDesc: GPURenderPassDescriptor = {
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

    // (moved culling and instance buffer updates above the shadow pass)

    const passEncoder = encoder.beginRenderPass(finalPassDesc);

    // Render environment/skybox first (background)
    if (environmentRenderer && scene) {
      const environmentEntities = scene.queryEntities(EnvironmentComponent);
      const environmentEntity = environmentEntities.find((e: Entity) => e.active);
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
      this.bundleTransparentPipeline !== frameResources.transparentPipeline ||
      this.bundleOverlayPipeline !== frameResources.overlayPipeline ||
      this.bundleUniformBindGroup !== frameResources.uniformBindGroup ||
      this.bundleTextureBindGroup !== frameResources.textureBindGroup
    ) {
      this.invalidateBundle();
    }
    if (
      this.bundleInstanceCount !== geometry.instanceCount ||
      this.bundleIndexCount !== geometry.indices.length ||
      this.bundleOpaqueCount !== (geometry.opaqueCount ?? geometry.instanceCount)
    ) {
      this.invalidateBundle();
    }

    if (this.bundleDirty || !this.staticBundle) {
      try {
        this.staticBundle = this.recordStaticBundle(
          device,
          frameResources,
          ctx.presentationFormat,
          geometry,
          ctx.msaaSampleCount ?? MSAA_SAMPLE_COUNT
        );
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
      } catch {
        this.drawStaticGeometry(passEncoder, frameResources, geometry);
      }
    } else {
      this.drawStaticGeometry(passEncoder, frameResources, geometry);
    }

    // Render custom geometry entities (with meshData)
    this.drawCustomGeometry(passEncoder, device, frameResources);

    // Render water (after opaque, before transparent/grid)
    if (ctx.waterRenderer && scene) {
      try {
        const envCubemap = ctx.environmentRenderer
          ? (ctx.environmentRenderer as any).getEnvCubeTexture?.() || null
          : null;
        const time = ctx.time ?? 0;
        ctx.waterRenderer.render(
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
    
    // Render normals to G-buffer if SSAO is enabled
    const enableSSAO = ctx.featureFlags?.enableSSAO !== false;
    if (enableSSAO && this.normalTextureView && frameResources.depthTextureView) {
      // Initialize normal render pass if needed
      if (!this.normalRenderPass) {
        this.normalRenderPass = new NormalRenderPass(device);
      }
      
      if (this.normalRenderPass && !this.normalRenderPass.isInitialized()) {
        // Create vertex buffer layouts matching the main render pass
        const vertexBuffers: GPUVertexBufferLayout[] = [
          {
            arrayStride: 24,
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'snorm8x4' },
              { shaderLocation: 2, offset: 16, format: 'float16x2' },
              { shaderLocation: 3, offset: 20, format: 'unorm8x4' },
            ],
          },
          {
            arrayStride: 12,
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
        
        this.normalRenderPass.initialize(
          frameResources.uniformBindGroupLayout,
          frameResources.textureBindGroupLayout,
          vertexBuffers,
          'rgba16float',
          ctx.msaaSampleCount ?? MSAA_SAMPLE_COUNT
        );
      }
      
      // Render normals to texture
      if (this.normalRenderPass) {
        const normalPass = encoder.beginRenderPass({
          label: 'normal-render-pass',
          colorAttachments: [
            {
              view: this.normalTextureView,
              clearValue: { r: 0.5, g: 0.5, b: 1.0, a: 1.0 }, // Encoded (0,0,1) = world up normal
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
          depthStencilAttachment: {
            view: frameResources.depthTextureView,
            depthLoadOp: 'load', // Reuse depth from main pass
            depthStoreOp: 'discard',
            depthClearValue: 1.0,
          },
        });
        
        this.normalRenderPass.render(normalPass, frameResources, geometry);
        normalPass.end();
      }
    }
    // Postprocess: SSAO -> Bloom -> Tonemap+LUT to the swap chain
    // Initialize passes lazily
    if (enableHDR) {
      if (!this.bloomPass) { this.bloomPass = new BloomPass(device); this.bloomPass.initialize('rgba16float'); }
      if (!this.tonemapPass) { this.tonemapPass = new TonemapLutPass(device); this.tonemapPass.initialize(ctx.presentationFormat); }
    }
    if (enableSSAO && !this.ssaoPass) {
      this.ssaoPass = new SSAOPass(device);
      this.ssaoPass.initialize('rgba16float');
    }
    // Ensure views exist (created on resize)
    if (!this.hdrColorTexture) {
      this.hdrColorTexture = createHdrColorTarget(device, canvas);
      this.hdrColorView = this.hdrColorTexture.createView();
    }
    if (!this.hdrColorView) this.hdrColorView = this.hdrColorTexture.createView();
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
    const ssaoView = this.ssaoTextureView;
    const depthView = frameResources.depthTextureView;
    
    // SSAO pass (before bloom) - now with proper normal texture
    if (enableSSAO && hdrView && depthView && ssaoView && this.ssaoPass && viewMatrix && projectionMatrix) {
      // Calculate inverse projection matrix for SSAO
      const projectionMatrixInv = new Float32Array(16);
      mat4Invert(projectionMatrixInv, projectionMatrix);
      
      // Use normal texture if available, otherwise fallback to depth (less accurate)
      const normalViewToUse = this.normalTextureView ?? depthView;
      
      this.ssaoPass.render(
        encoder,
        depthView,
        normalViewToUse,
        ssaoView,
        canvas.width,
        canvas.height,
        projectionMatrix,
        projectionMatrixInv,
        frameResources.timestampQuerySet
          ? { querySet: frameResources.timestampQuerySet, begin: TIMESTAMP_INDICES.MAIN_PASS_END + 1, end: TIMESTAMP_INDICES.MAIN_PASS_END + 2 }
          : undefined
      );
    }
    
    // Bloom pass with timestamps (optional flag)
    if (enableHDR && hdrView && bloomView && this.bloomPass && ctx.featureFlags?.enableBloom !== false) {
      this.bloomPass.render(
        encoder,
        hdrView,
        bloomView,
        canvas.width,
        canvas.height,
        frameResources.timestampQuerySet
          ? { querySet: frameResources.timestampQuerySet, begin: TIMESTAMP_INDICES.BLOOM_BEGIN, end: TIMESTAMP_INDICES.BLOOM_END }
          : undefined
      );
    }
    // Tonemap pass with timestamps (only when HDR path is enabled)
    if (enableHDR && hdrView && bloomView && this.tonemapPass) {
      this.tonemapPass.render(
        encoder,
        hdrView,
        bloomView,
        swapChainView,
        ssaoView, // Pass SSAO texture (can be null)
        frameResources.timestampQuerySet
          ? { querySet: frameResources.timestampQuerySet, begin: TIMESTAMP_INDICES.TONEMAP_BEGIN, end: TIMESTAMP_INDICES.TONEMAP_END }
          : undefined
      );
    }

    // Frame end timestamp (after all passes; before resolve/copy)
    if (frameResources.timestampQuerySet) {
      try {
        (encoder as any).writeTimestamp?.(frameResources.timestampQuerySet, TIMESTAMP_INDICES.FRAME_END);
      } catch {}
    }

    // Resolve and copy timestamps after all writes are recorded
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
    try { this.normalTexture?.destroy(); } catch {}
    try { this.ssaoTexture?.destroy(); } catch {}
    try { this.ssaoPass?.dispose(); } catch {}
    try { this.normalRenderPass?.dispose(); } catch {}
    this.hdrColorTexture = null;
    this.bloomTexture = null;
    this.normalTexture = null;
    this.ssaoTexture = null;
    this.ssaoPass = null;
    this.normalRenderPass = null;
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
      instanceSecondaryColorData: Float32Array;
      instanceEmissiveColorData: Float32Array;
      instanceMaterialParamsData: Float32Array;
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
      frameResources.instanceSecondaryColorBuffer,
      0,
      sceneData.instanceSecondaryColorData.buffer as ArrayBuffer,
      sceneData.instanceSecondaryColorData.byteOffset,
      sceneData.instanceSecondaryColorData.byteLength
    );
    device.queue.writeBuffer(
      frameResources.instanceEmissiveColorBuffer,
      0,
      sceneData.instanceEmissiveColorData.buffer as ArrayBuffer,
      sceneData.instanceEmissiveColorData.byteOffset,
      sceneData.instanceEmissiveColorData.byteLength
    );
    device.queue.writeBuffer(
      frameResources.instanceMaterialParamsBuffer,
      0,
      sceneData.instanceMaterialParamsData.buffer as ArrayBuffer,
      sceneData.instanceMaterialParamsData.byteOffset,
      sceneData.instanceMaterialParamsData.byteLength
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
      instanceSecondaryColorData: Float32Array;
      instanceEmissiveColorData: Float32Array;
      instanceMaterialParamsData: Float32Array;
      instanceRotationData: Float32Array;
      instanceMaterialIdData: Float32Array;
    }
  ): void {
    const pool = (frameResources as unknown as { bufferPool: GPUBufferPool }).bufferPool;

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
    const wasPooledMaterialParams =
      pool.get('instance-material-params') === prevMaterialParamsBuf;
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
    const secondaryColorBuf = pool.getOrCreate(
      'instance-secondary-color',
      sceneData.instanceSecondaryColorData.byteLength,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      'instance-secondary-color-buffer'
    );
    const emissiveColorBuf = pool.getOrCreate(
      'instance-emissive-color',
      sceneData.instanceEmissiveColorData.byteLength,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      'instance-emissive-color-buffer'
    );
    const materialParamsBuf = pool.getOrCreate(
      'instance-material-params',
      sceneData.instanceMaterialParamsData.byteLength,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      'instance-material-params-buffer'
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
      if (!wasPooledSecondary && prevSecondaryColorBuf !== secondaryColorBuf) prevSecondaryColorBuf.destroy();
    } catch {
      // ignore
    }
    try {
      if (!wasPooledEmissive && prevEmissiveColorBuf !== emissiveColorBuf) prevEmissiveColorBuf.destroy();
    } catch {
      // ignore
    }
    try {
      if (!wasPooledMaterialParams && prevMaterialParamsBuf !== materialParamsBuf)
        prevMaterialParamsBuf.destroy();
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
    this.bundleOpaqueCount = 0;
    this.bundleRenderPipeline = null;
    this.bundleTransparentPipeline = null;
    this.bundleOverlayPipeline = null;
    this.bundleUniformBindGroup = null;
    this.bundleTextureBindGroup = null;
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

  /**
   * Renders custom geometry entities (those with meshData)
   */
  private drawCustomGeometry(
    encoder: GPURenderPassEncoder,
    device: GPUDevice,
    frameResources: FrameResources
  ): void {
    if (this.customGeometryEntitiesCache.length === 0) return;

    // For each custom geometry entity, render individually
    // We can optimize this later by grouping entities with same geometry
    for (const { entity, meshComponent } of this.customGeometryEntitiesCache) {
      if (!entity.active) continue;

      const meshData = meshComponent.meshData;
      if (!meshData?.vertices || !meshData.indices) {
        const entityName = entity.name || entity.id || 'unnamed';
        const meshType = meshComponent.meshType || 'unknown';
        Logger.warn(
          `[FrameRenderer] Skipping entity "${entityName}" (id: ${entity.id}) with meshType="${meshType}" ` +
          `due to missing or invalid geometry (meshData: ${meshData ? 'present but invalid' : 'missing'}). ` +
          `This usually means the geometry generator failed or was not called.`
        );
        continue;
      }

      // Get or create geometry buffers from cache
      const geometryBuffers = this.geometryCache.getGeometryBuffers(device, meshData);
      if (!geometryBuffers) {
        // Geometry was invalid or failed to create - log entity info for debugging
        const entityName = entity.name || entity.id || 'unnamed';
        const meshType = meshComponent.meshType || 'unknown';
        Logger.warn(
          `[FrameRenderer] Skipping entity "${entityName}" (id: ${entity.id}) with meshType="${meshType}" ` +
          `due to invalid geometry buffers (geometry cache failed to create buffers). ` +
          `Check geometry validation in GeometryCache.`
        );
        continue;
      }

      // Get material
      const material = entity.getComponent(MaterialComponent);
      
      // Apply avatar colors from userData.avatarColorSlots if present
      // This allows dynamic color updates for avatar parts
      if (material && entity.userData?.avatarColorSlots) {
        const colorSlots = entity.userData.avatarColorSlots as Record<string, RgbaColor>;
        if (colorSlots.primary) {
          material.primaryColor = colorSlots.primary;
        }
        if (colorSlots.secondary) {
          material.secondaryColor = colorSlots.secondary;
        }
        if (colorSlots.accent) {
          material.accentColor = colorSlots.accent;
        }
        if (colorSlots.emissive) {
          material.emissiveColor = colorSlots.emissive;
          material.emissiveIntensity = colorSlots.emissive[3] ?? 0;
        }
        material.updateFlags();
      }
      
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

      // Use accentColor if available, otherwise fallback to secondaryColor, then primary
      const accent = material?.accentColor;
      const secondary = accent ?? material?.secondaryColor ?? primary;
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
      } else {
        encoder.setPipeline(frameResources.renderPipeline);
        encoder.drawIndexed(geometryBuffers.indexCount, 1, 0, 0, 0);
      }

      // Render overlay pass if needed
      encoder.setPipeline(frameResources.overlayPipeline);
      encoder.drawIndexed(geometryBuffers.indexCount, 1, 0, 0, 0);
    }
  }

  private recordStaticBundle(
    device: GPUDevice,
    frameResources: FrameResources,
    presentationFormat: GPUTextureFormat,
    geometry: GeometryData,
    sampleCount: number
  ): GPURenderBundle {
    if (typeof (device as any).createRenderBundleEncoder !== 'function') {
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

