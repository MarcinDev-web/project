/**
 * Procedural Weather Map Generator
 * 
 * Generates a 2D weather map texture using GPU compute shaders.
 * The weather map controls cloud coverage, type, and precipitation.
 * 
 * Channels:
 * - R: Cloud coverage (0-1)
 * - G: Cloud type (0=stratus, 0.5=stratocumulus, 1=cumulus)
 * - B: Precipitation/density multiplier
 * - A: Wind distortion factor
 */

/**
 * Weather map generation parameters
 */
export interface WeatherMapParams {
  /** Base coverage level (0-1), default 0.5 */
  coverage: number;
  /** Animation time in seconds */
  time: number;
  /** Wind speed multiplier for animation */
  windSpeed: number;
  /** Wind direction in radians */
  windDirection: number;
  /** Scale of weather patterns (larger = bigger clouds) */
  patternScale: number;
  /** Seed for deterministic generation */
  seed: number;
}

const DEFAULT_WEATHER_PARAMS: WeatherMapParams = {
  coverage: 0.5,
  time: 0,
  windSpeed: 0.01,
  windDirection: 0,
  patternScale: 1.0,
  seed: 12345,
};

/**
 * WGSL Compute Shader for Weather Map Generation
 */
const WEATHER_MAP_SHADER = /* wgsl */ `
// Weather Map Generator Compute Shader
// Generates procedural weather patterns for volumetric clouds

struct WeatherUniforms {
  size: u32,
  coverage: f32,
  time: f32,
  windSpeed: f32,
  windDirX: f32,
  windDirY: f32,
  patternScale: f32,
  seed: f32,
}

@group(0) @binding(0) var<uniform> u: WeatherUniforms;
@group(0) @binding(1) var outputTexture: texture_storage_2d<rgba8unorm, write>;

// ========== Noise Functions ==========

// Hash function for pseudo-random values
fn hash2(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn hash22(p: vec2<f32>) -> vec2<f32> {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// 2D Value noise with quintic interpolation
fn noise2D(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  
  // Quintic interpolation for C2 continuity
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  
  let a = hash2(i + vec2<f32>(0.0, 0.0));
  let b = hash2(i + vec2<f32>(1.0, 0.0));
  let c = hash2(i + vec2<f32>(0.0, 1.0));
  let d = hash2(i + vec2<f32>(1.0, 1.0));
  
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian Motion (FBM)
fn fbm(p: vec2<f32>, octaves: i32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var pos = p;
  var totalAmplitude = 0.0;
  
  for (var i = 0; i < octaves; i++) {
    value += amplitude * noise2D(pos);
    totalAmplitude += amplitude;
    pos *= 2.0;
    amplitude *= 0.5;
  }
  
  return value / totalAmplitude;
}

// Worley noise (cellular) for cloud type variation
fn worley2D(p: vec2<f32>) -> f32 {
  let cell = floor(p);
  var minDist = 1.0;
  
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let neighbor = cell + vec2<f32>(f32(x), f32(y));
      let point = neighbor + hash22(neighbor + vec2<f32>(u.seed));
      let diff = point - p;
      minDist = min(minDist, dot(diff, diff));
    }
  }
  
  return sqrt(minDist);
}

// ========== Weather Generation ==========

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let texSize = f32(u.size);
  if (gid.x >= u.size || gid.y >= u.size) { return; }
  
  // Normalized UV coordinates
  let uv = vec2<f32>(f32(gid.x) / texSize, f32(gid.y) / texSize);
  
  // Wind offset for animation
  let windDir = normalize(vec2<f32>(u.windDirX, u.windDirY));
  let windOffset = windDir * u.time * u.windSpeed;
  
  // Sample position with wind and scale
  let samplePos = (uv + windOffset) * u.patternScale;
  
  // === Coverage (R channel) ===
  // Multi-octave FBM for natural cloud distribution
  var coverage = fbm(samplePos * 0.5 + vec2<f32>(u.seed * 0.01), 5);
  
  // Add larger-scale variation
  coverage += fbm(samplePos * 0.2, 3) * 0.3;
  
  // Remap with coverage control
  coverage = smoothstep(0.3 - u.coverage * 0.3, 0.7 - u.coverage * 0.2, coverage);
  coverage = saturate(coverage);
  
  // === Cloud Type (G channel) ===
  // 0 = stratus (flat), 0.5 = stratocumulus, 1 = cumulus (puffy)
  var cloudType = fbm(samplePos * 0.3 + vec2<f32>(100.0 + u.seed), 4);
  
  // Add Worley influence for cell-like cumulus distribution
  let worleyInfluence = worley2D(samplePos * 2.0);
  cloudType = mix(cloudType, 1.0 - worleyInfluence, 0.3);
  cloudType = saturate(cloudType);
  
  // === Precipitation (B channel) ===
  // Higher coverage = more likely precipitation
  var precipitation = smoothstep(0.6, 0.9, coverage);
  precipitation *= fbm(samplePos * 1.0 + vec2<f32>(200.0), 3);
  precipitation = saturate(precipitation);
  
  // === Wind Distortion (A channel) ===
  // Used for detail noise offset
  var windDistortion = fbm(samplePos * 0.8 + windOffset * 2.0, 3);
  windDistortion = windDistortion * 0.5 + 0.5; // Remap to 0-1
  
  // Write output
  let outputColor = vec4<f32>(coverage, cloudType, precipitation, windDistortion);
  textureStore(outputTexture, vec2<i32>(gid.xy), outputColor);
}
`;

/**
 * Procedural Weather Map Generator
 * 
 * Creates and manages a GPU-generated weather map texture for cloud rendering.
 */
export class ProceduralWeatherMap {
  private device: GPUDevice | null = null;
  private computePipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private weatherTexture: GPUTexture | null = null;
  private weatherTextureView: GPUTextureView | null = null;
  private sampler: GPUSampler | null = null;
  
  private size: number;
  private initialized = false;
  private lastUpdateTime = 0;
  private updateInterval: number; // ms between updates
  
  // Reusable uniform data array
  private uniformData = new Float32Array(8);
  
  /**
   * Create a new weather map generator
   * @param size Texture size (power of 2 recommended), default 256
   * @param updateInterval Milliseconds between GPU updates, default 100 (10 FPS)
   */
  constructor(size = 256, updateInterval = 100) {
    this.size = size;
    this.updateInterval = updateInterval;
  }
  
  /**
   * Initialize GPU resources
   * @param device WebGPU device
   */
  async initialize(device: GPUDevice): Promise<void> {
    this.device = device;
    
    // Create shader module
    const shaderModule = device.createShaderModule({
      label: 'Weather Map Compute Shader',
      code: WEATHER_MAP_SHADER,
    });
    
    // Create bind group layout
    this.bindGroupLayout = device.createBindGroupLayout({
      label: 'Weather Map Bind Group Layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: 'write-only',
            format: 'rgba8unorm',
          },
        },
      ],
    });
    
    // Create pipeline
    this.computePipeline = device.createComputePipeline({
      label: 'Weather Map Compute Pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });
    
    // Create uniform buffer
    // WeatherUniforms: u32 + 7*f32 = 32 bytes
    this.uniformBuffer = device.createBuffer({
      label: 'Weather Map Uniforms',
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Create weather texture
    this.weatherTexture = device.createTexture({
      label: 'Weather Map Texture',
      size: [this.size, this.size, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    });
    
    this.weatherTextureView = this.weatherTexture.createView({
      label: 'Weather Map Texture View',
    });
    
    // Create sampler for reading in fragment shaders
    this.sampler = device.createSampler({
      label: 'Weather Map Sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });
    
    this.initialized = true;
    
    // Generate initial weather map
    await this.update(DEFAULT_WEATHER_PARAMS);
  }
  
  /**
   * Update the weather map with new parameters
   * @param params Weather generation parameters
   * @param force Force update even if within update interval
   */
  async update(params: Partial<WeatherMapParams> = {}, force = false): Promise<void> {
    if (!this.initialized || !this.device || !this.computePipeline || !this.uniformBuffer || !this.weatherTexture || !this.bindGroupLayout) {
      return;
    }
    
    // Throttle updates
    const now = performance.now();
    if (!force && now - this.lastUpdateTime < this.updateInterval) {
      return;
    }
    this.lastUpdateTime = now;
    
    const fullParams = { ...DEFAULT_WEATHER_PARAMS, ...params };
    
    // Calculate wind direction components
    const windDirX = Math.cos(fullParams.windDirection);
    const windDirY = Math.sin(fullParams.windDirection);
    
    // Pack uniforms
    const uniformView = new DataView(this.uniformData.buffer);
    uniformView.setUint32(0, this.size, true);           // size
    uniformView.setFloat32(4, fullParams.coverage, true); // coverage
    uniformView.setFloat32(8, fullParams.time, true);     // time
    uniformView.setFloat32(12, fullParams.windSpeed, true); // windSpeed
    uniformView.setFloat32(16, windDirX, true);           // windDirX
    uniformView.setFloat32(20, windDirY, true);           // windDirY
    uniformView.setFloat32(24, fullParams.patternScale, true); // patternScale
    uniformView.setFloat32(28, fullParams.seed, true);    // seed
    
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
    
    // Create bind group
    const bindGroup = this.device.createBindGroup({
      label: 'Weather Map Bind Group',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.weatherTexture.createView() },
      ],
    });
    
    // Dispatch compute shader
    const encoder = this.device.createCommandEncoder({ label: 'Weather Map Encoder' });
    const pass = encoder.beginComputePass({ label: 'Weather Map Pass' });
    pass.setPipeline(this.computePipeline);
    pass.setBindGroup(0, bindGroup);
    
    const workgroupSize = 8;
    const workgroupsX = Math.ceil(this.size / workgroupSize);
    const workgroupsY = Math.ceil(this.size / workgroupSize);
    pass.dispatchWorkgroups(workgroupsX, workgroupsY);
    pass.end();
    
    this.device.queue.submit([encoder.finish()]);
  }
  
  /**
   * Get the weather texture for binding in shaders
   */
  getTexture(): GPUTexture | null {
    return this.weatherTexture;
  }
  
  /**
   * Get the weather texture view for binding in shaders
   */
  getTextureView(): GPUTextureView | null {
    return this.weatherTextureView;
  }
  
  /**
   * Get the sampler for the weather texture
   */
  getSampler(): GPUSampler | null {
    return this.sampler;
  }
  
  /**
   * Get texture size
   */
  getSize(): number {
    return this.size;
  }
  
  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Resize the weather map texture
   * @param newSize New texture size
   */
  async resize(newSize: number): Promise<void> {
    if (!this.device || newSize === this.size) return;
    
    this.size = newSize;
    
    // Destroy old texture
    if (this.weatherTexture) {
      this.weatherTexture.destroy();
    }
    
    // Create new texture
    this.weatherTexture = this.device.createTexture({
      label: 'Weather Map Texture',
      size: [this.size, this.size, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    });
    
    this.weatherTextureView = this.weatherTexture.createView({
      label: 'Weather Map Texture View',
    });
    
    // Force update with new size
    await this.update({}, true);
  }
  
  /**
   * Set update interval
   * @param interval Milliseconds between updates
   */
  setUpdateInterval(interval: number): void {
    this.updateInterval = Math.max(16, interval); // Minimum 60 FPS
  }
  
  /**
   * Cleanup GPU resources
   */
  dispose(): void {
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }
    if (this.weatherTexture) {
      this.weatherTexture.destroy();
      this.weatherTexture = null;
    }
    this.weatherTextureView = null;
    this.sampler = null;
    this.computePipeline = null;
    this.bindGroupLayout = null;
    this.device = null;
    this.initialized = false;
  }
}

