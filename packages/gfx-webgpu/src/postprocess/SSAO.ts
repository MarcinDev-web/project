/**
 * Screen Space Ambient Occlusion (SSAO)
 * 
 * Adds depth and realism by darkening areas where geometry occludes ambient light.
 * Uses a high-quality implementation with temporal accumulation for smoothness.
 */

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
    // Create sampler for depth and normals
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
    if (!this.sampleBuffer) {
      const samples = this.generateSampleKernel(this.config.sampleCount);
      const sampleData = new Float32Array(samples.length * 4); // vec4 aligned
      for (let i = 0; i < samples.length; i++) {
        sampleData[i * 4 + 0] = samples[i]![0];
        sampleData[i * 4 + 1] = samples[i]![1];
        sampleData[i * 4 + 2] = samples[i]![2];
        sampleData[i * 4 + 3] = 0; // padding
      }

      this.sampleBuffer = this.device.createBuffer({
        label: 'ssao-samples',
        size: sampleData.byteLength,
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
    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'ssao-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } }, // normals
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // noise
          { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // samples
          { binding: 5, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // config
        ],
      });
    }

    // Create render pipeline
    if (!this.pipeline) {
      const shader = this.createSSAOShader();
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
      });
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
@group(0) @binding(1) var depthSmp : sampler;
@group(0) @binding(2) var normalTex : texture_2d<f32>;
@group(0) @binding(3) var noiseTex : texture_2d<f32>;
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

@fragment
fn fs_main(@location(0) v_uv: vec2<f32>) -> @location(0) vec4<f32> {
  let depth = textureSample(depthTex, depthSmp, v_uv);
  if (depth >= 0.999) { return vec4<f32>(1.0, 1.0, 1.0, 1.0); } // Skip background
  
  let viewPos = viewPosFromDepth(v_uv, depth);
  // Decode normal from [0,1] range back to [-1,1]
  let normalEncoded = textureSample(normalTex, depthSmp, v_uv).xyz;
  let normal = normalize(normalEncoded * 2.0 - 1.0);
  
  // Random rotation vector from noise texture
  // Noise texture stores (cos(angle), sin(angle), 0, 1) in rgba16float format
  // Values are in [-1,1] range stored directly as float16 (not encoded)
  let texSize = vec2<f32>(textureDimensions(noiseTex, 0));
  let noiseUV = v_uv * (config.screenSize / texSize);
  let noiseSample = textureSample(noiseTex, depthSmp, noiseUV);
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
  
  // Sample occlusion
  var occlusion = 0.0;
  let sampleCount = min(config.sampleCount, 64u);
  
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
    
    // Sample depth at sample position
    let sampleDepth = textureSample(depthTex, depthSmp, sampleUV);
    let sampleViewPos = viewPosFromDepth(sampleUV, sampleDepth);
    
    // Range check and accumulate
    let rangeCheck = smoothstep(0.0, 1.0, config.radius / abs(viewPos.z - sampleViewPos.z));
    if (sampleViewPos.z >= samplePos.z + config.bias) {
      occlusion += rangeCheck;
    }
  }
  
  occlusion = 1.0 - (occlusion / f32(sampleCount));
  occlusion = pow(max(occlusion, 0.0), config.intensity);
  
  return vec4<f32>(occlusion, occlusion, occlusion, 1.0);
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
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: normalView },
          { binding: 3, resource: this.noiseTexture.createView() },
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

