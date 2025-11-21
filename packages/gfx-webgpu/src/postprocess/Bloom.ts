import { Logger } from '@engine/core/utils';

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
  private pendingDestroy: GPUTexture[] = [];
  private previousFrameTempTextures: GPUTexture[] = []; // Temp textures from previous frame (safe to destroy)
  private currentFrameTempTextures: GPUTexture[] = []; // Temp textures from current frame (will be destroyed next frame)

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
    this.releaseMipChain();
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
struct BloomConfig {
  threshold: f32,
  intensity: f32,
  _pad0: f32,
  _pad1: f32,
}
@group(0) @binding(2) var<uniform> config : BloomConfig;
@fragment fn fs_main(@location(0) v_uv:vec2<f32>) -> @location(0) vec4<f32> {
  let col = vec3<f32>(textureSample(hdrTex, smp, v_uv).xyz);
  let lum = dot(col, vec3<f32>(0.2126, 0.7152, 0.0722));
  var bright = max(lum - config.threshold, 0.0);
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
struct BlurParams {
  direction: vec2<f32>,
  texSize: vec2<f32>,
}
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

    // Calculate expected first mip size (half resolution)
    const expectedFirstMipWidth = Math.floor(width / 2);
    const expectedFirstMipHeight = Math.floor(height / 2);

    // Destroy old mip chain if size changed
    // CRITICAL: Compare with expected first mip size, not full canvas size!
    if (this.mipChain.length > 0) {
      const firstMip = this.mipChain[0];
      if (firstMip && (firstMip.width !== expectedFirstMipWidth || firstMip.height !== expectedFirstMipHeight)) {
        this.releaseMipChain();
      }
    }

    // Create mip chain
    if (this.mipChain.length === 0 && this.format) {
      let currentWidth = expectedFirstMipWidth;
      let currentHeight = expectedFirstMipHeight;

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
    // Track temp textures to destroy after all render passes are finished
    const tempTextures: GPUTexture[] = [];
    
    for (let i = 0; i < this.config.iterations && i < this.mipChain.length - 1; i++) {
      const srcMip = this.mipViews[i]!;
      const dstMip = this.mipViews[i + 1]!;

      // Create temporary texture for horizontal blur output
      const tempMip = this.device.createTexture({
        label: `bloom-temp-${i}`,
        size: [this.mipChain[i + 1]!.width, this.mipChain[i + 1]!.height, 1],
        format: this.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      const tempView = tempMip.createView();
      tempTextures.push(tempMip); // Track for cleanup

      // Horizontal blur - create bind group fresh (don't cache, uses temp texture)
      const blurLayout = this.blurPipeline.getBindGroupLayout(0);
      const blurHParamsBuffer = this.device.createBuffer({
        label: `bloom-blur-h-params-${i}`,
        size: 16, // vec2 direction + vec2 texSize
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const texSizeH = new Float32Array(4);
      texSizeH[0] = 1.0; // horizontal direction
      texSizeH[1] = 0.0;
      texSizeH[2] = 1.0 / Math.floor(width / Math.pow(2, i));
      texSizeH[3] = 1.0 / Math.floor(height / Math.pow(2, i));
      this.device.queue.writeBuffer(blurHParamsBuffer, 0, texSizeH);

      const blurHBg = this.device.createBindGroup({
        label: `bloom-blur-h-bg-${i}`,
        layout: blurLayout,
        entries: [
          { binding: 0, resource: srcMip },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: { buffer: blurHParamsBuffer } },
        ],
      });

      const blurH = encoder.beginRenderPass({
        label: `bloom-blur-h-${i}`,
        colorAttachments: [{ view: tempView, loadOp: 'clear', storeOp: 'store' }],
      });
      blurH.setPipeline(this.blurPipeline);
      blurH.setBindGroup(0, blurHBg);
      blurH.draw(3, 1, 0, 0);
      blurH.end();

      // Vertical blur - create bind group fresh (don't cache, uses temp texture)
      const blurVParamsBuffer = this.device.createBuffer({
        label: `bloom-blur-v-params-${i}`,
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const texSizeV = new Float32Array(4);
      texSizeV[0] = 0.0; // vertical direction
      texSizeV[1] = 1.0;
      texSizeV[2] = 1.0 / tempMip.width;
      texSizeV[3] = 1.0 / tempMip.height;
      this.device.queue.writeBuffer(blurVParamsBuffer, 0, texSizeV);

      const blurVBg = this.device.createBindGroup({
        label: `bloom-blur-v-bg-${i}`,
        layout: blurLayout,
        entries: [
          { binding: 0, resource: tempView },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: { buffer: blurVParamsBuffer } },
        ],
      });

      const blurV = encoder.beginRenderPass({
        label: `bloom-blur-v-${i}`,
        colorAttachments: [{ view: dstMip, loadOp: 'clear', storeOp: 'store' }],
      });
      blurV.setPipeline(this.blurPipeline);
      blurV.setBindGroup(0, blurVBg);
      blurV.draw(3, 1, 0, 0);
      blurV.end();

      // Note: tempMip will be destroyed after encoder.finish() is called
      // We track it in tempTextures array but don't destroy here
      // The textures will be cleaned up by the caller or via GC
    }

    // Step 3: Upsample and combine (from smallest to largest)
    // CRITICAL: We cannot use a texture as both render attachment and texture binding
    // in the same render pass. When i > 0, we read from highResView (mipViews[i])
    // and want to write back to it, but that's not allowed in the same pass.
    // Solution: Always write to a separate temp texture, then use that as input for next iteration
    let prevUpsampleView: GPUTextureView | null = null;
    
    for (let i = this.config.iterations - 1; i >= 0; i--) {
      if (i >= this.mipChain.length - 1) continue;

      const lowResView = i === this.config.iterations - 1 
        ? this.mipViews[i + 1]!  // First iteration: use mip chain
        : prevUpsampleView!;      // Later iterations: use previous upsample result
      const highResView = this.mipViews[i]!;
      
      // Always create temp texture for output to avoid usage conflicts
      const upsampleTempTex = this.device.createTexture({
        label: `bloom-upsample-temp-${i}`,
        size: [this.mipChain[i]!.width, this.mipChain[i]!.height, 1],
        format: this.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      const outputView = i === 0 ? dstView : upsampleTempTex.createView();
      tempTextures.push(upsampleTempTex);

      // Do not cache upsample bind groups: they reference per-frame temporary textures (lowRes/highRes views).
      // Caching risks reusing stale views across frames, leading to WebGPU validation errors.
      if (!this.upsampleLayout) {
        continue;
      }
      const upsampleBg = this.device.createBindGroup({
        label: `bloom-upsample-bg-${i}`,
        layout: this.upsampleLayout,
        entries: [
          { binding: 0, resource: lowResView },
          { binding: 1, resource: highResView },
          { binding: 2, resource: this.sampler },
        ],
      });

      const upsample = encoder.beginRenderPass({
        label: `bloom-upsample-${i}`,
        colorAttachments: [{ view: outputView, loadOp: i === 0 ? 'clear' : 'load', storeOp: 'store' }],
      });
      upsample.setPipeline(this.upsamplePipeline);
      upsample.setBindGroup(0, upsampleBg);
      upsample.draw(3, 1, 0, 0);
      upsample.end();
      
      // For next iteration, use this temp as the low-res input
      if (i > 0) {
        prevUpsampleView = upsampleTempTex.createView();
      }
    }
    
    
    // Move current frame textures to previous (they'll be destroyed after submit)
    // Store new textures as current (they'll be destroyed in next frame)
    this.previousFrameTempTextures = this.currentFrameTempTextures;
    this.currentFrameTempTextures = tempTextures;
  }
  
  /**
   * Flushes pending temp textures after encoder submit.
   * Should be called after queue.submit() to ensure textures are safe to destroy.
   */
  flushTempTextures(queue: GPUQueue): void {
    // Destroy textures from previous frame (they're safe now after submit)
    const previousFrameTextures = this.previousFrameTempTextures;
    if (previousFrameTextures.length > 0) {
      // Clear immediately so we don't destroy them again
      this.previousFrameTempTextures = [];
      
      const destroyTextures = () => {
        for (const texture of previousFrameTextures) {
          try {
            texture.destroy();
          } catch (err) {
            Logger.warn('Failed to destroy bloom temp texture', err);
          }
        }
      };
      
      // Wait for GPU work to complete before destroying
      queue
        .onSubmittedWorkDone()
        .then(() => destroyTextures())
        .catch((err) => {
          Logger.warn('Failed to defer destroy bloom temp textures after GPU work', err);
          // Fallback: destroy after delay
          setTimeout(destroyTextures, 200);
        });
    }
  }

  dispose(): void {
    try {
      this.configBuffer?.destroy();
    } catch {
      // ignore
    }
    this.configBuffer = null;
    this.releaseMipChain(true);
    if (this.pendingDestroy.length > 0) {
      const textures = this.pendingDestroy.splice(0);
      for (const texture of textures) {
        try {
          texture.destroy();
        } catch {
          // ignore
        }
      }
    }
    // Destroy any pending temp textures immediately on dispose
    const allTempTextures = [...this.previousFrameTempTextures, ...this.currentFrameTempTextures];
    this.previousFrameTempTextures = [];
    this.currentFrameTempTextures = [];
    for (const texture of allTempTextures) {
      try {
        texture.destroy();
      } catch {
        // ignore
      }
    }
    this.cachedBindGroups.clear();
    this.brightPassPipeline = null;
    this.blurPipeline = null;
    this.upsamplePipeline = null;
    this.brightPassLayout = null;
    this.blurLayout = null;
    this.upsampleLayout = null;
    this.sampler = null;
    this.format = null;
  }

  flushPendingDestroy(queue: GPUQueue): void {
    if (this.pendingDestroy.length === 0) {
      return;
    }
    const textures = this.pendingDestroy.splice(0);
    const destroyTextures = () => {
      for (const texture of textures) {
        try {
          texture.destroy();
        } catch (err) {
          Logger.warn('Failed to destroy bloom mip texture', err);
        }
      }
    };
    queue
      .onSubmittedWorkDone()
      .then(() => destroyTextures())
      .catch((err) => {
        Logger.warn('Failed to defer destroy bloom mip textures after GPU work', err);
        setTimeout(destroyTextures, 200);
      });
  }

  private releaseMipChain(forceImmediate = false): void {
    if (this.mipChain.length === 0) {
      this.mipViews = [];
      return;
    }
    if (forceImmediate) {
      for (const tex of this.mipChain) {
        if (!tex) continue;
        try {
          tex.destroy();
        } catch {
          // ignore
        }
      }
    } else {
      for (const tex of this.mipChain) {
        if (tex) {
          this.pendingDestroy.push(tex);
        }
      }
    }
    this.mipChain = [];
    this.mipViews = [];
  }
}



