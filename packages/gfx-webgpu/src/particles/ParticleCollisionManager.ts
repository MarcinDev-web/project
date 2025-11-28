/**
 * ParticleCollisionManager - Manages SDF-based particle collision detection
 * 
 * Provides:
 * - SDF volume management for collision geometry
 * - Collision parameter configuration
 * - Integration with particle simulation pipeline
 */

import { SDFAtlas, type SDFVolumeEntry, type SDFAtlasConfig } from '../sdf/SDFAtlas';
import { type AABBCollider, type SphereCollider } from '../sdf/SDFVolumeGenerator';

export const enum CollisionMode {
  /** Bounce off surface with restitution */
  Bounce = 0,
  /** Slide along surface */
  Slide = 1,
  /** Kill particle on collision */
  Kill = 2,
  /** Stick to surface (zero velocity) */
  Stick = 3,
}

export interface ParticleCollisionConfig {
  /** Collision response mode */
  mode: CollisionMode;
  /** Bounce coefficient (0 = no bounce, 1 = perfect bounce) */
  restitution: number;
  /** Surface friction (0 = frictionless, 1 = full friction) */
  friction: number;
  /** Particle collision radius */
  particleRadius: number;
  /** Enable SDF-based collision */
  enableSDFCollision: boolean;
  /** Enable simple ground plane collision */
  enableGroundPlane: boolean;
  /** Ground plane Y coordinate */
  groundPlaneY: number;
}

export interface CollisionGeometry {
  /** AABBs for collision */
  aabbs?: AABBCollider[];
  /** Spheres for collision */
  spheres?: SphereCollider[];
  /** Point cloud for JFA-based SDF (advanced) */
  points?: Float32Array;
}

const DEFAULT_CONFIG: ParticleCollisionConfig = {
  mode: CollisionMode.Bounce,
  restitution: 0.5,
  friction: 0.1,
  particleRadius: 0.05,
  enableSDFCollision: true,
  enableGroundPlane: true,
  groundPlaneY: 0,
};

const DEFAULT_SDF_ATLAS_CONFIG: SDFAtlasConfig = {
  defaultResolution: 64,
  maxCachedVolumes: 8,
  minVoxelSize: 0.25,
};

export class ParticleCollisionManager {
  private device: GPUDevice;
  private config: ParticleCollisionConfig;
  private sdfAtlas: SDFAtlas;
  
  // Current active SDF volume
  private activeVolume: SDFVolumeEntry | null = null;
  private activeBindGroup: GPUBindGroup | null = null;
  private activeParamsBuffer: GPUBuffer | null = null;
  
  // Collision uniform buffer
  private collisionUniformBuffer: GPUBuffer | null = null;
  private collisionUniformData = new ArrayBuffer(64);
  
  // Bind group layout for collision shader
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  
  constructor(device: GPUDevice, config?: Partial<ParticleCollisionConfig>) {
    this.device = device;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sdfAtlas = new SDFAtlas(device, DEFAULT_SDF_ATLAS_CONFIG);
    this.initialize();
  }
  
  private initialize(): void {
    // Create collision uniform buffer
    this.collisionUniformBuffer = this.device.createBuffer({
      label: 'particle-collision-uniforms',
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Create bind group layout
    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: 'particle-collision-bgl',
      entries: [
        // SDF volume texture
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: 'unfilterable-float', viewDimension: '3d' },
        },
        // SDF sampler
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: 'filtering' },
        },
        // Collision params
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
      ],
    });
  }
  
  /**
   * Updates collision configuration.
   */
  setConfig(config: Partial<ParticleCollisionConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateUniformBuffer();
  }
  
  /**
   * Gets current collision configuration.
   */
  getConfig(): ParticleCollisionConfig {
    return { ...this.config };
  }
  
  /**
   * Sets collision mode.
   */
  setMode(mode: CollisionMode): void {
    this.config.mode = mode;
    this.updateUniformBuffer();
  }
  
  /**
   * Sets restitution (bounce coefficient).
   */
  setRestitution(restitution: number): void {
    this.config.restitution = Math.max(0, Math.min(1, restitution));
    this.updateUniformBuffer();
  }
  
  /**
   * Sets surface friction.
   */
  setFriction(friction: number): void {
    this.config.friction = Math.max(0, Math.min(1, friction));
    this.updateUniformBuffer();
  }
  
  /**
   * Sets particle collision radius.
   */
  setParticleRadius(radius: number): void {
    this.config.particleRadius = Math.max(0.001, radius);
    this.updateUniformBuffer();
  }
  
  /**
   * Sets ground plane parameters.
   */
  setGroundPlane(enabled: boolean, y = 0): void {
    this.config.enableGroundPlane = enabled;
    this.config.groundPlaneY = y;
    this.updateUniformBuffer();
  }
  
  /**
   * Updates collision geometry from AABBs.
   */
  updateCollisionFromAABBs(
    encoder: GPUCommandEncoder,
    id: string,
    boundsMin: [number, number, number],
    boundsMax: [number, number, number],
    aabbs: AABBCollider[]
  ): void {
    this.activeVolume = this.sdfAtlas.getOrCreateFromAABBs(
      id,
      encoder,
      boundsMin,
      boundsMax,
      aabbs
    );
    this.createCollisionBindGroup();
  }
  
  /**
   * Updates collision geometry from spheres.
   */
  updateCollisionFromSpheres(
    encoder: GPUCommandEncoder,
    id: string,
    boundsMin: [number, number, number],
    boundsMax: [number, number, number],
    spheres: SphereCollider[]
  ): void {
    this.activeVolume = this.sdfAtlas.getOrCreateFromSpheres(
      id,
      encoder,
      boundsMin,
      boundsMax,
      spheres
    );
    this.createCollisionBindGroup();
  }
  
  /**
   * Updates collision geometry from point cloud.
   */
  updateCollisionFromPoints(
    encoder: GPUCommandEncoder,
    id: string,
    boundsMin: [number, number, number],
    boundsMax: [number, number, number],
    points: Float32Array,
    signed = false
  ): void {
    this.activeVolume = this.sdfAtlas.getOrCreateFromPoints(
      id,
      encoder,
      boundsMin,
      boundsMax,
      points,
      signed
    );
    this.createCollisionBindGroup();
  }
  
  private createCollisionBindGroup(): void {
    if (!this.activeVolume || !this.bindGroupLayout) return;
    
    // Cleanup old resources
    this.activeParamsBuffer?.destroy();
    
    // Create SDF bind resources
    const { bindGroup: sdfBindGroup, paramsBuffer } = this.sdfAtlas.createBindGroup(this.activeVolume);
    
    // Store for cleanup
    this.activeParamsBuffer = paramsBuffer;
    
    // Get the sampler from SDF atlas bind group
    // We need to create our own bind group with the collision-specific layout
    const sampler = this.device.createSampler({
      label: 'particle-collision-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });
    
    // Update collision uniform buffer with SDF bounds
    this.updateUniformBufferWithBounds();
    
    this.activeBindGroup = this.device.createBindGroup({
      label: 'particle-collision-bg',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.activeVolume.texture.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: this.collisionUniformBuffer! } },
      ],
    });
  }
  
  private updateUniformBuffer(): void {
    const view = new DataView(this.collisionUniformData);
    
    // Keep existing bounds or use defaults
    const bounds = this.activeVolume?.config ?? {
      boundsMin: [0, 0, 0],
      boundsMax: [10, 10, 10],
      resolution: [64, 64, 64],
    };
    
    // boundsMin (vec3 + pad)
    view.setFloat32(0, bounds.boundsMin[0], true);
    view.setFloat32(4, bounds.boundsMin[1], true);
    view.setFloat32(8, bounds.boundsMin[2], true);
    view.setFloat32(12, 0, true);
    
    // boundsMax (vec3 + pad)
    view.setFloat32(16, bounds.boundsMax[0], true);
    view.setFloat32(20, bounds.boundsMax[1], true);
    view.setFloat32(24, bounds.boundsMax[2], true);
    view.setFloat32(28, 0, true);
    
    // resolution (vec3 + pad)
    view.setFloat32(32, bounds.resolution[0], true);
    view.setFloat32(36, bounds.resolution[1], true);
    view.setFloat32(40, bounds.resolution[2], true);
    view.setFloat32(44, 0, true);
    
    // Collision params
    view.setFloat32(48, this.config.restitution, true);
    view.setFloat32(52, this.config.friction, true);
    view.setUint32(56, this.config.mode, true);
    view.setFloat32(60, this.config.particleRadius, true);
    
    this.device.queue.writeBuffer(
      this.collisionUniformBuffer!,
      0,
      this.collisionUniformData
    );
  }
  
  private updateUniformBufferWithBounds(): void {
    if (!this.activeVolume) return;
    
    const view = new DataView(this.collisionUniformData);
    const bounds = this.activeVolume.config;
    
    // boundsMin
    view.setFloat32(0, bounds.boundsMin[0], true);
    view.setFloat32(4, bounds.boundsMin[1], true);
    view.setFloat32(8, bounds.boundsMin[2], true);
    view.setFloat32(12, 0, true);
    
    // boundsMax
    view.setFloat32(16, bounds.boundsMax[0], true);
    view.setFloat32(20, bounds.boundsMax[1], true);
    view.setFloat32(24, bounds.boundsMax[2], true);
    view.setFloat32(28, 0, true);
    
    // resolution
    view.setFloat32(32, bounds.resolution[0], true);
    view.setFloat32(36, bounds.resolution[1], true);
    view.setFloat32(40, bounds.resolution[2], true);
    view.setFloat32(44, 0, true);
    
    // Collision params
    view.setFloat32(48, this.config.restitution, true);
    view.setFloat32(52, this.config.friction, true);
    view.setUint32(56, this.config.mode, true);
    view.setFloat32(60, this.config.particleRadius, true);
    
    this.device.queue.writeBuffer(
      this.collisionUniformBuffer!,
      0,
      this.collisionUniformData
    );
  }
  
  /**
   * Gets the collision bind group for use in particle simulation shader.
   * Returns null if no collision geometry is set.
   */
  getBindGroup(): GPUBindGroup | null {
    return this.activeBindGroup;
  }
  
  /**
   * Gets the bind group layout for pipeline creation.
   */
  getBindGroupLayout(): GPUBindGroupLayout {
    return this.bindGroupLayout!;
  }
  
  /**
   * Gets the collision uniform buffer for external use.
   */
  getUniformBuffer(): GPUBuffer {
    return this.collisionUniformBuffer!;
  }
  
  /**
   * Checks if collision is currently enabled and configured.
   */
  isCollisionEnabled(): boolean {
    return this.config.enableSDFCollision && this.activeVolume !== null;
  }
  
  /**
   * Invalidates the current SDF volume (forces rebuild on next update).
   */
  invalidate(): void {
    this.activeVolume = null;
    this.activeBindGroup = null;
  }
  
  /**
   * Disposes all GPU resources.
   */
  dispose(): void {
    this.sdfAtlas.dispose();
    this.collisionUniformBuffer?.destroy();
    this.activeParamsBuffer?.destroy();
    
    this.collisionUniformBuffer = null;
    this.activeParamsBuffer = null;
    this.activeVolume = null;
    this.activeBindGroup = null;
    this.bindGroupLayout = null;
  }
}

