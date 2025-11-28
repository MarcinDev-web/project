/**
 * SDFAtlas - Manages 3D SDF textures for collision and effects
 * 
 * Provides:
 * - SDF texture pooling and reuse
 * - Automatic resolution scaling based on bounds
 * - Bind group creation for shader consumption
 * - GPU sampler configuration for SDF sampling
 */

import { SDFVolumeGenerator, type SDFVolumeConfig, type AABBCollider, type SphereCollider } from './SDFVolumeGenerator';

export interface SDFAtlasConfig {
  /** Default resolution for SDF volumes */
  defaultResolution: number;
  /** Maximum cached SDF volumes */
  maxCachedVolumes: number;
  /** Minimum voxel size (world units) for resolution scaling */
  minVoxelSize?: number;
}

export interface SDFVolumeEntry {
  id: string;
  texture: GPUTexture;
  config: SDFVolumeConfig;
  lastUsedFrame: number;
}

export class SDFAtlas {
  private device: GPUDevice;
  private config: SDFAtlasConfig;
  private generator: SDFVolumeGenerator;
  
  // Cached volumes
  private volumes = new Map<string, SDFVolumeEntry>();
  private frameCounter = 0;
  
  // Shared sampler for SDF lookups
  private sampler: GPUSampler | null = null;
  
  // Bind group layout for SDF consumption
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  
  constructor(device: GPUDevice, config: SDFAtlasConfig) {
    this.device = device;
    this.config = config;
    this.generator = new SDFVolumeGenerator(device);
    this.initialize();
  }
  
  private initialize(): void {
    // Create trilinear sampler for smooth SDF interpolation
    this.sampler = this.device.createSampler({
      label: 'sdf-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });
    
    // Create bind group layout for SDF consumption
    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: 'sdf-consumer-bgl',
      entries: [
        // SDF volume texture
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'unfilterable-float', viewDimension: '3d' },
        },
        // Sampler
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
        // SDF params uniform
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });
  }
  
  /**
   * Calculates appropriate resolution based on bounds and voxel size.
   */
  private calculateResolution(boundsMin: [number, number, number], boundsMax: [number, number, number]): [number, number, number] {
    const size: [number, number, number] = [
      boundsMax[0] - boundsMin[0],
      boundsMax[1] - boundsMin[1],
      boundsMax[2] - boundsMin[2],
    ];
    
    const minVoxelSize = this.config.minVoxelSize ?? 0.5;
    const defaultRes = this.config.defaultResolution;
    
    // Calculate resolution per axis to maintain voxel size
    const res: [number, number, number] = [
      Math.min(defaultRes, Math.ceil(size[0] / minVoxelSize)),
      Math.min(defaultRes, Math.ceil(size[1] / minVoxelSize)),
      Math.min(defaultRes, Math.ceil(size[2] / minVoxelSize)),
    ];
    
    // Ensure power of 2 for efficient GPU texture handling
    return [
      Math.max(8, this.nearestPowerOf2(res[0])),
      Math.max(8, this.nearestPowerOf2(res[1])),
      Math.max(8, this.nearestPowerOf2(res[2])),
    ];
  }
  
  private nearestPowerOf2(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
  
  /**
   * Gets or creates an SDF volume for AABBs.
   */
  getOrCreateFromAABBs(
    id: string,
    encoder: GPUCommandEncoder,
    boundsMin: [number, number, number],
    boundsMax: [number, number, number],
    aabbs: AABBCollider[]
  ): SDFVolumeEntry {
    this.frameCounter++;
    
    // Check cache
    let entry = this.volumes.get(id);
    if (entry) {
      entry.lastUsedFrame = this.frameCounter;
      return entry;
    }
    
    // Evict old entries if at capacity
    this.evictIfNeeded();
    
    // Create new volume
    const resolution = this.calculateResolution(boundsMin, boundsMax);
    const config: SDFVolumeConfig = {
      resolution,
      boundsMin,
      boundsMax,
      signed: false,
    };
    
    const texture = this.generator.createSDFTexture(config);
    this.generator.generateFromAABBs(encoder, texture, config, aabbs);
    
    entry = {
      id,
      texture,
      config,
      lastUsedFrame: this.frameCounter,
    };
    
    this.volumes.set(id, entry);
    return entry;
  }
  
  /**
   * Gets or creates an SDF volume for spheres.
   */
  getOrCreateFromSpheres(
    id: string,
    encoder: GPUCommandEncoder,
    boundsMin: [number, number, number],
    boundsMax: [number, number, number],
    spheres: SphereCollider[]
  ): SDFVolumeEntry {
    this.frameCounter++;
    
    let entry = this.volumes.get(id);
    if (entry) {
      entry.lastUsedFrame = this.frameCounter;
      return entry;
    }
    
    this.evictIfNeeded();
    
    const resolution = this.calculateResolution(boundsMin, boundsMax);
    const config: SDFVolumeConfig = {
      resolution,
      boundsMin,
      boundsMax,
      signed: false,
    };
    
    const texture = this.generator.createSDFTexture(config);
    this.generator.generateFromSpheres(encoder, texture, config, spheres);
    
    entry = {
      id,
      texture,
      config,
      lastUsedFrame: this.frameCounter,
    };
    
    this.volumes.set(id, entry);
    return entry;
  }
  
  /**
   * Gets or creates an SDF volume from point cloud.
   */
  getOrCreateFromPoints(
    id: string,
    encoder: GPUCommandEncoder,
    boundsMin: [number, number, number],
    boundsMax: [number, number, number],
    points: Float32Array,
    signed = false
  ): SDFVolumeEntry {
    this.frameCounter++;
    
    let entry = this.volumes.get(id);
    if (entry) {
      entry.lastUsedFrame = this.frameCounter;
      return entry;
    }
    
    this.evictIfNeeded();
    
    const resolution = this.calculateResolution(boundsMin, boundsMax);
    const config: SDFVolumeConfig = {
      resolution,
      boundsMin,
      boundsMax,
      signed,
    };
    
    const texture = this.generator.createSDFTexture(config);
    this.generator.generateFromPoints(encoder, texture, config, points);
    
    entry = {
      id,
      texture,
      config,
      lastUsedFrame: this.frameCounter,
    };
    
    this.volumes.set(id, entry);
    return entry;
  }
  
  /**
   * Updates an existing SDF volume with new AABB data.
   */
  updateFromAABBs(
    id: string,
    encoder: GPUCommandEncoder,
    aabbs: AABBCollider[]
  ): boolean {
    const entry = this.volumes.get(id);
    if (!entry) return false;
    
    this.generator.generateFromAABBs(encoder, entry.texture, entry.config, aabbs);
    entry.lastUsedFrame = this.frameCounter;
    return true;
  }
  
  /**
   * Creates a bind group for shader consumption of an SDF volume.
   */
  createBindGroup(entry: SDFVolumeEntry): { bindGroup: GPUBindGroup; paramsBuffer: GPUBuffer } {
    // Create params uniform buffer
    const paramsBuffer = this.device.createBuffer({
      label: `sdf-params-${entry.id}`,
      size: 48, // boundsMin (16), boundsMax (16), resolution (16)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Upload params
    const paramsData = new Float32Array(12);
    paramsData.set(entry.config.boundsMin, 0);
    paramsData[3] = 0; // padding
    paramsData.set(entry.config.boundsMax, 4);
    paramsData[7] = 0; // padding
    paramsData[8] = entry.config.resolution[0];
    paramsData[9] = entry.config.resolution[1];
    paramsData[10] = entry.config.resolution[2];
    paramsData[11] = 0; // padding
    this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);
    
    const bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout!,
      entries: [
        { binding: 0, resource: entry.texture.createView() },
        { binding: 1, resource: this.sampler! },
        { binding: 2, resource: { buffer: paramsBuffer } },
      ],
    });
    
    return { bindGroup, paramsBuffer };
  }
  
  /**
   * Gets the bind group layout for SDF consumption.
   */
  getBindGroupLayout(): GPUBindGroupLayout {
    return this.bindGroupLayout!;
  }
  
  /**
   * Removes a specific volume from cache.
   */
  remove(id: string): void {
    const entry = this.volumes.get(id);
    if (entry) {
      entry.texture.destroy();
      this.volumes.delete(id);
    }
  }
  
  /**
   * Invalidates all cached volumes.
   */
  invalidateAll(): void {
    for (const entry of this.volumes.values()) {
      entry.texture.destroy();
    }
    this.volumes.clear();
  }
  
  private evictIfNeeded(): void {
    if (this.volumes.size < this.config.maxCachedVolumes) return;
    
    // Find and remove least recently used
    let oldest: SDFVolumeEntry | null = null;
    let oldestFrame = Infinity;
    
    for (const entry of this.volumes.values()) {
      if (entry.lastUsedFrame < oldestFrame) {
        oldestFrame = entry.lastUsedFrame;
        oldest = entry;
      }
    }
    
    if (oldest) {
      oldest.texture.destroy();
      this.volumes.delete(oldest.id);
    }
  }
  
  dispose(): void {
    this.invalidateAll();
    this.generator.dispose();
    this.sampler = null;
    this.bindGroupLayout = null;
  }
}

