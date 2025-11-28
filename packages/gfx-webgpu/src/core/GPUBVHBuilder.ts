/**
 * GPU BVH Builder
 * 
 * Builds BVH entirely on the GPU using LBVH (Linear BVH) algorithm.
 * Optimal for dynamic scenes where CPU BVH construction would be a bottleneck.
 * 
 * Algorithm stages:
 * 1. Compute Morton codes for all instances
 * 2. Radix sort Morton codes (8 passes for 32-bit keys)
 * 3. Build binary radix tree (Karras 2012)
 * 4. Compute AABBs bottom-up
 * 
 * Output is compatible with GPUFrustumCuller BVH format.
 */

import { Logger } from '@engine/core/utils';
import type { Vec3 } from '@engine/core/math';

// ============================================================================
// Constants
// ============================================================================

const WORKGROUP_SIZE = 256;
const RADIX_BITS = 4;
const RADIX_BUCKETS = 16;  // 2^RADIX_BITS
const RADIX_PASSES = 8;    // 32 bits / 4 bits per pass

// Uniform buffer layout
const UNIFORM_SIZE = 32; // 8 floats

// ============================================================================
// Types
// ============================================================================

export interface GPUBVHBuilderOptions {
  /** Maximum number of instances to support. Default: 100000 */
  maxInstances?: number;
}

export interface SceneBounds {
  min: Vec3;
  max: Vec3;
}

export interface GPUBVHBuildResult {
  /** GPU buffer containing BVH nodes */
  nodesBuffer: GPUBuffer;
  /** Number of nodes in BVH (2*n-1 for n instances) */
  nodeCount: number;
  /** Time taken for GPU build (ms) */
  buildTimeMs: number;
}

// ============================================================================
// GPU BVH Builder Implementation
// ============================================================================

export class GPUBVHBuilder {
  private device: GPUDevice;
  private options: Required<GPUBVHBuilderOptions>;
  
  // Pipelines
  private computeMortonPipeline: GPUComputePipeline | null = null;
  private radixHistogramPipeline: GPUComputePipeline | null = null;
  private radixPrefixSumPipeline: GPUComputePipeline | null = null;
  private radixScatterPipeline: GPUComputePipeline | null = null;
  private radixCopyBackPipeline: GPUComputePipeline | null = null;
  private buildRadixTreePipeline: GPUComputePipeline | null = null;
  private initializeLeavesPipeline: GPUComputePipeline | null = null;
  private computeNodeBoundsPipeline: GPUComputePipeline | null = null;
  private resetNodeCountersPipeline: GPUComputePipeline | null = null;
  
  // Bind group layouts
  private mainBindGroupLayout: GPUBindGroupLayout | null = null;
  private sortBindGroupLayout: GPUBindGroupLayout | null = null;
  private boundsBindGroupLayout: GPUBindGroupLayout | null = null;
  
  // Buffers
  private uniformBuffer: GPUBuffer | null = null;
  private mortonCodesBuffer: GPUBuffer | null = null;
  private mortonCodesTempBuffer: GPUBuffer | null = null;
  private bvhNodesBuffer: GPUBuffer | null = null;
  private nodeParentsBuffer: GPUBuffer | null = null;
  private histogramsBuffer: GPUBuffer | null = null;
  private prefixSumsBuffer: GPUBuffer | null = null;
  private nodeCountersBuffer: GPUBuffer | null = null;
  
  // State
  private initialized = false;
  private currentCapacity = 0;
  
  constructor(device: GPUDevice, options: GPUBVHBuilderOptions = {}) {
    this.device = device;
    this.options = {
      maxInstances: options.maxInstances ?? 100000,
    };
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initializes GPU resources. Called lazily on first build.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.createPipelines();
      this.createStaticBuffers();
      this.initialized = true;
    } catch (err) {
      Logger.warn('[GPUBVHBuilder] Initialization failed:', err);
      this.initialized = false;
      throw err;
    }
  }

  private async createPipelines(): Promise<void> {
    const shaderCode = this.getShaderCode();
    const shaderModule = this.device.createShaderModule({
      label: 'gpu-bvh-build-shader',
      code: shaderCode,
    });

    // Main bind group layout (group 0)
    this.mainBindGroupLayout = this.device.createBindGroupLayout({
      label: 'gpu-bvh-main-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    // Sort bind group layout (group 1)
    this.sortBindGroupLayout = this.device.createBindGroupLayout({
      label: 'gpu-bvh-sort-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    // Bounds bind group layout (group 2)
    this.boundsBindGroupLayout = this.device.createBindGroupLayout({
      label: 'gpu-bvh-bounds-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    const mainLayout = this.device.createPipelineLayout({
      label: 'gpu-bvh-main-layout',
      bindGroupLayouts: [this.mainBindGroupLayout],
    });

    const sortLayout = this.device.createPipelineLayout({
      label: 'gpu-bvh-sort-layout',
      bindGroupLayouts: [this.mainBindGroupLayout, this.sortBindGroupLayout],
    });

    const boundsLayout = this.device.createPipelineLayout({
      label: 'gpu-bvh-bounds-layout',
      bindGroupLayouts: [this.mainBindGroupLayout, this.sortBindGroupLayout, this.boundsBindGroupLayout],
    });

    // Create pipelines
    this.computeMortonPipeline = this.device.createComputePipeline({
      label: 'gpu-bvh-compute-morton',
      layout: mainLayout,
      compute: { module: shaderModule, entryPoint: 'computeMortonCodes' },
    });

    this.radixHistogramPipeline = this.device.createComputePipeline({
      label: 'gpu-bvh-radix-histogram',
      layout: sortLayout,
      compute: { module: shaderModule, entryPoint: 'radixHistogram' },
    });

    this.radixPrefixSumPipeline = this.device.createComputePipeline({
      label: 'gpu-bvh-radix-prefix-sum',
      layout: sortLayout,
      compute: { module: shaderModule, entryPoint: 'radixPrefixSum' },
    });

    this.radixScatterPipeline = this.device.createComputePipeline({
      label: 'gpu-bvh-radix-scatter',
      layout: sortLayout,
      compute: { module: shaderModule, entryPoint: 'radixScatter' },
    });

    this.radixCopyBackPipeline = this.device.createComputePipeline({
      label: 'gpu-bvh-radix-copy-back',
      layout: sortLayout,
      compute: { module: shaderModule, entryPoint: 'radixCopyBack' },
    });

    this.buildRadixTreePipeline = this.device.createComputePipeline({
      label: 'gpu-bvh-build-tree',
      layout: mainLayout,
      compute: { module: shaderModule, entryPoint: 'buildRadixTree' },
    });

    this.initializeLeavesPipeline = this.device.createComputePipeline({
      label: 'gpu-bvh-init-leaves',
      layout: mainLayout,
      compute: { module: shaderModule, entryPoint: 'initializeLeaves' },
    });

    this.computeNodeBoundsPipeline = this.device.createComputePipeline({
      label: 'gpu-bvh-compute-bounds',
      layout: boundsLayout,
      compute: { module: shaderModule, entryPoint: 'computeNodeBounds' },
    });

    this.resetNodeCountersPipeline = this.device.createComputePipeline({
      label: 'gpu-bvh-reset-counters',
      layout: boundsLayout,
      compute: { module: shaderModule, entryPoint: 'resetNodeCounters' },
    });
  }

  private createStaticBuffers(): void {
    this.uniformBuffer = this.device.createBuffer({
      label: 'gpu-bvh-uniforms',
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Ensures buffers are large enough for the given instance count.
   */
  private ensureCapacity(instanceCount: number): void {
    if (instanceCount <= this.currentCapacity) return;

    const newCapacity = Math.max(instanceCount, this.currentCapacity * 2, 1024);
    const numNodes = 2 * newCapacity - 1;
    const numWorkgroups = Math.ceil(newCapacity / WORKGROUP_SIZE);
    const histogramSize = numWorkgroups * RADIX_BUCKETS;

    // Destroy old buffers
    this.mortonCodesBuffer?.destroy();
    this.mortonCodesTempBuffer?.destroy();
    this.bvhNodesBuffer?.destroy();
    this.nodeParentsBuffer?.destroy();
    this.histogramsBuffer?.destroy();
    this.prefixSumsBuffer?.destroy();
    this.nodeCountersBuffer?.destroy();

    // Morton codes (pair of u32)
    this.mortonCodesBuffer = this.device.createBuffer({
      label: 'gpu-bvh-morton-codes',
      size: newCapacity * 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.mortonCodesTempBuffer = this.device.createBuffer({
      label: 'gpu-bvh-morton-codes-temp',
      size: newCapacity * 8,
      usage: GPUBufferUsage.STORAGE,
    });

    // BVH nodes (32 bytes each)
    this.bvhNodesBuffer = this.device.createBuffer({
      label: 'gpu-bvh-nodes',
      size: numNodes * 32,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // Node parent pointers
    this.nodeParentsBuffer = this.device.createBuffer({
      label: 'gpu-bvh-parents',
      size: numNodes * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    // Radix sort histograms
    this.histogramsBuffer = this.device.createBuffer({
      label: 'gpu-bvh-histograms',
      size: histogramSize * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    this.prefixSumsBuffer = this.device.createBuffer({
      label: 'gpu-bvh-prefix-sums',
      size: histogramSize * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    // Node counters for bottom-up traversal
    this.nodeCountersBuffer = this.device.createBuffer({
      label: 'gpu-bvh-counters',
      size: numNodes * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    this.currentCapacity = newCapacity;
  }

  // ==========================================================================
  // Build API
  // ==========================================================================

  /**
   * Builds BVH on the GPU from instance bounds.
   * 
   * @param encoder - GPU command encoder
   * @param instanceBoundsBuffer - Buffer with instance bounds (vec4: xyz=center, w=radius)
   * @param instanceCount - Number of instances
   * @param sceneBounds - Scene AABB for Morton code normalization
   * @returns BVH nodes buffer and metadata
   */
  async build(
    encoder: GPUCommandEncoder,
    instanceBoundsBuffer: GPUBuffer,
    instanceCount: number,
    sceneBounds: SceneBounds
  ): Promise<GPUBVHBuildResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (instanceCount === 0) {
      return {
        nodesBuffer: this.bvhNodesBuffer!,
        nodeCount: 0,
        buildTimeMs: 0,
      };
    }

    const startTime = performance.now();

    this.ensureCapacity(instanceCount);
    this.uploadUniforms(instanceCount, sceneBounds, 0);

    const workgroupCount = Math.ceil(instanceCount / WORKGROUP_SIZE);
    const numNodes = 2 * instanceCount - 1;

    // Create bind groups
    const mainBindGroup = this.device.createBindGroup({
      label: 'gpu-bvh-main-bg',
      layout: this.mainBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: instanceBoundsBuffer } },
        { binding: 2, resource: { buffer: this.mortonCodesBuffer! } },
        { binding: 3, resource: { buffer: this.mortonCodesTempBuffer! } },
        { binding: 4, resource: { buffer: this.bvhNodesBuffer! } },
        { binding: 5, resource: { buffer: this.nodeParentsBuffer! } },
      ],
    });

    const sortBindGroup = this.device.createBindGroup({
      label: 'gpu-bvh-sort-bg',
      layout: this.sortBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.histogramsBuffer! } },
        { binding: 1, resource: { buffer: this.prefixSumsBuffer! } },
      ],
    });

    const boundsBindGroup = this.device.createBindGroup({
      label: 'gpu-bvh-bounds-bg',
      layout: this.boundsBindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.nodeCountersBuffer! } },
      ],
    });

    // Pass 1: Compute Morton codes
    const mortonPass = encoder.beginComputePass({ label: 'gpu-bvh-morton' });
    mortonPass.setPipeline(this.computeMortonPipeline!);
    mortonPass.setBindGroup(0, mainBindGroup);
    mortonPass.dispatchWorkgroups(workgroupCount);
    mortonPass.end();

    // Pass 2-9: Radix sort (8 passes for 32-bit keys)
    for (let pass = 0; pass < RADIX_PASSES; pass++) {
      this.uploadUniforms(instanceCount, sceneBounds, pass);

      // Histogram
      const histPass = encoder.beginComputePass({ label: `gpu-bvh-radix-hist-${pass}` });
      histPass.setPipeline(this.radixHistogramPipeline!);
      histPass.setBindGroup(0, mainBindGroup);
      histPass.setBindGroup(1, sortBindGroup);
      histPass.dispatchWorkgroups(workgroupCount);
      histPass.end();

      // Prefix sum
      const prefixPass = encoder.beginComputePass({ label: `gpu-bvh-radix-prefix-${pass}` });
      prefixPass.setPipeline(this.radixPrefixSumPipeline!);
      prefixPass.setBindGroup(0, mainBindGroup);
      prefixPass.setBindGroup(1, sortBindGroup);
      prefixPass.dispatchWorkgroups(1);
      prefixPass.end();

      // Scatter
      const scatterPass = encoder.beginComputePass({ label: `gpu-bvh-radix-scatter-${pass}` });
      scatterPass.setPipeline(this.radixScatterPipeline!);
      scatterPass.setBindGroup(0, mainBindGroup);
      scatterPass.setBindGroup(1, sortBindGroup);
      scatterPass.dispatchWorkgroups(workgroupCount);
      scatterPass.end();

      // Copy back
      const copyPass = encoder.beginComputePass({ label: `gpu-bvh-radix-copy-${pass}` });
      copyPass.setPipeline(this.radixCopyBackPipeline!);
      copyPass.setBindGroup(0, mainBindGroup);
      copyPass.setBindGroup(1, sortBindGroup);
      copyPass.dispatchWorkgroups(workgroupCount);
      copyPass.end();
    }

    // Pass 10: Initialize leaf nodes
    const leafPass = encoder.beginComputePass({ label: 'gpu-bvh-init-leaves' });
    leafPass.setPipeline(this.initializeLeavesPipeline!);
    leafPass.setBindGroup(0, mainBindGroup);
    leafPass.dispatchWorkgroups(workgroupCount);
    leafPass.end();

    // Pass 11: Build radix tree
    const treePass = encoder.beginComputePass({ label: 'gpu-bvh-build-tree' });
    treePass.setPipeline(this.buildRadixTreePipeline!);
    treePass.setBindGroup(0, mainBindGroup);
    treePass.dispatchWorkgroups(Math.ceil((instanceCount - 1) / WORKGROUP_SIZE));
    treePass.end();

    // Pass 12: Reset node counters
    const resetPass = encoder.beginComputePass({ label: 'gpu-bvh-reset-counters' });
    resetPass.setPipeline(this.resetNodeCountersPipeline!);
    resetPass.setBindGroup(0, mainBindGroup);
    resetPass.setBindGroup(1, sortBindGroup);
    resetPass.setBindGroup(2, boundsBindGroup);
    resetPass.dispatchWorkgroups(Math.ceil(numNodes / WORKGROUP_SIZE));
    resetPass.end();

    // Pass 13: Compute node bounds (bottom-up)
    const boundsPass = encoder.beginComputePass({ label: 'gpu-bvh-compute-bounds' });
    boundsPass.setPipeline(this.computeNodeBoundsPipeline!);
    boundsPass.setBindGroup(0, mainBindGroup);
    boundsPass.setBindGroup(1, sortBindGroup);
    boundsPass.setBindGroup(2, boundsBindGroup);
    boundsPass.dispatchWorkgroups(workgroupCount);
    boundsPass.end();

    const buildTimeMs = performance.now() - startTime;

    return {
      nodesBuffer: this.bvhNodesBuffer!,
      nodeCount: numNodes,
      buildTimeMs,
    };
  }

  /**
   * Computes scene bounds from instance bounds.
   * Can be done on CPU or GPU; here we provide a simple CPU version.
   */
  static computeSceneBounds(positions: Float32Array, radii: Float32Array): SceneBounds {
    const count = positions.length / 3;
    
    if (count === 0) {
      return {
        min: [0, 0, 0],
        max: [1, 1, 1],
      };
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3]!;
      const y = positions[i * 3 + 1]!;
      const z = positions[i * 3 + 2]!;
      const r = radii[i] ?? 0.5;

      minX = Math.min(minX, x - r);
      minY = Math.min(minY, y - r);
      minZ = Math.min(minZ, z - r);
      maxX = Math.max(maxX, x + r);
      maxY = Math.max(maxY, y + r);
      maxZ = Math.max(maxZ, z + r);
    }

    // Add small padding to avoid edge cases
    const padding = 0.001;
    return {
      min: [minX - padding, minY - padding, minZ - padding],
      max: [maxX + padding, maxY + padding, maxZ + padding],
    };
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  private uploadUniforms(instanceCount: number, sceneBounds: SceneBounds, radixPass: number): void {
    const extent: Vec3 = [
      sceneBounds.max[0] - sceneBounds.min[0],
      sceneBounds.max[1] - sceneBounds.min[1],
      sceneBounds.max[2] - sceneBounds.min[2],
    ];

    // Prevent division by zero
    const safeExtent: Vec3 = [
      extent[0] > 0 ? extent[0] : 1,
      extent[1] > 0 ? extent[1] : 1,
      extent[2] > 0 ? extent[2] : 1,
    ];

    const data = new Float32Array([
      instanceCount,           // instanceCount
      sceneBounds.min[0],      // sceneMinX
      sceneBounds.min[1],      // sceneMinY
      sceneBounds.min[2],      // sceneMinZ
      safeExtent[0],           // sceneExtentX
      safeExtent[1],           // sceneExtentY
      safeExtent[2],           // sceneExtentZ
      radixPass,               // currentRadixPass
    ]);

    this.device.queue.writeBuffer(this.uniformBuffer!, 0, data);
  }

  // ==========================================================================
  // Shader Code
  // ==========================================================================

  private getShaderCode(): string {
    return /* wgsl */ `
      const WORKGROUP_SIZE: u32 = 256u;
      const RADIX_BITS: u32 = 4u;
      const RADIX_BUCKETS: u32 = 16u;
      const NODE_FLAG_LEAF: u32 = 0x80000000u;

      struct BuildUniforms {
        instanceCount: u32,
        sceneMinX: f32,
        sceneMinY: f32,
        sceneMinZ: f32,
        sceneExtentX: f32,
        sceneExtentY: f32,
        sceneExtentZ: f32,
        currentRadixPass: u32,
      }

      struct BVHNode {
        boundsMin: vec4<f32>,
        boundsMax: vec4<f32>,
      }

      struct MortonPair {
        code: u32,
        index: u32,
      }

      @group(0) @binding(0) var<uniform> uniforms: BuildUniforms;
      @group(0) @binding(1) var<storage, read> instanceBounds: array<vec4<f32>>;
      @group(0) @binding(2) var<storage, read_write> mortonCodes: array<MortonPair>;
      @group(0) @binding(3) var<storage, read_write> mortonCodesTemp: array<MortonPair>;
      @group(0) @binding(4) var<storage, read_write> bvhNodes: array<BVHNode>;
      @group(0) @binding(5) var<storage, read_write> nodeParents: array<i32>;

      @group(1) @binding(0) var<storage, read_write> histograms: array<u32>;
      @group(1) @binding(1) var<storage, read_write> prefixSums: array<u32>;

      @group(2) @binding(0) var<storage, read_write> nodeCounters: array<atomic<u32>>;

      var<workgroup> localHistogram: array<atomic<u32>, RADIX_BUCKETS>;
      var<workgroup> localPrefixSum: array<u32, RADIX_BUCKETS>;

      fn expandBits(v: u32) -> u32 {
        var x = v & 0x3FFu;
        x = (x | (x << 16u)) & 0x030000FFu;
        x = (x | (x << 8u))  & 0x0300F00Fu;
        x = (x | (x << 4u))  & 0x030C30C3u;
        x = (x | (x << 2u))  & 0x09249249u;
        return x;
      }

      fn computeMorton(pos: vec3<f32>) -> u32 {
        let sceneMin = vec3<f32>(uniforms.sceneMinX, uniforms.sceneMinY, uniforms.sceneMinZ);
        let sceneExtent = vec3<f32>(uniforms.sceneExtentX, uniforms.sceneExtentY, uniforms.sceneExtentZ);
        let normalized = clamp((pos - sceneMin) / sceneExtent, vec3<f32>(0.0), vec3<f32>(1.0));
        let quantized = vec3<u32>(normalized * 1023.0);
        return expandBits(quantized.x) | (expandBits(quantized.y) << 1u) | (expandBits(quantized.z) << 2u);
      }

      @compute @workgroup_size(256)
      fn computeMortonCodes(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let instanceIndex = globalId.x;
        if (instanceIndex >= uniforms.instanceCount) { return; }
        let bounds = instanceBounds[instanceIndex];
        let mortonCode = computeMorton(bounds.xyz);
        mortonCodes[instanceIndex] = MortonPair(mortonCode, instanceIndex);
      }

      fn getRadixDigit(code: u32, pass: u32) -> u32 {
        return (code >> (pass * RADIX_BITS)) & (RADIX_BUCKETS - 1u);
      }

      @compute @workgroup_size(256)
      fn radixHistogram(@builtin(global_invocation_id) globalId: vec3<u32>,
                        @builtin(local_invocation_id) localId: vec3<u32>,
                        @builtin(workgroup_id) workgroupId: vec3<u32>) {
        let instanceIndex = globalId.x;
        let localIndex = localId.x;
        let pass = uniforms.currentRadixPass;
        
        if (localIndex < RADIX_BUCKETS) {
          atomicStore(&localHistogram[localIndex], 0u);
        }
        workgroupBarrier();
        
        if (instanceIndex < uniforms.instanceCount) {
          let code = mortonCodes[instanceIndex].code;
          let digit = getRadixDigit(code, pass);
          atomicAdd(&localHistogram[digit], 1u);
        }
        workgroupBarrier();
        
        if (localIndex < RADIX_BUCKETS) {
          let histOffset = workgroupId.x * RADIX_BUCKETS + localIndex;
          histograms[histOffset] = atomicLoad(&localHistogram[localIndex]);
        }
      }

      @compute @workgroup_size(256)
      fn radixPrefixSum(@builtin(global_invocation_id) globalId: vec3<u32>) {
        if (globalId.x != 0u) { return; }
        let numWorkgroups = (uniforms.instanceCount + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
        let totalHistEntries = numWorkgroups * RADIX_BUCKETS;
        var sum = 0u;
        for (var i = 0u; i < totalHistEntries; i++) {
          let val = histograms[i];
          prefixSums[i] = sum;
          sum += val;
        }
      }

      @compute @workgroup_size(256)
      fn radixScatter(@builtin(global_invocation_id) globalId: vec3<u32>,
                      @builtin(local_invocation_id) localId: vec3<u32>,
                      @builtin(workgroup_id) workgroupId: vec3<u32>) {
        let instanceIndex = globalId.x;
        let localIndex = localId.x;
        let pass = uniforms.currentRadixPass;
        
        if (localIndex < RADIX_BUCKETS) {
          atomicStore(&localHistogram[localIndex], 0u);
          localPrefixSum[localIndex] = prefixSums[workgroupId.x * RADIX_BUCKETS + localIndex];
        }
        workgroupBarrier();
        
        if (instanceIndex >= uniforms.instanceCount) { return; }
        
        let pair = mortonCodes[instanceIndex];
        let digit = getRadixDigit(pair.code, pass);
        let localOffset = atomicAdd(&localHistogram[digit], 1u);
        workgroupBarrier();
        let globalOffset = localPrefixSum[digit] + localOffset;
        mortonCodesTemp[globalOffset] = pair;
      }

      @compute @workgroup_size(256)
      fn radixCopyBack(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let index = globalId.x;
        if (index >= uniforms.instanceCount) { return; }
        mortonCodes[index] = mortonCodesTemp[index];
      }

      @compute @workgroup_size(256)
      fn initializeLeaves(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let leafIdx = globalId.x;
        let n = uniforms.instanceCount;
        if (leafIdx >= n) { return; }
        
        let instanceIdx = mortonCodes[leafIdx].index;
        let bounds = instanceBounds[instanceIdx];
        let center = bounds.xyz;
        let radius = bounds.w;
        let nodeIdx = n - 1u + leafIdx;
        
        bvhNodes[nodeIdx].boundsMin = vec4<f32>(center - vec3<f32>(radius), bitcast<f32>(instanceIdx | NODE_FLAG_LEAF));
        bvhNodes[nodeIdx].boundsMax = vec4<f32>(center + vec3<f32>(radius), bitcast<f32>(1u));
        nodeParents[nodeIdx] = -2;
      }

      fn commonUpperBits(code1: u32, code2: u32) -> i32 {
        return i32(countLeadingZeros(code1 ^ code2));
      }

      fn findSplit(first: i32, last: i32) -> i32 {
        let firstCode = mortonCodes[first].code;
        let lastCode = mortonCodes[last].code;
        if (firstCode == lastCode) { return (first + last) >> 1; }
        let commonPrefix = commonUpperBits(firstCode, lastCode);
        var split = first;
        var step = last - first;
        loop {
          step = (step + 1) >> 1;
          let newSplit = split + step;
          if (newSplit < last) {
            let splitCode = mortonCodes[newSplit].code;
            let splitPrefix = commonUpperBits(firstCode, splitCode);
            if (splitPrefix > commonPrefix) { split = newSplit; }
          }
          if (step <= 1) { break; }
        }
        return split;
      }

      fn determineRange(i: i32, n: i32) -> vec2<i32> {
        let d = select(-1, 1, commonUpperBits(mortonCodes[i].code, mortonCodes[min(i + 1, n - 1)].code) > 
                              commonUpperBits(mortonCodes[i].code, mortonCodes[max(i - 1, 0)].code));
        let deltaMin = commonUpperBits(mortonCodes[i].code, mortonCodes[max(i - d, 0)].code);
        var lmax = 2;
        loop {
          let idx = i + lmax * d;
          if (idx < 0 || idx >= n) { break; }
          if (commonUpperBits(mortonCodes[i].code, mortonCodes[idx].code) <= deltaMin) { break; }
          lmax *= 2;
        }
        var l = 0;
        var t = lmax >> 1;
        loop {
          if (t <= 0) { break; }
          let idx = i + (l + t) * d;
          if (idx >= 0 && idx < n) {
            if (commonUpperBits(mortonCodes[i].code, mortonCodes[idx].code) > deltaMin) { l += t; }
          }
          t >>= 1;
        }
        let j = i + l * d;
        return select(vec2<i32>(j, i), vec2<i32>(i, j), d > 0);
      }

      @compute @workgroup_size(256)
      fn buildRadixTree(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let i = i32(globalId.x);
        let n = i32(uniforms.instanceCount);
        if (i >= n - 1) { return; }
        
        let range = determineRange(i, n);
        let first = range.x;
        let last = range.y;
        let split = findSplit(first, last);
        
        var childLeft: i32;
        var childRight: i32;
        if (split == first) { childLeft = split + n - 1; }
        else { childLeft = split; }
        if (split + 1 == last) { childRight = split + 1 + n - 1; }
        else { childRight = split + 1; }
        
        let nodeIdx = u32(i);
        bvhNodes[nodeIdx].boundsMin.w = bitcast<f32>(u32(childLeft));
        bvhNodes[nodeIdx].boundsMax.w = bitcast<f32>(u32(childRight));
        nodeParents[childLeft] = i;
        nodeParents[childRight] = i;
        if (i == 0) { nodeParents[0] = -1; }
      }

      @compute @workgroup_size(256)
      fn resetNodeCounters(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let nodeIdx = globalId.x;
        let numNodes = 2u * uniforms.instanceCount - 1u;
        if (nodeIdx >= numNodes) { return; }
        atomicStore(&nodeCounters[nodeIdx], 0u);
      }

      @compute @workgroup_size(256)
      fn computeNodeBounds(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let leafIdx = globalId.x;
        let n = uniforms.instanceCount;
        if (leafIdx >= n) { return; }
        
        var nodeIdx = i32(n - 1u + leafIdx);
        var parentIdx = nodeParents[nodeIdx];
        
        while (parentIdx >= 0) {
          let count = atomicAdd(&nodeCounters[parentIdx], 1u);
          if (count == 0u) { return; }
          
          let leftChild = i32(bitcast<u32>(bvhNodes[parentIdx].boundsMin.w));
          let rightChild = i32(bitcast<u32>(bvhNodes[parentIdx].boundsMax.w));
          let leftNode = bvhNodes[leftChild];
          let rightNode = bvhNodes[rightChild];
          
          let mergedMin = min(leftNode.boundsMin.xyz, rightNode.boundsMin.xyz);
          let mergedMax = max(leftNode.boundsMax.xyz, rightNode.boundsMax.xyz);
          
          bvhNodes[parentIdx].boundsMin = vec4<f32>(mergedMin, bvhNodes[parentIdx].boundsMin.w);
          bvhNodes[parentIdx].boundsMax = vec4<f32>(mergedMax, bvhNodes[parentIdx].boundsMax.w);
          
          nodeIdx = parentIdx;
          parentIdx = nodeParents[nodeIdx];
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
      this.mortonCodesBuffer?.destroy();
      this.mortonCodesTempBuffer?.destroy();
      this.bvhNodesBuffer?.destroy();
      this.nodeParentsBuffer?.destroy();
      this.histogramsBuffer?.destroy();
      this.prefixSumsBuffer?.destroy();
      this.nodeCountersBuffer?.destroy();
    } catch {
      // Ignore cleanup errors
    }

    this.uniformBuffer = null;
    this.mortonCodesBuffer = null;
    this.mortonCodesTempBuffer = null;
    this.bvhNodesBuffer = null;
    this.nodeParentsBuffer = null;
    this.histogramsBuffer = null;
    this.prefixSumsBuffer = null;
    this.nodeCountersBuffer = null;
    this.computeMortonPipeline = null;
    this.radixHistogramPipeline = null;
    this.radixPrefixSumPipeline = null;
    this.radixScatterPipeline = null;
    this.radixCopyBackPipeline = null;
    this.buildRadixTreePipeline = null;
    this.initializeLeavesPipeline = null;
    this.computeNodeBoundsPipeline = null;
    this.resetNodeCountersPipeline = null;
    this.initialized = false;
    this.currentCapacity = 0;
  }
}

