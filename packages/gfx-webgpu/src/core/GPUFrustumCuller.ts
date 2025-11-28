/**
 * GPU Frustum Culler (Enhanced)
 * 
 * Performs frustum culling on the GPU using compute shaders.
 * Supports two culling strategies:
 * 
 * 1. **Flat Culling** (default): Direct per-instance frustum tests
 *    - Best for small to medium scenes (<10k instances)
 *    - Uses workgroup-local counting to reduce atomic contention
 *    - Per-instance bounding spheres (vec4: xyz=center, w=radius)
 * 
 * 2. **Hierarchical BVH Culling**: Two-level BVH traversal
 *    - Best for large scenes (10k+ instances)
 *    - Skips entire subtrees that fail frustum test
 *    - Requires BVH to be built/updated on CPU, uploaded to GPU
 */
import type { Mat4, FrustumPlane } from '@engine/core/math';
import { extractFrustumPlanes } from '@engine/core/math';
import { Logger } from '@engine/core/utils';

// ============================================================================
// Constants
// ============================================================================

const WORKGROUP_SIZE = 64;
const FRUSTUM_UNIFORM_SIZE = 128; // 6 planes * vec4 + misc vec4

// BVH node flags
const BVH_NODE_FLAG_LEAF = 0x80000000;

// ============================================================================
// Types
// ============================================================================

export interface CullResult {
  drawIndirectBuffer: GPUBuffer;
  visibleCountBuffer: GPUBuffer;
  visibleIndicesBuffer: GPUBuffer;
}

export interface BVHNode {
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  // For internal nodes: child indices, for leaf nodes: instance start + count
  child0: number;
  child1: number;
  isLeaf: boolean;
}

export interface GPUBVHData {
  nodes: Float32Array;  // Linearized nodes (8 floats per node)
  nodeCount: number;
}

export type CullingStrategy = 'flat' | 'bvh' | 'bvh-parallel' | 'bvh-coherent';

export interface GPUFrustumCullerOptions {
  /** Culling strategy. Default: 'flat' */
  strategy?: CullingStrategy;
  /** Threshold instance count to auto-switch to BVH. Default: 10000 */
  bvhThreshold?: number;
  /** Enable shared memory optimization. Default: true */
  useSharedMemory?: boolean;
  /** Number of workgroups for parallel BVH traversal. Default: 16 */
  parallelWorkgroups?: number;
  /** Enable frustum-coherent traversal (distance-based child ordering). Default: true */
  useCoherentTraversal?: boolean;
  /** Enable Hi-Z occlusion culling when Hi-Z texture is available. Default: true */
  useHiZOcclusion?: boolean;
}

export interface HiZOcclusionParams {
  /** Hi-Z depth texture (r32float with mip chain) */
  hiZTexture: GPUTexture;
  /** Hi-Z sampler */
  hiZSampler: GPUSampler;
  /** Screen dimensions */
  screenWidth: number;
  screenHeight: number;
  /** Number of Hi-Z mip levels */
  mipLevels: number;
}

// ============================================================================
// GPU Frustum Culler Implementation
// ============================================================================

// Work queue constants for parallel BVH
const WORK_QUEUE_CAPACITY = 16384;
const PARALLEL_UNIFORM_SIZE = 192; // 6 planes * vec4 + misc vec4 + viewProj mat4x4

export class GPUFrustumCuller {
  private device: GPUDevice;
  private options: Required<GPUFrustumCullerOptions>;
  
  // Pipelines - Flat culling
  private flatCullPipeline: GPUComputePipeline | null = null;
  private flatCullSimplePipeline: GPUComputePipeline | null = null;
  private finalizePipeline: GPUComputePipeline | null = null;
  private resetPipeline: GPUComputePipeline | null = null;
  
  // Pipelines - BVH culling (single-threaded)
  private bvhTraversePipeline: GPUComputePipeline | null = null;
  
  // Pipelines - Parallel BVH culling
  private bvhExpandTopLevelsPipeline: GPUComputePipeline | null = null;
  private bvhParallelTraversePipeline: GPUComputePipeline | null = null;
  private bvhParallelResetPipeline: GPUComputePipeline | null = null;
  private bvhParallelFinalizePipeline: GPUComputePipeline | null = null;
  
  // Bind group layouts
  private flatBindGroupLayout: GPUBindGroupLayout | null = null;
  private bvhBindGroupLayout: GPUBindGroupLayout | null = null;
  private parallelBvhCoreLayout: GPUBindGroupLayout | null = null;
  private parallelBvhQueueLayout: GPUBindGroupLayout | null = null;
  
  // Buffers - Core
  private uniformBuffer: GPUBuffer | null = null;
  private visibleCountBuffer: GPUBuffer | null = null;
  private visibleIndicesBuffer: GPUBuffer | null = null;
  private drawIndirectBuffer: GPUBuffer | null = null;
  private bvhNodesBuffer: GPUBuffer | null = null;
  
  // Buffers - Parallel BVH work queue
  private workQueueBuffer: GPUBuffer | null = null;
  private queueHeadBuffer: GPUBuffer | null = null;
  private queueTailBuffer: GPUBuffer | null = null;
  private activeWorkgroupsBuffer: GPUBuffer | null = null;
  
  // Cached state
  private maxInstances = 0;
  private bvhNodeCount = 0;
  private initialized = false;
  private parallelBvhInitialized = false;
  
  // Reusable frustum planes (avoid allocations)
  private readonly frustumPlanes: FrustumPlane[] = Array.from({ length: 6 }, () => ({
    normal: [0, 0, 0] as [number, number, number],
    d: 0,
  }));

  // Pipelines - Coherent BVH traversal
  private bvhCoherentTraversePipeline: GPUComputePipeline | null = null;
  
  // Pipelines - Hi-Z occlusion culling
  private hiZOcclusionPipeline: GPUComputePipeline | null = null;
  private hiZBindGroupLayout: GPUBindGroupLayout | null = null;
  
  // Buffers - Hi-Z occlusion  
  private hiZUniformBuffer: GPUBuffer | null = null;
  private hiZOcclusionInitialized = false;

  constructor(device: GPUDevice, options: GPUFrustumCullerOptions = {}) {
    this.device = device;
    this.options = {
      strategy: options.strategy ?? 'flat',
      bvhThreshold: options.bvhThreshold ?? 10000,
      useSharedMemory: options.useSharedMemory ?? true,
      parallelWorkgroups: options.parallelWorkgroups ?? 16,
      useCoherentTraversal: options.useCoherentTraversal ?? true,
      useHiZOcclusion: options.useHiZOcclusion ?? true,
    };
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initializes GPU resources. Called lazily on first cull.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.createPipelines();
      this.createStaticBuffers();
      this.initialized = true;
    } catch (err) {
      Logger.warn('[GPUFrustumCuller] Initialization failed:', err);
      this.initialized = false;
      throw err;
    }
  }

  private async createPipelines(): Promise<void> {
    // Flat culling shader
    const flatShaderCode = this.getFlatCullShaderCode();
    const flatModule = this.device.createShaderModule({
      label: 'gpu-cull-flat-shader',
      code: flatShaderCode,
    });

    // Flat bind group layout
    this.flatBindGroupLayout = this.device.createBindGroupLayout({
      label: 'gpu-cull-flat-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    const flatPipelineLayout = this.device.createPipelineLayout({
      label: 'gpu-cull-flat-layout',
      bindGroupLayouts: [this.flatBindGroupLayout],
    });

    // Create flat culling pipelines
    this.flatCullPipeline = this.device.createComputePipeline({
      label: 'gpu-cull-flat-main',
      layout: flatPipelineLayout,
      compute: { module: flatModule, entryPoint: 'main' },
    });

    this.flatCullSimplePipeline = this.device.createComputePipeline({
      label: 'gpu-cull-flat-simple',
      layout: flatPipelineLayout,
      compute: { module: flatModule, entryPoint: 'main_simple' },
    });

    this.finalizePipeline = this.device.createComputePipeline({
      label: 'gpu-cull-finalize',
      layout: flatPipelineLayout,
      compute: { module: flatModule, entryPoint: 'finalize' },
    });

    this.resetPipeline = this.device.createComputePipeline({
      label: 'gpu-cull-reset',
      layout: flatPipelineLayout,
      compute: { module: flatModule, entryPoint: 'reset' },
    });

    // BVH culling shader (optional, created on demand)
    if (this.options.strategy === 'bvh') {
      await this.createBVHPipelines();
    }
  }

  private async createBVHPipelines(): Promise<void> {
    const bvhShaderCode = this.getBVHCullShaderCode();
    const bvhModule = this.device.createShaderModule({
      label: 'gpu-cull-bvh-shader',
      code: bvhShaderCode,
    });

    this.bvhBindGroupLayout = this.device.createBindGroupLayout({
      label: 'gpu-cull-bvh-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    const bvhPipelineLayout = this.device.createPipelineLayout({
      label: 'gpu-cull-bvh-layout',
      bindGroupLayouts: [this.bvhBindGroupLayout],
    });

    this.bvhTraversePipeline = this.device.createComputePipeline({
      label: 'gpu-cull-bvh-traverse',
      layout: bvhPipelineLayout,
      compute: { module: bvhModule, entryPoint: 'traverseBVH' },
    });

    // Coherent traversal pipeline (with distance-based ordering)
    this.bvhCoherentTraversePipeline = this.device.createComputePipeline({
      label: 'gpu-cull-bvh-coherent',
      layout: bvhPipelineLayout,
      compute: { module: bvhModule, entryPoint: 'traverseBVHCoherent' },
    });
  }

  /**
   * Creates pipelines for parallel BVH traversal with work-stealing.
   */
  private async createParallelBVHPipelines(): Promise<void> {
    if (this.parallelBvhInitialized) return;

    const shaderCode = this.getParallelBVHShaderCode();
    const shaderModule = this.device.createShaderModule({
      label: 'gpu-cull-bvh-parallel-shader',
      code: shaderCode,
    });

    // Core bind group layout (group 0)
    this.parallelBvhCoreLayout = this.device.createBindGroupLayout({
      label: 'gpu-cull-parallel-bvh-core-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    // Work queue bind group layout (group 1)
    this.parallelBvhQueueLayout = this.device.createBindGroupLayout({
      label: 'gpu-cull-parallel-bvh-queue-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: 'gpu-cull-parallel-bvh-layout',
      bindGroupLayouts: [this.parallelBvhCoreLayout, this.parallelBvhQueueLayout],
    });

    // Create pipelines
    this.bvhExpandTopLevelsPipeline = this.device.createComputePipeline({
      label: 'gpu-cull-bvh-expand-top',
      layout: pipelineLayout,
      compute: { module: shaderModule, entryPoint: 'expandTopLevels' },
    });

    this.bvhParallelTraversePipeline = this.device.createComputePipeline({
      label: 'gpu-cull-bvh-parallel-traverse',
      layout: pipelineLayout,
      compute: { module: shaderModule, entryPoint: 'parallelTraverse' },
    });

    this.bvhParallelResetPipeline = this.device.createComputePipeline({
      label: 'gpu-cull-bvh-parallel-reset',
      layout: pipelineLayout,
      compute: { module: shaderModule, entryPoint: 'reset' },
    });

    this.bvhParallelFinalizePipeline = this.device.createComputePipeline({
      label: 'gpu-cull-bvh-parallel-finalize',
      layout: pipelineLayout,
      compute: { module: shaderModule, entryPoint: 'finalize' },
    });

    // Create work queue buffers
    this.workQueueBuffer = this.device.createBuffer({
      label: 'gpu-cull-work-queue',
      size: WORK_QUEUE_CAPACITY * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.queueHeadBuffer = this.device.createBuffer({
      label: 'gpu-cull-queue-head',
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.queueTailBuffer = this.device.createBuffer({
      label: 'gpu-cull-queue-tail',
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.activeWorkgroupsBuffer = this.device.createBuffer({
      label: 'gpu-cull-active-workgroups',
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.parallelBvhInitialized = true;
  }

  /**
   * Creates pipelines for Hi-Z occlusion culling.
   */
  private async createHiZOcclusionPipelines(): Promise<void> {
    if (this.hiZOcclusionInitialized) return;

    const shaderCode = this.getHiZOcclusionShaderCode();
    const shaderModule = this.device.createShaderModule({
      label: 'gpu-cull-hiz-shader',
      code: shaderCode,
    });

    // Hi-Z bind group layout (group 1) - extends flat culling
    this.hiZBindGroupLayout = this.device.createBindGroupLayout({
      label: 'gpu-cull-hiz-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, sampler: { type: 'non-filtering' } },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: 'gpu-cull-hiz-layout',
      bindGroupLayouts: [this.flatBindGroupLayout!, this.hiZBindGroupLayout],
    });

    this.hiZOcclusionPipeline = this.device.createComputePipeline({
      label: 'gpu-cull-hiz-occlusion',
      layout: pipelineLayout,
      compute: { module: shaderModule, entryPoint: 'mainWithOcclusion' },
    });

    // Extended uniform buffer for Hi-Z (6 planes + misc + viewProj + screenInfo = 48 floats = 192 bytes)
    const hiZUniformSize = 48 * 4;
    this.hiZUniformBuffer = this.device.createBuffer({
      label: 'gpu-cull-hiz-uniforms',
      size: hiZUniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.hiZOcclusionInitialized = true;
  }

  private createStaticBuffers(): void {
    // Uniform buffer for frustum planes
    this.uniformBuffer = this.device.createBuffer({
      label: 'gpu-cull-uniforms',
      size: FRUSTUM_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Visible count buffer (atomic counter)
    this.visibleCountBuffer = this.device.createBuffer({
      label: 'gpu-cull-visible-count',
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    // Draw indirect buffer (DrawIndexedIndirect = 5 * u32 = 20 bytes)
    this.drawIndirectBuffer = this.device.createBuffer({
      label: 'gpu-cull-draw-indirect',
      size: 20,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
    });
  }

  // ==========================================================================
  // Culling API
  // ==========================================================================

  /**
   * Performs GPU frustum culling on instances.
   * 
   * @param encoder - GPU command encoder
   * @param viewProjectionMatrix - Combined view-projection matrix
   * @param instanceBoundsBuffer - Buffer with per-instance bounds (vec4: xyz=center, w=radius)
   * @param maxInstances - Maximum number of instances to cull
   * @param indexCount - Number of indices per instance (for indirect draw)
   * @returns Culling result with indirect draw buffer, or null on failure
   */
  async cull(
    encoder: GPUCommandEncoder,
    viewProjectionMatrix: Mat4,
    instanceBoundsBuffer: GPUBuffer,
    maxInstances: number,
    indexCount: number
  ): Promise<CullResult | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.flatCullPipeline || !this.finalizePipeline || !this.uniformBuffer) {
      return null;
    }

    // Ensure buffers are large enough
    this.ensureBufferCapacity(maxInstances);

    // Upload frustum planes
    this.uploadFrustumPlanes(viewProjectionMatrix, maxInstances, indexCount);

    // Reset visible count
    const zeroData = new Uint32Array([0]);
    this.device.queue.writeBuffer(this.visibleCountBuffer!, 0, zeroData);

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      label: 'gpu-cull-bg',
      layout: this.flatBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: instanceBoundsBuffer } },
        { binding: 2, resource: { buffer: this.visibleIndicesBuffer! } },
        { binding: 3, resource: { buffer: this.visibleCountBuffer! } },
        { binding: 4, resource: { buffer: this.drawIndirectBuffer! } },
      ],
    });

    // Run culling pass
    const cullPipeline = this.options.useSharedMemory 
      ? this.flatCullPipeline 
      : this.flatCullSimplePipeline!;
    
    const workgroupCount = Math.ceil(maxInstances / WORKGROUP_SIZE);
    
    const cullPass = encoder.beginComputePass({ label: 'gpu-frustum-cull' });
    cullPass.setPipeline(cullPipeline);
    cullPass.setBindGroup(0, bindGroup);
    cullPass.dispatchWorkgroups(workgroupCount);
    cullPass.end();

    // Run finalize pass to update draw indirect buffer
    const finalizePass = encoder.beginComputePass({ label: 'gpu-cull-finalize' });
    finalizePass.setPipeline(this.finalizePipeline);
    finalizePass.setBindGroup(0, bindGroup);
    finalizePass.dispatchWorkgroups(1);
    finalizePass.end();

    return {
      drawIndirectBuffer: this.drawIndirectBuffer!,
      visibleCountBuffer: this.visibleCountBuffer!,
      visibleIndicesBuffer: this.visibleIndicesBuffer!,
    };
  }

  /**
   * Performs hierarchical BVH culling.
   * Requires BVH data to be uploaded first via updateBVH().
   * 
   * @param cameraPosition - Camera position for coherent traversal (optional)
   */
  async cullWithBVH(
    encoder: GPUCommandEncoder,
    viewProjectionMatrix: Mat4,
    instanceBoundsBuffer: GPUBuffer,
    maxInstances: number,
    indexCount: number,
    cameraPosition?: [number, number, number]
  ): Promise<CullResult | null> {
    if (!this.bvhTraversePipeline) {
      await this.createBVHPipelines();
    }

    if (!this.bvhTraversePipeline || !this.bvhNodesBuffer || this.bvhNodeCount === 0) {
      // Fall back to flat culling if BVH not available
      return this.cull(encoder, viewProjectionMatrix, instanceBoundsBuffer, maxInstances, indexCount);
    }

    // Similar to flat culling but uses BVH traversal
    this.ensureBufferCapacity(maxInstances);
    this.uploadFrustumPlanesWithCamera(viewProjectionMatrix, this.bvhNodeCount, indexCount, cameraPosition);

    const zeroData = new Uint32Array([0]);
    this.device.queue.writeBuffer(this.visibleCountBuffer!, 0, zeroData);

    const bindGroup = this.device.createBindGroup({
      label: 'gpu-cull-bvh-bg',
      layout: this.bvhBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: this.bvhNodesBuffer } },
        { binding: 2, resource: { buffer: instanceBoundsBuffer } },
        { binding: 3, resource: { buffer: this.visibleIndicesBuffer! } },
        { binding: 4, resource: { buffer: this.visibleCountBuffer! } },
        { binding: 5, resource: { buffer: this.drawIndirectBuffer! } },
      ],
    });

    // Use coherent traversal if enabled and camera position provided
    const useCoherent = this.options.useCoherentTraversal && 
                        cameraPosition !== undefined && 
                        this.bvhCoherentTraversePipeline !== null;

    const cullPass = encoder.beginComputePass({ label: 'gpu-bvh-cull' });
    cullPass.setPipeline(useCoherent ? this.bvhCoherentTraversePipeline! : this.bvhTraversePipeline);
    cullPass.setBindGroup(0, bindGroup);
    cullPass.dispatchWorkgroups(1);
    cullPass.end();

    return {
      drawIndirectBuffer: this.drawIndirectBuffer!,
      visibleCountBuffer: this.visibleCountBuffer!,
      visibleIndicesBuffer: this.visibleIndicesBuffer!,
    };
  }

  /**
   * Performs parallel BVH culling with work-stealing.
   * 
   * Two-pass approach:
   * 1. expandTopLevels: Single workgroup expands top BVH levels, populates work queue
   * 2. parallelTraverse: Multiple workgroups consume queue and process subtrees
   * 
   * Best for very large scenes (50k+ instances) where parallel processing overhead is justified.
   */
  async cullWithParallelBVH(
    encoder: GPUCommandEncoder,
    viewProjectionMatrix: Mat4,
    instanceBoundsBuffer: GPUBuffer,
    maxInstances: number,
    indexCount: number
  ): Promise<CullResult | null> {
    if (!this.parallelBvhInitialized) {
      await this.createParallelBVHPipelines();
    }

    if (!this.bvhExpandTopLevelsPipeline || !this.bvhParallelTraversePipeline ||
        !this.bvhNodesBuffer || this.bvhNodeCount === 0) {
      // Fall back to single-threaded BVH or flat culling
      return this.cullWithBVH(encoder, viewProjectionMatrix, instanceBoundsBuffer, maxInstances, indexCount);
    }

    this.ensureBufferCapacity(maxInstances);
    this.uploadFrustumPlanesExtended(viewProjectionMatrix, this.bvhNodeCount, indexCount, maxInstances);

    // Reset all counters
    const zeroData = new Uint32Array([0, 0, 0, 0]);
    this.device.queue.writeBuffer(this.visibleCountBuffer!, 0, zeroData.subarray(0, 1));
    this.device.queue.writeBuffer(this.queueHeadBuffer!, 0, zeroData.subarray(0, 1));
    this.device.queue.writeBuffer(this.queueTailBuffer!, 0, zeroData.subarray(0, 1));
    this.device.queue.writeBuffer(this.activeWorkgroupsBuffer!, 0, zeroData.subarray(0, 1));

    // Create bind groups
    const coreBindGroup = this.device.createBindGroup({
      label: 'gpu-cull-parallel-core-bg',
      layout: this.parallelBvhCoreLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: this.bvhNodesBuffer } },
        { binding: 2, resource: { buffer: instanceBoundsBuffer } },
        { binding: 3, resource: { buffer: this.visibleIndicesBuffer! } },
        { binding: 4, resource: { buffer: this.visibleCountBuffer! } },
        { binding: 5, resource: { buffer: this.drawIndirectBuffer! } },
      ],
    });

    const queueBindGroup = this.device.createBindGroup({
      label: 'gpu-cull-parallel-queue-bg',
      layout: this.parallelBvhQueueLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.workQueueBuffer! } },
        { binding: 1, resource: { buffer: this.queueHeadBuffer! } },
        { binding: 2, resource: { buffer: this.queueTailBuffer! } },
        { binding: 3, resource: { buffer: this.activeWorkgroupsBuffer! } },
      ],
    });

    // Pass 1: Expand top levels of BVH
    const expandPass = encoder.beginComputePass({ label: 'gpu-bvh-expand-top' });
    expandPass.setPipeline(this.bvhExpandTopLevelsPipeline);
    expandPass.setBindGroup(0, coreBindGroup);
    expandPass.setBindGroup(1, queueBindGroup);
    expandPass.dispatchWorkgroups(1);
    expandPass.end();

    // Pass 2: Parallel traversal with work-stealing
    const traversePass = encoder.beginComputePass({ label: 'gpu-bvh-parallel-traverse' });
    traversePass.setPipeline(this.bvhParallelTraversePipeline);
    traversePass.setBindGroup(0, coreBindGroup);
    traversePass.setBindGroup(1, queueBindGroup);
    traversePass.dispatchWorkgroups(this.options.parallelWorkgroups);
    traversePass.end();

    // Pass 3: Finalize draw command
    const finalizePass = encoder.beginComputePass({ label: 'gpu-bvh-parallel-finalize' });
    finalizePass.setPipeline(this.bvhParallelFinalizePipeline!);
    finalizePass.setBindGroup(0, coreBindGroup);
    finalizePass.setBindGroup(1, queueBindGroup);
    finalizePass.dispatchWorkgroups(1);
    finalizePass.end();

    return {
      drawIndirectBuffer: this.drawIndirectBuffer!,
      visibleCountBuffer: this.visibleCountBuffer!,
      visibleIndicesBuffer: this.visibleIndicesBuffer!,
    };
  }

  /**
   * Performs frustum + Hi-Z occlusion culling.
   * 
   * Combines frustum culling with Hi-Z depth buffer occlusion testing.
   * Objects that pass frustum test are further tested against the Hi-Z buffer
   * to cull objects hidden behind other geometry.
   * 
   * @param hiZParams - Hi-Z texture and parameters from OcclusionCullingPass
   */
  async cullWithHiZOcclusion(
    encoder: GPUCommandEncoder,
    viewProjectionMatrix: Mat4,
    instanceBoundsBuffer: GPUBuffer,
    maxInstances: number,
    indexCount: number,
    hiZParams: HiZOcclusionParams
  ): Promise<CullResult | null> {
    if (!this.hiZOcclusionInitialized) {
      await this.createHiZOcclusionPipelines();
    }

    if (!this.hiZOcclusionPipeline || !this.hiZUniformBuffer) {
      // Fall back to regular frustum culling
      return this.cull(encoder, viewProjectionMatrix, instanceBoundsBuffer, maxInstances, indexCount);
    }

    if (!this.initialized) {
      await this.initialize();
    }

    this.ensureBufferCapacity(maxInstances);

    // Upload extended uniforms with viewProj and screen info
    this.uploadHiZUniforms(viewProjectionMatrix, maxInstances, indexCount, hiZParams);

    // Reset visible count
    const zeroData = new Uint32Array([0]);
    this.device.queue.writeBuffer(this.visibleCountBuffer!, 0, zeroData);

    // Create flat culling bind group (group 0)
    const flatBindGroup = this.device.createBindGroup({
      label: 'gpu-cull-hiz-flat-bg',
      layout: this.flatBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: instanceBoundsBuffer } },
        { binding: 2, resource: { buffer: this.visibleIndicesBuffer! } },
        { binding: 3, resource: { buffer: this.visibleCountBuffer! } },
        { binding: 4, resource: { buffer: this.drawIndirectBuffer! } },
      ],
    });

    // Create Hi-Z bind group (group 1)
    const hiZBindGroup = this.device.createBindGroup({
      label: 'gpu-cull-hiz-bg',
      layout: this.hiZBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.hiZUniformBuffer } },
        { binding: 1, resource: hiZParams.hiZTexture.createView() },
        { binding: 2, resource: hiZParams.hiZSampler },
      ],
    });

    // Run combined frustum + occlusion culling
    const cullPass = encoder.beginComputePass({ label: 'gpu-frustum-hiz-cull' });
    cullPass.setPipeline(this.hiZOcclusionPipeline);
    cullPass.setBindGroup(0, flatBindGroup);
    cullPass.setBindGroup(1, hiZBindGroup);
    cullPass.dispatchWorkgroups(Math.ceil(maxInstances / WORKGROUP_SIZE));
    cullPass.end();

    // Finalize pass
    const finalizePass = encoder.beginComputePass({ label: 'gpu-cull-finalize' });
    finalizePass.setPipeline(this.finalizePipeline!);
    finalizePass.setBindGroup(0, flatBindGroup);
    finalizePass.dispatchWorkgroups(1);
    finalizePass.end();

    return {
      drawIndirectBuffer: this.drawIndirectBuffer!,
      visibleCountBuffer: this.visibleCountBuffer!,
      visibleIndicesBuffer: this.visibleIndicesBuffer!,
    };
  }

  /**
   * Uploads uniforms for Hi-Z occlusion culling.
   */
  private uploadHiZUniforms(
    viewProjectionMatrix: Mat4,
    maxInstances: number,
    indexCount: number,
    hiZParams: HiZOcclusionParams
  ): void {
    extractFrustumPlanes(this.frustumPlanes, viewProjectionMatrix);

    // Extended uniform layout: 6 planes + misc + viewProj + screenInfo = 48 floats (192 bytes)
    const data = new Float32Array(48);
    
    // Pack 6 frustum planes (24 floats)
    for (let i = 0; i < 6; i++) {
      const plane = this.frustumPlanes[i]!;
      const offset = i * 4;
      data[offset + 0] = plane.normal[0];
      data[offset + 1] = plane.normal[1];
      data[offset + 2] = plane.normal[2];
      data[offset + 3] = plane.d;
    }

    // Misc data (4 floats)
    const miscOffset = 24;
    data[miscOffset + 0] = maxInstances;
    data[miscOffset + 1] = indexCount;
    data[miscOffset + 2] = 0;
    data[miscOffset + 3] = 0;

    // ViewProj matrix (16 floats)
    const vpOffset = 28;
    for (let i = 0; i < 16; i++) {
      data[vpOffset + i] = viewProjectionMatrix[i]!;
    }

    // Screen info (4 floats)
    const screenOffset = 44;
    data[screenOffset + 0] = hiZParams.screenWidth;
    data[screenOffset + 1] = hiZParams.screenHeight;
    data[screenOffset + 2] = hiZParams.mipLevels;
    data[screenOffset + 3] = 1.0; // hiZEnabled flag
    
    this.device.queue.writeBuffer(this.hiZUniformBuffer!, 0, data);

    // Also update regular uniforms for finalize pass
    this.uploadFrustumPlanes(viewProjectionMatrix, maxInstances, indexCount);
  }

  // ==========================================================================
  // BVH Management
  // ==========================================================================

  /**
   * Updates the GPU BVH data.
   * Call this when scene geometry changes significantly.
   */
  updateBVH(bvhData: GPUBVHData): void {
    if (bvhData.nodeCount === 0) {
      this.bvhNodeCount = 0;
      return;
    }

    const requiredSize = bvhData.nodes.byteLength;
    
    // Recreate buffer if needed
    if (!this.bvhNodesBuffer || this.bvhNodesBuffer.size < requiredSize) {
      this.bvhNodesBuffer?.destroy();
      this.bvhNodesBuffer = this.device.createBuffer({
        label: 'gpu-cull-bvh-nodes',
        size: requiredSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }

    this.device.queue.writeBuffer(this.bvhNodesBuffer, 0, bvhData.nodes.buffer as ArrayBuffer, bvhData.nodes.byteOffset, bvhData.nodes.byteLength);
    this.bvhNodeCount = bvhData.nodeCount;
  }

  /**
   * Builds linearized BVH data from CPU BVH nodes.
   * Format: 8 floats per node (boundsMin.xyz + child0, boundsMax.xyz + child1)
   */
  static buildGPUBVHData(nodes: BVHNode[]): GPUBVHData {
    if (nodes.length === 0) {
      return { nodes: new Float32Array(0), nodeCount: 0 };
    }

    const data = new Float32Array(nodes.length * 8);
    
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const offset = i * 8;
      
      // boundsMin.xyz
      data[offset + 0] = node.boundsMin[0];
      data[offset + 1] = node.boundsMin[1];
      data[offset + 2] = node.boundsMin[2];
      
      // child0 (with leaf flag)
      const child0Value = node.isLeaf 
        ? (node.child0 | BVH_NODE_FLAG_LEAF)
        : node.child0;
      data[offset + 3] = new Float32Array(new Uint32Array([child0Value]).buffer)[0]!;
      
      // boundsMax.xyz
      data[offset + 4] = node.boundsMax[0];
      data[offset + 5] = node.boundsMax[1];
      data[offset + 6] = node.boundsMax[2];
      
      // child1
      data[offset + 7] = new Float32Array(new Uint32Array([node.child1]).buffer)[0]!;
    }

    return { nodes: data, nodeCount: nodes.length };
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  private ensureBufferCapacity(maxInstances: number): void {
    if (maxInstances <= this.maxInstances && this.visibleIndicesBuffer) {
      return;
    }

    const newCapacity = Math.max(maxInstances, this.maxInstances * 2, 1024);
    
    this.visibleIndicesBuffer?.destroy();
    this.visibleIndicesBuffer = this.device.createBuffer({
      label: 'gpu-cull-visible-indices',
      size: newCapacity * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    this.maxInstances = newCapacity;
  }

  private uploadFrustumPlanes(viewProjectionMatrix: Mat4, maxInstances: number, indexCount: number): void {
    extractFrustumPlanes(this.frustumPlanes, viewProjectionMatrix);

    const data = new Float32Array(FRUSTUM_UNIFORM_SIZE / 4);
    
    // Pack 6 frustum planes (vec4 each: xyz=normal, w=distance)
    for (let i = 0; i < 6; i++) {
      const plane = this.frustumPlanes[i]!;
      const offset = i * 4;
      data[offset + 0] = plane.normal[0];
      data[offset + 1] = plane.normal[1];
      data[offset + 2] = plane.normal[2];
      data[offset + 3] = plane.d;
    }

    // Misc data: maxInstances, indexCount, flags, reserved
    const miscOffset = 24; // 6 planes * 4 floats
    data[miscOffset + 0] = maxInstances;
    data[miscOffset + 1] = indexCount;
    data[miscOffset + 2] = 0; // flags
    data[miscOffset + 3] = 0; // reserved

    this.device.queue.writeBuffer(this.uniformBuffer!, 0, data);
  }

  /**
   * Uploads frustum planes with extended uniform data for parallel BVH.
   * Includes viewProj matrix for potential occlusion culling integration.
   */
  private uploadFrustumPlanesExtended(
    viewProjectionMatrix: Mat4,
    nodeCount: number,
    indexCount: number,
    maxInstances: number
  ): void {
    extractFrustumPlanes(this.frustumPlanes, viewProjectionMatrix);

    const data = new Float32Array(PARALLEL_UNIFORM_SIZE / 4);
    
    // Pack 6 frustum planes (vec4 each)
    for (let i = 0; i < 6; i++) {
      const plane = this.frustumPlanes[i]!;
      const offset = i * 4;
      data[offset + 0] = plane.normal[0];
      data[offset + 1] = plane.normal[1];
      data[offset + 2] = plane.normal[2];
      data[offset + 3] = plane.d;
    }

    // Misc data: nodeCount, indexCount, maxInstances, cameraZ
    const miscOffset = 24;
    data[miscOffset + 0] = nodeCount;
    data[miscOffset + 1] = indexCount;
    data[miscOffset + 2] = maxInstances;
    data[miscOffset + 3] = 0; // cameraZ (for frustum-coherent traversal)

    // viewProj matrix (for occlusion culling)
    const vpOffset = 28;
    for (let i = 0; i < 16; i++) {
      data[vpOffset + i] = viewProjectionMatrix[i]!;
    }

    this.device.queue.writeBuffer(this.uniformBuffer!, 0, data);
  }

  /**
   * Uploads frustum planes with camera position for coherent BVH traversal.
   */
  private uploadFrustumPlanesWithCamera(
    viewProjectionMatrix: Mat4,
    maxInstances: number,
    indexCount: number,
    cameraPosition?: [number, number, number]
  ): void {
    extractFrustumPlanes(this.frustumPlanes, viewProjectionMatrix);

    // Extended size to include camera position: 6 planes + misc + cameraPos = 32 floats
    const data = new Float32Array(32);
    
    // Pack 6 frustum planes (vec4 each)
    for (let i = 0; i < 6; i++) {
      const plane = this.frustumPlanes[i]!;
      const offset = i * 4;
      data[offset + 0] = plane.normal[0];
      data[offset + 1] = plane.normal[1];
      data[offset + 2] = plane.normal[2];
      data[offset + 3] = plane.d;
    }

    // Misc data: maxInstances, indexCount, flags, reserved
    const miscOffset = 24;
    data[miscOffset + 0] = maxInstances;
    data[miscOffset + 1] = indexCount;
    data[miscOffset + 2] = 0; // flags
    data[miscOffset + 3] = 0; // reserved

    // Camera position for distance-based child ordering
    const camOffset = 28;
    data[camOffset + 0] = cameraPosition?.[0] ?? 0;
    data[camOffset + 1] = cameraPosition?.[1] ?? 0;
    data[camOffset + 2] = cameraPosition?.[2] ?? 0;
    data[camOffset + 3] = 0; // padding

    this.device.queue.writeBuffer(this.uniformBuffer!, 0, data);
  }

  // ==========================================================================
  // Shader Code
  // ==========================================================================

  private getFlatCullShaderCode(): string {
    return /* wgsl */ `
      struct CullUniforms {
        planes: array<vec4<f32>, 6>,
        misc: vec4<f32>,
      }

      @group(0) @binding(0) var<uniform> uniforms: CullUniforms;
      @group(0) @binding(1) var<storage, read> instanceBounds: array<vec4<f32>>;
      @group(0) @binding(2) var<storage, read_write> visibleIndices: array<u32>;
      @group(0) @binding(3) var<storage, read_write> visibleCount: atomic<u32>;
      @group(0) @binding(4) var<storage, read_write> drawCommand: array<u32, 5>;

      const WORKGROUP_SIZE: u32 = 64u;
      
      // Shared memory for parallel prefix sum stream compaction
      var<workgroup> localVisibleFlags: array<u32, 64>;   // 1 if visible, 0 otherwise
      var<workgroup> localPrefixSum: array<u32, 64>;      // Exclusive prefix sum
      var<workgroup> localInstanceIndices: array<u32, 64>; // Instance indices to write
      var<workgroup> sharedTotalCount: u32;               // Total visible in workgroup
      var<workgroup> sharedGlobalOffset: u32;             // Global write offset

      fn isSphereFrustumVisible(bounds: vec4<f32>) -> bool {
        let center = bounds.xyz;
        let radius = bounds.w;
        
        if (radius <= 0.0) {
          return false;
        }
        
        for (var i = 0u; i < 6u; i++) {
          let plane = uniforms.planes[i];
          let distance = dot(plane.xyz, center) + plane.w;
          if (distance < -radius) {
            return false;
          }
        }
        return true;
      }

      // ========================================================================
      // Parallel Prefix Sum (Exclusive) - Hillis-Steele Algorithm
      // Reduces atomic contention by computing write offsets in parallel
      // ========================================================================
      fn workgroupPrefixSum(localIndex: u32) {
        // Hillis-Steele parallel prefix sum (log2(64) = 6 steps)
        for (var offset = 1u; offset < WORKGROUP_SIZE; offset *= 2u) {
          workgroupBarrier();
          let val = localPrefixSum[localIndex];
          workgroupBarrier();
          if (localIndex >= offset) {
            localPrefixSum[localIndex] = val + localPrefixSum[localIndex - offset];
          }
        }
        workgroupBarrier();
        
        // Convert to exclusive prefix sum (shift right by 1)
        let inclusiveSum = localPrefixSum[localIndex];
        workgroupBarrier();
        if (localIndex == 0u) {
          sharedTotalCount = localPrefixSum[WORKGROUP_SIZE - 1u];
          localPrefixSum[0] = 0u;
        } else {
          localPrefixSum[localIndex] = localPrefixSum[localIndex - 1u];
        }
        workgroupBarrier();
      }

      @compute @workgroup_size(64)
      fn main(
        @builtin(global_invocation_id) globalId: vec3<u32>,
        @builtin(local_invocation_id) localId: vec3<u32>
      ) {
        let instanceIndex = globalId.x;
        let localIndex = localId.x;
        let maxInstances = u32(uniforms.misc.x);
        
        // ========================================
        // Phase 1: Visibility test + store flags
        // ========================================
        var isVisible = false;
        if (instanceIndex < maxInstances) {
          let bounds = instanceBounds[instanceIndex];
          isVisible = isSphereFrustumVisible(bounds);
        }
        
        // Store visibility flag and instance index
        let visFlag = select(0u, 1u, isVisible);
        localVisibleFlags[localIndex] = visFlag;
        localPrefixSum[localIndex] = visFlag;
        localInstanceIndices[localIndex] = instanceIndex;
        workgroupBarrier();
        
        // ========================================
        // Phase 2: Parallel prefix sum
        // ========================================
        workgroupPrefixSum(localIndex);
        
        // ========================================
        // Phase 3: Single atomic to reserve global space
        // ========================================
        if (localIndex == 0u && sharedTotalCount > 0u) {
          sharedGlobalOffset = atomicAdd(&visibleCount, sharedTotalCount);
        }
        workgroupBarrier();
        
        // ========================================
        // Phase 4: All visible threads write in parallel
        // ========================================
        if (isVisible && sharedTotalCount > 0u) {
          let localWriteOffset = localPrefixSum[localIndex];
          let globalWriteOffset = sharedGlobalOffset + localWriteOffset;
          visibleIndices[globalWriteOffset] = instanceIndex;
        }
      }

      @compute @workgroup_size(64)
      fn main_simple(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let instanceIndex = globalId.x;
        let maxInstances = u32(uniforms.misc.x);
        
        if (instanceIndex >= maxInstances) {
          return;
        }
        
        let bounds = instanceBounds[instanceIndex];
        if (isSphereFrustumVisible(bounds)) {
          let outputIndex = atomicAdd(&visibleCount, 1u);
          visibleIndices[outputIndex] = instanceIndex;
        }
      }

      @compute @workgroup_size(1)
      fn finalize() {
        let count = atomicLoad(&visibleCount);
        let indexCount = u32(uniforms.misc.y);
        
        drawCommand[0] = indexCount;
        drawCommand[1] = count;
        drawCommand[2] = 0u;
        drawCommand[3] = 0u;
        drawCommand[4] = 0u;
      }

      @compute @workgroup_size(1)
      fn reset() {
        atomicStore(&visibleCount, 0u);
      }
    `;
  }

  private getBVHCullShaderCode(): string {
    return /* wgsl */ `
      struct CullUniforms {
        planes: array<vec4<f32>, 6>,
        misc: vec4<f32>,
        cameraPos: vec4<f32>,
      }

      struct BVHNode {
        boundsMin: vec4<f32>,
        boundsMax: vec4<f32>,
      }

      struct StackEntry {
        nodeIndex: u32,
        frustumMask: u32,
      }

      const NODE_FLAG_LEAF: u32 = 0x80000000u;
      const MAX_STACK_DEPTH: u32 = 32u;

      @group(0) @binding(0) var<uniform> uniforms: CullUniforms;
      @group(0) @binding(1) var<storage, read> bvhNodes: array<BVHNode>;
      @group(0) @binding(2) var<storage, read> instanceBounds: array<vec4<f32>>;
      @group(0) @binding(3) var<storage, read_write> visibleIndices: array<u32>;
      @group(0) @binding(4) var<storage, read_write> visibleCount: atomic<u32>;
      @group(0) @binding(5) var<storage, read_write> drawCommand: array<u32, 5>;

      var<workgroup> localVisibleIndices: array<u32, 256>;
      var<workgroup> localVisibleCount: atomic<u32>;

      fn testAABBFrustum(aabbMin: vec3<f32>, aabbMax: vec3<f32>) -> i32 {
        var result: i32 = 1;
        
        for (var i = 0u; i < 6u; i++) {
          let plane = uniforms.planes[i];
          
          let px = select(aabbMin.x, aabbMax.x, plane.x >= 0.0);
          let py = select(aabbMin.y, aabbMax.y, plane.y >= 0.0);
          let pz = select(aabbMin.z, aabbMax.z, plane.z >= 0.0);
          
          let nx = select(aabbMax.x, aabbMin.x, plane.x >= 0.0);
          let ny = select(aabbMax.y, aabbMin.y, plane.y >= 0.0);
          let nz = select(aabbMax.z, aabbMin.z, plane.z >= 0.0);
          
          let pDist = dot(plane.xyz, vec3<f32>(px, py, pz)) + plane.w;
          let nDist = dot(plane.xyz, vec3<f32>(nx, ny, nz)) + plane.w;
          
          if (pDist < 0.0) {
            return -1;
          }
          
          if (nDist < 0.0) {
            result = 0;
          }
        }
        
        return result;
      }

      fn isSphereFrustumVisible(center: vec3<f32>, radius: f32) -> bool {
        for (var i = 0u; i < 6u; i++) {
          let plane = uniforms.planes[i];
          let distance = dot(plane.xyz, center) + plane.w;
          if (distance < -radius) {
            return false;
          }
        }
        return true;
      }

      @compute @workgroup_size(1)
      fn traverseBVH() {
        let nodeCount = u32(uniforms.misc.x);
        if (nodeCount == 0u) {
          return;
        }

        var stack: array<u32, MAX_STACK_DEPTH>;
        var stackPtr: u32 = 1u;
        stack[0] = 0u;

        while (stackPtr > 0u) {
          stackPtr -= 1u;
          let nodeIndex = stack[stackPtr];
          
          if (nodeIndex >= nodeCount) {
            continue;
          }
          
          let node = bvhNodes[nodeIndex];
          let aabbMin = node.boundsMin.xyz;
          let aabbMax = node.boundsMax.xyz;
          
          let visResult = testAABBFrustum(aabbMin, aabbMax);
          
          if (visResult == -1) {
            continue;
          }
          
          let child0 = bitcast<u32>(node.boundsMin.w);
          let child1 = bitcast<u32>(node.boundsMax.w);
          
          let isLeaf = (child0 & NODE_FLAG_LEAF) != 0u;
          
          if (isLeaf) {
            let instanceStart = child0 & (~NODE_FLAG_LEAF);
            let instanceCount = child1;
            
            if (visResult == 1) {
              for (var i = 0u; i < instanceCount; i++) {
                let writeIdx = atomicAdd(&visibleCount, 1u);
                visibleIndices[writeIdx] = instanceStart + i;
              }
            } else {
              for (var i = 0u; i < instanceCount; i++) {
                let instanceIdx = instanceStart + i;
                let bounds = instanceBounds[instanceIdx];
                
                if (isSphereFrustumVisible(bounds.xyz, bounds.w)) {
                  let writeIdx = atomicAdd(&visibleCount, 1u);
                  visibleIndices[writeIdx] = instanceIdx;
                }
              }
            }
          } else {
            if (stackPtr < MAX_STACK_DEPTH - 1u) {
              if (child1 < nodeCount) {
                stack[stackPtr] = child1;
                stackPtr += 1u;
              }
              if (child0 < nodeCount) {
                stack[stackPtr] = child0;
                stackPtr += 1u;
              }
            }
          }
        }
      }

      // Frustum-coherent traversal with distance-based child ordering
      @compute @workgroup_size(1)
      fn traverseBVHCoherent() {
        let nodeCount = u32(uniforms.misc.x);
        if (nodeCount == 0u) { return; }

        var stack: array<u32, MAX_STACK_DEPTH>;
        var stackPtr: u32 = 1u;
        stack[0] = 0u;

        while (stackPtr > 0u) {
          stackPtr -= 1u;
          let nodeIndex = stack[stackPtr];
          
          if (nodeIndex >= nodeCount) { continue; }
          
          let node = bvhNodes[nodeIndex];
          let aabbMin = node.boundsMin.xyz;
          let aabbMax = node.boundsMax.xyz;
          
          let visResult = testAABBFrustum(aabbMin, aabbMax);
          if (visResult == -1) { continue; }
          
          let child0 = bitcast<u32>(node.boundsMin.w);
          let child1 = bitcast<u32>(node.boundsMax.w);
          let isLeaf = (child0 & NODE_FLAG_LEAF) != 0u;
          
          if (isLeaf) {
            let instanceStart = child0 & (~NODE_FLAG_LEAF);
            let instanceCount = child1;
            
            if (visResult == 1) {
              for (var i = 0u; i < instanceCount; i++) {
                let writeIdx = atomicAdd(&visibleCount, 1u);
                visibleIndices[writeIdx] = instanceStart + i;
              }
            } else {
              for (var i = 0u; i < instanceCount; i++) {
                let instanceIdx = instanceStart + i;
                let bounds = instanceBounds[instanceIdx];
                if (isSphereFrustumVisible(bounds.xyz, bounds.w)) {
                  let writeIdx = atomicAdd(&visibleCount, 1u);
                  visibleIndices[writeIdx] = instanceIdx;
                }
              }
            }
          } else {
            if (stackPtr < MAX_STACK_DEPTH - 1u) {
              // Distance-based child ordering for cache coherence
              let child0Node = bvhNodes[child0];
              let child1Node = bvhNodes[child1];
              let child0Center = (child0Node.boundsMin.xyz + child0Node.boundsMax.xyz) * 0.5;
              let child1Center = (child1Node.boundsMin.xyz + child1Node.boundsMax.xyz) * 0.5;
              let dist0 = distance(uniforms.cameraPos.xyz, child0Center);
              let dist1 = distance(uniforms.cameraPos.xyz, child1Center);
              
              // Push far child first (processed last) for near-to-far ordering
              if (dist0 < dist1) {
                if (child1 < nodeCount) { stack[stackPtr] = child1; stackPtr += 1u; }
                if (child0 < nodeCount) { stack[stackPtr] = child0; stackPtr += 1u; }
              } else {
                if (child0 < nodeCount) { stack[stackPtr] = child0; stackPtr += 1u; }
                if (child1 < nodeCount) { stack[stackPtr] = child1; stackPtr += 1u; }
              }
            }
          }
        }
      }

      @compute @workgroup_size(1)
      fn finalize() {
        let count = atomicLoad(&visibleCount);
        let indexCount = u32(uniforms.misc.y);
        
        drawCommand[0] = indexCount;
        drawCommand[1] = count;
        drawCommand[2] = 0u;
        drawCommand[3] = 0u;
        drawCommand[4] = 0u;
      }
    `;
  }

  private getParallelBVHShaderCode(): string {
    return /* wgsl */ `
      const WORKGROUP_SIZE: u32 = 64u;
      const MAX_LOCAL_STACK: u32 = 16u;
      const QUEUE_CAPACITY: u32 = 16384u;
      const TOP_LEVEL_DEPTH: u32 = 4u;
      const NODE_FLAG_LEAF: u32 = 0x80000000u;

      struct CullUniforms {
        planes: array<vec4<f32>, 6>,
        misc: vec4<f32>,
        viewProj: mat4x4<f32>,
      }

      struct BVHNode {
        boundsMin: vec4<f32>,
        boundsMax: vec4<f32>,
      }

      @group(0) @binding(0) var<uniform> uniforms: CullUniforms;
      @group(0) @binding(1) var<storage, read> bvhNodes: array<BVHNode>;
      @group(0) @binding(2) var<storage, read> instanceBounds: array<vec4<f32>>;
      @group(0) @binding(3) var<storage, read_write> visibleIndices: array<u32>;
      @group(0) @binding(4) var<storage, read_write> visibleCount: atomic<u32>;
      @group(0) @binding(5) var<storage, read_write> drawCommand: array<u32, 5>;

      @group(1) @binding(0) var<storage, read_write> workQueue: array<u32>;
      @group(1) @binding(1) var<storage, read_write> queueHead: atomic<u32>;
      @group(1) @binding(2) var<storage, read_write> queueTail: atomic<u32>;
      @group(1) @binding(3) var<storage, read_write> activeWorkgroups: atomic<u32>;

      var<workgroup> localVisibleIndices: array<u32, 256>;
      var<workgroup> localVisibleCount: atomic<u32>;

      fn testAABBFrustum(aabbMin: vec3<f32>, aabbMax: vec3<f32>) -> i32 {
        var result: i32 = 1;
        
        for (var i = 0u; i < 6u; i++) {
          let plane = uniforms.planes[i];
          
          let px = select(aabbMin.x, aabbMax.x, plane.x >= 0.0);
          let py = select(aabbMin.y, aabbMax.y, plane.y >= 0.0);
          let pz = select(aabbMin.z, aabbMax.z, plane.z >= 0.0);
          
          let nx = select(aabbMax.x, aabbMin.x, plane.x >= 0.0);
          let ny = select(aabbMax.y, aabbMin.y, plane.y >= 0.0);
          let nz = select(aabbMax.z, aabbMin.z, plane.z >= 0.0);
          
          let pDist = dot(plane.xyz, vec3<f32>(px, py, pz)) + plane.w;
          let nDist = dot(plane.xyz, vec3<f32>(nx, ny, nz)) + plane.w;
          
          if (pDist < 0.0) {
            return -1;
          }
          
          if (nDist < 0.0) {
            result = 0;
          }
        }
        
        return result;
      }

      fn isSphereFrustumVisible(center: vec3<f32>, radius: f32) -> bool {
        for (var i = 0u; i < 6u; i++) {
          let plane = uniforms.planes[i];
          let distance = dot(plane.xyz, center) + plane.w;
          if (distance < -radius) {
            return false;
          }
        }
        return true;
      }

      @compute @workgroup_size(1)
      fn expandTopLevels() {
        let nodeCount = u32(uniforms.misc.x);
        if (nodeCount == 0u) {
          return;
        }
        
        var stack: array<u32, 64>;
        var stackPtr: u32 = 1u;
        stack[0] = 0u;
        
        var queueWritePtr: u32 = 0u;
        
        while (stackPtr > 0u && queueWritePtr < QUEUE_CAPACITY) {
          stackPtr -= 1u;
          let nodeIndex = stack[stackPtr];
          
          if (nodeIndex >= nodeCount) {
            continue;
          }
          
          let node = bvhNodes[nodeIndex];
          let aabbMin = node.boundsMin.xyz;
          let aabbMax = node.boundsMax.xyz;
          
          let visResult = testAABBFrustum(aabbMin, aabbMax);
          
          if (visResult == -1) {
            continue;
          }
          
          let child0 = bitcast<u32>(node.boundsMin.w);
          let child1 = bitcast<u32>(node.boundsMax.w);
          let isLeaf = (child0 & NODE_FLAG_LEAF) != 0u;
          
          if (isLeaf) {
            workQueue[queueWritePtr] = nodeIndex;
            queueWritePtr += 1u;
          } else {
            let depth = countOneBits(nodeIndex);
            
            if (depth < TOP_LEVEL_DEPTH) {
              if (stackPtr < 62u) {
                if (child1 < nodeCount) {
                  stack[stackPtr] = child1;
                  stackPtr += 1u;
                }
                if (child0 < nodeCount) {
                  stack[stackPtr] = child0;
                  stackPtr += 1u;
                }
              }
            } else {
              workQueue[queueWritePtr] = nodeIndex;
              queueWritePtr += 1u;
            }
          }
        }
        
        atomicStore(&queueTail, queueWritePtr);
        atomicStore(&queueHead, 0u);
      }

      @compute @workgroup_size(64)
      fn parallelTraverse(
        @builtin(global_invocation_id) globalId: vec3<u32>,
        @builtin(local_invocation_id) localId: vec3<u32>
      ) {
        let localIndex = localId.x;
        let nodeCount = u32(uniforms.misc.x);
        
        if (localIndex == 0u) {
          atomicStore(&localVisibleCount, 0u);
          atomicAdd(&activeWorkgroups, 1u);
        }
        workgroupBarrier();
        
        if (nodeCount == 0u) {
          if (localIndex == 0u) {
            atomicSub(&activeWorkgroups, 1u);
          }
          return;
        }
        
        var localStack: array<u32, MAX_LOCAL_STACK>;
        var localStackPtr: u32 = 0u;
        
        loop {
          var nodeIndex: u32 = 0xFFFFFFFFu;
          
          if (localIndex == 0u) {
            let head = atomicAdd(&queueHead, 1u);
            let tail = atomicLoad(&queueTail);
            
            if (head < tail) {
              nodeIndex = workQueue[head];
            }
          }
          
          workgroupBarrier();
          
          if (localIndex == 0u && nodeIndex == 0xFFFFFFFFu) {
            atomicSub(&activeWorkgroups, 1u);
            break;
          }
          
          if (localIndex == 0u && nodeIndex != 0xFFFFFFFFu) {
            localStack[0] = nodeIndex;
            localStackPtr = 1u;
            
            while (localStackPtr > 0u) {
              localStackPtr -= 1u;
              let currentNode = localStack[localStackPtr];
              
              if (currentNode >= nodeCount) {
                continue;
              }
              
              let node = bvhNodes[currentNode];
              let aabbMin = node.boundsMin.xyz;
              let aabbMax = node.boundsMax.xyz;
              
              let visResult = testAABBFrustum(aabbMin, aabbMax);
              
              if (visResult == -1) {
                continue;
              }
              
              let child0 = bitcast<u32>(node.boundsMin.w);
              let child1 = bitcast<u32>(node.boundsMax.w);
              let isLeaf = (child0 & NODE_FLAG_LEAF) != 0u;
              
              if (isLeaf) {
                let instanceStart = child0 & (~NODE_FLAG_LEAF);
                let instanceCount = child1;
                
                if (visResult == 1) {
                  for (var i = 0u; i < instanceCount; i++) {
                    let writeIdx = atomicAdd(&localVisibleCount, 1u);
                    if (writeIdx < 256u) {
                      localVisibleIndices[writeIdx] = instanceStart + i;
                    }
                  }
                } else {
                  for (var i = 0u; i < instanceCount; i++) {
                    let instIdx = instanceStart + i;
                    let bounds = instanceBounds[instIdx];
                    
                    if (isSphereFrustumVisible(bounds.xyz, bounds.w)) {
                      let writeIdx = atomicAdd(&localVisibleCount, 1u);
                      if (writeIdx < 256u) {
                        localVisibleIndices[writeIdx] = instIdx;
                      }
                    }
                  }
                }
              } else {
                if (localStackPtr < MAX_LOCAL_STACK - 1u) {
                  if (child1 < nodeCount) {
                    localStack[localStackPtr] = child1;
                    localStackPtr += 1u;
                  }
                  if (child0 < nodeCount) {
                    localStack[localStackPtr] = child0;
                    localStackPtr += 1u;
                  }
                }
              }
            }
          }
          
          workgroupBarrier();
        }
        
        workgroupBarrier();
        
        if (localIndex == 0u) {
          let localCount = min(atomicLoad(&localVisibleCount), 256u);
          if (localCount > 0u) {
            let globalOffset = atomicAdd(&visibleCount, localCount);
            for (var i = 0u; i < localCount; i++) {
              visibleIndices[globalOffset + i] = localVisibleIndices[i];
            }
          }
        }
      }

      @compute @workgroup_size(1)
      fn reset() {
        atomicStore(&visibleCount, 0u);
        atomicStore(&queueHead, 0u);
        atomicStore(&queueTail, 0u);
        atomicStore(&activeWorkgroups, 0u);
      }

      @compute @workgroup_size(1)
      fn finalize() {
        let count = atomicLoad(&visibleCount);
        let indexCount = u32(uniforms.misc.y);
        
        drawCommand[0] = indexCount;
        drawCommand[1] = count;
        drawCommand[2] = 0u;
        drawCommand[3] = 0u;
        drawCommand[4] = 0u;
      }
    `;
  }

  private getHiZOcclusionShaderCode(): string {
    return /* wgsl */ `
      struct CullUniforms {
        planes: array<vec4<f32>, 6>,
        misc: vec4<f32>,
      }

      struct CullUniformsExtended {
        planes: array<vec4<f32>, 6>,
        misc: vec4<f32>,
        viewProj: mat4x4<f32>,
        screenInfo: vec4<f32>,
      }

      @group(0) @binding(0) var<uniform> uniforms: CullUniforms;
      @group(0) @binding(1) var<storage, read> instanceBounds: array<vec4<f32>>;
      @group(0) @binding(2) var<storage, read_write> visibleIndices: array<u32>;
      @group(0) @binding(3) var<storage, read_write> visibleCount: atomic<u32>;
      @group(0) @binding(4) var<storage, read_write> drawCommand: array<u32, 5>;

      @group(1) @binding(0) var<uniform> uniformsExt: CullUniformsExtended;
      @group(1) @binding(1) var hiZTexture: texture_2d<f32>;
      @group(1) @binding(2) var hiZSampler: sampler;

      const WORKGROUP_SIZE: u32 = 64u;
      var<workgroup> localVisibleIndices: array<u32, 64>;
      var<workgroup> localVisibleCount: atomic<u32>;

      fn projectToScreen(worldPos: vec3<f32>) -> vec3<f32> {
        let clipPos = uniformsExt.viewProj * vec4<f32>(worldPos, 1.0);
        if (clipPos.w <= 0.0) { return vec3<f32>(-1.0, -1.0, -1.0); }
        let ndcPos = clipPos.xyz / clipPos.w;
        return vec3<f32>(ndcPos.x * 0.5 + 0.5, -ndcPos.y * 0.5 + 0.5, ndcPos.z);
      }

      fn isOccludedByHiZ(center: vec3<f32>, radius: f32) -> bool {
        let screenSize = uniformsExt.screenInfo.xy;
        let maxMip = uniformsExt.screenInfo.z;
        
        let clipPos = uniformsExt.viewProj * vec4<f32>(center, 1.0);
        if (clipPos.w <= 0.0) { return true; }
        
        let ndcPos = clipPos.xyz / clipPos.w;
        if (ndcPos.x < -1.0 || ndcPos.x > 1.0 || ndcPos.y < -1.0 || ndcPos.y > 1.0) {
          return false;
        }
        
        let screenPos = vec2<f32>(ndcPos.x * 0.5 + 0.5, -ndcPos.y * 0.5 + 0.5);
        
        // Approximate screen-space radius
        let clipRadius = radius / clipPos.w;
        let screenRadius = clipRadius * 0.5 * max(screenSize.x, screenSize.y);
        
        // Select mip level based on screen-space size
        let mipLevel = ceil(log2(max(screenRadius * 2.0, 1.0)));
        let safeMip = clamp(mipLevel, 0.0, maxMip);
        
        // Compute near depth (closest point to camera)
        let nearClipPos = uniformsExt.viewProj * vec4<f32>(center - vec3<f32>(0.0, 0.0, radius), 1.0);
        let nearDepth = select(1.0, nearClipPos.z / nearClipPos.w, nearClipPos.w > 0.0);
        
        // Sample Hi-Z at center and corners
        let halfSize = screenRadius / max(screenSize.x, screenSize.y);
        var maxHiZ = textureSampleLevel(hiZTexture, hiZSampler, screenPos, safeMip).r;
        maxHiZ = max(maxHiZ, textureSampleLevel(hiZTexture, hiZSampler, screenPos + vec2(-halfSize, -halfSize), safeMip).r);
        maxHiZ = max(maxHiZ, textureSampleLevel(hiZTexture, hiZSampler, screenPos + vec2(halfSize, -halfSize), safeMip).r);
        maxHiZ = max(maxHiZ, textureSampleLevel(hiZTexture, hiZSampler, screenPos + vec2(-halfSize, halfSize), safeMip).r);
        maxHiZ = max(maxHiZ, textureSampleLevel(hiZTexture, hiZSampler, screenPos + vec2(halfSize, halfSize), safeMip).r);
        
        // For reverse-Z: smaller depth = farther, object occluded if nearDepth < maxHiZ
        return nearDepth < maxHiZ;
      }

      @compute @workgroup_size(64)
      fn mainWithOcclusion(
        @builtin(global_invocation_id) globalId: vec3<u32>,
        @builtin(local_invocation_id) localId: vec3<u32>
      ) {
        let instanceIndex = globalId.x;
        let localIndex = localId.x;
        let maxInstances = u32(uniformsExt.misc.x);
        let hiZEnabled = uniformsExt.screenInfo.w > 0.5;
        
        if (localIndex == 0u) {
          atomicStore(&localVisibleCount, 0u);
        }
        workgroupBarrier();
        
        if (instanceIndex >= maxInstances) {
          return;
        }
        
        let bounds = instanceBounds[instanceIndex];
        let center = bounds.xyz;
        let radius = bounds.w;
        
        // Stage 1: Frustum culling
        var isVisible = radius > 0.0;
        if (isVisible) {
          for (var i = 0u; i < 6u; i++) {
            let plane = uniformsExt.planes[i];
            let distance = dot(plane.xyz, center) + plane.w;
            if (distance < -radius) {
              isVisible = false;
              break;
            }
          }
        }
        
        // Stage 2: Hi-Z occlusion culling
        if (isVisible && hiZEnabled) {
          if (isOccludedByHiZ(center, radius)) {
            isVisible = false;
          }
        }
        
        var localWriteIndex = 0u;
        if (isVisible) {
          localWriteIndex = atomicAdd(&localVisibleCount, 1u);
          localVisibleIndices[localWriteIndex] = instanceIndex;
        }
        workgroupBarrier();
        
        if (localIndex == 0u) {
          let localCount = atomicLoad(&localVisibleCount);
          if (localCount > 0u) {
            let globalOffset = atomicAdd(&visibleCount, localCount);
            for (var i = 0u; i < localCount; i++) {
              visibleIndices[globalOffset + i] = localVisibleIndices[i];
            }
          }
        }
      }
    `;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  dispose(): void {
    try {
      this.uniformBuffer?.destroy();
      this.visibleCountBuffer?.destroy();
      this.visibleIndicesBuffer?.destroy();
      this.drawIndirectBuffer?.destroy();
      this.bvhNodesBuffer?.destroy();
      // Parallel BVH buffers
      this.workQueueBuffer?.destroy();
      this.queueHeadBuffer?.destroy();
      this.queueTailBuffer?.destroy();
      this.activeWorkgroupsBuffer?.destroy();
      // Hi-Z occlusion buffers
      this.hiZUniformBuffer?.destroy();
    } catch {
      // Ignore cleanup errors
    }

    this.uniformBuffer = null;
    this.visibleCountBuffer = null;
    this.visibleIndicesBuffer = null;
    this.drawIndirectBuffer = null;
    this.bvhNodesBuffer = null;
    this.workQueueBuffer = null;
    this.queueHeadBuffer = null;
    this.queueTailBuffer = null;
    this.activeWorkgroupsBuffer = null;
    this.hiZUniformBuffer = null;
    this.flatCullPipeline = null;
    this.bvhTraversePipeline = null;
    this.bvhCoherentTraversePipeline = null;
    this.bvhExpandTopLevelsPipeline = null;
    this.bvhParallelTraversePipeline = null;
    this.bvhParallelResetPipeline = null;
    this.bvhParallelFinalizePipeline = null;
    this.hiZOcclusionPipeline = null;
    this.initialized = false;
    this.parallelBvhInitialized = false;
    this.hiZOcclusionInitialized = false;
  }
}
