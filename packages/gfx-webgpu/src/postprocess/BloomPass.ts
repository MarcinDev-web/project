/**
 * Bloom Post-Processing Pass
 * 
 * Implements separable Gaussian blur for bloom effect.
 * Extracts bright areas, blurs them, and adds them back to the scene.
 */

/**
 * Bloom pass for extracting and blurring bright areas.
 */
export class BloomPass {
  private device: GPUDevice;
  private extractPipeline: GPURenderPipeline | null = null;
  private blurPipeline: GPURenderPipeline | null = null;
  private extractBindGroupLayout: GPUBindGroupLayout | null = null;
  private blurBindGroupLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;
  private threshold = 1.0;
  private intensity = 1.0;
  private blurRadius = 8.0;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Sets bloom parameters.
   */
  setParams(threshold: number, intensity: number, blurRadius: number): void {
    this.threshold = threshold;
    this.intensity = intensity;
    this.blurRadius = blurRadius;
  }

  /**
   * Initializes bloom resources.
   */
  private initialize(): void {
    if (this.extractPipeline && this.blurPipeline) return;

    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        label: 'bloom-sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
    }

    // Extract bright areas pipeline
    if (!this.extractBindGroupLayout) {
      this.extractBindGroupLayout = this.device.createBindGroupLayout({
        label: 'bloom-extract-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ],
      });
    }

    const extractShader = this.device.createShaderModule({
      label: 'bloom-extract-shader',
      code: `
        struct BloomParams {
          threshold: f32,
          intensity: f32,
          _pad0: f32,
          _pad1: f32,
        }

        @group(0) @binding(0) var srcTex: texture_2d<f32>;
        @group(0) @binding(1) var srcSmp: sampler;
        @group(0) @binding(2) var<uniform> params: BloomParams;

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
          let color = textureSample(srcTex, srcSmp, input.uv).rgb;
          // Extract bright areas (luminance > threshold)
          let luminance = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
          let bright = max(color - vec3<f32>(params.threshold), vec3<f32>(0.0));
          return vec4<f32>(bright * params.intensity, 1.0);
        }
      `,
    });

    const extractPipelineLayout = this.device.createPipelineLayout({
      label: 'bloom-extract-pl',
      bindGroupLayouts: [this.extractBindGroupLayout],
    });

    this.extractPipeline = this.device.createRenderPipeline({
      label: 'bloom-extract-pipeline',
      layout: extractPipelineLayout,
      vertex: { module: extractShader, entryPoint: 'vs' },
      fragment: {
        module: extractShader,
        entryPoint: 'fs',
        targets: [{ format: 'rgba16float' }],
      },
      primitive: { topology: 'triangle-list' },
    });

    // Blur pipeline (separable Gaussian)
    if (!this.blurBindGroupLayout) {
      this.blurBindGroupLayout = this.device.createBindGroupLayout({
        label: 'bloom-blur-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ],
      });
    }

    const blurShader = this.device.createShaderModule({
      label: 'bloom-blur-shader',
      code: `
        struct BlurParams {
          direction: vec2<f32>,
          radius: f32,
          _pad0: f32,
        }

        @group(0) @binding(0) var srcTex: texture_2d<f32>;
        @group(0) @binding(1) var srcSmp: sampler;
        @group(0) @binding(2) var<uniform> params: BlurParams;

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

        fn gaussian(x: f32, sigma: f32) -> f32 {
          return exp(-(x * x) / (2.0 * sigma * sigma));
        }

        @fragment
        fn fs(input: VSOut) -> @location(0) vec4<f32> {
          let texSize = vec2<f32>(textureDimensions(srcTex, 0));
          let texelSize = 1.0 / texSize;
          let dir = params.direction * texelSize;
          let radius = params.radius;
          let sigma = radius / 3.0;

          var result = vec3<f32>(0.0);
          var weightSum = 0.0;

          // Sample kernel (9 taps for performance)
          for (var i = -4; i <= 4; i++) {
            let offset = dir * f32(i);
            let weight = gaussian(abs(f32(i)), sigma);
            result += textureSample(srcTex, srcSmp, input.uv + offset).rgb * weight;
            weightSum += weight;
          }

          return vec4<f32>(result / max(weightSum, 1e-4), 1.0);
        }
      `,
    });

    const blurPipelineLayout = this.device.createPipelineLayout({
      label: 'bloom-blur-pl',
      bindGroupLayouts: [this.blurBindGroupLayout],
    });

    this.blurPipeline = this.device.createRenderPipeline({
      label: 'bloom-blur-pipeline',
      layout: blurPipelineLayout,
      vertex: { module: blurShader, entryPoint: 'vs' },
      fragment: {
        module: blurShader,
        entryPoint: 'fs',
        targets: [{ format: 'rgba16float' }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  /**
   * Processes bloom effect.
   * 
   * @param encoder - Command encoder
   * @param srcView - Source HDR texture view
   * @param extractView - Output view for bright areas extraction
   * @param tempView - Temporary view for horizontal blur
   * @param finalView - Final blurred output view
   */
  process(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    extractView: GPUTextureView,
    tempView: GPUTextureView,
    finalView: GPUTextureView
  ): void {
    this.initialize();
    if (!this.extractPipeline || !this.blurPipeline || !this.sampler) return;

    // Extract bright areas
    const extractParams = new Float32Array(4);
    extractParams[0] = this.threshold;
    extractParams[1] = this.intensity;
    const extractParamsBuffer = this.device.createBuffer({
      label: 'bloom-extract-params',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(extractParamsBuffer, 0, extractParams);

    const extractBindGroup = this.device.createBindGroup({
      label: 'bloom-extract-bg',
      layout: this.extractBindGroupLayout!,
      entries: [
        { binding: 0, resource: srcView },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: extractParamsBuffer } },
      ],
    });

    const extractPass = encoder.beginRenderPass({
      label: 'bloom-extract',
      colorAttachments: [{ view: extractView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
    });
    extractPass.setPipeline(this.extractPipeline);
    extractPass.setBindGroup(0, extractBindGroup);
    extractPass.draw(3, 1, 0, 0);
    extractPass.end();

    // Horizontal blur
    const blurParamsH = new Float32Array(4);
    blurParamsH[0] = 1.0; // x direction
    blurParamsH[1] = 0.0; // y direction
    blurParamsH[2] = this.blurRadius;
    const blurParamsHBuffer = this.device.createBuffer({
      label: 'bloom-blur-h-params',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(blurParamsHBuffer, 0, blurParamsH);

    const blurHBindGroup = this.device.createBindGroup({
      label: 'bloom-blur-h-bg',
      layout: this.blurBindGroupLayout!,
      entries: [
        { binding: 0, resource: extractView },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: blurParamsHBuffer } },
      ],
    });

    const blurHPass = encoder.beginRenderPass({
      label: 'bloom-blur-h',
      colorAttachments: [{ view: tempView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
    });
    blurHPass.setPipeline(this.blurPipeline);
    blurHPass.setBindGroup(0, blurHBindGroup);
    blurHPass.draw(3, 1, 0, 0);
    blurHPass.end();

    // Vertical blur
    const blurParamsV = new Float32Array(4);
    blurParamsV[0] = 0.0; // x direction
    blurParamsV[1] = 1.0; // y direction
    blurParamsV[2] = this.blurRadius;
    const blurParamsVBuffer = this.device.createBuffer({
      label: 'bloom-blur-v-params',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(blurParamsVBuffer, 0, blurParamsV);

    const blurVBindGroup = this.device.createBindGroup({
      label: 'bloom-blur-v-bg',
      layout: this.blurBindGroupLayout!,
      entries: [
        { binding: 0, resource: tempView },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: blurParamsVBuffer } },
      ],
    });

    const blurVPass = encoder.beginRenderPass({
      label: 'bloom-blur-v',
      colorAttachments: [{ view: finalView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
    });
    blurVPass.setPipeline(this.blurPipeline);
    blurVPass.setBindGroup(0, blurVBindGroup);
    blurVPass.draw(3, 1, 0, 0);
    blurVPass.end();
  }

  /**
   * Disposes resources.
   */
  dispose(): void {
    this.extractPipeline = null;
    this.blurPipeline = null;
    this.extractBindGroupLayout = null;
    this.blurBindGroupLayout = null;
    this.sampler = null;
  }
}

