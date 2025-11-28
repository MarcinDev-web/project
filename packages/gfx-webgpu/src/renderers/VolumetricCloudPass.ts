import type { Mat4, Vec3 } from '@engine/core/math';
import { mat4Invert } from '@engine/core/math';

import { createBlueNoiseTexture } from '../textures/BlueNoiseTexture';

/**
 * Cloud parameters interface for external configuration
 */
export interface VolumetricCloudParams {
  /** Cloud layer altitude in world units (default: 800) */
  cloudAltitude: number;
  /** Cloud layer thickness in world units (default: 400) */
  cloudThickness: number;
  /** Cloud density/coverage 0-1 (default: 0.5) */
  cloudDensity: number;
  /** Cloud animation speed (default: 0.02) */
  cloudSpeed: number;
  /** Sun direction (normalized) */
  sunDirection: Vec3;
  /** Sun color RGB */
  sunColor: Vec3;
  /** Sky color for ambient lighting */
  skyColor: Vec3;
  /** Time for animation */
  time: number;
  /** Camera near plane distance (must match projection) */
  nearPlane: number;
  /** Camera far plane distance (must match projection) */
  farPlane: number;
  /** 
   * Use detailed light marching with Beer's Law and multi-scattering.
   * More accurate but slower (adds LIGHT_STEPS iterations per sample).
   * When false, uses fast height-based lighting approximation.
   * (default: false)
   */
  useDetailedLighting?: boolean;
}

/**
 * WGSL Shader for Volumetric Cloud Raymarching
 * Implements:
 * - Ray-plane intersection for cloud layer bounds
 * - 3D FBM noise for cloud density
 * - Beer-Lambert light absorption
 * - Silver lining effect (rim lighting)
 * - Proper alpha blending with sky
 */
const VOLUMETRIC_CLOUD_SHADER = /* wgsl */ `
// SHADER VERSION v20 - Use skyColor for ambient lighting
// === Uniforms ===
struct CloudUniforms {
  viewProjectionInverse: mat4x4<f32>,
  viewProjection: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  time: f32,
  sunDirection: vec3<f32>,
  cloudAltitude: f32,
  sunColor: vec3<f32>,
  cloudThickness: f32,
  skyColor: vec3<f32>,
  cloudDensity: f32,
  cloudSpeed: f32,
  screenWidth: f32,
  screenHeight: f32,
  nearPlane: f32,
  farPlane: f32,
  useDetailedLighting: f32, // 1.0 = use lightMarch with Beer's Law, 0.0 = fast height-based
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<uniform> u: CloudUniforms;
// Depth texture for scene occlusion (resolved/single-sampled for separate pass rendering)
@group(0) @binding(1) var depthTexture: texture_depth_2d;
// Blue Noise Texture for Dithering
@group(0) @binding(2) var blueNoiseTex: texture_2d<f32>;
@group(0) @binding(3) var blueNoiseSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// === Constants (Optimized for lower, fluffier clouds) ===
const MAX_STEPS: i32 = 48;       // More steps for better quality at closer range
const LIGHT_STEPS: i32 = 5;      // Slightly more for better shadows
const MAX_DIST: f32 = 12000.0;   // Reduced - clouds are closer now
const MIN_TRANSMITTANCE: f32 = 0.01;

// === Utility Functions ===

// Linearize depth from depth buffer (0-1 range) to view-space distance
fn linearizeDepth(depth: f32) -> f32 {
  // Standard-Z perspective depth linearization
  // Uses camera near/far plane values from uniforms for correct depth reconstruction
  let z = depth;
  return u.nearPlane * u.farPlane / (u.farPlane - z * (u.farPlane - u.nearPlane));
}

// Sample scene depth at given UV coordinates using textureLoad (single-sampled/resolved)
fn sampleSceneDepth(uv: vec2<f32>) -> f32 {
  let texSize = textureDimensions(depthTexture);
  let pixelCoord = vec2<i32>(uv * vec2<f32>(texSize));
  let depthSample = textureLoad(depthTexture, pixelCoord, 0);
  return linearizeDepth(depthSample);
}

// === Noise Functions ===

// Improved hash function with better distribution
fn hash3(p: vec3<f32>) -> f32 {
  var p3 = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 3D Value noise with quintic interpolation for smoother gradients
fn noise3D(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  
  // Quintic interpolation for C2 continuity (smoother than cubic)
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  
  // Sample 8 corners of the cube
  let c000 = hash3(i + vec3<f32>(0.0, 0.0, 0.0));
  let c100 = hash3(i + vec3<f32>(1.0, 0.0, 0.0));
  let c010 = hash3(i + vec3<f32>(0.0, 1.0, 0.0));
  let c110 = hash3(i + vec3<f32>(1.0, 1.0, 0.0));
  let c001 = hash3(i + vec3<f32>(0.0, 0.0, 1.0));
  let c101 = hash3(i + vec3<f32>(1.0, 0.0, 1.0));
  let c011 = hash3(i + vec3<f32>(0.0, 1.0, 1.0));
  let c111 = hash3(i + vec3<f32>(1.0, 1.0, 1.0));
  
  // Trilinear interpolation
  return mix(
    mix(mix(c000, c100, u.x), mix(c010, c110, u.x), u.y),
    mix(mix(c001, c101, u.x), mix(c011, c111, u.x), u.y),
    u.z
  );
}

// Fractal Brownian Motion (5 octaves for smoother clouds)
fn fbm(p: vec3<f32>) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var pos = p;
  var totalAmplitude = 0.0;
  
  // 5 octaves for richer detail
  for (var i = 0; i < 5; i++) {
    value += amplitude * noise3D(pos);
    totalAmplitude += amplitude;
    pos *= 2.0;
    amplitude *= 0.5;
  }
  
  // Normalize to 0-1 range
  return value / totalAmplitude;
}

// === Cloud Density (Working version) ===

fn cloudDensity(p: vec3<f32>) -> f32 {
  // Height within cloud layer (0 at bottom, 1 at top)
  let heightFraction = saturate((p.y - u.cloudAltitude) / u.cloudThickness);
  
  // Height gradient: rounded profile
  let heightGradient = smoothstep(0.0, 0.2, heightFraction) * smoothstep(1.0, 0.7, heightFraction);
  if (heightGradient < 0.01) { return 0.0; }
  
  // Wind animation
  let wind = vec3<f32>(u.time * u.cloudSpeed * 50.0, 0.0, u.time * u.cloudSpeed * 20.0);
  
  // Sample position normalized for noise (world coords / 1000)
  let np = (p + wind) * 0.001;
  
  // Multi-octave FBM
  var n = fbm(np * 1.0) * 0.5;       // Large shapes
  n += fbm(np * 2.5) * 0.25;          // Medium detail
  n += fbm(np * 6.0) * 0.125;         // Fine detail
  
  // Apply height gradient
  var density = n * heightGradient;
  
  // Coverage threshold - cloudDensity parameter controls cloud amount
  let coverage = u.cloudDensity;
  let threshold = 0.3 * (1.0 - coverage);
  density = smoothstep(threshold, threshold + 0.25, density);
  
  return density;
}

// === Ray-Plane Intersection ===

fn rayPlaneIntersect(ro: vec3<f32>, rd: vec3<f32>, planeY: f32) -> f32 {
  if (abs(rd.y) < 0.0001) { return -1.0; }
  return (planeY - ro.y) / rd.y;
}

// === Light Marching (Beer-Lambert + Multi-scattering approximation) ===

fn lightMarch(p: vec3<f32>) -> f32 {
  let sunDir = normalize(u.sunDirection);
  let cloudTop = u.cloudAltitude + u.cloudThickness;
  
  let tExit = rayPlaneIntersect(p, sunDir, cloudTop);
  if (tExit < 0.0) { return 1.0; }
  
  let stepSize = min(tExit, u.cloudThickness * 0.5) / f32(LIGHT_STEPS);
  var totalDensity = 0.0;
  var pos = p;
  
  // Offset start slightly to avoid self-shadowing artifacts
  pos += sunDir * stepSize * 0.3;
  
  for (var i = 0; i < LIGHT_STEPS; i++) {
    pos += sunDir * stepSize;
    totalDensity += cloudDensity(pos) * stepSize;
  }
  
  // Beer's Law with adjusted extinction coefficient
  let beer = exp(-totalDensity * 0.6);
  
  // Multi-scattering approximation (Schneider/Hillaire method)
  // Light penetrates deeper into clouds than simple Beer's law suggests
  let multiScatter = exp(-totalDensity * 0.15) * 0.7;
  
  // Combine: primary transmission + multi-scattered light
  return beer * 0.8 + multiScatter * 0.2;
}

// === Main Raymarching with Depth Occlusion ===

fn raymarchCloudsWithDepth(ro: vec3<f32>, rd: vec3<f32>, sceneDepth: f32, dither: f32) -> vec4<f32> {
  let cloudBottom = u.cloudAltitude;
  let cloudTop = u.cloudAltitude + u.cloudThickness;
  
  // Calculate ray intersection with cloud layer planes
  var tEnter: f32;
  var tExit: f32;
  
  if (ro.y < cloudBottom) {
    // Camera below clouds
    if (rd.y <= 0.0) { return vec4<f32>(0.0); } // Looking down, no clouds
    tEnter = rayPlaneIntersect(ro, rd, cloudBottom);
    tExit = rayPlaneIntersect(ro, rd, cloudTop);
  } else if (ro.y > cloudTop) {
    // Camera above clouds
    if (rd.y >= 0.0) { return vec4<f32>(0.0); } // Looking up, no clouds
    tEnter = rayPlaneIntersect(ro, rd, cloudTop);
    tExit = rayPlaneIntersect(ro, rd, cloudBottom);
  } else {
    // Camera inside cloud layer
    tEnter = 0.0;
    if (rd.y > 0.0) {
      tExit = rayPlaneIntersect(ro, rd, cloudTop);
    } else if (rd.y < 0.0) {
      tExit = rayPlaneIntersect(ro, rd, cloudBottom);
    } else {
      tExit = MAX_DIST; // Looking horizontally inside clouds
    }
  }
  
  // Validate intersection distances
  if (tExit < 0.0 || tEnter > MAX_DIST) { return vec4<f32>(0.0); }
  
  tEnter = max(tEnter, 0.0);
  tExit = min(tExit, MAX_DIST);
  
  if (sceneDepth < tEnter && sceneDepth < u.farPlane * 0.99) { return vec4<f32>(0.0); }
  if (sceneDepth < tExit && sceneDepth < u.farPlane * 0.99) { tExit = sceneDepth; }
  
  let rayLength = tExit - tEnter;
  if (rayLength <= 0.0) { return vec4<f32>(0.0); }
  
  let stepSize = rayLength / f32(MAX_STEPS);
  
  var transmittance = 1.0;
  var lightAccum = vec3<f32>(0.0);
  
  // Jitter start position with dither
  var t = tEnter + stepSize * dither;
  
  // Simple lighting setup
  let sunDir = normalize(u.sunDirection);

  for (var i = 0; i < MAX_STEPS; i++) {
    if (transmittance < MIN_TRANSMITTANCE) { break; }
    
    let pos = ro + rd * t;
    let density = cloudDensity(pos);
    
    if (density > 0.0) {
      var lightAmount: f32;
      
      if (u.useDetailedLighting > 0.5) {
        // Detailed lighting: Beer's Law with multi-scattering via light marching
        lightAmount = lightMarch(pos);
      } else {
        // Fast approximation: height-based lighting
        let heightFrac = saturate((pos.y - cloudBottom) / (cloudTop - cloudBottom));
        lightAmount = 0.4 + heightFrac * 0.6; // Brighter at top
      }
      
      // Direct sunlight contribution
      let directLight = vec3<f32>(lightAmount) * u.sunColor;
      // Ambient sky light (scattered light from atmosphere)
      let ambientLight = u.skyColor * (0.15 + 0.1 * (1.0 - lightAmount));
      // Combined sample color
      let sampleColor = directLight + ambientLight;
      lightAccum += sampleColor * density * transmittance * stepSize * 2.0;
      
      // Beer-Lambert absorption
      transmittance *= exp(-density * stepSize * 1.0);
    }
    
    t += stepSize;
  }
  
  let cloudAlpha = 1.0 - transmittance;
  
  // Final cloud color - white tinted by accumulated light
  // Use skyColor for base ambient to match atmospheric conditions
  var cloudColor = vec3<f32>(0.9, 0.92, 0.95) * (lightAccum + u.skyColor * 0.25);
  cloudColor = clamp(cloudColor, vec3<f32>(0.1), vec3<f32>(1.0));
  
  return vec4<f32>(cloudColor, cloudAlpha);
}

// === Vertex Shader ===

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  output.position = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
  output.uv = vec2<f32>(x, 1.0 - y);
  return output;
}

// === Fragment Shader ===

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let ndc = vec2<f32>(input.uv.x * 2.0 - 1.0, input.uv.y * 2.0 - 1.0);
  let clipPos = vec4<f32>(ndc, 1.0, 1.0);
  let worldPos4 = u.viewProjectionInverse * clipPos;
  let worldTarget = worldPos4.xyz / worldPos4.w;
  let rayDir = normalize(worldTarget - u.cameraPosition);
  
  // Generate blue noise / dither value from texture BEFORE any non-uniform control flow
  // textureSample requires uniform control flow due to implicit derivative calculations
  // Scale UV by screen size and divide by texture size (64) to tile pixel-perfectly
  let noiseUV = (input.uv * vec2<f32>(u.screenWidth, u.screenHeight)) / 64.0;
  
  // Temporal offset to animate noise (Golden Ratio based)
  // This helps TAA accumulate better or just makes noise less static
  let timeFrame = floor(u.time * 60.0);
  let goldenOffset = vec2<f32>(
    fract(timeFrame * 0.7548776662466927), 
    fract(timeFrame * 0.5698402909980532)
  );
  
  let dither = textureSample(blueNoiseTex, blueNoiseSampler, noiseUV + goldenOffset).r;
  
  // Smooth horizon fade - clouds gradually fade out near horizon instead of sharp cutoff
  let horizonFade = smoothstep(-0.05, 0.15, rayDir.y);
  if (horizonFade <= 0.0) { return vec4<f32>(0.0); }
  
  let sceneDepth = sampleSceneDepth(input.uv);
  
  let cloudResult = raymarchCloudsWithDepth(u.cameraPosition, rayDir, sceneDepth, dither);
  
  // Apply horizon fade to smoothly blend clouds at the horizon
  let fadedAlpha = cloudResult.a * horizonFade;
  return vec4<f32>(cloudResult.rgb * fadedAlpha, fadedAlpha);
}
`;

/**
 * VolumetricCloudPass
 * 
 * Renders volumetric clouds using SDF-style raymarching.
 * Should be rendered as a separate pass after the skybox with alpha blending.
 */
export class VolumetricCloudPass {
  private device!: GPUDevice;
  private pipeline!: GPURenderPipeline;
  private uniformBuffer!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private bindGroupLayout!: GPUBindGroupLayout;
  private blueNoiseTexture!: GPUTexture;
  private blueNoiseSampler!: GPUSampler;
  private currentDepthTextureView: GPUTextureView | null = null;
  private initialized = false;
  
  // Reusable arrays to avoid allocations
  private invViewProj = new Float32Array(16);
  private viewProj = new Float32Array(16);
  private uniformData = new Float32Array(64); // 256 bytes (mat4 + mat4 + params)
  
  // Reusable validated sun direction (avoid allocations)
  private validatedSunDir: [number, number, number] = [0, 1, 0];

  /**
   * Validates and normalizes sun direction.
   * Handles zero-length vectors (which would cause NaN after normalization).
   */
  private validateSunDirection(direction: Vec3): [number, number, number] {
    const x = Number.isFinite(direction[0]) ? direction[0] : 0;
    const y = Number.isFinite(direction[1]) ? direction[1] : 1;
    const z = Number.isFinite(direction[2]) ? direction[2] : 0;
    
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.0001) {
      // Zero-length vector - use default upward direction
      this.validatedSunDir[0] = 0;
      this.validatedSunDir[1] = 1;
      this.validatedSunDir[2] = 0;
    } else {
      this.validatedSunDir[0] = x / len;
      this.validatedSunDir[1] = y / len;
      this.validatedSunDir[2] = z / len;
    }
    return this.validatedSunDir;
  }

  /**
   * Validates cloud thickness (must be positive).
   */
  private validateCloudThickness(thickness: number): number {
    if (!Number.isFinite(thickness) || thickness <= 0) {
      return 400; // Default thickness
    }
    return thickness;
  }

  /**
   * Validates cloud density (clamps to 0-1 range).
   */
  private validateCloudDensity(density: number): number {
    if (!Number.isFinite(density)) {
      return 0.5; // Default density
    }
    return Math.max(0, Math.min(1, density));
  }

  /**
   * Initialize the cloud pass with GPU device and output format.
   * @param device The GPU device
   * @param format The output texture format
   * @param sampleCount MSAA sample count (default: 4)
   */
  async initialize(
    device: GPUDevice, 
    format: GPUTextureFormat, 
    sampleCount = 4
  ): Promise<void> {
    this.device = device;

    // Uniform buffer layout:
    // mat4x4 viewProjectionInverse: 64 bytes (0-63)
    // mat4x4 viewProjection: 64 bytes (64-127)
    // vec3 cameraPosition + f32 time: 16 bytes (128-143)
    // vec3 sunDirection + f32 cloudAltitude: 16 bytes (144-159)
    // vec3 sunColor + f32 cloudThickness: 16 bytes (160-175)
    // vec3 skyColor + f32 cloudDensity: 16 bytes (176-191)
    // f32 cloudSpeed + f32 screenWidth + f32 screenHeight + f32 nearPlane: 16 bytes (192-207)
    // f32 farPlane + f32 useDetailedLighting + padding: 16 bytes (208-223)
    // Total: 224 bytes -> align to 256 for safety
    const uniformBufferSize = 256;
    
    this.uniformBuffer = device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'Volumetric Cloud Uniforms',
    });

    // Create Blue Noise Texture
    this.blueNoiseTexture = createBlueNoiseTexture(device);
    
    // Create Sampler for noise (repeat wrapping)
    this.blueNoiseSampler = device.createSampler({
      label: 'Blue Noise Sampler',
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });

    // Create bind group layout with single-sampled/resolved depth texture (no sampler - using textureLoad)
    this.bindGroupLayout = device.createBindGroupLayout({
      label: 'Volumetric Cloud Bind Group Layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'depth', multisampled: false },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
      ],
    });

    // Create shader module
    const shaderModule = device.createShaderModule({
      code: VOLUMETRIC_CLOUD_SHADER,
      label: 'Volumetric Cloud Shader',
    });

    // Create pipeline with alpha blending and MSAA support
    this.pipeline = await device.createRenderPipelineAsync({
      label: 'Volumetric Cloud Pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: format,
          blend: {
            // Premultiplied alpha blending (cloud over sky)
            color: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        }],
      },
      primitive: {
        topology: 'triangle-list',
      },
      multisample: {
        count: sampleCount,
      },
      // No depthStencil - clouds are rendered in a separate pass without depth attachment
      // They sample depth from a resolved texture for occlusion, not from the depth buffer
    });

    this.initialized = true;
  }

  /**
   * Updates the depth texture used for scene occlusion.
   * Must be called before render() when depth texture changes.
   * @param depthTextureView The depth texture view from the main render pass
   */
  updateDepthTexture(depthTextureView: GPUTextureView): void {
    if (!this.initialized) return;
    
    // Only recreate bind group if depth texture changed
    if (this.currentDepthTextureView === depthTextureView) return;
    
    this.currentDepthTextureView = depthTextureView;
    
    // Recreate bind group with new depth texture (no sampler needed - using textureLoad)
    this.bindGroup = this.device.createBindGroup({
      label: 'Volumetric Cloud Bind Group',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: depthTextureView },
        { binding: 2, resource: this.blueNoiseTexture.createView() },
        { binding: 3, resource: this.blueNoiseSampler },
      ],
    });
  }

  /**
   * Check if the pass is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Render volumetric clouds
   * @param passEncoder The render pass encoder
   * @param viewProjectionMatrix The VP matrix (will be inverted internally)
   * @param cameraPosition Camera world position
   * @param params Cloud rendering parameters
   * @param screenWidth Screen width in pixels
   * @param screenHeight Screen height in pixels
   */
  render(
    passEncoder: GPURenderPassEncoder,
    viewProjectionMatrix: Float32Array | Mat4,
    cameraPosition: Vec3 | Float32Array | number[],
    params: VolumetricCloudParams,
    screenWidth = 1920,
    screenHeight = 1080
  ): void {
    if (!this.initialized) return;
    if (!this.bindGroup) return; // Need depth texture to be set first
    
    // Note: Clouds render from any camera position
    // The shader handles camera inside/above cloud layer correctly

    // Validate parameters to prevent NaN/invalid values in shader
    const validatedSunDir = this.validateSunDirection(params.sunDirection);
    const validatedThickness = this.validateCloudThickness(params.cloudThickness);
    const validatedDensity = this.validateCloudDensity(params.cloudDensity);

    // Copy VP matrix and compute inverse
    if (viewProjectionMatrix instanceof Float32Array) {
      this.viewProj.set(viewProjectionMatrix);
    } else {
      for (let i = 0; i < 16; i++) {
        this.viewProj[i] = viewProjectionMatrix[i] ?? 0;
      }
    }
    mat4Invert(this.invViewProj, this.viewProj as unknown as Mat4);

    // Pack uniforms
    let offset = 0;
    
    // mat4x4 viewProjectionInverse (16 floats)
    for (let i = 0; i < 16; i++) {
      this.uniformData[offset++] = this.invViewProj[i] ?? 0;
    }
    
    // mat4x4 viewProjection (16 floats)
    for (let i = 0; i < 16; i++) {
      this.uniformData[offset++] = this.viewProj[i] ?? 0;
    }
    
    // vec3 cameraPosition + f32 time
    this.uniformData[offset++] = cameraPosition[0];
    this.uniformData[offset++] = cameraPosition[1];
    this.uniformData[offset++] = cameraPosition[2];
    this.uniformData[offset++] = params.time;
    
    // vec3 sunDirection + f32 cloudAltitude (using validated values)
    this.uniformData[offset++] = validatedSunDir[0];
    this.uniformData[offset++] = validatedSunDir[1];
    this.uniformData[offset++] = validatedSunDir[2];
    this.uniformData[offset++] = params.cloudAltitude;
    
    // vec3 sunColor + f32 cloudThickness (using validated value)
    this.uniformData[offset++] = params.sunColor[0];
    this.uniformData[offset++] = params.sunColor[1];
    this.uniformData[offset++] = params.sunColor[2];
    this.uniformData[offset++] = validatedThickness;
    
    // vec3 skyColor + f32 cloudDensity (using validated value)
    this.uniformData[offset++] = params.skyColor[0];
    this.uniformData[offset++] = params.skyColor[1];
    this.uniformData[offset++] = params.skyColor[2];
    this.uniformData[offset++] = validatedDensity;
    
    // f32 cloudSpeed + f32 screenWidth + f32 screenHeight + f32 nearPlane
    this.uniformData[offset++] = params.cloudSpeed;
    this.uniformData[offset++] = screenWidth;
    this.uniformData[offset++] = screenHeight;
    this.uniformData[offset++] = params.nearPlane;
    
    // f32 farPlane + f32 useDetailedLighting + padding
    this.uniformData[offset++] = params.farPlane;
    this.uniformData[offset++] = params.useDetailedLighting ? 1.0 : 0.0;
    this.uniformData[offset++] = 0; // _pad1
    this.uniformData[offset++] = 0; // _pad2

    // Upload uniforms
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this.uniformData.buffer,
      this.uniformData.byteOffset,
      offset * 4 // bytes
    );

    // Draw full-screen triangle
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.draw(3, 1, 0, 0);
  }

  /**
   * Cleanup GPU resources
   */
  dispose(): void {
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
    }
    if (this.blueNoiseTexture) {
      this.blueNoiseTexture.destroy();
    }
    this.initialized = false;
  }
}

