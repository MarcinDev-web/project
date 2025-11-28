/**
 * Hybrid Volumetric Cloud Pass
 * 
 * Advanced volumetric cloud rendering with:
 * - Procedural weather map for coverage control
 * - SDF-based cloud shapes (cumulus, stratus, stratocumulus)
 * - FBM + Worley noise for natural detail
 * - Temporal reprojection for performance optimization
 * - Half-resolution rendering with upscaling
 * 
 * @module gfx-webgpu/renderers
 */

import type { Mat4, Vec3 } from '@engine/core/math';
import { mat4Invert } from '@engine/core/math';

import { createBlueNoiseTexture } from '../textures/BlueNoiseTexture';
import { ProceduralWeatherMap, type WeatherMapParams } from '../textures/ProceduralWeatherMap';

// Import shader code
import HYBRID_CLOUD_SHADER from '../shaders/clouds/hybrid_clouds.wgsl?raw';
import TEMPORAL_SHADER from '../shaders/clouds/temporal_reprojection.wgsl?raw';

/**
 * Cloud type enumeration
 */
export type CloudType = 'auto' | 'cumulus' | 'stratus' | 'stratocumulus';

/**
 * Extended cloud parameters for hybrid rendering
 */
export interface HybridVolumetricCloudParams {
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
  /** Camera near plane distance */
  nearPlane: number;
  /** Camera far plane distance */
  farPlane: number;
  
  // === Hybrid-specific parameters ===
  
  /** Dominant cloud type: 'auto' uses weather map, others force specific type */
  cloudType: CloudType;
  /** Weather map animation speed (default: 0.01) */
  weatherSpeed: number;
  /** Worley noise intensity for erosion 0-1 (default: 0.5) */
  erosionStrength: number;
  /** Temporal blend factor 0.9-0.98 (default: 0.95) */
  temporalBlend: number;
  /** Enable temporal reprojection (default: true) */
  enableTemporal: boolean;
  /** Weather map pattern scale (default: 1.0) */
  weatherMapScale: number;
  /** Wind direction in radians (default: 0) */
  windDirection: number;
}

/**
 * Default parameters for hybrid clouds
 */
const DEFAULT_PARAMS: HybridVolumetricCloudParams = {
  cloudAltitude: 800,
  cloudThickness: 400,
  cloudDensity: 0.5,
  cloudSpeed: 0.02,
  sunDirection: [0.5, 0.8, 0.3],
  sunColor: [1.0, 0.95, 0.9],
  skyColor: [0.6, 0.7, 0.9],
  time: 0,
  nearPlane: 0.1,
  farPlane: 10000,
  cloudType: 'auto',
  weatherSpeed: 0.01,
  erosionStrength: 0.5,
  temporalBlend: 0.95,
  enableTemporal: true,
  weatherMapScale: 1.0,
  windDirection: 0,
};

/**
 * Cloud type to shader value mapping
 */
const CLOUD_TYPE_VALUES: Record<CloudType, number> = {
  'auto': 0,
  'cumulus': 1,
  'stratus': 2,
  'stratocumulus': 3,
};

/**
 * HybridVolumetricCloudPass
 * 
 * Renders volumetric clouds using a hybrid approach combining:
 * - Weather map for macro-scale coverage
 * - SDF shapes for cloud type formations
 * - Procedural noise for micro-scale detail
 * - Temporal reprojection for performance
 */
export class HybridVolumetricCloudPass {
  private device: GPUDevice | null = null;
  
  // Main cloud rendering
  private cloudPipeline: GPURenderPipeline | null = null;
  private cloudBindGroupLayout: GPUBindGroupLayout | null = null;
  private cloudBindGroup: GPUBindGroup | null = null;
  private cloudUniformBuffer: GPUBuffer | null = null;
  
  // Temporal reprojection
  private temporalPipeline: GPURenderPipeline | null = null;
  private temporalBindGroupLayout: GPUBindGroupLayout | null = null;
  private temporalBindGroup: GPUBindGroup | null = null;
  private temporalUniformBuffer: GPUBuffer | null = null;
  
  // Render targets
  private halfResTexture: GPUTexture | null = null;
  private halfResView: GPUTextureView | null = null;
  private historyTexture: GPUTexture | null = null;
  private historyView: GPUTextureView | null = null;
  private motionVectorTexture: GPUTexture | null = null;
  private motionVectorView: GPUTextureView | null = null;
  
  // Shared resources
  private weatherMap: ProceduralWeatherMap | null = null;
  private blueNoiseTexture: GPUTexture | null = null;
  private blueNoiseSampler: GPUSampler | null = null;
  private linearSampler: GPUSampler | null = null;
  
  // State
  private currentDepthView: GPUTextureView | null = null;
  private initialized = false;
  private frameIndex = 0;
  private currentWidth = 0;
  private currentHeight = 0;
  private presentationFormat: GPUTextureFormat = 'bgra8unorm';
  
  // Reusable arrays to avoid allocations
  private invViewProj = new Float32Array(16);
  private viewProj = new Float32Array(16);
  private prevViewProj = new Float32Array(16);
  private cloudUniformData = new Float32Array(80); // ~320 bytes
  private temporalUniformData = new Float32Array(8); // 32 bytes
  private validatedSunDir: [number, number, number] = [0, 1, 0];
  
  /**
   * Initialize the hybrid cloud pass
   * @param device WebGPU device
   * @param format Presentation format
   * @param sampleCount MSAA sample count (1 for half-res, upscaled later)
   */
  async initialize(
    device: GPUDevice,
    format: GPUTextureFormat,
    _sampleCount = 1 // Ignored - we always render at half res without MSAA
  ): Promise<void> {
    this.device = device;
    this.presentationFormat = format;
    
    // Initialize weather map generator
    this.weatherMap = new ProceduralWeatherMap(256, 100);
    await this.weatherMap.initialize(device);
    
    // Create blue noise texture
    this.blueNoiseTexture = createBlueNoiseTexture(device);
    
    // Create samplers
    this.blueNoiseSampler = device.createSampler({
      label: 'Hybrid Cloud Blue Noise Sampler',
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });
    
    this.linearSampler = device.createSampler({
      label: 'Hybrid Cloud Linear Sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
    
    // Create uniform buffers
    // Cloud uniforms: 3 mat4 (192) + params (~128) = ~320 bytes, align to 352
    this.cloudUniformBuffer = device.createBuffer({
      label: 'Hybrid Cloud Uniforms',
      size: 352,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Temporal uniforms: 32 bytes
    this.temporalUniformBuffer = device.createBuffer({
      label: 'Temporal Reprojection Uniforms',
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Create cloud bind group layout
    this.cloudBindGroupLayout = device.createBindGroupLayout({
      label: 'Hybrid Cloud Bind Group Layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth', multisampled: false } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });
    
    // Create temporal bind group layout
    this.temporalBindGroupLayout = device.createBindGroupLayout({
      label: 'Temporal Reprojection Bind Group Layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth', multisampled: false } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });
    
    // Create cloud shader module
    const cloudShaderModule = device.createShaderModule({
      label: 'Hybrid Cloud Shader',
      code: HYBRID_CLOUD_SHADER,
    });
    
    // Create temporal shader module
    const temporalShaderModule = device.createShaderModule({
      label: 'Temporal Reprojection Shader',
      code: TEMPORAL_SHADER,
    });
    
    // Create cloud pipeline (renders to half-res target)
    this.cloudPipeline = await device.createRenderPipelineAsync({
      label: 'Hybrid Cloud Pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.cloudBindGroupLayout],
      }),
      vertex: {
        module: cloudShaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: cloudShaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: 'rgba16float', // HDR for half-res
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: 1 },
    });
    
    // Create temporal pipeline (upscales and blends with history)
    this.temporalPipeline = await device.createRenderPipelineAsync({
      label: 'Temporal Reprojection Pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.temporalBindGroupLayout],
      }),
      vertex: {
        module: temporalShaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: temporalShaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: 1 },
    });
    
    this.initialized = true;
  }
  
  /**
   * Ensure render targets exist and match screen size
   */
  private ensureRenderTargets(width: number, height: number): void {
    if (!this.device) return;
    
    const halfWidth = Math.max(1, Math.floor(width / 2));
    const halfHeight = Math.max(1, Math.floor(height / 2));
    
    // Check if resize needed
    if (this.halfResTexture && this.currentWidth === width && this.currentHeight === height) {
      return;
    }
    
    this.currentWidth = width;
    this.currentHeight = height;
    
    // Destroy old textures
    this.halfResTexture?.destroy();
    this.historyTexture?.destroy();
    this.motionVectorTexture?.destroy();
    
    // Create half-res cloud render target
    this.halfResTexture = this.device.createTexture({
      label: 'Hybrid Cloud Half-Res Target',
      size: [halfWidth, halfHeight, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.halfResView = this.halfResTexture.createView();
    
    // Create history buffer (full res for temporal)
    this.historyTexture = this.device.createTexture({
      label: 'Hybrid Cloud History Buffer',
      size: [width, height, 1],
      format: this.presentationFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.historyView = this.historyTexture.createView();
    
    // Create motion vector buffer (half-res)
    this.motionVectorTexture = this.device.createTexture({
      label: 'Hybrid Cloud Motion Vectors',
      size: [halfWidth, halfHeight, 1],
      format: 'rg16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.motionVectorView = this.motionVectorTexture.createView();
  }
  
  /**
   * Update depth texture for scene occlusion
   */
  updateDepthTexture(depthTextureView: GPUTextureView): void {
    if (!this.initialized) return;
    this.currentDepthView = depthTextureView;
  }
  
  /**
   * Validate and normalize sun direction
   */
  private validateSunDirection(direction: Vec3): [number, number, number] {
    const x = Number.isFinite(direction[0]) ? direction[0] : 0;
    const y = Number.isFinite(direction[1]) ? direction[1] : 1;
    const z = Number.isFinite(direction[2]) ? direction[2] : 0;
    
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.0001) {
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
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Render hybrid volumetric clouds
   */
  render(
    passEncoder: GPURenderPassEncoder,
    viewProjectionMatrix: Float32Array | Mat4,
    cameraPosition: Vec3 | Float32Array | number[],
    params: Partial<HybridVolumetricCloudParams> = {},
    screenWidth = 1920,
    screenHeight = 1080
  ): void {
    if (!this.initialized || !this.device || !this.currentDepthView) return;
    
    const fullParams = { ...DEFAULT_PARAMS, ...params };
    
    // Ensure render targets
    this.ensureRenderTargets(screenWidth, screenHeight);
    
    // Update weather map
    if (this.weatherMap) {
      const weatherParams: Partial<WeatherMapParams> = {
        coverage: fullParams.cloudDensity,
        time: fullParams.time,
        windSpeed: fullParams.weatherSpeed,
        windDirection: fullParams.windDirection,
        patternScale: fullParams.weatherMapScale,
      };
      // Fire and forget - async update
      void this.weatherMap.update(weatherParams);
    }
    
    // Validate parameters
    const validatedSunDir = this.validateSunDirection(fullParams.sunDirection);
    const validatedThickness = Math.max(1, fullParams.cloudThickness);
    const validatedDensity = Math.max(0, Math.min(1, fullParams.cloudDensity));
    
    // Copy VP matrix and compute inverse
    if (viewProjectionMatrix instanceof Float32Array) {
      this.viewProj.set(viewProjectionMatrix);
    } else {
      for (let i = 0; i < 16; i++) {
        this.viewProj[i] = viewProjectionMatrix[i] ?? 0;
      }
    }
    mat4Invert(this.invViewProj, this.viewProj as unknown as Mat4);
    
    // Pack cloud uniforms
    this.packCloudUniforms(
      cameraPosition,
      fullParams,
      validatedSunDir,
      validatedThickness,
      validatedDensity,
      screenWidth,
      screenHeight
    );
    
    // Upload uniforms
    this.device.queue.writeBuffer(
      this.cloudUniformBuffer!,
      0,
      this.cloudUniformData.buffer,
      this.cloudUniformData.byteOffset,
      this.cloudUniformData.byteLength
    );
    
    // Create/update bind group
    this.updateCloudBindGroup();
    
    if (!this.cloudBindGroup || !this.cloudPipeline) return;
    
    // Render clouds
    passEncoder.setPipeline(this.cloudPipeline);
    passEncoder.setBindGroup(0, this.cloudBindGroup);
    passEncoder.draw(3, 1, 0, 0);
    
    // Store current VP as previous for next frame
    this.prevViewProj.set(this.viewProj);
    this.frameIndex++;
  }
  
  /**
   * Pack cloud shader uniforms
   */
  private packCloudUniforms(
    cameraPosition: Vec3 | Float32Array | number[],
    params: HybridVolumetricCloudParams,
    sunDir: [number, number, number],
    thickness: number,
    density: number,
    screenWidth: number,
    screenHeight: number
  ): void {
    let offset = 0;
    
    // mat4x4 viewProjectionInverse (16 floats)
    for (let i = 0; i < 16; i++) {
      this.cloudUniformData[offset++] = this.invViewProj[i] ?? 0;
    }
    
    // mat4x4 viewProjection (16 floats)
    for (let i = 0; i < 16; i++) {
      this.cloudUniformData[offset++] = this.viewProj[i] ?? 0;
    }
    
    // mat4x4 prevViewProjection (16 floats)
    for (let i = 0; i < 16; i++) {
      this.cloudUniformData[offset++] = this.prevViewProj[i] ?? 0;
    }
    
    // vec3 cameraPosition + f32 time
    this.cloudUniformData[offset++] = cameraPosition[0];
    this.cloudUniformData[offset++] = cameraPosition[1];
    this.cloudUniformData[offset++] = cameraPosition[2];
    this.cloudUniformData[offset++] = params.time;
    
    // vec3 sunDirection + f32 cloudAltitude
    this.cloudUniformData[offset++] = sunDir[0];
    this.cloudUniformData[offset++] = sunDir[1];
    this.cloudUniformData[offset++] = sunDir[2];
    this.cloudUniformData[offset++] = params.cloudAltitude;
    
    // vec3 sunColor + f32 cloudThickness
    this.cloudUniformData[offset++] = params.sunColor[0];
    this.cloudUniformData[offset++] = params.sunColor[1];
    this.cloudUniformData[offset++] = params.sunColor[2];
    this.cloudUniformData[offset++] = thickness;
    
    // vec3 skyColor + f32 cloudDensity
    this.cloudUniformData[offset++] = params.skyColor[0];
    this.cloudUniformData[offset++] = params.skyColor[1];
    this.cloudUniformData[offset++] = params.skyColor[2];
    this.cloudUniformData[offset++] = density;
    
    // f32 cloudSpeed + f32 screenWidth + f32 screenHeight + f32 nearPlane
    this.cloudUniformData[offset++] = params.cloudSpeed;
    this.cloudUniformData[offset++] = screenWidth;
    this.cloudUniformData[offset++] = screenHeight;
    this.cloudUniformData[offset++] = params.nearPlane;
    
    // f32 farPlane + f32 erosionStrength + f32 cloudType + f32 weatherMapScale
    this.cloudUniformData[offset++] = params.farPlane;
    this.cloudUniformData[offset++] = params.erosionStrength;
    this.cloudUniformData[offset++] = CLOUD_TYPE_VALUES[params.cloudType];
    this.cloudUniformData[offset++] = params.weatherMapScale;
  }
  
  /**
   * Update cloud bind group
   */
  private updateCloudBindGroup(): void {
    if (!this.device || !this.cloudBindGroupLayout || !this.currentDepthView) return;
    
    const weatherView = this.weatherMap?.getTextureView();
    const weatherSampler = this.weatherMap?.getSampler();
    
    if (!weatherView || !weatherSampler) return;
    
    this.cloudBindGroup = this.device.createBindGroup({
      label: 'Hybrid Cloud Bind Group',
      layout: this.cloudBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cloudUniformBuffer! } },
        { binding: 1, resource: this.currentDepthView },
        { binding: 2, resource: weatherView },
        { binding: 3, resource: weatherSampler },
        { binding: 4, resource: this.blueNoiseTexture!.createView() },
        { binding: 5, resource: this.blueNoiseSampler! },
      ],
    });
  }
  
  /**
   * Get weather map for external access
   */
  getWeatherMap(): ProceduralWeatherMap | null {
    return this.weatherMap;
  }
  
  /**
   * Cleanup GPU resources
   */
  dispose(): void {
    this.halfResTexture?.destroy();
    this.historyTexture?.destroy();
    this.motionVectorTexture?.destroy();
    this.cloudUniformBuffer?.destroy();
    this.temporalUniformBuffer?.destroy();
    this.blueNoiseTexture?.destroy();
    this.weatherMap?.dispose();
    
    this.halfResTexture = null;
    this.historyTexture = null;
    this.motionVectorTexture = null;
    this.cloudUniformBuffer = null;
    this.temporalUniformBuffer = null;
    this.blueNoiseTexture = null;
    this.weatherMap = null;
    this.cloudPipeline = null;
    this.temporalPipeline = null;
    this.cloudBindGroup = null;
    this.temporalBindGroup = null;
    this.device = null;
    this.initialized = false;
  }
}

