/**
 * SDFVolumeGenerator - GPU-based Signed Distance Field generation
 * 
 * Generates 3D SDF volumes from scene geometry for use in particle collision,
 * volumetric effects, and other distance-based operations.
 * 
 * Supports multiple input modes:
 * - Point cloud seeding with Jump Flooding Algorithm (JFA)
 * - Analytical SDF from AABBs (fast path for box colliders)
 * - Analytical SDF from spheres
 * - Union of multiple SDF sources
 */

import sdfGenerateShader from '../shaders/compute/sdf_generate.wgsl?raw';

export interface SDFVolumeConfig {
  /** Volume resolution (default: 64x64x64) */
  resolution: [number, number, number];
  /** World-space bounds minimum */
  boundsMin: [number, number, number];
  /** World-space bounds maximum */
  boundsMax: [number, number, number];
  /** Generate signed distance (requires inside/outside info) */
  signed?: boolean;
}

export interface AABBCollider {
  min: [number, number, number];
  max: [number, number, number];
}

export interface SphereCollider {
  center: [number, number, number];
  radius: number;
}

const WORKGROUP_SIZE = 4; // 4x4x4 = 64 threads

export class SDFVolumeGenerator {
  private device: GPUDevice;
  
  // Shader module
  private shaderModule: GPUShaderModule | null = null;
  
  // Pipelines
  private initSeedsPipeline: GPUComputePipeline | null = null;
  private seedFromGeometryPipeline: GPUComputePipeline | null = null;
  private jfaPassPipeline: GPUComputePipeline | null = null;
  private computeDistancesPipeline: GPUComputePipeline | null = null;
  private computeAABBPipeline: GPUComputePipeline | null = null;
  private computeSpherePipeline: GPUComputePipeline | null = null;
  
  // Bind group layouts
  private mainBindGroupLayout: GPUBindGroupLayout | null = null;
  private aabbBindGroupLayout: GPUBindGroupLayout | null = null;
  
  // Uniform buffer
  private uniformBuffer: GPUBuffer | null = null;
  private uniformData = new ArrayBuffer(64);
  
  constructor(device: GPUDevice) {
    this.device = device;
    this.initialize();
  }
  
  private initialize(): void {
    // Create shader module
    this.shaderModule = this.device.createShaderModule({
      label: 'sdf-generate-shader',
      code: sdfGenerateShader,
    });
    
    // Create uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      label: 'sdf-uniforms',
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Create main bind group layout (shared by most pipelines)
    this.mainBindGroupLayout = this.device.createBindGroupLayout({
      label: 'sdf-main-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'r32float', viewDimension: '3d' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });
    
    // Create AABB/Sphere bind group layout
    this.aabbBindGroupLayout = this.device.createBindGroupLayout({
      label: 'sdf-aabb-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });
    
    // Create pipelines
    this.createPipelines();
  }
  
  private createPipelines(): void {
    const mainLayout = this.device.createPipelineLayout({
      label: 'sdf-main-layout',
      bindGroupLayouts: [this.mainBindGroupLayout!],
    });
    
    const aabbLayout = this.device.createPipelineLayout({
      label: 'sdf-aabb-layout',
      bindGroupLayouts: [this.mainBindGroupLayout!, this.aabbBindGroupLayout!],
    });
    
    // Initialize seeds pipeline
    this.initSeedsPipeline = this.device.createComputePipeline({
      label: 'sdf-init-seeds',
      layout: mainLayout,
      compute: { module: this.shaderModule!, entryPoint: 'initSeeds' },
    });
    
    // Seed from geometry pipeline
    this.seedFromGeometryPipeline = this.device.createComputePipeline({
      label: 'sdf-seed-geometry',
      layout: mainLayout,
      compute: { module: this.shaderModule!, entryPoint: 'seedFromGeometry' },
    });
    
    // JFA pass pipeline
    this.jfaPassPipeline = this.device.createComputePipeline({
      label: 'sdf-jfa-pass',
      layout: mainLayout,
      compute: { module: this.shaderModule!, entryPoint: 'jfaPass' },
    });
    
    // Compute distances pipeline
    this.computeDistancesPipeline = this.device.createComputePipeline({
      label: 'sdf-compute-distances',
      layout: mainLayout,
      compute: { module: this.shaderModule!, entryPoint: 'computeDistances' },
    });
    
    // AABB SDF pipeline
    this.computeAABBPipeline = this.device.createComputePipeline({
      label: 'sdf-compute-aabb',
      layout: aabbLayout,
      compute: { module: this.shaderModule!, entryPoint: 'computeAABBSDF' },
    });
    
    // Sphere SDF pipeline
    this.computeSpherePipeline = this.device.createComputePipeline({
      label: 'sdf-compute-sphere',
      layout: aabbLayout,
      compute: { module: this.shaderModule!, entryPoint: 'computeSphereSDF' },
    });
  }
  
  /**
   * Creates an SDF volume texture.
   */
  createSDFTexture(config: SDFVolumeConfig): GPUTexture {
    return this.device.createTexture({
      label: 'sdf-volume',
      size: config.resolution,
      format: 'r32float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
      dimension: '3d',
    });
  }
  
  /**
   * Generates SDF from a list of AABBs (analytical, no JFA needed).
   * This is the fastest path for simple box-based collision geometry.
   */
  generateFromAABBs(
    encoder: GPUCommandEncoder,
    output: GPUTexture,
    config: SDFVolumeConfig,
    aabbs: AABBCollider[]
  ): void {
    if (aabbs.length === 0) return;
    
    // Update uniforms
    this.updateUniforms(config, 0, 0);
    
    // Create AABB buffer
    const aabbData = new Float32Array(aabbs.length * 8);
    for (let i = 0; i < aabbs.length; i++) {
      const aabb = aabbs[i]!;
      aabbData[i * 8 + 0] = aabb.min[0];
      aabbData[i * 8 + 1] = aabb.min[1];
      aabbData[i * 8 + 2] = aabb.min[2];
      aabbData[i * 8 + 3] = 0; // padding
      aabbData[i * 8 + 4] = aabb.max[0];
      aabbData[i * 8 + 5] = aabb.max[1];
      aabbData[i * 8 + 6] = aabb.max[2];
      aabbData[i * 8 + 7] = 0; // padding
    }
    
    const aabbBuffer = this.device.createBuffer({
      label: 'sdf-aabb-list',
      size: aabbData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(aabbBuffer, 0, aabbData);
    
    const countBuffer = this.device.createBuffer({
      label: 'sdf-aabb-count',
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(countBuffer, 0, new Uint32Array([aabbs.length]));
    
    // Create dummy buffers for unused bindings
    const dummyBuffer = this.device.createBuffer({
      label: 'sdf-dummy',
      size: 64,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.UNIFORM,
    });
    
    // Create bind groups
    const mainBindGroup = this.device.createBindGroup({
      layout: this.mainBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: dummyBuffer } },
        { binding: 2, resource: { buffer: dummyBuffer } },
        { binding: 3, resource: output.createView() },
        { binding: 4, resource: { buffer: dummyBuffer } },
        { binding: 5, resource: { buffer: dummyBuffer } },
      ],
    });
    
    const aabbBindGroup = this.device.createBindGroup({
      layout: this.aabbBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: aabbBuffer } },
        { binding: 1, resource: { buffer: countBuffer } },
        { binding: 2, resource: { buffer: dummyBuffer } },
        { binding: 3, resource: { buffer: countBuffer } }, // reuse as dummy
      ],
    });
    
    // Dispatch
    const pass = encoder.beginComputePass({ label: 'sdf-aabb-pass' });
    pass.setPipeline(this.computeAABBPipeline!);
    pass.setBindGroup(0, mainBindGroup);
    pass.setBindGroup(1, aabbBindGroup);
    
    const [rx, ry, rz] = config.resolution;
    pass.dispatchWorkgroups(
      Math.ceil(rx / WORKGROUP_SIZE),
      Math.ceil(ry / WORKGROUP_SIZE),
      Math.ceil(rz / WORKGROUP_SIZE)
    );
    pass.end();
    
    // Cleanup
    aabbBuffer.destroy();
    countBuffer.destroy();
    dummyBuffer.destroy();
  }
  
  /**
   * Generates SDF from a list of spheres (analytical).
   */
  generateFromSpheres(
    encoder: GPUCommandEncoder,
    output: GPUTexture,
    config: SDFVolumeConfig,
    spheres: SphereCollider[]
  ): void {
    if (spheres.length === 0) return;
    
    // Update uniforms
    this.updateUniforms(config, 0, 0);
    
    // Create sphere buffer
    const sphereData = new Float32Array(spheres.length * 4);
    for (let i = 0; i < spheres.length; i++) {
      const sphere = spheres[i]!;
      sphereData[i * 4 + 0] = sphere.center[0];
      sphereData[i * 4 + 1] = sphere.center[1];
      sphereData[i * 4 + 2] = sphere.center[2];
      sphereData[i * 4 + 3] = sphere.radius;
    }
    
    const sphereBuffer = this.device.createBuffer({
      label: 'sdf-sphere-list',
      size: sphereData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(sphereBuffer, 0, sphereData);
    
    const countBuffer = this.device.createBuffer({
      label: 'sdf-sphere-count',
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(countBuffer, 0, new Uint32Array([spheres.length]));
    
    // Create dummy buffers
    const dummyBuffer = this.device.createBuffer({
      label: 'sdf-dummy',
      size: 64,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.UNIFORM,
    });
    
    // Create bind groups
    const mainBindGroup = this.device.createBindGroup({
      layout: this.mainBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: dummyBuffer } },
        { binding: 2, resource: { buffer: dummyBuffer } },
        { binding: 3, resource: output.createView() },
        { binding: 4, resource: { buffer: dummyBuffer } },
        { binding: 5, resource: { buffer: dummyBuffer } },
      ],
    });
    
    const sphereBindGroup = this.device.createBindGroup({
      layout: this.aabbBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: dummyBuffer } },
        { binding: 1, resource: { buffer: countBuffer } },
        { binding: 2, resource: { buffer: sphereBuffer } },
        { binding: 3, resource: { buffer: countBuffer } },
      ],
    });
    
    // Dispatch
    const pass = encoder.beginComputePass({ label: 'sdf-sphere-pass' });
    pass.setPipeline(this.computeSpherePipeline!);
    pass.setBindGroup(0, mainBindGroup);
    pass.setBindGroup(1, sphereBindGroup);
    
    const [rx, ry, rz] = config.resolution;
    pass.dispatchWorkgroups(
      Math.ceil(rx / WORKGROUP_SIZE),
      Math.ceil(ry / WORKGROUP_SIZE),
      Math.ceil(rz / WORKGROUP_SIZE)
    );
    pass.end();
    
    // Cleanup
    sphereBuffer.destroy();
    countBuffer.destroy();
    dummyBuffer.destroy();
  }
  
  /**
   * Generates SDF from point cloud using Jump Flooding Algorithm.
   * This is more expensive but supports arbitrary geometry.
   * 
   * @param points Array of [x, y, z, inside] where inside is 1 for points inside geometry
   */
  generateFromPoints(
    encoder: GPUCommandEncoder,
    output: GPUTexture,
    config: SDFVolumeConfig,
    points: Float32Array
  ): void {
    const [rx, ry, rz] = config.resolution;
    const totalVoxels = rx * ry * rz;
    const pointCount = Math.floor(points.length / 4);
    
    if (pointCount === 0) return;
    
    // Create seed buffers (ping-pong)
    const seedBufferSize = totalVoxels * 16; // vec3<i32> + i32 = 16 bytes
    const seedBufferA = this.device.createBuffer({
      label: 'sdf-seeds-a',
      size: seedBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const seedBufferB = this.device.createBuffer({
      label: 'sdf-seeds-b',
      size: seedBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    
    // Create geometry points buffer
    const geoBuffer = this.device.createBuffer({
      label: 'sdf-geometry-points',
      size: points.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(geoBuffer, 0, points.buffer as ArrayBuffer, points.byteOffset, points.byteLength);
    
    const geoCountBuffer = this.device.createBuffer({
      label: 'sdf-geometry-count',
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(geoCountBuffer, 0, new Uint32Array([pointCount]));
    
    // Calculate JFA pass count
    const maxDim = Math.max(rx, ry, rz);
    const passCount = Math.ceil(Math.log2(maxDim));
    
    let readBuffer = seedBufferA;
    let writeBuffer = seedBufferB;
    
    // Initialize seeds
    this.updateUniforms(config, 0, 0);
    const initBindGroup = this.createJFABindGroup(readBuffer, writeBuffer, output, geoBuffer, geoCountBuffer);
    
    let pass = encoder.beginComputePass({ label: 'sdf-init-seeds' });
    pass.setPipeline(this.initSeedsPipeline!);
    pass.setBindGroup(0, initBindGroup);
    pass.dispatchWorkgroups(Math.ceil(totalVoxels / 64));
    pass.end();
    
    // Swap buffers
    [readBuffer, writeBuffer] = [writeBuffer, readBuffer];
    
    // Seed from geometry
    const seedBindGroup = this.createJFABindGroup(readBuffer, writeBuffer, output, geoBuffer, geoCountBuffer);
    pass = encoder.beginComputePass({ label: 'sdf-seed-geometry' });
    pass.setPipeline(this.seedFromGeometryPipeline!);
    pass.setBindGroup(0, seedBindGroup);
    pass.dispatchWorkgroups(Math.ceil(pointCount / 64));
    pass.end();
    
    [readBuffer, writeBuffer] = [writeBuffer, readBuffer];
    
    // JFA passes
    for (let i = 0; i < passCount; i++) {
      const stepSize = Math.pow(2, passCount - 1 - i);
      this.updateUniforms(config, stepSize, i);
      
      const jfaBindGroup = this.createJFABindGroup(readBuffer, writeBuffer, output, geoBuffer, geoCountBuffer);
      
      pass = encoder.beginComputePass({ label: `sdf-jfa-pass-${i}` });
      pass.setPipeline(this.jfaPassPipeline!);
      pass.setBindGroup(0, jfaBindGroup);
      pass.dispatchWorkgroups(
        Math.ceil(rx / WORKGROUP_SIZE),
        Math.ceil(ry / WORKGROUP_SIZE),
        Math.ceil(rz / WORKGROUP_SIZE)
      );
      pass.end();
      
      [readBuffer, writeBuffer] = [writeBuffer, readBuffer];
    }
    
    // Final step (step size 1)
    this.updateUniforms(config, 1, passCount);
    const finalJfaBindGroup = this.createJFABindGroup(readBuffer, writeBuffer, output, geoBuffer, geoCountBuffer);
    pass = encoder.beginComputePass({ label: 'sdf-jfa-final' });
    pass.setPipeline(this.jfaPassPipeline!);
    pass.setBindGroup(0, finalJfaBindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(rx / WORKGROUP_SIZE),
      Math.ceil(ry / WORKGROUP_SIZE),
      Math.ceil(rz / WORKGROUP_SIZE)
    );
    pass.end();
    
    [readBuffer, writeBuffer] = [writeBuffer, readBuffer];
    
    // Compute final distances
    this.updateUniforms(config, 1, passCount + 1);
    const distBindGroup = this.createJFABindGroup(readBuffer, writeBuffer, output, geoBuffer, geoCountBuffer);
    pass = encoder.beginComputePass({ label: 'sdf-compute-distances' });
    pass.setPipeline(this.computeDistancesPipeline!);
    pass.setBindGroup(0, distBindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(rx / WORKGROUP_SIZE),
      Math.ceil(ry / WORKGROUP_SIZE),
      Math.ceil(rz / WORKGROUP_SIZE)
    );
    pass.end();
    
    // Cleanup
    seedBufferA.destroy();
    seedBufferB.destroy();
    geoBuffer.destroy();
    geoCountBuffer.destroy();
  }
  
  private updateUniforms(config: SDFVolumeConfig, stepSize: number, passIndex: number): void {
    const view = new DataView(this.uniformData);
    
    // resolution (vec3<u32>)
    view.setUint32(0, config.resolution[0], true);
    view.setUint32(4, config.resolution[1], true);
    view.setUint32(8, config.resolution[2], true);
    view.setUint32(12, 0, true); // padding
    
    // boundsMin (vec3<f32>)
    view.setFloat32(16, config.boundsMin[0], true);
    view.setFloat32(20, config.boundsMin[1], true);
    view.setFloat32(24, config.boundsMin[2], true);
    view.setFloat32(28, 0, true); // padding
    
    // boundsMax (vec3<f32>)
    view.setFloat32(32, config.boundsMax[0], true);
    view.setFloat32(36, config.boundsMax[1], true);
    view.setFloat32(40, config.boundsMax[2], true);
    view.setFloat32(44, 0, true); // padding
    
    // stepSize, passIndex, signMode
    view.setInt32(48, stepSize, true);
    view.setUint32(52, passIndex, true);
    view.setUint32(56, config.signed ? 1 : 0, true);
    view.setUint32(60, 0, true); // padding
    
    this.device.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData);
  }
  
  private createJFABindGroup(
    seedsIn: GPUBuffer,
    seedsOut: GPUBuffer,
    output: GPUTexture,
    geoBuffer: GPUBuffer,
    geoCountBuffer: GPUBuffer
  ): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.mainBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: seedsIn } },
        { binding: 2, resource: { buffer: seedsOut } },
        { binding: 3, resource: output.createView() },
        { binding: 4, resource: { buffer: geoBuffer } },
        { binding: 5, resource: { buffer: geoCountBuffer } },
      ],
    });
  }
  
  dispose(): void {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
    this.shaderModule = null;
  }
}

