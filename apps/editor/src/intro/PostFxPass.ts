/**
 * Custom Post-FX Pass for Intro
 * Vignette + Chromatic Aberration for cinematic feel
 */

export interface PostFxParams {
  vignetteIntensity: number;      // 0-1
  vignetteRadius: number;          // 0-1
  chromaticAberration: number;     // 0-1
  time: number;                    // For animated effects
}

/**
 * Custom post-processing effects for intro
 */
export class PostFxPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;
  
  private params: PostFxParams = {
    vignetteIntensity: 0.5,
    vignetteRadius: 0.8,
    chromaticAberration: 0.002,
    time: 0,
  };

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Set effect parameters
   */
  setParams(params: Partial<PostFxParams>): void {
    Object.assign(this.params, params);
  }

  /**
   * Initialize the pass
   */
  private initialize(): void {
    if (this.pipeline) return;

    // Create sampler
    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        label: 'postfx-sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
    }

    // Create bind group layout
    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'postfx-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ],
      });
    }

    // Create shader
    const shader = this.device.createShaderModule({
      label: 'postfx-shader',
      code: `
        struct PostFxParams {
          vignetteIntensity: f32,
          vignetteRadius: f32,
          chromaticAberration: f32,
          time: f32,
        }

        @group(0) @binding(0) var srcTex: texture_2d<f32>;
        @group(0) @binding(1) var srcSmp: sampler;
        @group(0) @binding(2) var<uniform> params: PostFxParams;

        struct VSOut {
          @builtin(position) pos: vec4<f32>,
          @location(0) uv: vec2<f32>,
        }

        @vertex
        fn vs(@builtin(vertex_index) vid: u32) -> VSOut {
          var o: VSOut;
          let x = f32((vid << 1u) & 2u);
          let y = f32(vid & 2u);
          o.pos = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
          o.uv = vec2<f32>(x, y);
          return o;
        }

        @fragment
        fn fs(input: VSOut) -> @location(0) vec4<f32> {
          let uv = input.uv;
          
          // Chromatic Aberration
          let aberration = params.chromaticAberration;
          let center = vec2<f32>(0.5, 0.5);
          let dir = uv - center;
          let dist = length(dir);
          let offset = dir * aberration * dist;
          
          // Sample RGB channels with offset
          let r = textureSample(srcTex, srcSmp, uv - offset).r;
          let g = textureSample(srcTex, srcSmp, uv).g;
          let b = textureSample(srcTex, srcSmp, uv + offset).b;
          
          var color = vec3<f32>(r, g, b);
          
          // Vignette
          let vignetteCenter = vec2<f32>(0.5, 0.5);
          let vignetteUV = uv - vignetteCenter;
          let vignetteDist = length(vignetteUV);
          let vignette = smoothstep(
            params.vignetteRadius,
            params.vignetteRadius - 0.5,
            vignetteDist
          );
          let vignetteAmount = mix(
            1.0 - params.vignetteIntensity,
            1.0,
            vignette
          );
          color *= vignetteAmount;
          
          // Subtle scanlines for cinematic feel (optional)
          let scanline = sin((uv.y + params.time * 0.1) * 800.0) * 0.01 + 1.0;
          color *= scanline;
          
          return vec4<f32>(color, 1.0);
        }
      `,
    });

    // Create pipeline
    const pipelineLayout = this.device.createPipelineLayout({
      label: 'postfx-pl',
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'postfx-pipeline',
      layout: pipelineLayout,
      vertex: { module: shader, entryPoint: 'vs' },
      fragment: {
        module: shader,
        entryPoint: 'fs',
        targets: [{ format: 'bgra8unorm' }], // Swap chain format
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  /**
   * Apply post-FX to the scene
   */
  apply(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    dstView: GPUTextureView
  ): void {
    this.initialize();
    if (!this.pipeline || !this.sampler || !this.bindGroupLayout) return;

    // Create params buffer
    const paramsData = new Float32Array([
      this.params.vignetteIntensity,
      this.params.vignetteRadius,
      this.params.chromaticAberration,
      this.params.time,
    ]);
    
    const paramsBuffer = this.device.createBuffer({
      label: 'postfx-params',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      label: 'postfx-bg',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: srcView },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: paramsBuffer } },
      ],
    });

    // Render pass
    const pass = encoder.beginRenderPass({
      label: 'postfx-pass',
      colorAttachments: [{
        view: dstView,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.pipeline = null;
    this.bindGroupLayout = null;
    this.sampler = null;
  }
}

