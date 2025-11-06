import { Logger } from '@engine/core/utils';
import type { Mat4 } from '@engine/core/math';
import { mat4Invert } from '@engine/core/math';
import type { FrameResources, GeometryData } from '../resources/resources';
import type { FrameRenderContext } from './FrameRenderer';
import { TonemapLutPass } from '../postprocess/TonemapLut';
import { BloomPass } from '../postprocess/Bloom';
import { FXAAPass } from '../postprocess/FXAAPass';
import { SSAOPass } from '../postprocess/SSAO';
import { NormalRenderPass } from './NormalRenderPass';
import { TIMESTAMP_INDICES } from '../config';

export interface PostProcessFeatureFlags {
  enableHDR: boolean;
  enableBloom: boolean;
  enableSSAO: boolean;
  enableFXAA: boolean;
}

export interface PostProcessInputs {
  ctx: FrameRenderContext;
  encoder: GPUCommandEncoder;
  frameResources: FrameResources;
  featureFlags: PostProcessFeatureFlags;
  targets: {
    hdrView: GPUTextureView | null;
    bloomView: GPUTextureView | null;
    normalView: GPUTextureView | null;
    ssaoView: GPUTextureView | null;
    resolvedDepthView: GPUTextureView | null;
    tonemapIntermediateView: GPUTextureView | null;
    needsDepthStore: boolean;
  };
  geometry: GeometryData;
  viewMatrix?: Mat4;
  projectionMatrix?: Mat4;
  sampleCount: number;
  swapChainView: GPUTextureView;
}

export class PostProcessPipeline {
  private tonemapPass: TonemapLutPass | null = null;
  private bloomPass: BloomPass | null = null;
  private fxaaPass: FXAAPass | null = null;
  private ssaoPass: SSAOPass | null = null;
  private normalRenderPass: NormalRenderPass | null = null;
  private depthResolvePipeline: GPURenderPipeline | null = null;
  private depthResolveLayout: GPUBindGroupLayout | null = null;
  private depthResolveUniformBuffer: GPUBuffer | null = null;
  private projectionInverseScratch = new Float32Array(16);
  private normalVertexLayouts: GPUVertexBufferLayout[] | null = null;

  run(inputs: PostProcessInputs): void {
    const {
      ctx,
      encoder,
      frameResources,
      featureFlags,
      targets,
      geometry,
      viewMatrix,
      projectionMatrix,
      sampleCount,
      swapChainView,
    } = inputs;

    const device = ctx.device;
    const enableHDR = featureFlags.enableHDR;
    const enableBloom = featureFlags.enableBloom && enableHDR;
    const enableSSAO = featureFlags.enableSSAO;
    const enableFXAA = featureFlags.enableFXAA && enableHDR;

    const hdrView = targets.hdrView;
    const bloomView = targets.bloomView;
    const normalView = targets.normalView;
    const ssaoView = targets.ssaoView;
    const resolvedDepthView = targets.resolvedDepthView;
    const tonemapIntermediateView = targets.tonemapIntermediateView;
    const depthView = frameResources.depthTextureView;

    if (!depthView || !frameResources.depthTexture) {
      return;
    }

    if (enableSSAO) {
      this.ensureSsaoPass(device);
    }

    if (enableSSAO && normalView) {
      this.ensureNormalPass(device, frameResources);
      this.renderNormalPass(encoder, frameResources, geometry, normalView);
    }

    const depthForSsao =
      enableSSAO && sampleCount > 1 ? resolvedDepthView ?? null : depthView;

    if (enableSSAO && sampleCount > 1 && resolvedDepthView) {
      this.resolveDepth(device, encoder, depthView, resolvedDepthView, ctx.canvas.width, ctx.canvas.height);
    }

    if (
      enableSSAO &&
      this.ssaoPass &&
      depthForSsao &&
      ssaoView &&
      normalView &&
      viewMatrix &&
      projectionMatrix
    ) {
      const projectionMatrixInv = this.projectionInverseScratch;
      mat4Invert(projectionMatrixInv, projectionMatrix);
      this.ssaoPass.render(
        encoder,
        depthForSsao,
        normalView,
        ssaoView,
        ctx.canvas.width,
        ctx.canvas.height,
        projectionMatrix,
        projectionMatrixInv,
        frameResources.timestampQuerySet
          ? {
              querySet: frameResources.timestampQuerySet,
              begin: TIMESTAMP_INDICES.MAIN_PASS_END + 1,
              end: TIMESTAMP_INDICES.MAIN_PASS_END + 2,
            }
          : undefined
      );
    }

    if (enableBloom && hdrView && bloomView) {
      this.ensureBloomPass(device, ctx.presentationFormat);
      this.bloomPass?.render(
        encoder,
        hdrView,
        bloomView,
        ctx.canvas.width,
        ctx.canvas.height,
        frameResources.timestampQuerySet
          ? {
              querySet: frameResources.timestampQuerySet,
              begin: TIMESTAMP_INDICES.BLOOM_BEGIN,
              end: TIMESTAMP_INDICES.BLOOM_END,
            }
          : undefined
      );
    }

    if (enableHDR && hdrView) {
      this.ensureTonemapPass(device, ctx.presentationFormat);
      this.tonemapPass?.render(
        encoder,
        hdrView,
        enableBloom ? bloomView : null,
        enableFXAA ? tonemapIntermediateView ?? swapChainView : swapChainView,
        ssaoView ?? null,
        frameResources.timestampQuerySet
          ? {
              querySet: frameResources.timestampQuerySet,
              begin: TIMESTAMP_INDICES.TONEMAP_BEGIN,
              end: TIMESTAMP_INDICES.TONEMAP_END,
            }
          : undefined
      );
    }

    if (enableFXAA && tonemapIntermediateView) {
      this.ensureFxaaPass(device);
      this.fxaaPass?.apply(encoder, tonemapIntermediateView, swapChainView);
    }
  }

  dispose(): void {
    this.tonemapPass?.dispose?.();
    this.tonemapPass = null;
    this.bloomPass?.dispose?.();
    this.bloomPass = null;
    this.fxaaPass?.dispose?.();
    this.fxaaPass = null;
    this.ssaoPass?.dispose?.();
    this.ssaoPass = null;
    this.normalRenderPass?.dispose();
    this.normalRenderPass = null;
    try {
      this.depthResolveUniformBuffer?.destroy();
    } catch {
      // ignore
    }
    this.depthResolveUniformBuffer = null;
    this.depthResolvePipeline = null;
    this.depthResolveLayout = null;
  }

  flush(queue: GPUQueue): void {
    this.bloomPass?.flushPendingDestroy(queue);
    this.bloomPass?.flushTempTextures(queue);
  }

  private ensureTonemapPass(device: GPUDevice, swapChainFormat: GPUTextureFormat): void {
    if (!this.tonemapPass) {
      this.tonemapPass = new TonemapLutPass(device);
      this.tonemapPass.initialize(swapChainFormat);
    }
  }

  private ensureBloomPass(device: GPUDevice, _swapChainFormat: GPUTextureFormat): void {
    if (!this.bloomPass) {
      this.bloomPass = new BloomPass(device);
      this.bloomPass.initialize('rgba16float');
    }
  }

  private ensureFxaaPass(device: GPUDevice): void {
    if (!this.fxaaPass) {
      this.fxaaPass = new FXAAPass(device);
    }
  }

  private ensureSsaoPass(device: GPUDevice): void {
    if (!this.ssaoPass) {
      this.ssaoPass = new SSAOPass(device);
      this.ssaoPass.initialize('rgba16float');
    }
  }

  private ensureNormalPass(device: GPUDevice, frameResources: FrameResources): void {
    if (!this.normalRenderPass) {
      this.normalRenderPass = new NormalRenderPass(device);
    }
    if (this.normalRenderPass && !this.normalRenderPass.isInitialized()) {
      if (!this.normalVertexLayouts) {
        this.normalVertexLayouts = [
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
      }
      this.normalRenderPass.initialize(
        frameResources.uniformBindGroupLayout,
        frameResources.textureBindGroupLayout,
        this.normalVertexLayouts,
        'rgba16float',
        1
      );
    }
  }

  private renderNormalPass(
    encoder: GPUCommandEncoder,
    frameResources: FrameResources,
    geometry: GeometryData,
    outputView: GPUTextureView
  ): void {
    if (!this.normalRenderPass) {
      return;
    }
    const pass = encoder.beginRenderPass({
      label: 'normal-render-pass',
      colorAttachments: [
        {
          view: outputView,
          clearValue: { r: 0.5, g: 0.5, b: 1.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    this.normalRenderPass.render(pass, frameResources, geometry);
    pass.end();
  }

  private resolveDepth(
    device: GPUDevice,
    encoder: GPUCommandEncoder,
    multisampledDepthView: GPUTextureView,
    resolvedDepthView: GPUTextureView,
    width: number,
    height: number
  ): void {
    this.initializeDepthResolve(device);
    if (!this.depthResolvePipeline || !this.depthResolveLayout || !this.depthResolveUniformBuffer) {
      Logger.warn('Depth resolve pipeline not initialized');
      return;
    }
    const uniformData = new Float32Array([width, height]);
    device.queue.writeBuffer(this.depthResolveUniformBuffer, 0, uniformData);
    const bindGroup = device.createBindGroup({
      label: 'depth-resolve-bg',
      layout: this.depthResolveLayout,
      entries: [
        { binding: 0, resource: multisampledDepthView },
        { binding: 1, resource: { buffer: this.depthResolveUniformBuffer } },
      ],
    });
    const pass = encoder.beginRenderPass({
      label: 'depth-resolve-pass',
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

  private initializeDepthResolve(device: GPUDevice): void {
    if (this.depthResolvePipeline) {
      return;
    }
    if (!this.depthResolveLayout) {
      this.depthResolveLayout = device.createBindGroupLayout({
        label: 'depth-resolve-bgl',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: 'depth', multisampled: true },
          },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ],
      });
    }
    if (!this.depthResolveUniformBuffer) {
      this.depthResolveUniformBuffer = device.createBuffer({
        label: 'depth-resolve-uniforms',
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }
    const vs = device.createShaderModule({
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
      label: 'depth-resolve-pipeline',
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
}
