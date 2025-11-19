import { createPostProcessPipeline, FULLSCREEN_VERTEX_SHADER } from './PostProcessUtils';

export enum TonemapMode {
  ACES = 0,
  Reinhard = 1,
  Cineon = 2,
  Linear = 3,
}

export interface TonemapConfig {
  /** Quantization steps (0 = disabled, >0 = number of color bands for NPR effect) */
  quantizeSteps?: number;
  /** Tonemapping algorithm */
  mode?: TonemapMode;
  /** Vignette intensity (0-1) */
  vignetteIntensity?: number;
  /** Vignette smoothness (0-1) */
  vignetteSmoothness?: number;
  /** Chromatic aberration intensity (0-1) */
  aberrationIntensity?: number;
}

export class TonemapLutPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private configLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;
  private lutTexture: GPUTexture | null = null;
  private configBuffer: GPUBuffer | null = null;
  private cachedBindGroup: GPUBindGroup | null = null;
  private cachedConfigBindGroup: GPUBindGroup | null = null;
  private cachedSrcView: GPUTextureView | null = null;
  private cachedBloomView: GPUTextureView | null = null;
  private cachedSSAOView: GPUTextureView | null = null;
  
  private config: Required<TonemapConfig> = {
    quantizeSteps: 0,
    mode: TonemapMode.ACES,
    vignetteIntensity: 0.0,
    vignetteSmoothness: 0.5,
    aberrationIntensity: 0.0,
  };

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Sets tonemap configuration
   */
  setConfig(config: TonemapConfig): void {
    this.config = { ...this.config, ...config };
    this.updateConfigBuffer();
  }

  /**
   * Gets current configuration
   */
  getConfig(): Readonly<Required<TonemapConfig>> {
    return this.config;
  }

  private createIdentityLUT(size = 16): Uint8Array {
    const data = new Uint8Array(size * size * size * 4);
    let i = 0;
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const r = (x / (size - 1)) * 255;
          const g = (y / (size - 1)) * 255;
          const b = (z / (size - 1)) * 255;
          data[i++] = r & 0xff;
          data[i++] = g & 0xff;
          data[i++] = b & 0xff;
          data[i++] = 255;
        }
      }
    }
    return data;
  }

  initialize(presentationFormat: GPUTextureFormat): void {
    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        label: 'post-sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
    }

    if (!this.lutTexture) {
      const size = 16;
      const data = this.createIdentityLUT(size);
      this.lutTexture = this.device.createTexture({
        label: 'lut3d-16',
        size: { width: size, height: size, depthOrArrayLayers: size },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        dimension: '3d',
      });
      // Write 3D via writeTexture with rowsPerImage=height and depth=layers
      this.device.queue.writeTexture(
        { texture: this.lutTexture },
        data as unknown as GPUAllowSharedBufferSource,
        { bytesPerRow: size * 4, rowsPerImage: size },
        { width: size, height: size, depthOrArrayLayers: size }
      );
    }

    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'tonemap-lut-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '3d' } },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // bloom
          { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // ssao (optional)
        ],
      });
    }

    if (!this.configLayout) {
      this.configLayout = this.device.createBindGroupLayout({
        label: 'tonemap-config-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ],
      });
    }

    if (!this.configBuffer) {
      this.configBuffer = this.device.createBuffer({
        label: 'tonemap-config',
        size: 32, // 8 floats (aligned to 16 bytes)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.updateConfigBuffer();
    }

    if (!this.pipeline) {
      const shader = this.device.createShaderModule({
        code: `
@group(0) @binding(0) var srcTex : texture_2d<f32>;
@group(0) @binding(1) var srcSmp : sampler;
@group(0) @binding(2) var lut3d : texture_3d<f32>;
@group(0) @binding(3) var bloomTex : texture_2d<f32>;
@group(0) @binding(4) var ssaoTex : texture_2d<f32>;

struct TonemapConfig {
  quantizeSteps: f32,
  mode: f32,
  vignetteIntensity: f32,
  vignetteSmoothness: f32,
  aberrationIntensity: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(1) @binding(0) var<uniform> config: TonemapConfig;

// Dithering function (blue noise approximation)
fn dither(uv: vec2<f32>) -> f32 {
  let x = fract(uv.x * 37.0 + uv.y * 17.0);
  let y = fract(uv.x * 19.0 + uv.y * 23.0);
  return (x + y) * 0.5 - 0.5;
}

// ACES Filmic Tone Mapping (Reference Implementation)
fn ACESFilm(x: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

// Reinhard Tone Mapping
fn Reinhard(x: vec3<f32>) -> vec3<f32> {
  return x / (x + vec3<f32>(1.0));
}

// Cineon Tone Mapping
fn Cineon(x: vec3<f32>) -> vec3<f32> {
  let a = x * (x * 0.22 + 0.025) + 0.004; // Optimized fit
  let b = x * (x * 0.22 + 0.3) + 0.06;
  return clamp((a / b) - 0.0667, vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment fn fs_main(@builtin(position) pos: vec4<f32>, @location(0) v_uv:vec2<f32>) -> @location(0) vec4<f32> {
  // Chromatic Aberration
  var uv = v_uv;
  var color = vec3<f32>(0.0);
  
  if (config.aberrationIntensity > 0.001) {
    let dist = distance(v_uv, vec2<f32>(0.5));
    let offset = dist * config.aberrationIntensity * 0.02;
    
    color.r = textureSample(srcTex, srcSmp, v_uv + vec2<f32>(offset, 0.0)).r;
    color.g = textureSample(srcTex, srcSmp, v_uv).g;
    color.b = textureSample(srcTex, srcSmp, v_uv - vec2<f32>(offset, 0.0)).b;
  } else {
    color = textureSample(srcTex, srcSmp, v_uv).rgb;
  }
  
  var hdr = color;
  
  // Add bloom (already in HDR)
  let bloom = vec3<f32>(textureSample(bloomTex, srcSmp, v_uv).xyz);
  hdr += bloom;
  
  // Apply SSAO (multiply ambient occlusion)
  let ssao = textureSample(ssaoTex, srcSmp, v_uv).r;
  hdr *= mix(1.0, ssao, 0.5);
  
  // Apply Tonemapping
  var mapped = hdr;
  let mode = i32(config.mode);
  
  if (mode == 0) { // ACES
    mapped = ACESFilm(hdr);
  } else if (mode == 1) { // Reinhard
    mapped = Reinhard(hdr);
  } else if (mode == 2) { // Cineon
    mapped = Cineon(hdr);
  } else { // Linear (3)
    mapped = clamp(hdr, vec3<f32>(0.0), vec3<f32>(1.0));
  }
  
  // Apply Vignette
  if (config.vignetteIntensity > 0.001) {
    let dist = distance(v_uv, vec2<f32>(0.5));
    let vignette = smoothstep(0.8, 0.8 - config.vignetteSmoothness, dist * (1.0 + config.vignetteIntensity));
    mapped *= vignette;
  }
  
  // Apply quantization for NPR effect if enabled
  if (config.quantizeSteps > 0.5) {
    let step = 1.0 / config.quantizeSteps;
    mapped = floor(mapped / step + 0.5) * step;
  }
  
  // Gamma correction (sRGB)
  let ldr = pow(mapped, vec3<f32>(1.0/2.2));
  
  // Apply dithering to reduce banding (subtle, skip if quantizing)
  var finalColor = ldr;
  if (config.quantizeSteps < 0.5) {
    let ditherValue = dither(pos.xy * 0.25) * 0.01;
    finalColor = clamp(ldr + vec3<f32>(ditherValue), vec3<f32>(0.0), vec3<f32>(1.0));
  }
  
  return vec4<f32>(finalColor, 1.0);
}
`,
      });

      const layout = this.device.createPipelineLayout({
        label: 'tonemap-lut-pl',
        bindGroupLayouts: [this.bindGroupLayout, this.configLayout],
      });

      this.pipeline = this.device.createRenderPipeline({
        label: 'tonemap-lut-pipeline',
        layout,
        vertex: {
          module: this.device.createShaderModule({ code: FULLSCREEN_VERTEX_SHADER }),
          entryPoint: 'vs_fullscreen',
        },
        fragment: {
          module: shader,
          entryPoint: 'fs_main',
          targets: [{ format: presentationFormat }],
        },
        primitive: { topology: 'triangle-list' },
      });
    }
  }

  render(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    bloomView: GPUTextureView | null,
    dstView: GPUTextureView,
    ssaoView?: GPUTextureView | null,
    opts?: { querySet?: GPUQuerySet; begin?: number; end?: number }
  ): void {
    if (!this.pipeline || !this.bindGroupLayout || !this.sampler || !this.lutTexture) return;

    // Create placeholder black texture for bloom if not provided (no bloom = black)
    let placeholderBloom: GPUTexture | null = null;
    if (!bloomView) {
      placeholderBloom = this.device.createTexture({
        label: 'tonemap-bloom-placeholder',
        size: [1, 1, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      // Write black (no bloom = 0.0) in float16
      const blackData = new Float32Array([0.0, 0.0, 0.0, 0.0]);
      this.device.queue.writeTexture(
        { texture: placeholderBloom },
        blackData.buffer as ArrayBuffer,
        { bytesPerRow: 16, rowsPerImage: 1 },
        [1, 1, 1]
      );
    }

    // Create placeholder white texture for SSAO if not provided (no occlusion = white)
    let placeholderSSAO: GPUTexture | null = null;
    if (!ssaoView) {
      placeholderSSAO = this.device.createTexture({
        label: 'tonemap-ssao-placeholder',
        size: [1, 1, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      // Write white (no occlusion = 1.0) in float16
      const whiteData = new Float32Array([1.0, 1.0, 1.0, 1.0]);
      this.device.queue.writeTexture(
        { texture: placeholderSSAO },
        whiteData.buffer as ArrayBuffer,
        { bytesPerRow: 16, rowsPerImage: 1 },
        [1, 1, 1]
      );
    }

    const bloomToUse = bloomView ?? placeholderBloom!.createView();
    const ssaoToUse = ssaoView ?? placeholderSSAO!.createView();
    
    if (!this.cachedBindGroup || this.cachedSrcView !== srcView || this.cachedBloomView !== bloomView || this.cachedSSAOView !== ssaoView) {
      this.cachedBindGroup = this.device.createBindGroup({
        label: 'tonemap-lut-bg',
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: srcView },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: this.lutTexture.createView({ dimension: '3d' }) },
          { binding: 3, resource: bloomToUse },
          { binding: 4, resource: ssaoToUse },
        ],
      });
      this.cachedSrcView = srcView;
      this.cachedBloomView = bloomView;
      this.cachedSSAOView = ssaoView ?? null;
      // Note: placeholderSSAO will be reused across frames if ssaoView is null
      // It's acceptable to keep it alive for the lifetime of TonemapLutPass
    }

    if (!this.cachedConfigBindGroup) {
      this.cachedConfigBindGroup = this.device.createBindGroup({
        label: 'tonemap-config-bg',
        layout: this.configLayout!,
        entries: [
          { binding: 0, resource: { buffer: this.configBuffer! } },
        ],
      });
    }
    const passDesc: GPURenderPassDescriptor = {
      label: 'tonemap-pass',
      colorAttachments: [{ view: dstView, loadOp: 'clear', storeOp: 'store' }],
      ...(opts?.querySet && typeof opts.begin === 'number' && typeof opts.end === 'number'
        ? {
            timestampWrites: {
              querySet: opts.querySet,
              beginningOfPassWriteIndex: opts.begin!,
              endOfPassWriteIndex: opts.end!,
            },
          }
        : {}),
    } as GPURenderPassDescriptor;
    const pass = encoder.beginRenderPass(passDesc);
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.cachedBindGroup!);
    pass.setBindGroup(1, this.cachedConfigBindGroup!);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }

  /**
   * Updates config buffer with current settings
   */
  private updateConfigBuffer(): void {
    if (!this.configBuffer) return;
    const data = new Float32Array(8);
    data[0] = this.config.quantizeSteps;
    data[1] = this.config.mode;
    data[2] = this.config.vignetteIntensity;
    data[3] = this.config.vignetteSmoothness;
    data[4] = this.config.aberrationIntensity;
    data[5] = 0; // pad
    data[6] = 0; // pad
    data[7] = 0; // pad
    this.device.queue.writeBuffer(this.configBuffer, 0, data);
  }

  dispose(): void {
    try {
      this.lutTexture?.destroy();
    } catch {
      // ignore
    }
    this.lutTexture = null;
    this.pipeline = null;
    this.bindGroupLayout = null;
    this.configLayout = null;
    this.sampler = null;
    this.configBuffer?.destroy();
    this.configBuffer = null;
    this.cachedBindGroup = null;
    this.cachedConfigBindGroup = null;
    this.cachedSrcView = null;
    this.cachedBloomView = null;
    this.cachedSSAOView = null;
  }
}
