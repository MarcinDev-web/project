/**
 * Screen Space Ambient Occlusion (SSAO)
 * 
 * Adds depth and realism by darkening areas where geometry occludes ambient light.
 * Uses a high-quality implementation with temporal accumulation for smoothness.
 */

import { Logger } from '@engine/core/utils';

export interface SSAOConfig {
  /** Sample count (16, 32, or 64 - higher = better quality, slower) */
  sampleCount?: number;
  /** Radius of the occlusion sphere in view-space units */
  radius?: number;
  /** Intensity multiplier */
  intensity?: number;
  /** Bias to reduce self-occlusion artifacts */
  bias?: number;
  /** Enable temporal accumulation for smoother results */
  temporal?: boolean;
}

export class SSAOPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;
  private noiseTexture: GPUTexture | null = null;
  private sampleBuffer: GPUBuffer | null = null;
  private configBuffer: GPUBuffer | null = null;
  private cachedBindGroup: GPUBindGroup | null = null;
  private cachedDepthView: GPUTextureView | null = null;
  private cachedNormalView: GPUTextureView | null = null;
  private cachedOutputView: GPUTextureView | null = null;

  // Default configuration
  private config: Required<SSAOConfig> = {
    sampleCount: 32,
    radius: 0.5,
    intensity: 2.0,
    bias: 0.025,
    temporal: false, // Disabled by default (requires history buffer)
  };

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Sets SSAO configuration
   */
  setConfig(config: SSAOConfig): void {
    this.config = { ...this.config, ...config };
    this.invalidateBindGroup();
  }

  /**
   * Gets current configuration
   */
  getConfig(): Readonly<Required<SSAOConfig>> {
    return this.config;
  }

  /**
   * Initializes SSAO resources
   */
  initialize(format: GPUTextureFormat): void {
    // Create regular sampler for normals and noise textures
    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        label: 'ssao-sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
    }

    // Generate random rotation vectors (4x4 noise texture)
    // Stores rotation vectors as (cos(angle), sin(angle), 0) in [-1,1] range
    // which will be encoded to [0,1] when written to rgba16float texture
    if (!this.noiseTexture) {
      const noiseSize = 4;
      const noiseData = new Float32Array(noiseSize * noiseSize * 4); // rgba16float = 4 components
      for (let i = 0; i < noiseSize * noiseSize; i++) {
        const angle = Math.random() * Math.PI * 2;
        // Store rotation vector components (cos, sin, 0, 1)
        // These are in [-1,1] range and will be stored as-is in float texture
        noiseData[i * 4 + 0] = Math.cos(angle);
        noiseData[i * 4 + 1] = Math.sin(angle);
        noiseData[i * 4 + 2] = 0;
        noiseData[i * 4 + 3] = 1.0; // Alpha channel
      }

      this.noiseTexture = this.device.createTexture({
        label: 'ssao-noise',
        size: [noiseSize, noiseSize, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      // Upload noise data directly via writeTexture (rgba16float supports Float32 input)
      // rgba16float: 4 components, each 2 bytes in texture, but we write as Float32 (4 bytes)
      this.device.queue.writeTexture(
        { texture: this.noiseTexture },
        noiseData.buffer as ArrayBuffer,
        { bytesPerRow: noiseSize * 16, rowsPerImage: noiseSize }, // 4 components * 4 bytes Float32
        { width: noiseSize, height: noiseSize, depthOrArrayLayers: 1 }
      );
    }

    // Generate sample kernel (hemisphere oriented along normal)
    // Shader expects max(sampleCount, 64) samples, so always generate 64 to match shader declaration
    if (!this.sampleBuffer) {
      const maxSamples = Math.max(this.config.sampleCount, 64);
      const samples = this.generateSampleKernel(maxSamples);
      const sampleData = new Float32Array(samples.length * 4); // vec4 aligned
      for (let i = 0; i < samples.length; i++) {
        sampleData[i * 4 + 0] = samples[i]![0];
        sampleData[i * 4 + 1] = samples[i]![1];
        sampleData[i * 4 + 2] = samples[i]![2];
        sampleData[i * 4 + 3] = 0; // padding
      }

      // Uniform buffer must be at least 1024 bytes (64 samples * 16 bytes per vec4)
      // WebGPU pads uniform buffers to multiples of 16 bytes
      this.sampleBuffer = this.device.createBuffer({
        label: 'ssao-samples',
        size: sampleData.byteLength, // This will be 1024 bytes for 64 samples
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(this.sampleBuffer, 0, sampleData);
    }

    // Create config uniform buffer
    if (!this.configBuffer) {
      this.configBuffer = this.device.createBuffer({
        label: 'ssao-config',
        size: 160, // 10 vec4s = 40 floats = 160 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }

    // Create bind group layout
    // Note: We use textureLoad for depth (which works with both multisampled and non-multisampled)
    // so we don't need a sampler for depth - textureLoad reads directly
    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'ssao-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } }, // normals
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // noise
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, // For normalTex and noiseTex
          { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // samples
          { binding: 5, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // config
        ],
      });
    }

    // Create render pipeline (recreate if needed to ensure valid state)
    const shader = this.createSSAOShader();
    try {
      this.pipeline = this.device.createRenderPipeline({
        label: 'ssao-pipeline',
        layout: this.device.createPipelineLayout({
          bindGroupLayouts: [this.bindGroupLayout],
        }),
        vertex: {
          module: this.device.createShaderModule({
            code: `
struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs_fullscreen(@builtin(vertex_index) vid:u32)->VSOut{
  var o:VSOut; let x=f32((vid<<1u)&2u); let y=f32(vid&2u); 
  o.pos=vec4<f32>(x*2.0-1.0, y*-2.0+1.0, 0.0, 1.0); 
  o.uv=vec2<f32>(x,y); return o;
}`,
          }),
          entryPoint: 'vs_fullscreen',
        },
        fragment: {
          module: this.device.createShaderModule({ code: shader }),
          entryPoint: 'fs_main',
          targets: [{ format }],
        },
        primitive: { topology: 'triangle-list' },
        multisample: { count: 1 }, // Single-sampled post-processing pass
      });
    } catch (err) {
      Logger.error('Failed to create SSAO pipeline:', err as unknown as Error);
      this.pipeline = null;
    }
  }

  /**
   * Generates sample kernel with distribution bias toward origin
   */
  private generateSampleKernel(count: number): Array<[number, number, number]> {
    const samples: Array<[number, number, number]> = [];
    for (let i = 0; i < count; i++) {
      // Sample in hemisphere with distribution biased toward origin
      let x = (Math.random() * 2 - 1);
      let y = (Math.random() * 2 - 1);
      let z = Math.random(); // Always positive (hemisphere)

      const scale = i / count;
      // Scale samples s.t. they're more aligned to center of hemisphere
      const s = 0.1 + scale * scale * 0.9; // lerp(0.1, 1.0, scale^2)
      x *= s;
      y *= s;
      z = 0.1 + z * s * 0.9; // Bias toward surface

      // Normalize
      const len = Math.sqrt(x * x + y * y + z * z);
      if (len > 0.0001) {
        samples.push([x / len, y / len, z / len]);
      } else {
        samples.push([0, 0, 1]);
      }
    }
    return samples;
  }

  /**
   * Creates SSAO shader code
   */
  private createSSAOShader(): string {
    const maxSamples = Math.max(this.config.sampleCount, 64);
    return `
struct SSAOConfig {
  radius: f32,
  intensity: f32,
  bias: f32,
  sampleCount: u32,
  screenSize: vec2<f32>,
  projectionMatrix: mat4x4<f32>,
  projectionMatrixInv: mat4x4<f32>,
}

@group(0) @binding(0) var depthTex : texture_depth_2d;
@group(0) @binding(1) var normalTex : texture_2d<f32>;
@group(0) @binding(2) var noiseTex : texture_2d<f32>;
@group(0) @binding(3) var normalSmp : sampler;
@group(0) @binding(4) var<uniform> samples : array<vec4<f32>, ${maxSamples}>;
@group(0) @binding(5) var<uniform> config : SSAOConfig;

fn viewPosFromDepth(uv: vec2<f32>, depth: f32) -> vec3<f32> {
  let clipPos = vec4<f32>(uv * 2.0 - 1.0, depth, 1.0);
  let viewPosH = config.projectionMatrixInv * clipPos;
  return viewPosH.xyz / viewPosH.w;
}

fn rand(vec: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    fract(sin(dot(vec, vec2<f32>(12.9898, 78.233))) * 43758.5453),
    fract(sin(dot(vec, vec2<f32>(12.9898, 78.233) * 2.0)) * 43758.5453)
  );
}

// Manual bilinear filtering for depth texture
fn sampleDepthBilinear(depthTex: texture_depth_2d, uv: vec2<f32>, screenSize: vec2<f32>) -> f32 {
  let texSize = vec2<f32>(textureDimensions(depthTex, 0));
  let pixelCoord = uv * texSize;
  let i = vec2<i32>(floor(pixelCoord));
  let f = pixelCoord - vec2<f32>(i);
  
  // Clamp coordinates to texture bounds
  let size = vec2<i32>(textureDimensions(depthTex, 0));
  let maxCoord = size - vec2<i32>(1, 1);
  
  // Sample 4 corners with clamping (textureLoad on depth returns f32 directly)
  let c00 = vec2<i32>(min(max(i.x, 0), maxCoord.x), min(max(i.y, 0), maxCoord.y));
  let c10 = vec2<i32>(min(max(i.x + 1, 0), maxCoord.x), min(max(i.y, 0), maxCoord.y));
  let c01 = vec2<i32>(min(max(i.x, 0), maxCoord.x), min(max(i.y + 1, 0), maxCoord.y));
  let c11 = vec2<i32>(min(max(i.x + 1, 0), maxCoord.x), min(max(i.y + 1, 0), maxCoord.y));
  
  let d00 = textureLoad(depthTex, c00, 0);
  let d10 = textureLoad(depthTex, c10, 0);
  let d01 = textureLoad(depthTex, c01, 0);
  let d11 = textureLoad(depthTex, c11, 0);
  
  // Bilinear interpolation
  let d0 = mix(d00, d10, f.x);
  let d1 = mix(d01, d11, f.x);
  return mix(d0, d1, f.y);
}

@fragment
fn fs_main(@location(0) v_uv: vec2<f32>) -> @location(0) vec4<f32> {
  // Sample all textures FIRST to maintain uniform control flow
  // Use textureLoad with bilinear filtering for depth (works with both multisampled and non-multisampled)
  let depth = sampleDepthBilinear(depthTex, v_uv, config.screenSize);
  let normalEncoded = textureSample(normalTex, normalSmp, v_uv).xyz;
  
  // Noise texture sampling
  let texSize = vec2<f32>(textureDimensions(noiseTex, 0));
  let noiseUV = v_uv * (config.screenSize / texSize);
  let noiseSample = textureSample(noiseTex, normalSmp, noiseUV);
  
  // Default to white (no occlusion) for background pixels
  var result = vec4<f32>(1.0, 1.0, 1.0, 1.0);
  
  // Check if this is a valid surface pixel (not background)
  let isSurface = select(0.0, 1.0, depth < 0.999);
  
  // Always compute view position and decode normal (needed for occlusion calculation)
  let viewPos = viewPosFromDepth(v_uv, depth);
  let normal = normalize(normalEncoded * 2.0 - 1.0);
  
  // Random rotation vector from noise texture
  // Noise texture stores (cos(angle), sin(angle), 0, 1) in rgba16float format
  // Values are in [-1,1] range stored directly as float16 (not encoded)
  // Extract rotation vector (cos, sin, 0) and normalize
  let randomVec = normalize(vec3<f32>(noiseSample.xy, 0.0));
  
  // Create TBN matrix (Tangent-Bitangent-Normal)
  let tangent = normalize(randomVec - normal * dot(randomVec, normal));
  let bitangent = cross(normal, tangent);
  let tbn = mat3x3<f32>(
    tangent.x, bitangent.x, normal.x,
    tangent.y, bitangent.y, normal.y,
    tangent.z, bitangent.z, normal.z
  );
  
  // Sample occlusion - execute loop in uniform control flow
  var occlusion = 0.0;
  let sampleCount = min(config.sampleCount, 64u);
  
  // Pre-sample all depths in uniform control flow to avoid non-uniform textureSample calls
  for (var i = 0u; i < sampleCount; i++) {
    // Get sample position in tangent space
    let sampleTS = samples[i].xyz;
    // Transform to view space
    let sampleVS = tbn * sampleTS;
    // Position sample in view space
    let samplePos = viewPos + sampleVS * config.radius;
    
    // Project sample position to screen space
    let sampleClip = config.projectionMatrix * vec4<f32>(samplePos, 1.0);
    let sampleNDC = sampleClip.xyz / sampleClip.w;
    let sampleUV = sampleNDC.xy * 0.5 + 0.5;
    
    // Sample depth at sample position (always executed in uniform control flow)
    // Use bilinear filtered depth sampling
    let sampleDepth = sampleDepthBilinear(depthTex, sampleUV, config.screenSize);
    let sampleViewPos = viewPosFromDepth(sampleUV, sampleDepth);
    
    // Range check and accumulate (only if this is a surface pixel)
    let rangeCheck = smoothstep(0.0, 1.0, config.radius / abs(viewPos.z - sampleViewPos.z));
    let isOccluded = select(0.0, 1.0, sampleViewPos.z >= samplePos.z + config.bias);
    occlusion += rangeCheck * isOccluded * isSurface;
  }
  
  // Compute final occlusion only for surface pixels
  occlusion = 1.0 - (occlusion / f32(sampleCount));
  occlusion = pow(max(occlusion, 0.0), config.intensity);
  
  // Use select to return occlusion for surface, white for background
  result = vec4<f32>(
    select(1.0, occlusion, depth < 0.999),
    select(1.0, occlusion, depth < 0.999),
    select(1.0, occlusion, depth < 0.999),
    1.0
  );
  
  return result;
}`;
  }

  /**
   * Invalidates cached bind group (call when views change)
   */
  private invalidateBindGroup(): void {
    this.cachedBindGroup = null;
    this.cachedDepthView = null;
    this.cachedNormalView = null;
    this.cachedOutputView = null;
  }

  /**
   * Updates configuration uniform buffer
   */
  private updateConfig(width: number, height: number, projectionMatrix: Float32Array, projectionMatrixInv: Float32Array): void {
    if (!this.configBuffer) return;

    // Write config: radius, intensity, bias, sampleCount (vec4)
    // screenSize (vec2), pad, projectionMatrix (mat4x4 = 4 vec4s), projectionMatrixInv (mat4x4 = 4 vec4s)
    // Total: 1 vec4 + 1 vec2+pad + 8 vec4s = 10 vec4s = 40 floats = 160 bytes
    const data = new Float32Array(40);
    let offset = 0;
    // First vec4: radius, intensity, bias, sampleCount
    data[offset++] = this.config.radius;
    data[offset++] = this.config.intensity;
    data[offset++] = this.config.bias;
    data[offset++] = this.config.sampleCount;
    // screenSize + padding
    data[offset++] = width;
    data[offset++] = height;
    data[offset++] = 0; // pad
    data[offset++] = 0; // pad
    // projectionMatrix (column-major, 4 vec4s)
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        data[offset++] = projectionMatrix[row * 4 + col]!;
      }
    }
    // projectionMatrixInv (column-major, 4 vec4s)
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        data[offset++] = projectionMatrixInv[row * 4 + col]!;
      }
    }

    this.device.queue.writeBuffer(this.configBuffer, 0, data);
  }

  /**
   * Renders SSAO pass
   */
  render(
    encoder: GPUCommandEncoder,
    depthView: GPUTextureView,
    normalView: GPUTextureView,
    outputView: GPUTextureView,
    width: number,
    height: number,
    projectionMatrix: Float32Array,
    projectionMatrixInv: Float32Array,
    opts?: { querySet?: GPUQuerySet; begin?: number; end?: number }
  ): void {
    if (!this.pipeline || !this.bindGroupLayout || !this.sampler || !this.noiseTexture || !this.sampleBuffer || !this.configBuffer) {
      return;
    }

    // Update config buffer
    this.updateConfig(width, height, projectionMatrix, projectionMatrixInv);

    // Create/reuse bind group
    if (!this.cachedBindGroup || 
        this.cachedDepthView !== depthView || 
        this.cachedNormalView !== normalView || 
        this.cachedOutputView !== outputView) {
      this.cachedBindGroup = this.device.createBindGroup({
        label: 'ssao-bg',
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: depthView },
          { binding: 1, resource: normalView },
          { binding: 2, resource: this.noiseTexture.createView() },
          { binding: 3, resource: this.sampler },
          { binding: 4, resource: { buffer: this.sampleBuffer } },
          { binding: 5, resource: { buffer: this.configBuffer } },
        ],
      });
      this.cachedDepthView = depthView;
      this.cachedNormalView = normalView;
      this.cachedOutputView = outputView;
    }

    const passDesc: GPURenderPassDescriptor = {
      label: 'ssao-pass',
      colorAttachments: [{ view: outputView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 1, g: 1, b: 1, a: 1 } }],
      ...(opts?.querySet && typeof opts.begin === 'number' && typeof opts.end === 'number'
        ? {
            timestampWrites: {
              querySet: opts.querySet,
              beginningOfPassWriteIndex: opts.begin,
              endOfPassWriteIndex: opts.end,
            },
          }
        : {}),
    } as GPURenderPassDescriptor;

    const pass = encoder.beginRenderPass(passDesc);
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.cachedBindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }

  /**
   * Disposes resources
   */
  dispose(): void {
    try {
      this.noiseTexture?.destroy();
      this.sampleBuffer?.destroy();
      this.configBuffer?.destroy();
    } catch {
      // ignore
    }
    this.noiseTexture = null;
    this.sampleBuffer = null;
    this.configBuffer = null;
    this.pipeline = null;
    this.bindGroupLayout = null;
    this.sampler = null;
    this.invalidateBindGroup();
  }
}

