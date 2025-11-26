import type { Mat4, Vec3 } from '@engine/core/math';
import { mat4Invert } from '@engine/core/math';

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
// SHADER VERSION v9 - BALANCED: good quality with optimized FBM, dual noise layers
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
  _pad0: f32,
};

@group(0) @binding(0) var<uniform> u: CloudUniforms;

// Depth texture for scene occlusion (resolved/single-sampled for separate pass rendering)
@group(0) @binding(1) var depthTexture: texture_depth_2d;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// === Constants (Balanced Quality/Performance) ===
const MAX_STEPS: i32 = 40;       // Good balance of quality and speed
const LIGHT_STEPS: i32 = 5;      // Good lighting quality
const MAX_DIST: f32 = 5000.0;    // Reasonable draw distance
const NEAR_PLANE: f32 = 0.1;
const FAR_PLANE: f32 = 10000.0;
const MIN_TRANSMITTANCE: f32 = 0.01; // Early exit threshold

// === Depth Functions ===

// Linearize depth from depth buffer (0-1 range) to view-space distance
fn linearizeDepth(depth: f32) -> f32 {
  // Standard-Z perspective depth linearization
  // For standard-Z: depth=0 is near, depth=1 is far
  let z = depth;
  return NEAR_PLANE * FAR_PLANE / (FAR_PLANE - z * (FAR_PLANE - NEAR_PLANE));
}

// Sample scene depth at given UV coordinates using textureLoad (single-sampled/resolved)
fn sampleSceneDepth(uv: vec2<f32>) -> f32 {
  let texSize = textureDimensions(depthTexture);
  let pixelCoord = vec2<i32>(uv * vec2<f32>(texSize));
  // For non-multisampled textures, use mip level 0
  let depthSample = textureLoad(depthTexture, pixelCoord, 0);
  return linearizeDepth(depthSample);
}

// === Noise Functions ===

fn hash3(p: vec3<f32>) -> f32 {
  var p3 = fract(p * 0.1031);
  p3 = p3 + dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

fn noise3D(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  
  return mix(
    mix(
      mix(hash3(i + vec3(0.0, 0.0, 0.0)), hash3(i + vec3(1.0, 0.0, 0.0)), u.x),
      mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), u.x),
      u.y
    ),
    mix(
      mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), u.x),
      mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), u.x),
      u.y
    ),
    u.z
  );
}

// Fractal Brownian Motion for cloud shapes (Optimized: unrolled, 4 octaves)
fn fbm(p: vec3<f32>) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var pos = p;
  
  // Unrolled loop - better GPU performance than dynamic loop
  value += amplitude * noise3D(pos);
  pos *= 2.0; amplitude *= 0.5;
  value += amplitude * noise3D(pos);
  pos *= 2.0; amplitude *= 0.5;
  value += amplitude * noise3D(pos);
  pos *= 2.0; amplitude *= 0.5;
  value += amplitude * noise3D(pos);
  // Removed 5th octave for performance
  
  return value;
}

// === Cloud Density (Balanced Quality/Performance) ===

fn cloudDensity(p: vec3<f32>) -> f32 {
  // Height within cloud layer (0 at bottom, 1 at top)
  let heightFraction = saturate((p.y - u.cloudAltitude) / u.cloudThickness);
  
  // Height-based density falloff (thicker in middle, thinner at edges)
  let heightDensity = heightFraction * (1.0 - heightFraction) * 4.0;
  
  // Early exit for very thin areas
  if (heightDensity < 0.01) {
    return 0.0;
  }
  
  // Animate cloud position
  let animOffset = vec3<f32>(u.time * u.cloudSpeed * 50.0, 0.0, u.time * u.cloudSpeed * 20.0);
  let samplePos = p + animOffset;
  
  // Base cloud shape from FBM (large scale fluffy shapes)
  let baseNoise = fbm(samplePos * 0.002);
  
  // Detail noise at higher frequency (adds definition and texture)
  let detailNoise = fbm(samplePos * 0.007) * 0.4;
  
  // Combine noises
  var density = baseNoise + detailNoise;
  density = density * heightDensity;
  
  // Apply coverage threshold (controlled by cloudDensity parameter)
  let coverage = u.cloudDensity;
  density = smoothstep(1.0 - coverage, 1.0 - coverage + 0.25, density);
  
  return max(0.0, density);
}

// === Ray-Plane Intersection ===

fn rayPlaneIntersect(ro: vec3<f32>, rd: vec3<f32>, planeY: f32) -> f32 {
  if (abs(rd.y) < 0.0001) {
    return -1.0; // Ray parallel to plane
  }
  let t = (planeY - ro.y) / rd.y;
  return t;
}

// === Light Marching (Beer-Lambert) ===

fn lightMarch(p: vec3<f32>) -> f32 {
  let sunDir = normalize(u.sunDirection);
  let cloudTop = u.cloudAltitude + u.cloudThickness;
  
  // Distance to exit cloud layer toward sun
  let tExit = rayPlaneIntersect(p, sunDir, cloudTop);
  if (tExit < 0.0) {
    return 1.0; // Already outside or sun below
  }
  
  let stepSize = min(tExit, u.cloudThickness) / f32(LIGHT_STEPS);
  var totalDensity = 0.0;
  var pos = p;
  
  for (var i = 0; i < LIGHT_STEPS; i++) {
    pos += sunDir * stepSize;
    totalDensity += cloudDensity(pos) * stepSize;
  }
  
  // Beer-Lambert absorption
  let absorption = exp(-totalDensity * 0.5);
  return absorption;
}

// === Main Raymarching ===

fn raymarchClouds(ro: vec3<f32>, rd: vec3<f32>) -> vec4<f32> {
  let cloudBottom = u.cloudAltitude;
  let cloudTop = u.cloudAltitude + u.cloudThickness;
  
  // Find entry and exit points for cloud layer
  var tEnter = rayPlaneIntersect(ro, rd, cloudBottom);
  var tExit = rayPlaneIntersect(ro, rd, cloudTop);
  
  // Handle camera inside cloud layer
  if (ro.y > cloudBottom && ro.y < cloudTop) {
    if (rd.y > 0.0) {
      tEnter = 0.0;
    } else {
      tExit = tEnter;
      tEnter = 0.0;
    }
  }
  
  // Swap if needed (ray going down)
  if (tEnter > tExit) {
    let temp = tEnter;
    tEnter = tExit;
    tExit = temp;
  }
  
  // Skip if cloud layer is behind camera or too far
  if (tExit < 0.0 || tEnter > MAX_DIST) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  
  tEnter = max(tEnter, 0.0);
  tExit = min(tExit, MAX_DIST);
  
  // Raymarching
  let rayLength = tExit - tEnter;
  let stepSize = rayLength / f32(MAX_STEPS);
  
  var transmittance = 1.0;
  var lightEnergy = 0.0;
  var depth = 0.0;
  var t = tEnter;
  
  let sunDir = normalize(u.sunDirection);
  
  for (var i = 0; i < MAX_STEPS; i++) {
    if (transmittance < MIN_TRANSMITTANCE) {
      break;
    }
    
    let pos = ro + rd * t;
    let density = cloudDensity(pos);
    
    if (density > 0.001) {
      // Light contribution at this point
      let lightTransmittance = lightMarch(pos);
      
      // Silver lining: enhanced brightness at cloud edges when backlit
      let viewDotSun = dot(-rd, sunDir);
      let silverLining = pow(max(viewDotSun, 0.0), 4.0) * 0.6;
      
      // Phase function (Henyey-Greenstein approximation)
      let phase = 0.5 + 0.5 * viewDotSun;
      
      // Accumulate light
      let sampleLight = lightTransmittance * (1.0 + silverLining) * phase;
      lightEnergy += density * transmittance * sampleLight * stepSize;
      
      // Update transmittance (Beer-Lambert)
      transmittance *= exp(-density * stepSize * 2.0);
      
      if (depth == 0.0) {
        depth = t;
      }
    }
    
    t += stepSize;
  }
  
  // Final cloud color
  let cloudAlpha = 1.0 - transmittance;
  
  // Base cloud color (white with slight sky tint)
  let baseCloudColor = vec3<f32>(1.0, 1.0, 1.0);
  
  // Lit cloud color
  let litColor = u.sunColor * lightEnergy * 2.5 + u.skyColor * 0.15;
  
  // Ambient from sky (darker in shadow)
  let ambientColor = u.skyColor * 0.25 * (1.0 - lightEnergy * 0.5);
  
  var cloudColor = litColor + ambientColor;
  cloudColor = mix(baseCloudColor * 0.8, cloudColor, 0.7);
  
  // Clamp to avoid excessive brightness
  cloudColor = min(cloudColor, vec3<f32>(1.5));
  
  return vec4<f32>(cloudColor, cloudAlpha);
}

// === Main Raymarching with Depth Occlusion ===

fn raymarchCloudsWithDepth(ro: vec3<f32>, rd: vec3<f32>, sceneDepth: f32) -> vec4<f32> {
  let cloudBottom = u.cloudAltitude;
  let cloudTop = u.cloudAltitude + u.cloudThickness;
  
  // CRITICAL FIX: Camera below clouds looking down = no clouds possible
  // If camera is below cloud layer (ro.y < cloudBottom) and ray points down (rd.y < 0),
  // the ray will NEVER intersect the cloud layer which is ABOVE the camera
  if (ro.y < cloudBottom && rd.y <= 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  
  // Camera above clouds looking up = no clouds possible
  if (ro.y > cloudTop && rd.y >= 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  
  // Find entry and exit points for cloud layer
  var tEnter = rayPlaneIntersect(ro, rd, cloudBottom);
  var tExit = rayPlaneIntersect(ro, rd, cloudTop);
  
  // Handle camera inside cloud layer
  if (ro.y > cloudBottom && ro.y < cloudTop) {
    if (rd.y > 0.0) {
      tEnter = 0.0;
    } else {
      tExit = tEnter;
      tEnter = 0.0;
    }
  }
  
  // Swap if needed (ray going down)
  if (tEnter > tExit) {
    let temp = tEnter;
    tEnter = tExit;
    tExit = temp;
  }
  
  // Skip if cloud layer is behind camera or too far
  if (tExit < 0.0 || tEnter > MAX_DIST) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  
  // Additional safety: both intersection points must be positive (in front of camera)
  if (tEnter < 0.0 && tExit < 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  
  tEnter = max(tEnter, 0.0);
  tExit = min(tExit, MAX_DIST);
  
  // Depth occlusion: if scene geometry is closer than cloud entry, skip clouds entirely
  if (sceneDepth < tEnter && sceneDepth < FAR_PLANE * 0.99) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  
  // Clamp exit point to scene depth (clouds behind geometry are occluded)
  if (sceneDepth < tExit && sceneDepth < FAR_PLANE * 0.99) {
    tExit = sceneDepth;
  }
  
  // Raymarching
  let rayLength = tExit - tEnter;
  if (rayLength <= 0.0) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  
  let stepSize = rayLength / f32(MAX_STEPS);
  
  var transmittance = 1.0;
  var lightEnergy = 0.0;
  var depth = 0.0;
  var t = tEnter;
  
  let sunDir = normalize(u.sunDirection);
  
  for (var i = 0; i < MAX_STEPS; i++) {
    if (transmittance < MIN_TRANSMITTANCE) {
      break;
    }
    
    // Stop if we've reached scene geometry
    if (t >= sceneDepth && sceneDepth < FAR_PLANE * 0.99) {
      break;
    }
    
    let pos = ro + rd * t;
    let density = cloudDensity(pos);
    
    if (density > 0.001) {
      // Light contribution at this point
      let lightTransmittance = lightMarch(pos);
      
      // Silver lining: enhanced brightness at cloud edges when backlit
      let viewDotSun = dot(-rd, sunDir);
      let silverLining = pow(max(viewDotSun, 0.0), 4.0) * 0.6;
      
      // Phase function (Henyey-Greenstein approximation)
      let phase = 0.5 + 0.5 * viewDotSun;
      
      // Accumulate light
      let sampleLight = lightTransmittance * (1.0 + silverLining) * phase;
      lightEnergy += density * transmittance * sampleLight * stepSize;
      
      // Update transmittance (Beer-Lambert)
      transmittance *= exp(-density * stepSize * 2.0);
      
      if (depth == 0.0) {
        depth = t;
      }
    }
    
    t += stepSize;
  }
  
  // Final cloud color
  let cloudAlpha = 1.0 - transmittance;
  
  // Base cloud color (white with slight sky tint)
  let baseCloudColor = vec3<f32>(1.0, 1.0, 1.0);
  
  // Lit cloud color
  let litColor = u.sunColor * lightEnergy * 2.5 + u.skyColor * 0.15;
  
  // Ambient from sky (darker in shadow)
  let ambientColor = u.skyColor * 0.25 * (1.0 - lightEnergy * 0.5);
  
  var cloudColor = litColor + ambientColor;
  cloudColor = mix(baseCloudColor * 0.8, cloudColor, 0.7);
  
  // Clamp to avoid excessive brightness
  cloudColor = min(cloudColor, vec3<f32>(1.5));
  
  return vec4<f32>(cloudColor, cloudAlpha);
}

// === Vertex Shader ===

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  
  // Full-screen triangle
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  
  output.position = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
  output.uv = vec2<f32>(x, 1.0 - y);
  
  return output;
}

// === Fragment Shader ===

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Convert UV to NDC - NOTE: WebGPU Y is flipped compared to OpenGL
  // UV.y=0 is top of screen, NDC.y=+1 should be top
  // But the inverse VP might expect different convention
  let ndc = vec2<f32>(input.uv.x * 2.0 - 1.0, input.uv.y * 2.0 - 1.0);
  
  // Unproject to world space to get ray direction
  let clipPos = vec4<f32>(ndc, 1.0, 1.0);
  let worldPos4 = u.viewProjectionInverse * clipPos;
  let worldTarget = worldPos4.xyz / worldPos4.w;
  let rayDir = normalize(worldTarget - u.cameraPosition);
  
  // CRITICAL: Only render clouds when looking UP (positive world Y direction)
  // This is the definitive check - if ray points down, no clouds possible
  if (rayDir.y < 0.05) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  
  // Sample scene depth for occlusion
  let sceneDepth = sampleSceneDepth(input.uv);
  
  // Raymarch clouds with depth occlusion
  let cloudResult = raymarchCloudsWithDepth(u.cameraPosition, rayDir, sceneDepth);
  
  // Output with premultiplied alpha for proper blending
  return vec4<f32>(cloudResult.rgb * cloudResult.a, cloudResult.a);
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
  private currentDepthTextureView: GPUTextureView | null = null;
  private initialized = false;
  
  // Reusable arrays to avoid allocations
  private invViewProj = new Float32Array(16);
  private viewProj = new Float32Array(16);
  private uniformData = new Float32Array(64); // 256 bytes (mat4 + mat4 + params)

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
    // f32 cloudSpeed + f32 screenWidth + f32 screenHeight + padding: 16 bytes (192-207)
    // Total: 208 bytes -> align to 256 for safety
    const uniformBufferSize = 256;
    
    this.uniformBuffer = device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'Volumetric Cloud Uniforms',
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
    
    // Safety check: only render clouds if camera is below cloud layer
    const camY = cameraPosition[1] ?? 0;
    if (camY >= params.cloudAltitude) return;

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
    
    // vec3 sunDirection + f32 cloudAltitude
    this.uniformData[offset++] = params.sunDirection[0];
    this.uniformData[offset++] = params.sunDirection[1];
    this.uniformData[offset++] = params.sunDirection[2];
    this.uniformData[offset++] = params.cloudAltitude;
    
    // vec3 sunColor + f32 cloudThickness
    this.uniformData[offset++] = params.sunColor[0];
    this.uniformData[offset++] = params.sunColor[1];
    this.uniformData[offset++] = params.sunColor[2];
    this.uniformData[offset++] = params.cloudThickness;
    
    // vec3 skyColor + f32 cloudDensity
    this.uniformData[offset++] = params.skyColor[0];
    this.uniformData[offset++] = params.skyColor[1];
    this.uniformData[offset++] = params.skyColor[2];
    this.uniformData[offset++] = params.cloudDensity;
    
    // f32 cloudSpeed + f32 screenWidth + f32 screenHeight + padding
    this.uniformData[offset++] = params.cloudSpeed;
    this.uniformData[offset++] = screenWidth;
    this.uniformData[offset++] = screenHeight;
    this.uniformData[offset++] = 0; // _pad0

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
    this.initialized = false;
  }
}

