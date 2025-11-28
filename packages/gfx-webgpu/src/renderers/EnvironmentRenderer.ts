import type { Mat4, Vec3 } from '@engine/core/math';
import type { EnvironmentComponent } from '@engine/world';
import { BrdfLutPass } from '../postprocess/BrdfLut';
import { loadHdrFile, parseHdrFile } from '../resources/HdrLoader';
import { createProceduralCloudyHdr } from '../textures/ProceduralSkyCubemap';
import { VolumetricCloudPass, type VolumetricCloudParams } from './VolumetricCloudPass';

/**
 * Skybox vertex shader - renders a full-screen quad at far plane
 */
const SKYBOX_VERTEX_SHADER = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) viewDirection: vec3f,
}

struct Uniforms {
  inverseViewProjection: mat4x4f,
  cameraPosition: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  
  // Full-screen triangle (covers NDC space)
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  
  let pos = positions[vertexIndex];
  output.position = vec4f(pos, 1.0, 1.0); // At far plane
  
  // Transform NDC position to view direction
  let worldPos = uniforms.inverseViewProjection * vec4f(pos, 1.0, 1.0);
  output.viewDirection = normalize(worldPos.xyz / worldPos.w - uniforms.cameraPosition);
  
  return output;
}
`;

/**
 * Solid color skybox fragment shader
 */
const SKYBOX_SOLID_FRAGMENT_SHADER = /* wgsl */ `
struct FragmentInput {
  @location(0) viewDirection: vec3f,
}

struct SkyboxParams {
  skyColor: vec3f,
  _pad0: f32,
}

@group(1) @binding(0) var<uniform> params: SkyboxParams;

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  return vec4f(params.skyColor, 1.0);
}
`;

/**
 * Gradient skybox fragment shader
 */
const SKYBOX_GRADIENT_FRAGMENT_SHADER = /* wgsl */ `
struct FragmentInput {
  @location(0) viewDirection: vec3f,
}

struct SkyboxParams {
  skyColor: vec3f,
  _pad0: f32,
  horizonColor: vec3f,
  _pad1: f32,
  groundColor: vec3f,
  _pad2: f32,
}

@group(1) @binding(0) var<uniform> params: SkyboxParams;

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  let dir = normalize(input.viewDirection);
  let elevation = dir.y;
  
  var color: vec3f;
  
  if (elevation > 0.0) {
    // Above horizon: blend from horizon to sky
    let t = pow(elevation, 0.5);
    color = mix(params.horizonColor, params.skyColor, t);
  } else {
    // Below horizon: blend from horizon to ground
    let t = pow(-elevation, 0.5);
    color = mix(params.horizonColor, params.groundColor, t);
  }
  
  return vec4f(color, 1.0);
}
`;

/**
 * Cubemap skybox fragment shader
 */
const SKYBOX_CUBEMAP_FRAGMENT_SHADER = /* wgsl */ `
struct FragmentInput {
  @location(0) viewDirection: vec3f,
}

@group(1) @binding(0) var<uniform> _placeholder: f32; // Placeholder for bind group layout compatibility
@group(1) @binding(1) var cubemapSampler: sampler;
@group(1) @binding(2) var cubemapTexture: texture_cube<f32>;

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  let dir = normalize(input.viewDirection);
  let color = textureSample(cubemapTexture, cubemapSampler, dir);
  return color;
}
`;

/**
 * Shared atmospheric scattering function template
 * Parameters: viewDir (normalized), sunDir (normalized), params (SkyboxParams struct reference)
 */
const ATMOSPHERIC_SCATTERING_FUNCTION = /* wgsl */ `
// Simple atmospheric scattering approximation
fn atmosphericScattering(viewDir: vec3f, sunDir: vec3f, skyColor: vec3f, horizonColor: vec3f, sunColor: vec3f, sunIntensity: f32) -> vec3f {
  let elevation = viewDir.y;
  let sunDot = max(dot(viewDir, sunDir), 0.0);
  
  // Sky gradient based on elevation
  let skyGradient = pow(max(elevation, 0.0), 0.4);
  let horizonFade = pow(1.0 - abs(elevation), 2.0);
  
  // Base sky color
  var baseSkyColor = mix(horizonColor, skyColor, skyGradient);
  
  // Sun contribution
  let sunRadius = 0.02;
  let sunGlow = pow(sunDot, 512.0); // Sharp sun disc
  let sunHalo = pow(sunDot, 8.0) * 0.5; // Soft glow around sun
  
  let sunContribution = (sunGlow + sunHalo) * sunColor * sunIntensity;
  
  // Atmospheric glow near horizon when looking toward sun
  let atmosphericGlow = horizonFade * pow(max(dot(viewDir, sunDir), 0.0), 4.0) * sunColor * 0.3;
  
  return baseSkyColor + sunContribution + atmosphericGlow;
}
`;

/**
 * Simple 2D noise function for clouds
 */
const CLOUD_NOISE_FUNCTION = /* wgsl */ `
// Simple hash function for pseudo-random values
fn hash(p: vec2<f32>) -> f32 {
  var p2 = fract(p * vec2<f32>(233.34, 441.33));
  let d = dot(p2, p2 + vec2<f32>(23.45, 23.45));
  p2 = p2 + vec2<f32>(d, d);
  return fract(p2.x * p2.y);
}

// 2D noise function
fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  var f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  let a = hash(i);
  let b = hash(i + vec2<f32>(1.0, 0.0));
  let c = hash(i + vec2<f32>(0.0, 1.0));
  let d = hash(i + vec2<f32>(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal noise for cloud-like patterns
fn fbm(p: vec2<f32>) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  
  for (var i = 0u; i < 4u; i++) {
    value += amplitude * noise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  
  return value;
}

// Generate cloud coverage based on view direction
fn generateClouds(viewDir: vec3<f32>, cloudDensity: f32, cloudSpeed: f32, time: f32) -> f32 {
  // Project view direction onto horizontal plane for UV
  let uv = vec2<f32>(viewDir.xz) * 0.5 + 0.5;
  
  // Animate clouds
  let animatedUV = uv + vec2<f32>(time * cloudSpeed, time * cloudSpeed * 0.7);
  
  // Generate cloud pattern (higher elevation = more clouds)
  let elevationFactor = pow(max(viewDir.y, 0.0), 0.65);
  var cloudPattern = clamp(fbm(animatedUV * 2.0) * 1.1, 0.0, 1.0);
  
  // Combine with density and elevation
  let cloudCoverage = cloudPattern * cloudDensity * elevationFactor;
  
  return smoothstep(0.2, 0.65, cloudCoverage);
}
`;

/**
 * Procedural sky fragment shader with atmospheric scattering approximation.
 * Note: 2D clouds removed - volumetric clouds are rendered as a separate pass via VolumetricCloudPass.
 */
const SKYBOX_PROCEDURAL_FRAGMENT_SHADER = /* wgsl */ `
struct FragmentInput {
  @location(0) viewDirection: vec3f,
}

struct SkyboxParams {
  skyColor: vec3f,
  _pad0: f32,
  horizonColor: vec3f,
  _pad1: f32,
  sunDirection: vec3f,
  _pad2: f32,
  sunColor: vec3f,
  sunIntensity: f32,
  // Cloud params kept for buffer compatibility but not used in main shader
  // Volumetric clouds rendered separately via VolumetricCloudPass
  cloudsEnabled: f32,
  cloudDensity: f32,
  cloudSpeed: f32,
  cloudTime: f32,
}

@group(1) @binding(0) var<uniform> params: SkyboxParams;

${ATMOSPHERIC_SCATTERING_FUNCTION}

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  let viewDir = normalize(input.viewDirection);
  let sunDir = normalize(params.sunDirection);
  
  // Pure atmospheric scattering - volumetric clouds rendered in separate pass
  let color = atmosphericScattering(viewDir, sunDir, params.skyColor, params.horizonColor, params.sunColor, params.sunIntensity);
  
  return vec4f(color, 1.0);
}
`;

/**
 * Physical Sky fragment shader with Rayleigh and Mie scattering
 * Based on Preetham/Hosek-Wilkie sky model for realistic atmospheric rendering
 */
const SKYBOX_PHYSICAL_SKY_FRAGMENT_SHADER = /* wgsl */ `
struct FragmentInput {
  @location(0) viewDirection: vec3f,
}

struct PhysicalSkyParams {
  sunDirection: vec3f,
  rayleigh: f32,
  sunColor: vec3f,
  turbidity: f32,
  mieCoefficient: f32,
  mieDirectionalG: f32,
  exposure: f32,
  _pad0: f32,
}

@group(1) @binding(0) var<uniform> params: PhysicalSkyParams;

// Physical constants
const PI: f32 = 3.141592653589793;
const E: f32 = 2.718281828459045;

// Refractive index of air
const n: f32 = 1.0003;
// Number of molecules per unit volume at sea level
const N: f32 = 2.545e25;
// Depolarization factor for standard air
const pn: f32 = 0.035;

// Primary wavelengths in meters (RGB)
const WAVELENGTH: vec3f = vec3f(680e-9, 550e-9, 450e-9);

// Mie K factor
const MIE_K: vec3f = vec3f(0.686, 0.678, 0.666);

// Rayleigh zenith optical depth constants
const RAYLEIGH_ZENITH: vec3f = vec3f(8.4e3, 1.25e4, 2.1e4);

// Calculate Rayleigh scattering coefficient
fn totalRayleigh(lambda: vec3f) -> vec3f {
  let n2 = n * n - 1.0;
  let num = 8.0 * pow(PI, 3.0) * n2 * n2 * (6.0 + 3.0 * pn);
  let lambda4 = pow(lambda, vec3f(4.0));
  let denom = 3.0 * N * lambda4 * (6.0 - 7.0 * pn);
  return num / denom;
}

// Rayleigh phase function
fn rayleighPhase(cosTheta: f32) -> f32 {
  return (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
}

// Calculate Mie scattering coefficient
fn totalMie(lambda: vec3f, K: vec3f, T: f32) -> vec3f {
  let c = 0.2 * T * 10e-18;
  let lambda2 = pow((2.0 * PI) / lambda, vec3f(2.0));
  return 0.434 * c * PI * lambda2 * K;
}

// Henyey-Greenstein phase function for Mie scattering
fn hgPhase(cosTheta: f32, g: f32) -> f32 {
  let g2 = g * g;
  let num = 1.0 - g2;
  let denom = pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);
  return num / (4.0 * PI * denom);
}

// Optical depth for Rayleigh scattering
fn rayleighOpticalDepth(zenithAngle: f32) -> vec3f {
  // Approximate optical depth based on zenith angle
  let secZ = 1.0 / max(cos(zenithAngle), 0.001);
  return RAYLEIGH_ZENITH * secZ;
}

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  let viewDir = normalize(input.viewDirection);
  let sunDir = normalize(params.sunDirection);
  
  // Cosine of angle between view and sun
  let cosTheta = dot(viewDir, sunDir);
  
  // Zenith angle (angle from vertical)
  let zenithAngle = acos(max(viewDir.y, 0.0));
  
  // Sun zenith angle
  let sunZenithAngle = acos(max(sunDir.y, 0.0));
  
  // Calculate scattering coefficients
  let betaR = totalRayleigh(WAVELENGTH) * params.rayleigh;
  let betaM = totalMie(WAVELENGTH, MIE_K, params.turbidity) * params.mieCoefficient;
  
  // Optical depth along view direction
  let zenithFactor = 1.0 / max(viewDir.y + 0.15, 0.001);
  let sunZenithFactor = 1.0 / max(sunDir.y + 0.15, 0.001);
  
  // Rayleigh extinction
  let rayleighDepth = betaR * zenithFactor;
  let mieDepth = betaM * zenithFactor;
  
  // Phase functions
  let phaseR = rayleighPhase(cosTheta);
  let phaseM = hgPhase(cosTheta, params.mieDirectionalG);
  
  // Atmospheric optical depth
  let extinction = exp(-(rayleighDepth + mieDepth));
  
  // In-scattering (simplified)
  let rayleighScatter = betaR * phaseR;
  let mieScatter = betaM * phaseM;
  
  // Sun disk and halo
  let sunDisk = smoothstep(0.9998, 0.99985, cosTheta) * 5.0;
  let sunHalo = pow(max(cosTheta, 0.0), 256.0) * 2.0;
  
  // Calculate sky color
  let inscatter = (rayleighScatter + mieScatter);
  let fex = extinction;
  
  // Sky radiance
  var skyColor = inscatter * (1.0 - fex);
  
  // Add sunlight contribution
  let sunContrib = params.sunColor * (sunDisk + sunHalo) * extinction;
  skyColor = skyColor + sunContrib;
  
  // Ground color (simple gradient below horizon)
  if (viewDir.y < 0.0) {
    let groundFactor = pow(-viewDir.y, 0.5);
    let groundColor = vec3f(0.1, 0.1, 0.12);
    let horizonColor = skyColor;
    skyColor = mix(horizonColor, groundColor, groundFactor);
  }
  
  // Tone mapping with exposure
  let exposed = vec3f(1.0) - exp(-skyColor * params.exposure);
  
  // Gamma correction (sRGB)
  let gammaOut = pow(exposed, vec3f(1.0 / 2.2));
  
  return vec4f(gammaOut, 1.0);
}
`;

/**
 * Configuration for environment rendering pipeline
 */
interface EnvironmentRenderConfig {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  sampleCount?: number;
}

/**
 * EnvironmentRenderer handles skybox and atmospheric rendering
 */
export class EnvironmentRenderer {
  private device: GPUDevice;
  private pipelines: Map<string, GPURenderPipeline> = new Map();
  private uniformBindGroupLayout!: GPUBindGroupLayout;
  private paramsBindGroupLayout!: GPUBindGroupLayout;
  private cubemapBindGroupLayout!: GPUBindGroupLayout;
  private uniformBuffer!: GPUBuffer;
  private paramsBuffer!: GPUBuffer;
  private uniformBindGroup!: GPUBindGroup;
  private paramsBindGroups: Map<string, GPUBindGroup> = new Map();
  private cubemapBindGroup: GPUBindGroup | null = null;
  private cubemapSampler!: GPUSampler;
  private initialized = false;
  // IBL resources
  private brdfLut: GPUTexture | null = null;
  private envCube: GPUTexture | null = null;
  // Cubemap cache
  private cubemapCache: Map<string, GPUTexture> = new Map();
  private readonly defaultCubemapKey = '__procedural_cloudy_sky__';
  private defaultCubemap: GPUTexture | null = null;
  // IBL cache
  private iblCache: Map<string, { brdfLut: GPUTexture; envCube: GPUTexture; timestamp: number }> = new Map();
  private iblCacheMaxSize = 5;
  // Dirty flags
  private uniformsDirty = false;
  private paramsDirty = false;
  // Pipeline descriptor cache (for faster re-initialization)
  private pipelineDescriptorsCache: Map<string, GPURenderPipelineDescriptor> = new Map();
  // Cloud animation time
  private cloudTimeStart: number = 0;
  
  // Volumetric cloud pass
  private volumetricCloudPass: VolumetricCloudPass | null = null;
  private lastInverseViewProj: Mat4 | null = null;
  private lastCameraPosition: Vec3 | null = null;
  private presentationFormat: GPUTextureFormat = 'bgra8unorm';
  
  // Depth texture for cloud occlusion
  private currentDepthTextureView: GPUTextureView | null = null;

  constructor() {
    this.device = null!; // Will be set in initialize
    this.cloudTimeStart = performance.now() / 1000.0; // Start time in seconds
  }

  /**
   * Initializes the environment renderer with WebGPU resources
   */
  async initialize(config: EnvironmentRenderConfig): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.device = config.device;
    const sampleCount = config.sampleCount ?? 4;

    // Create bind group layouts
    this.uniformBindGroupLayout = this.device.createBindGroupLayout({
      label: 'environment-uniform-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.paramsBindGroupLayout = this.device.createBindGroupLayout({
      label: 'environment-params-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    // Cubemap bind group layout: placeholder uniform + sampler + texture
    this.cubemapBindGroupLayout = this.device.createBindGroupLayout({
      label: 'environment-cubemap-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { viewDimension: 'cube' },
        },
      ],
    });

    // Create cubemap sampler (linear filtering, clamp-to-edge)
    this.cubemapSampler = this.device.createSampler({
      label: 'environment-cubemap-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });

    // Create uniform buffers
    // Uniform buffer: inverseViewProjection (64 bytes) + cameraPosition (16 bytes) = 80 bytes
    this.uniformBuffer = this.device.createBuffer({
      label: 'environment-uniform-buffer',
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Params buffer: varies by skybox type, max 128 bytes (8 vec4s for procedural sky with clouds)
    this.paramsBuffer = this.device.createBuffer({
      label: 'environment-params-buffer',
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create bind groups
    this.uniformBindGroup = this.device.createBindGroup({
      label: 'environment-uniform-bind-group',
      layout: this.uniformBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });

    // Create pipeline for each skybox type
    await this.createPipeline('solid', SKYBOX_SOLID_FRAGMENT_SHADER, config.presentationFormat, sampleCount);
    await this.createPipeline('gradient', SKYBOX_GRADIENT_FRAGMENT_SHADER, config.presentationFormat, sampleCount);
    await this.createPipeline('procedural-sky', SKYBOX_PROCEDURAL_FRAGMENT_SHADER, config.presentationFormat, sampleCount);
    await this.createPipeline('physical-sky', SKYBOX_PHYSICAL_SKY_FRAGMENT_SHADER, config.presentationFormat, sampleCount);
    await this.createCubemapPipeline(config.presentationFormat, sampleCount);

    // Initialize volumetric cloud pass
    this.presentationFormat = config.presentationFormat;
    this.volumetricCloudPass = new VolumetricCloudPass();
    await this.volumetricCloudPass.initialize(this.device, config.presentationFormat, sampleCount);

    this.initialized = true;
    try {
      await this.ensureDefaultCubemap();
    } catch (err) {
      console.warn('EnvironmentRenderer: failed to create default cloudy cubemap', err);
    }
  }

  /**
   * Creates a render pipeline for a specific skybox type
   */
  private async createPipeline(
    type: string,
    fragmentShader: string,
    presentationFormat: GPUTextureFormat,
    sampleCount: number
  ): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: `environment-shader-${type}`,
      code: SKYBOX_VERTEX_SHADER + '\n' + fragmentShader,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: `environment-pipeline-layout-${type}`,
      bindGroupLayouts: [this.uniformBindGroupLayout, this.paramsBindGroupLayout],
    });

    const createPipeline = (desc: GPURenderPipelineDescriptor): GPURenderPipeline | Promise<GPURenderPipeline> => {
      const anyDevice = this.device as unknown as { createRenderPipelineAsync?: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>, createRenderPipeline: (d: GPURenderPipelineDescriptor) => GPURenderPipeline };
      if (typeof anyDevice.createRenderPipelineAsync === 'function') {
        return anyDevice.createRenderPipelineAsync(desc);
      }
      return anyDevice.createRenderPipeline(desc);
    };

    const pipeline = await createPipeline({
      label: `environment-pipeline-${type}`,
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: presentationFormat }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false, // Skybox is at infinity
        depthCompare: 'less-equal',
      },
      multisample: {
        count: sampleCount,
      },
    });

    this.pipelines.set(type, pipeline);
  }

  /**
   * Creates a render pipeline specifically for cubemap skybox (different bind group layout)
   */
  private async createCubemapPipeline(
    presentationFormat: GPUTextureFormat,
    sampleCount: number
  ): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: 'environment-shader-cubemap',
      code: SKYBOX_VERTEX_SHADER + '\n' + SKYBOX_CUBEMAP_FRAGMENT_SHADER,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: 'environment-pipeline-layout-cubemap',
      bindGroupLayouts: [this.uniformBindGroupLayout, this.cubemapBindGroupLayout],
    });

    const createPipeline = (desc: GPURenderPipelineDescriptor): GPURenderPipeline | Promise<GPURenderPipeline> => {
      const anyDevice = this.device as unknown as { createRenderPipelineAsync?: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>, createRenderPipeline: (d: GPURenderPipelineDescriptor) => GPURenderPipeline };
      if (typeof anyDevice.createRenderPipelineAsync === 'function') {
        return anyDevice.createRenderPipelineAsync(desc);
      }
      return anyDevice.createRenderPipeline(desc);
    };

    const pipeline = await createPipeline({
      label: 'environment-pipeline-cubemap',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: presentationFormat }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false, // Skybox is at infinity
        depthCompare: 'less-equal',
      },
      multisample: {
        count: sampleCount,
      },
    });

    this.pipelines.set('cubemap', pipeline);
  }

  private async ensureDefaultCubemap(): Promise<void> {
    if (this.defaultCubemap) {
      return;
    }
    const hdrData = createProceduralCloudyHdr({
      width: 256,
      height: 128,
      exposure: 1.5,
      cloudDensity: 0.68,
    });
    this.defaultCubemap = await this.convertHdrToCubemap(hdrData, 512, this.defaultCubemapKey);
  }

  private getDefaultCubemap(): GPUTexture | null {
    if (this.defaultCubemap) {
      return this.defaultCubemap;
    }
    const cached = this.cubemapCache.get(this.defaultCubemapKey);
    if (cached) {
      this.defaultCubemap = cached;
      return cached;
    }
    return null;
  }

  /**
   * Generates a hash from environment parameters for cache key
   */
  private hashEnvironmentParams(environment: EnvironmentComponent): string {
    const parts: string[] = [
      environment.skyboxType,
      `${environment.skyColor[0]},${environment.skyColor[1]},${environment.skyColor[2]}`,
      `${environment.horizonColor[0]},${environment.horizonColor[1]},${environment.horizonColor[2]}`,
      `${environment.sunDirection[0]},${environment.sunDirection[1]},${environment.sunDirection[2]}`,
      `${environment.sunColor[0]},${environment.sunColor[1]},${environment.sunColor[2]}`,
      `${environment.sunIntensity}`,
      `${environment.cloudsEnabled ? 1 : 0}`,
      `${environment.cloudDensity}`,
      `${environment.cloudSpeed}`,
    ];
    return parts.join('|');
  }

  /**
   * Updates uniform data for the current frame
   */
  updateUniforms(inverseViewProjection: Mat4, cameraPosition: Vec3): void {
    if (!this.initialized) return;

    // Store for volumetric cloud pass
    this.lastInverseViewProj = inverseViewProjection;
    this.lastCameraPosition = cameraPosition;

    // Only update if dirty or first time
    if (!this.uniformsDirty) {
      this.uniformsDirty = true; // Mark for potential update
      // For now, always update (could optimize by comparing values)
      // In the future, compare old vs new values before updating
    }

    const data = new Float32Array(20); // 80 bytes
    let offset = 0;

    // inverseViewProjection matrix (64 bytes)
    for (let i = 0; i < 16; i++) {
      data[offset++] = inverseViewProjection[i] ?? 0;
    }

    // cameraPosition (16 bytes: vec3 + padding)
    data[offset++] = cameraPosition[0];
    data[offset++] = cameraPosition[1];
    data[offset++] = cameraPosition[2];
    data[offset++] = 0; // padding

    this.device.queue.writeBuffer(this.uniformBuffer, 0, data.buffer, data.byteOffset, data.byteLength);
  }

  /**
   * Validates and clamps color values
   */
  private validateColor(color: Vec3, defaultValue: Vec3 = [0, 0, 0]): Vec3 {
    const r = Number.isFinite(color[0]) ? Math.max(0, color[0]) : defaultValue[0];
    const g = Number.isFinite(color[1]) ? Math.max(0, color[1]) : defaultValue[1];
    const b = Number.isFinite(color[2]) ? Math.max(0, color[2]) : defaultValue[2];
    return [r, g, b];
  }

  /**
   * Validates and normalizes sun direction
   */
  private validateSunDirection(direction: Vec3): Vec3 {
    const x = Number.isFinite(direction[0]) ? direction[0] : 0;
    const y = Number.isFinite(direction[1]) ? direction[1] : 1;
    const z = Number.isFinite(direction[2]) ? direction[2] : 0;
    
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.0001) {
      return [0, 1, 0]; // Default upward direction
    }
    return [x / len, y / len, z / len];
  }

  /**
   * Validates sun intensity (allows HDR > 1.0, clamps negative values)
   */
  private validateSunIntensity(intensity: number): number {
    if (!Number.isFinite(intensity)) {
      return 1.0;
    }
    return Math.max(0, intensity);
  }

  /**
   * Updates skybox parameters from environment component
   */
  updateParams(environment: EnvironmentComponent): void {
    if (!this.initialized) return;

    this.paramsDirty = true;

    const type = environment.skyboxType;
    const data = new Float32Array(32); // 128 bytes max (8 vec4s)
    let offset = 0;

    switch (type) {
      case 'solid': {
        // skyColor (vec3 + padding)
        const skyColor = this.validateColor(environment.skyColor, [0.05, 0.08, 0.12]);
        data[offset++] = skyColor[0];
        data[offset++] = skyColor[1];
        data[offset++] = skyColor[2];
        data[offset++] = 0;
        break;
      }

      case 'gradient': {
        // skyColor (vec3 + padding)
        const skyColor = this.validateColor(environment.skyColor, [0.05, 0.08, 0.12]);
        data[offset++] = skyColor[0];
        data[offset++] = skyColor[1];
        data[offset++] = skyColor[2];
        data[offset++] = 0;
        // horizonColor (vec3 + padding)
        const horizonColor = this.validateColor(environment.horizonColor, [0.15, 0.18, 0.22]);
        data[offset++] = horizonColor[0];
        data[offset++] = horizonColor[1];
        data[offset++] = horizonColor[2];
        data[offset++] = 0;
        // groundColor (vec3 + padding)
        const groundColor = this.validateColor(environment.groundColor, [0.05, 0.06, 0.08]);
        data[offset++] = groundColor[0];
        data[offset++] = groundColor[1];
        data[offset++] = groundColor[2];
        data[offset++] = 0;
        break;
      }

      case 'procedural-sky': {
        // skyColor (vec3 + padding)
        const skyColor = this.validateColor(environment.skyColor, [0.05, 0.08, 0.12]);
        data[offset++] = skyColor[0];
        data[offset++] = skyColor[1];
        data[offset++] = skyColor[2];
        data[offset++] = 0;
        // horizonColor (vec3 + padding)
        const horizonColor = this.validateColor(environment.horizonColor, [0.15, 0.18, 0.22]);
        data[offset++] = horizonColor[0];
        data[offset++] = horizonColor[1];
        data[offset++] = horizonColor[2];
        data[offset++] = 0;
        // sunDirection (vec3 + padding)
        const sunDirection = this.validateSunDirection(environment.sunDirection);
        data[offset++] = sunDirection[0];
        data[offset++] = sunDirection[1];
        data[offset++] = sunDirection[2];
        data[offset++] = 0;
        // sunColor + sunIntensity (vec3 + f32)
        const sunColor = this.validateColor(environment.sunColor, [1.0, 0.95, 0.8]);
        const sunIntensity = this.validateSunIntensity(environment.sunIntensity);
        data[offset++] = sunColor[0];
        data[offset++] = sunColor[1];
        data[offset++] = sunColor[2];
        data[offset++] = sunIntensity;
        // Cloud parameters (cloudsEnabled, cloudDensity, cloudSpeed, cloudTime)
        const cloudTime = (performance.now() / 1000.0) - this.cloudTimeStart;
        data[offset++] = environment.cloudsEnabled ? 1.0 : 0.0;
        data[offset++] = Math.max(0, Math.min(1, environment.cloudDensity));
        data[offset++] = Math.max(0, Math.min(1, environment.cloudSpeed));
        data[offset++] = cloudTime;
        break;
      }

      case 'physical-sky': {
        // PhysicalSkyParams struct layout:
        // sunDirection: vec3f + rayleigh: f32 (16 bytes)
        // sunColor: vec3f + turbidity: f32 (16 bytes)
        // mieCoefficient: f32 + mieDirectionalG: f32 + exposure: f32 + _pad0: f32 (16 bytes)
        const sunDirection = this.validateSunDirection(environment.sunDirection);
        data[offset++] = sunDirection[0];
        data[offset++] = sunDirection[1];
        data[offset++] = sunDirection[2];
        // Type assertion needed until @engine/world is rebuilt with new properties
        const envWithPhysical = environment as typeof environment & {
          rayleigh?: number;
          turbidity?: number;
          mieCoefficient?: number;
          mieDirectionalG?: number;
        };
        data[offset++] = envWithPhysical.rayleigh ?? 2.0;
        // sunColor + turbidity
        const sunColor = this.validateColor(environment.sunColor, [1.0, 0.95, 0.8]);
        data[offset++] = sunColor[0];
        data[offset++] = sunColor[1];
        data[offset++] = sunColor[2];
        data[offset++] = envWithPhysical.turbidity ?? 4.0;
        // mieCoefficient, mieDirectionalG, exposure, _pad0
        data[offset++] = envWithPhysical.mieCoefficient ?? 0.005;
        data[offset++] = envWithPhysical.mieDirectionalG ?? 0.8;
        data[offset++] = environment.exposure ?? 1.0;
        data[offset++] = 0; // padding
        break;
      }

      case 'cubemap': {
        if (!environment.cubemapTexture) {
          const fallback = this.getDefaultCubemap();
          if (fallback) {
            environment.setCubemap(fallback, this.defaultCubemapKey);
          }
        }
        // For cubemap, we still write placeholder data to params buffer (for bind group compatibility)
        // Actual texture is bound separately in cubemap bind group
        data[offset++] = 0;
        data[offset++] = 0;
        data[offset++] = 0;
        data[offset++] = 0;
        break;
      }
    }

    this.device.queue.writeBuffer(this.paramsBuffer, 0, data.buffer, data.byteOffset, data.byteLength);

    // Handle cubemap bind group separately
    if (type === 'cubemap') {
      const cubemapTexture = (environment as any).cubemapTexture as GPUTexture | undefined;
      if (cubemapTexture) {
        // Create/update cubemap bind group
        this.cubemapBindGroup = this.device.createBindGroup({
          label: 'environment-cubemap-bind-group',
          layout: this.cubemapBindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: { buffer: this.paramsBuffer }, // Placeholder uniform
            },
            {
              binding: 1,
              resource: this.cubemapSampler,
            },
            {
              binding: 2,
              resource: cubemapTexture.createView({ dimension: 'cube' }),
            },
          ],
        });
      }
    }

    // Create/update params bind group for this type if needed
    if (!this.paramsBindGroups.has(type)) {
      const bindGroup = this.device.createBindGroup({
        label: `environment-params-bind-group-${type}`,
        layout: this.paramsBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.paramsBuffer },
          },
        ],
      });
      this.paramsBindGroups.set(type, bindGroup);
    }

    this.paramsDirty = false;
  }

  /**
   * Renders the skybox/environment
   */
  render(passEncoder: GPURenderPassEncoder, environment: EnvironmentComponent): void {
    if (!this.initialized || !environment.enabled) return;

    const type = environment.skyboxType;
    const pipeline = this.pipelines.get(type);

    if (!pipeline) {
      console.warn(`No pipeline for skybox type: ${type}`);
      return;
    }

    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, this.uniformBindGroup);

    if (type === 'cubemap') {
      if (!this.cubemapBindGroup) {
        console.warn('No cubemap bind group available');
        return;
      }
      passEncoder.setBindGroup(1, this.cubemapBindGroup);
    } else {
      const paramsBindGroup = this.paramsBindGroups.get(type);
      if (!paramsBindGroup) {
        console.warn(`No bind group for skybox type: ${type}`);
        return;
      }
      passEncoder.setBindGroup(1, paramsBindGroup);
    }

    passEncoder.draw(3, 1, 0, 0); // Full-screen triangle
  }

  /**
   * Updates the depth texture used for cloud occlusion.
   * Must be called before renderVolumetricClouds() when depth texture changes.
   * 
   * IMPORTANT: This must be a single-sampled (non-MSAA) depth texture view.
   * For MSAA rendering, use a resolved depth texture. The depth texture must
   * NOT be currently attached as a render target when sampling.
   * 
   * @param depthTextureView Single-sampled depth texture view for occlusion sampling
   */
  updateDepthTexture(depthTextureView: GPUTextureView): void {
    if (!this.initialized) return;
    this.currentDepthTextureView = depthTextureView;
    
    // Forward to volumetric cloud pass
    if (this.volumetricCloudPass) {
      this.volumetricCloudPass.updateDepthTexture(depthTextureView);
    }
  }

  /**
   * Renders volumetric clouds using raymarching.
   * 
   * IMPORTANT: This must be called in a SEPARATE render pass from the main scene pass.
   * The depth texture (set via updateDepthTexture) cannot be sampled while it's attached
   * as a render target. Ensure the main pass has ended before calling this method.
   * 
   * Note: updateDepthTexture() must be called before this with a resolved/single-sampled
   * depth texture for proper occlusion.
   * 
   * @param passEncoder The render pass encoder (for a separate cloud pass, NOT the main pass)
   * @param environment The environment component with cloud settings
   * @param viewProjectionMatrix The VP matrix (NOT inverted - will be inverted internally)
   * @param screenWidth Screen width in pixels (for depth sampling)
   * @param screenHeight Screen height in pixels (for depth sampling)
   * @param nearPlane Camera near plane distance for depth linearization (default: 0.1)
   * @param farPlane Camera far plane distance for depth linearization (default: 10000)
   */
  renderVolumetricClouds(
    passEncoder: GPURenderPassEncoder,
    environment: EnvironmentComponent,
    viewProjectionMatrix: Float32Array | Mat4,
    screenWidth?: number,
    screenHeight?: number,
    nearPlane = 0.1,
    farPlane = 10000
  ): void {
    if (!this.initialized || !this.volumetricCloudPass) return;
    if (!environment.enabled || !environment.cloudsEnabled) return;
    // Volumetric clouds work with procedural-sky and physical-sky
    if (environment.skyboxType !== 'procedural-sky' && environment.skyboxType !== 'physical-sky') return;
    if (!this.lastCameraPosition) return;

    const cloudTime = (performance.now() / 1000.0) - this.cloudTimeStart;

    // Note: cloudAltitude/cloudThickness are new properties added to EnvironmentComponent
    // Type assertion needed until @engine/world is rebuilt
    const env = environment as EnvironmentComponent & { cloudAltitude?: number; cloudThickness?: number };
    
    const params: VolumetricCloudParams = {
      cloudAltitude: env.cloudAltitude ?? 1200,
      cloudThickness: env.cloudThickness ?? 800,
      cloudDensity: environment.cloudDensity,
      cloudSpeed: environment.cloudSpeed,
      sunDirection: environment.sunDirection,
      sunColor: environment.sunColor,
      skyColor: environment.skyColor,
      time: cloudTime,
      nearPlane,
      farPlane,
    };

    this.volumetricCloudPass.render(
      passEncoder,
      viewProjectionMatrix,
      this.lastCameraPosition,
      params,
      screenWidth ?? 1920,
      screenHeight ?? 1080
    );
  }

  /**
   * Creates a cubemap texture from 6 individual face images
   * @param faces Array of 6 ImageBitmap or HTMLImageElement (in order: +X, -X, +Y, -Y, +Z, -Z)
   * @param path Optional path/identifier for caching
   */
  async loadCubemapFromFaces(
    faces: Array<ImageBitmap | HTMLImageElement>,
    path?: string
  ): Promise<GPUTexture> {
    if (!this.initialized) throw new Error('EnvironmentRenderer not initialized');
    if (faces.length !== 6) throw new Error('Cubemap requires exactly 6 faces');

    // Check cache first
    if (path && this.cubemapCache.has(path)) {
      return this.cubemapCache.get(path)!;
    }

    const firstFace = faces[0];
    if (!firstFace) throw new Error('First cubemap face is missing');

    const width = firstFace.width;
    const height = firstFace.height;

    // Create cubemap texture
    const cubemapTexture = this.device.createTexture({
      label: path ? `cubemap-${path}` : 'cubemap',
      size: { width, height, depthOrArrayLayers: 6 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    // Upload each face
    for (let face = 0; face < 6; face++) {
      const faceImage = faces[face];
      if (!faceImage) throw new Error(`Cubemap face ${face} is missing`);
      await this.device.queue.copyExternalImageToTexture(
        { source: faceImage, flipY: false },
        { texture: cubemapTexture, origin: [0, 0, face] },
        { width, height }
      );
    }

    // Cache it
    if (path) {
      this.cubemapCache.set(path, cubemapTexture);
    }

    return cubemapTexture;
  }

  /**
   * Loads HDR file and converts to cubemap texture
   * @param source File, URL, or ArrayBuffer containing HDR data
   * @param resolution Resolution for each cubemap face
   * @param path Optional path for caching
   */
  async loadHdrCubemap(
    source: string | File | ArrayBuffer,
    resolution = 512,
    path?: string
  ): Promise<GPUTexture> {
    if (!this.initialized) throw new Error('EnvironmentRenderer not initialized');

    // Check cache
    if (path && this.cubemapCache.has(path)) {
      return this.cubemapCache.get(path)!;
    }

    // Load and parse HDR
    let hdrData: { width: number; height: number; data: Float32Array };
    if (source instanceof ArrayBuffer) {
      hdrData = parseHdrFile(source);
    } else {
      hdrData = await loadHdrFile(source);
    }

    // Convert to cubemap
    return this.convertHdrToCubemap(hdrData, resolution, path);
  }

  /**
   * Clears cubemap from cache
   */
  clearCubemapCache(path: string): void {
    const texture = this.cubemapCache.get(path);
    if (texture) {
      texture.destroy();
      this.cubemapCache.delete(path);
    }
  }

  /**
   * Converts HDR equirectangular image to cubemap
   * @param hdrData HDR image data (width x height x 4 RGBA float32)
   * @param resolution Resolution for each cubemap face
   * @param path Optional path for caching
   */
  async convertHdrToCubemap(
    hdrData: { width: number; height: number; data: Float32Array },
    resolution = 512,
    path?: string
  ): Promise<GPUTexture> {
    if (!this.initialized) throw new Error('EnvironmentRenderer not initialized');

    // Check cache
    if (path && this.cubemapCache.has(path)) {
      return this.cubemapCache.get(path)!;
    }

    // Create HDR source texture from Float32Array data
    const hdrTexture = this.device.createTexture({
      label: 'hdr-source-texture',
      size: [hdrData.width, hdrData.height, 1],
      format: 'rgba32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    // Upload HDR data to texture via staging buffer
    const bytesPerPixel = 16; // rgba32float = 4 * 4 bytes
    const bufferSize = hdrData.width * hdrData.height * bytesPerPixel;
    const stagingBuffer = this.device.createBuffer({
      label: 'hdr-staging-buffer',
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });

    const mappedRange = stagingBuffer.getMappedRange();
    new Float32Array(mappedRange).set(hdrData.data);
    stagingBuffer.unmap();

    // Copy staging buffer to texture
    const encoder = this.device.createCommandEncoder({ label: 'hdr-upload-encoder' });
    encoder.copyBufferToTexture(
      { buffer: stagingBuffer, bytesPerRow: hdrData.width * bytesPerPixel, rowsPerImage: hdrData.height },
      { texture: hdrTexture },
      [hdrData.width, hdrData.height, 1]
    );
    this.device.queue.submit([encoder.finish()]);
    stagingBuffer.destroy();

    // Create cubemap texture (rgba16float for HDR)
    const cubemapTexture = this.device.createTexture({
      label: path ? `hdr-cubemap-${path}` : 'hdr-cubemap',
      size: { width: resolution, height: resolution, depthOrArrayLayers: 6 },
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Create sampler for HDR texture
    const hdrSampler = this.device.createSampler({
      label: 'hdr-sampler',
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // Create bind group layout for equirectangular to cubemap conversion
    const conversionBindGroupLayout = this.device.createBindGroupLayout({
      label: 'hdr-conversion-bgl',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'non-filtering' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'unfilterable-float' },
        },
      ],
    });

    // Shader for equirectangular to cubemap conversion
    const conversionShader = this.device.createShaderModule({
      label: 'hdr-conversion-shader',
      code: /* wgsl */ `
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) vid: u32) -> VSOut {
  var out: VSOut;
  let x = f32((vid << 1u) & 2u);
  let y = f32(vid & 2u);
  out.pos = vec4f(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
  out.uv = vec2f(x, y);
  return out;
}

struct FaceInfo {
  faceIndex: u32,
  _pad: vec3<u32>,
}

@group(0) @binding(0) var hdrSampler: sampler;
@group(0) @binding(1) var hdrTexture: texture_2d<f32>;
@group(1) @binding(0) var<uniform> faceInfo: FaceInfo;

// Convert cubemap face UV to direction vector
fn faceUVToDir(faceIndex: u32, uv: vec2<f32>) -> vec3<f32> {
  let a = uv * 2.0 - vec2<f32>(1.0, 1.0);
  switch (i32(faceIndex)) {
    case 0: { return normalize(vec3<f32>( 1.0, -a.y, -a.x)); } // +X
    case 1: { return normalize(vec3<f32>(-1.0, -a.y,  a.x)); } // -X
    case 2: { return normalize(vec3<f32>( a.x,  1.0,  a.y)); } // +Y
    case 3: { return normalize(vec3<f32>( a.x, -1.0, -a.y)); } // -Y
    case 4: { return normalize(vec3<f32>( a.x, -a.y,  1.0)); } // +Z
    default: { return normalize(vec3<f32>(-a.x, -a.y, -1.0)); } // -Z
  }
}

// Convert direction vector to equirectangular UV
fn dirToEquirectUV(dir: vec3<f32>) -> vec2<f32> {
  let theta = atan2(dir.x, dir.z);
  let phi = acos(clamp(dir.y, -1.0, 1.0));
  return vec2<f32>(
    (theta + 3.14159265359) / (2.0 * 3.14159265359),
    phi / 3.14159265359
  );
}

@fragment
fn fs(input: VSOut) -> @location(0) vec4<f32> {
  let dir = faceUVToDir(faceInfo.faceIndex, input.uv);
  let uv = dirToEquirectUV(dir);
  let color = textureSampleLevel(hdrTexture, hdrSampler, uv, 0.0);
  return color;
}
`,
    });

    // Create pipeline for conversion
    const faceInfoLayout = this.device.createBindGroupLayout({
      label: 'hdr-face-info-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    const conversionPipeline = await (this.device as any).createRenderPipelineAsync?.({
      label: 'hdr-conversion-pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [conversionBindGroupLayout, faceInfoLayout],
      }),
      vertex: {
        module: conversionShader,
        entryPoint: 'vs',
      },
      fragment: {
        module: conversionShader,
        entryPoint: 'fs',
        targets: [{ format: 'rgba16float' }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
    }) ?? this.device.createRenderPipeline({
      label: 'hdr-conversion-pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [conversionBindGroupLayout, faceInfoLayout],
      }),
      vertex: {
        module: conversionShader,
        entryPoint: 'vs',
      },
      fragment: {
        module: conversionShader,
        entryPoint: 'fs',
        targets: [{ format: 'rgba16float' }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
    });

    // Create bind group for HDR texture
    const hdrBindGroup = this.device.createBindGroup({
      label: 'hdr-bind-group',
      layout: conversionBindGroupLayout,
      entries: [
        { binding: 0, resource: hdrSampler },
        { binding: 1, resource: hdrTexture.createView() },
      ],
    });

    // Face info buffer (32 bytes for uniform padding)
    const faceInfoBuffer = this.device.createBuffer({
      label: 'hdr-face-info-buffer',
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const faceInfoBgLayout = conversionPipeline.getBindGroupLayout(1);

    // Render each cubemap face
    const renderEncoder = this.device.createCommandEncoder({ label: 'hdr-cubemap-encoder' });
    for (let face = 0; face < 6; face++) {
      const faceView = cubemapTexture.createView({
        baseArrayLayer: face,
        arrayLayerCount: 1,
      });

      const pass = renderEncoder.beginRenderPass({
        label: `hdr-cubemap-face-${face}`,
        colorAttachments: [
          {
            view: faceView,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      // Update face index
      const faceData = new Uint32Array(8);
      faceData[0] = face;
      this.device.queue.writeBuffer(faceInfoBuffer, 0, faceData);

      const faceBindGroup = this.device.createBindGroup({
        label: `hdr-face-bg-${face}`,
        layout: faceInfoBgLayout,
        entries: [{ binding: 0, resource: { buffer: faceInfoBuffer } }],
      });

      pass.setPipeline(conversionPipeline);
      pass.setBindGroup(0, hdrBindGroup);
      pass.setBindGroup(1, faceBindGroup);
      pass.draw(3, 1, 0, 0);
      pass.end();
    }

    this.device.queue.submit([renderEncoder.finish()]);

    // Cleanup intermediate resources
    faceInfoBuffer.destroy();
    hdrTexture.destroy();

    // Cache it
    if (path) {
      this.cubemapCache.set(path, cubemapTexture);
    }

    return cubemapTexture;
  }

  /**
   * Cleans up GPU resources
   */
  cleanup(): void {
    if (!this.initialized) return;

    this.uniformBuffer?.destroy();
    this.paramsBuffer?.destroy();
    this.pipelines.clear();
    this.paramsBindGroups.clear();

    // Cleanup cubemap cache
    for (const texture of this.cubemapCache.values()) {
      texture.destroy();
    }
    this.cubemapCache.clear();
    this.defaultCubemap = null;

    // Cleanup IBL cache
    for (const cached of this.iblCache.values()) {
      cached.brdfLut.destroy();
      cached.envCube.destroy();
    }
    this.iblCache.clear();

    this.initialized = false;
  }

  /**
   * Gets cached IBL resources or generates new ones
   */
  private getCachedIBLResources(environment: EnvironmentComponent, hash: string): { brdfLut: GPUTexture; envCube: GPUTexture } | null {
    const cached = this.iblCache.get(hash);
    if (cached) {
      return { brdfLut: cached.brdfLut, envCube: cached.envCube };
    }
    return null;
  }

  /**
   * Evicts oldest IBL cache entry if at max size
   */
  private evictOldestIBLCache(): void {
    if (this.iblCache.size < this.iblCacheMaxSize) {
      return;
    }

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, value] of this.iblCache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const cached = this.iblCache.get(oldestKey);
      if (cached) {
        cached.brdfLut.destroy();
        cached.envCube.destroy();
      }
      this.iblCache.delete(oldestKey);
    }
  }

  /**
   * Generates IBL resources: BRDF LUT (2D) and environment cubemap from procedural sky.
   * Returns generated textures for binding.
   * Uses cache to avoid regenerating for same environment parameters.
   */
  async prepareIBLResources(environment: EnvironmentComponent, resolution = 128): Promise<{ brdfLut: GPUTexture; envCube: GPUTexture }> {
    if (!this.initialized) throw new Error('EnvironmentRenderer not initialized');

    // Only cache for procedural-sky type
    if (environment.skyboxType === 'procedural-sky') {
      const hash = this.hashEnvironmentParams(environment);
      const cached = this.getCachedIBLResources(environment, hash);
      if (cached) {
        this.brdfLut = cached.brdfLut;
        this.envCube = cached.envCube;
        return cached;
      }
    }
    // BRDF LUT via compute
    const encoder = this.device.createCommandEncoder({ label: 'ibl-precompute-encoder' });
    const brdfGen = new BrdfLutPass(this.device);
    this.brdfLut = brdfGen.generate(encoder, 256);

    // Env cubemap render (procedural sky only)
    this.envCube = this.device.createTexture({
      label: 'ibl-env-cubemap',
      size: { width: resolution, height: resolution, depthOrArrayLayers: 6 },
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Create one pipeline that uses faceIndex uniform to compute direction
    const shader = this.device.createShaderModule({
      label: 'ibl-env-capture-shader',
      code: /* wgsl */ `
struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) vid:u32)->VSOut{
  var o:VSOut; let x=f32((vid<<1u)&2u); let y=f32(vid&2u); o.pos=vec4f(x*2.0-1.0, y*-2.0+1.0, 0.0, 1.0); o.uv=vec2f(x,y); return o;
}
struct SkyboxParams { skyColor: vec3f, _p0:f32, horizonColor: vec3f, _p1:f32, sunDirection: vec3f, _p2:f32, sunColor: vec3f, sunIntensity: f32, cloudsEnabled: f32, cloudDensity: f32, cloudSpeed: f32, cloudTime: f32 };
@group(0) @binding(0) var<uniform> params: SkyboxParams;
struct FaceInfo { faceIndex: u32, _pad: vec3<u32> };
@group(1) @binding(0) var<uniform> face: FaceInfo;

fn faceUVToDir(faceIndex:u32, uv: vec2<f32>) -> vec3<f32> {
  let a = uv*2.0 - vec2<f32>(1.0,1.0);
  switch(i32(faceIndex)){
    case 0: { return normalize(vec3<f32>( 1.0, -a.y, -a.x)); } // +X
    case 1: { return normalize(vec3<f32>(-1.0, -a.y,  a.x)); } // -X
    case 2: { return normalize(vec3<f32>( a.x,  1.0,  a.y)); } // +Y
    case 3: { return normalize(vec3<f32>( a.x, -1.0, -a.y)); } // -Y
    case 4: { return normalize(vec3<f32>( a.x, -a.y,  1.0)); } // +Z
    default: { return normalize(vec3<f32>(-a.x, -a.y, -1.0)); } // -Z
  }
}

${ATMOSPHERIC_SCATTERING_FUNCTION}
${CLOUD_NOISE_FUNCTION}

@fragment fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let dir = faceUVToDir(face.faceIndex, uv);
  var color = atmosphericScattering(normalize(dir), normalize(params.sunDirection), params.skyColor, params.horizonColor, params.sunColor, params.sunIntensity);
  
  // Add clouds if enabled
  if (params.cloudsEnabled > 0.5) {
    let cloudCoverage = generateClouds(normalize(dir), params.cloudDensity, params.cloudSpeed, params.cloudTime);
    let cloudColor = mix(color * 1.1, params.sunColor * params.sunIntensity * 0.4 + color * 1.3, 0.55);
    color = mix(color, cloudColor, cloudCoverage * 0.85);
  }
  
  return vec4<f32>(color, 1.0);
}
`,
    });
    const pipeline = await (this.device as any).createRenderPipelineAsync?.({
      label: 'ibl-env-capture-pipeline',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.paramsBindGroupLayout, this.device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }] })] }),
      vertex: { module: shader, entryPoint: 'vs' },
      fragment: { module: shader, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    }) ?? this.device.createRenderPipeline({
      label: 'ibl-env-capture-pipeline',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.paramsBindGroupLayout, this.device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }] })] }),
      vertex: { module: shader, entryPoint: 'vs' },
      fragment: { module: shader, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });

    // Face uniform buffer (32 bytes to satisfy uniform binding padding requirements)
    const faceBuffer = this.device.createBuffer({ label: 'ibl-face-ubo', size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const faceLayout = (pipeline.getBindGroupLayout(1));

    // Write cloud params for IBL capture
    // IMPORTANT: Always disable clouds for IBL cubemap to prevent "clouds on ground" artifacts
    // Volumetric clouds are rendered separately as a visual effect, not baked into lighting
    if (environment.skyboxType === 'procedural-sky') {
      const cloudParamsData = new Float32Array(4);
      cloudParamsData[0] = 0.0; // ALWAYS disable clouds for IBL - they cause lighting artifacts
      cloudParamsData[1] = 0.0;
      cloudParamsData[2] = 0.0;
      cloudParamsData[3] = 0.0;
      // Write to params buffer at offset 24 (after sunColor + sunIntensity)
      this.device.queue.writeBuffer(this.paramsBuffer, 24 * 4, cloudParamsData.buffer, cloudParamsData.byteOffset, cloudParamsData.byteLength);
    }

    for (let face = 0; face < 6; face++) {
      const view = this.envCube.createView({ baseArrayLayer: face, arrayLayerCount: 1 });
      const pass = encoder.beginRenderPass({
        label: `ibl-env-capture-face-${face}`,
        colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, this.paramsBindGroups.get('procedural-sky') ?? this.paramsBindGroups.values().next().value);
      const faceData = new Uint32Array(8);
      faceData[0] = face;
      this.device.queue.writeBuffer(faceBuffer, 0, faceData);
      const faceBg = this.device.createBindGroup({ label: `ibl-face-bg-${face}`, layout: faceLayout, entries: [{ binding: 0, resource: { buffer: faceBuffer } }] });
      pass.setBindGroup(1, faceBg);
      pass.draw(3, 1, 0, 0);
      pass.end();
    }

    this.device.queue.submit([encoder.finish()]);

    const result = { brdfLut: this.brdfLut!, envCube: this.envCube! };

    // Cache IBL resources for procedural-sky
    if (environment.skyboxType === 'procedural-sky') {
      const hash = this.hashEnvironmentParams(environment);
      this.evictOldestIBLCache();
      this.iblCache.set(hash, {
        brdfLut: this.brdfLut!,
        envCube: this.envCube!,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  /**
   * Gets the BRDF LUT texture (if generated).
   */
  getBrdfLutTexture(): GPUTexture | null {
    return this.brdfLut;
  }

  /**
   * Gets the environment cubemap texture (if generated).
   */
  getEnvCubeTexture(): GPUTexture | null {
    return this.envCube;
  }

  /**
   * Cleanup GPU resources.
   */
  dispose(): void {
    if (this.volumetricCloudPass) {
      this.volumetricCloudPass.dispose();
      this.volumetricCloudPass = null;
    }
    
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
    }
    if (this.paramsBuffer) {
      this.paramsBuffer.destroy();
    }
    if (this.brdfLut) {
      this.brdfLut.destroy();
      this.brdfLut = null;
    }
    if (this.envCube) {
      this.envCube.destroy();
      this.envCube = null;
    }
    
    // Cleanup cached cubemaps
    for (const texture of this.cubemapCache.values()) {
      texture.destroy();
    }
    this.cubemapCache.clear();
    
    // Cleanup cached IBL
    for (const entry of this.iblCache.values()) {
      entry.brdfLut.destroy();
      entry.envCube.destroy();
    }
    this.iblCache.clear();
    
    this.initialized = false;
  }
}
