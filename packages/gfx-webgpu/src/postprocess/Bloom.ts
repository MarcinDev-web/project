export interface BloomConfig {
  /** Brightness threshold (1.0 = no bloom) */
  threshold?: number;
  /** Bloom intensity multiplier */
  intensity?: number;
  /** Number of downsampling steps (more = larger blur radius) */
  iterations?: number;
}

export class BloomPass {
  private device: GPUDevice;
  private brightPassPipeline: GPURenderPipeline | null = null;
  private blurPipeline: GPURenderPipeline | null = null;
  private upsamplePipeline: GPURenderPipeline | null = null;
  private brightPassLayout: GPUBindGroupLayout | null = null;
  private blurLayout: GPUBindGroupLayout | null = null;
  private upsampleLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;
  private configBuffer: GPUBuffer | null = null;
  private cachedBindGroups: Map<string, GPUBindGroup> = new Map();
  private format: GPUTextureFormat | null = null;
  private mipChain: GPUTexture[] = [];
  private mipViews: GPUTextureView[] = [];

  private config: Required<BloomConfig> = {
    threshold: 1.0,
    intensity: 0.8,
    iterations: 5,
  };

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Sets bloom configuration
   */
  setConfig(config: BloomConfig): void {
    this.config = { ...this.config, ...config };
    this.mipChain = []; // Invalidate mip chain on config change
    this.mipViews = [];
  }

  /**
   * Gets current configuration
   */
  getConfig(): Readonly<Required<BloomConfig>> {
    return this.config;
  }

  initialize(format: GPUTextureFormat): void {
    this.format = format;
    
    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        label: 'bloom-sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
    }

    // Create config buffer
    if (!this.configBuffer) {
      this.configBuffer = this.device.createBuffer({
        label: 'bloom-config',
        size: 16, // vec4: threshold, intensity, unused, unused
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }

    // Bright-pass pipeline
    if (!this.brightPassLayout) {
      this.brightPassLayout = this.device.createBindGroupLayout({
        label: 'bloom-brightpass-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ],
      });
    }
    if (!this.brightPassPipeline) {
      const vs = this.device.createShaderModule({
        code: `struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs_fullscreen(@builtin(vertex_index) vid:u32)->VSOut{ var o:VSOut; let x=f32((vid<<1u)&2u); let y=f32(vid&2u); o.pos=vec4<f32>(x*2.0-1.0, y*-2.0+1.0, 0.0, 1.0); o.uv=vec2<f32>(x,y); return o; }`,
      });
      const fs = this.device.createShaderModule({
        code: `
@group(0) @binding(0) var hdrTex : texture_2d<f32>;
@group(0) @binding(1) var smp : sampler;
struct BloomConfig { threshold: f32, intensity: f32, _pad0: f32, _pad1: f32; }
@group(0) @binding(2) var<uniform> config : BloomConfig;
@fragment fn fs_main(@location(0) v_uv:vec2<f32>) -> @location(0) vec4<f32> {
  let col = vec3<f32>(textureSample(hdrTex, smp, v_uv).xyz);
  let lum = dot(col, vec3<f32>(0.2126, 0.7152, 0.0722));
  let bright = max(lum - config.threshold, 0.0);
  bright = bright / (bright + 1.0);
  return vec4<f32>(col * bright, 1.0);
}`,
      });
      this.brightPassPipeline = this.device.createRenderPipeline({
        label: 'bloom-brightpass',
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.brightPassLayout] }),
        vertex: { module: vs, entryPoint: 'vs_fullscreen' },
        fragment: { module: fs, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
    }

    // Blur pipeline (Gaussian horizontal + vertical)
    if (!this.blurLayout) {
      this.blurLayout = this.device.createBindGroupLayout({
        label: 'bloom-blur-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        ],
      });
    }
    if (!this.blurPipeline) {
      const vs = this.device.createShaderModule({
        code: `struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs_fullscreen(@builtin(vertex_index) vid:u32)->VSOut{ var o:VSOut; let x=f32((vid<<1u)&2u); let y=f32(vid&2u); o.pos=vec4<f32>(x*2.0-1.0, y*-2.0+1.0, 0.0, 1.0); o.uv=vec2<f32>(x,y); return o; }`,
      });
      const fs = this.device.createShaderModule({
        code: `
@group(0) @binding(0) var srcTex : texture_2d<f32>;
@group(0) @binding(1) var smp : sampler;
struct BlurParams { direction: vec2<f32>, texSize: vec2<f32>; }
@group(0) @binding(2) var<uniform> params : BlurParams;
@fragment fn fs_main(@location(0) v_uv:vec2<f32>) -> @location(0) vec4<f32> {
  let texel = params.texSize;
  var result = vec3<f32>(0.0);
  // 13-tap Gaussian blur
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(-6.0, -6.0) * params.direction * texel).rgb * 0.002216;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(-5.0, -5.0) * params.direction * texel).rgb * 0.008764;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(-4.0, -4.0) * params.direction * texel).rgb * 0.026995;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(-3.0, -3.0) * params.direction * texel).rgb * 0.064759;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(-2.0, -2.0) * params.direction * texel).rgb * 0.121117;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(-1.0, -1.0) * params.direction * texel).rgb * 0.176033;
  result += textureSample(srcTex, smp, v_uv).rgb * 0.199471;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(1.0, 1.0) * params.direction * texel).rgb * 0.176033;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(2.0, 2.0) * params.direction * texel).rgb * 0.121117;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(3.0, 3.0) * params.direction * texel).rgb * 0.064759;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(4.0, 4.0) * params.direction * texel).rgb * 0.026995;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(5.0, 5.0) * params.direction * texel).rgb * 0.008764;
  result += textureSample(srcTex, smp, v_uv + vec2<f32>(6.0, 6.0) * params.direction * texel).rgb * 0.002216;
  return vec4<f32>(result, 1.0);
}`,
      });
      // Note: blur params buffer would be added to layout if needed
      const blurParamsLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ],
      });
      this.blurPipeline = this.device.createRenderPipeline({
        label: 'bloom-blur',
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [blurParamsLayout] }),
        vertex: { module: vs, entryPoint: 'vs_fullscreen' },
        fragment: { module: fs, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
    }

    // Upsample pipeline (combines mip with previous level)
    if (!this.upsampleLayout) {
      this.upsampleLayout = this.device.createBindGroupLayout({
        label: 'bloom-upsample-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        ],
      });
    }
    if (!this.upsamplePipeline) {
      const vs = this.device.createShaderModule({
        code: `struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs_fullscreen(@builtin(vertex_index) vid:u32)->VSOut{ var o:VSOut; let x=f32((vid<<1u)&2u); let y=f32(vid&2u); o.pos=vec4<f32>(x*2.0-1.0, y*-2.0+1.0, 0.0, 1.0); o.uv=vec2<f32>(x,y); return o; }`,
      });
      const fs = this.device.createShaderModule({
        code: `
@group(0) @binding(0) var lowResTex : texture_2d<f32>;
@group(0) @binding(1) var highResTex : texture_2d<f32>;
@group(0) @binding(2) var smp : sampler;
@fragment fn fs_main(@location(0) v_uv:vec2<f32>) -> @location(0) vec4<f32> {
  let lowRes = textureSample(lowResTex, smp, v_uv).rgb;
  let highRes = textureSample(highResTex, smp, v_uv).rgb;
  return vec4<f32>(highRes + lowRes, 1.0);
}`,
      });
      this.upsamplePipeline = this.device.createRenderPipeline({
        label: 'bloom-upsample',
        layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.upsampleLayout] }),
        vertex: { module: vs, entryPoint: 'vs_fullscreen' },
        fragment: { module: fs, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
    }
  }

  /**
   * Creates or reuses mip chain textures for bloom downsampling
   */
  private ensureMipChain(width: number, height: number): void {
    const iterations = this.config.iterations;
    const neededMips = iterations + 1; // +1 for bright-pass output

    // Destroy old mip chain if size changed
    if (this.mipChain.length > 0) {
      const firstMip = this.mipChain[0];
      if (firstMip && (firstMip.width !== width || firstMip.height !== height)) {
        for (const tex of this.mipChain) {
          try {
            tex?.destroy();
          } catch {
            // ignore
          }
        }
        this.mipChain = [];
        this.mipViews = [];
      }
    }

    // Create mip chain
    if (this.mipChain.length === 0 && this.format) {
      let currentWidth = Math.floor(width / 2);
      let currentHeight = Math.floor(height / 2);

      for (let i = 0; i < neededMips; i++) {
        if (currentWidth < 1 || currentHeight < 1) break;

        const tex = this.device.createTexture({
          label: `bloom-mip-${i}`,
          size: [currentWidth, currentHeight, 1],
          format: this.format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        this.mipChain.push(tex);
        this.mipViews.push(tex.createView());

        currentWidth = Math.floor(currentWidth / 2);
        currentHeight = Math.floor(currentHeight / 2);
      }
    }
  }

  render(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    dstView: GPUTextureView,
    width: number,
    height: number,
    opts?: { querySet?: GPUQuerySet; begin?: number; end?: number }
  ): void {
    if (!this.brightPassPipeline || !this.blurPipeline || !this.upsamplePipeline || !this.sampler || !this.format) {
      return;
    }

    // Update config buffer
    if (this.configBuffer) {
      const configData = new Float32Array(4);
      configData[0] = this.config.threshold;
      configData[1] = this.config.intensity;
      this.device.queue.writeBuffer(this.configBuffer, 0, configData);
    }

    // Ensure mip chain exists
    this.ensureMipChain(width, height);
    if (this.mipChain.length === 0) return;

    // Step 1: Bright-pass extraction
    const brightPassView = this.mipViews[0]!;
    const brightPassKey = `bright-${srcView}`;
    let brightPassBg = this.cachedBindGroups.get(brightPassKey);
    if (!brightPassBg && this.brightPassLayout && this.configBuffer) {
      brightPassBg = this.device.createBindGroup({
        label: 'bloom-brightpass-bg',
        layout: this.brightPassLayout,
        entries: [
          { binding: 0, resource: srcView },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: { buffer: this.configBuffer } },
        ],
      });
      this.cachedBindGroups.set(brightPassKey, brightPassBg);
    }

    const brightPass = encoder.beginRenderPass({
      label: 'bloom-brightpass',
      colorAttachments: [{ view: brightPassView, loadOp: 'clear', storeOp: 'store' }],
    });
    brightPass.setPipeline(this.brightPassPipeline);
    brightPass.setBindGroup(0, brightPassBg!);
    brightPass.draw(3, 1, 0, 0);
    brightPass.end();

    // Step 2: Downsample and blur each mip level
    for (let i = 0; i < this.config.iterations && i < this.mipChain.length - 1; i++) {
      const srcMip = this.mipViews[i]!;
      const dstMip = this.mipViews[i + 1]!;

      // Horizontal blur
      const blurHKey = `blur-h-${i}-${srcMip}`;
      let blurHBg = this.cachedBindGroups.get(blurHKey);
      if (!blurHBg && this.blurPipeline) {
        const blurLayout = this.blurPipeline.getBindGroupLayout(0);
        // Create blur params buffer for direction
        const blurParamsBuffer = this.device.createBuffer({
          label: `bloom-blur-params-${i}`,
          size: 16, // vec2 direction + vec2 texSize
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const texSize = new Float32Array(4);
        texSize[0] = 1.0; // horizontal direction
        texSize[1] = 0.0;
        texSize[2] = 1.0 / Math.floor(width / Math.pow(2, i));
        texSize[3] = 1.0 / Math.floor(height / Math.pow(2, i));
        this.device.queue.writeBuffer(blurParamsBuffer, 0, texSize);

        blurHBg = this.device.createBindGroup({
          label: `bloom-blur-h-bg-${i}`,
          layout: blurLayout,
          entries: [
            { binding: 0, resource: srcMip },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: { buffer: blurParamsBuffer } },
          ],
        });
        this.cachedBindGroups.set(blurHKey, blurHBg);
      }

      // Create temporary texture for horizontal blur output
      const tempMip = this.device.createTexture({
        label: `bloom-temp-${i}`,
        size: [this.mipChain[i + 1]!.width, this.mipChain[i + 1]!.height, 1],
        format: this.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      const tempView = tempMip.createView();

      const blurH = encoder.beginRenderPass({
        label: `bloom-blur-h-${i}`,
        colorAttachments: [{ view: tempView, loadOp: 'clear', storeOp: 'store' }],
      });
      blurH.setPipeline(this.blurPipeline);
      blurH.setBindGroup(0, blurHBg!);
      blurH.draw(3, 1, 0, 0);
      blurH.end();

      // Vertical blur (blur horizontally blurred temp into dst mip)
      const blurVKey = `blur-v-${i}-${tempView}`;
      let blurVBg = this.cachedBindGroups.get(blurVKey);
      if (!blurVBg && this.blurPipeline) {
        const blurLayout = this.blurPipeline.getBindGroupLayout(0);
        const blurParamsBuffer = this.device.createBuffer({
          label: `bloom-blur-v-params-${i}`,
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const texSize = new Float32Array(4);
        texSize[0] = 0.0; // vertical direction
        texSize[1] = 1.0;
        texSize[2] = 1.0 / tempMip.width;
        texSize[3] = 1.0 / tempMip.height;
        this.device.queue.writeBuffer(blurParamsBuffer, 0, texSize);

        blurVBg = this.device.createBindGroup({
          label: `bloom-blur-v-bg-${i}`,
          layout: blurLayout,
          entries: [
            { binding: 0, resource: tempView },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: { buffer: blurParamsBuffer } },
          ],
        });
        this.cachedBindGroups.set(blurVKey, blurVBg);
      }

      const blurV = encoder.beginRenderPass({
        label: `bloom-blur-v-${i}`,
        colorAttachments: [{ view: dstMip, loadOp: 'clear', storeOp: 'store' }],
      });
      blurV.setPipeline(this.blurPipeline);
      blurV.setBindGroup(0, blurVBg!);
      blurV.draw(3, 1, 0, 0);
      blurV.end();

      tempMip.destroy();
    }

    // Step 3: Upsample and combine (from smallest to largest)
    for (let i = this.config.iterations - 1; i >= 0; i--) {
      if (i >= this.mipChain.length - 1) continue;

      const lowResView = this.mipViews[i + 1]!;
      const highResView = this.mipViews[i]!;
      const outputView = i === 0 ? dstView : highResView; // Final output goes to dstView

      const upsampleKey = `upsample-${i}-${lowResView}-${highResView}`;
      let upsampleBg = this.cachedBindGroups.get(upsampleKey);
      if (!upsampleBg && this.upsampleLayout) {
        upsampleBg = this.device.createBindGroup({
          label: `bloom-upsample-bg-${i}`,
          layout: this.upsampleLayout,
          entries: [
            { binding: 0, resource: lowResView },
            { binding: 1, resource: highResView },
            { binding: 2, resource: this.sampler },
          ],
        });
        this.cachedBindGroups.set(upsampleKey, upsampleBg);
      }

      const upsample = encoder.beginRenderPass({
        label: `bloom-upsample-${i}`,
        colorAttachments: [{ view: outputView, loadOp: i === 0 ? 'clear' : 'load', storeOp: 'store' }],
      });
      upsample.setPipeline(this.upsamplePipeline);
      upsample.setBindGroup(0, upsampleBg!);
      upsample.draw(3, 1, 0, 0);
      upsample.end();
    }
  }
}



