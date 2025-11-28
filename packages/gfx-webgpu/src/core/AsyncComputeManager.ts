/**
 * AsyncComputeManager - Coordinates async compute with rendering
 * 
 * Enables GPU compute work to overlap with rendering by managing
 * separate command encoders and synchronization between frames.
 * 
 * Key features:
 * - Frame N culling overlaps with Frame N-1 rendering
 * - Automatic fallback to synchronous path if async unavailable
 * - Performance metrics tracking
 * 
 * @module gfx-webgpu/core
 */

import type { Mat4 } from '@engine/core/math';
import { extractFrustumPlanes, type FrustumPlane } from '@engine/core/math';
import { Logger } from '@engine/core/utils';
import { CullingRingBuffer, type CullingFrame, type CullingRingBufferOptions } from './CullingRingBuffer';
export type { CullingFrame } from './CullingRingBuffer';
import type { GeometryData, FrameResources } from '../resources/resources';
import { MaterialComponent } from '@engine/world';

/** Workgroup size for culling compute shader */
const WORKGROUP_SIZE = 64;

/** Frustum uniform buffer size in bytes */
const FRUSTUM_UNIFORM_SIZE = 128;

/** Instance stride in floats */
const INSTANCE_STRIDE = 24;

/** Material params offset in instance data */
const INSTANCE_MATERIAL_PARAMS_OFFSET = 15;

/**
 * Configuration for AsyncComputeManager
 */
export interface AsyncComputeManagerOptions extends CullingRingBufferOptions {
  /** Enable async compute (default: true) */
  enabled?: boolean;
  /** Track compute completion for debugging (default: false in production) */
  trackCompletion?: boolean;
}

/**
 * Parameters for recording culling passes
 */
export interface CullingParams {
  /** View-projection matrix for frustum planes */
  viewProjectionMatrix: Mat4;
  /** Geometry data with instance buffers */
  geometry: GeometryData;
  /** Frame resources containing input buffers */
  frameResources: FrameResources;
}

/**
 * Result of culling preparation
 */
export interface CullingResult {
  /** The culling frame slot used */
  slot: CullingFrame;
  /** Command buffer with recorded culling work */
  commandBuffer: GPUCommandBuffer;
  /** Instance count processed */
  instanceCount: number;
}

/**
 * Performance metrics from async compute
 */
export interface AsyncComputeMetrics {
  /** Number of async culling passes submitted */
  asyncCullingCount: number;
  /** Number of fallback sync culling passes */
  syncFallbackCount: number;
  /** Average latency between culling and rendering (ms) */
  averageLatencyMs: number;
  /** Number of frames where culling wasn't ready in time */
  stalledFrameCount: number;
}

/**
 * Shader code for GPU instance culling and compaction
 */
const ASYNC_CULLING_SHADER = /* wgsl */ `
const INSTANCE_STRIDE: u32 = ${INSTANCE_STRIDE}u;
const MATERIAL_PARAMS_OFFSET: u32 = ${INSTANCE_MATERIAL_PARAMS_OFFSET}u;

struct CullingUniforms {
  planes: array<vec4<f32>, 6>,
  misc: vec4<f32>,
};

struct VisibilityCounters {
  opaque: atomic<u32>,
  transparent: atomic<u32>,
};

@group(0) @binding(0) var<uniform> uniforms: CullingUniforms;
@group(0) @binding(1) var<storage, read> instanceBounds: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> instanceInterleaved: array<f32>;
@group(0) @binding(3) var<storage, read_write> visibleOpaqueIndices: array<u32>;
@group(0) @binding(4) var<storage, read_write> visibleTransparentIndices: array<u32>;
@group(0) @binding(5) var<storage, read_write> counts: VisibilityCounters;

fn isVisible(bounds: vec4<f32>) -> bool {
  for (var i: u32 = 0u; i < 6u; i = i + 1u) {
    let plane = uniforms.planes[i];
    let dist = plane.x * bounds.x + plane.y * bounds.y + plane.z * bounds.z + plane.w;
    if (dist < -bounds.w) {
      return false;
    }
  }
  return true;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn classify(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let instanceIndex = global_id.x;
  let maxInstances = u32(uniforms.misc.x);
  if (instanceIndex >= maxInstances) {
    return;
  }

  let bounds = instanceBounds[instanceIndex];
  if (!isVisible(bounds)) {
    return;
  }

  let paramsBase = instanceIndex * INSTANCE_STRIDE + MATERIAL_PARAMS_OFFSET;
  let alpha = instanceInterleaved[paramsBase + 0u];
  let flags = u32(instanceInterleaved[paramsBase + 3u]);
  let transparentFlag = u32(uniforms.misc.z);
  let isTransparent = ((flags & transparentFlag) != 0u) || (alpha < 0.999);

  if (isTransparent) {
    let writeIdx = atomicAdd(&counts.transparent, 1u);
    visibleTransparentIndices[writeIdx] = instanceIndex;
  } else {
    let writeIdx = atomicAdd(&counts.opaque, 1u);
    visibleOpaqueIndices[writeIdx] = instanceIndex;
  }
}

@group(1) @binding(0) var<storage, read_write> compactCounts: VisibilityCounters;
@group(1) @binding(1) var<storage, read> compactOpaqueIndices: array<u32>;
@group(1) @binding(2) var<storage, read> compactTransparentIndices: array<u32>;
@group(1) @binding(3) var<storage, read> compactSource: array<f32>;
@group(1) @binding(4) var<storage, read_write> compactDestination: array<f32>;

fn copyInstance(srcIndex: u32, dstIndex: u32) {
  let srcBase = srcIndex * INSTANCE_STRIDE;
  let dstBase = dstIndex * INSTANCE_STRIDE;
  for (var c: u32 = 0u; c < INSTANCE_STRIDE; c = c + 1u) {
    compactDestination[dstBase + c] = compactSource[srcBase + c];
  }
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn compact(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let lane = global_id.x;

  let opaqueCount = atomicLoad(&compactCounts.opaque);
  if (lane < opaqueCount) {
    let srcIndex = compactOpaqueIndices[lane];
    copyInstance(srcIndex, lane);
  }

  let transparentCount = atomicLoad(&compactCounts.transparent);
  if (lane < transparentCount) {
    let srcIndex = compactTransparentIndices[lane];
    let dstIndex = opaqueCount + lane;
    copyInstance(srcIndex, dstIndex);
  }
}

@group(2) @binding(0) var<storage, read_write> finalizeCounts: VisibilityCounters;
@group(2) @binding(1) var<storage, read_write> drawArgs: array<u32>;
@group(2) @binding(2) var<uniform> finalizeUniforms: CullingUniforms;

@compute @workgroup_size(1)
fn finalizeDrawArgs() {
  let opaqueCount = atomicLoad(&finalizeCounts.opaque);
  let transparentCount = atomicLoad(&finalizeCounts.transparent);
  let totalCount = opaqueCount + transparentCount;
  let indexCount = u32(finalizeUniforms.misc.y);

  drawArgs[0] = indexCount;
  drawArgs[1] = opaqueCount;
  drawArgs[2] = 0u;
  drawArgs[3] = 0u;
  drawArgs[4] = 0u;

  drawArgs[5] = indexCount;
  drawArgs[6] = transparentCount;
  drawArgs[7] = 0u;
  drawArgs[8] = 0u;
  drawArgs[9] = opaqueCount;

  drawArgs[10] = indexCount;
  drawArgs[11] = totalCount;
  drawArgs[12] = 0u;
  drawArgs[13] = 0u;
  drawArgs[14] = 0u;
}
`;

/**
 * Manages async compute for culling operations with frame overlap.
 * 
 * Typical usage:
 * ```typescript
 * // At frame start, prepare culling for this frame
 * const culling = await asyncManager.prepareCulling(nextFrameVP, geometry, resources);
 * 
 * // Submit culling work immediately (runs async)
 * asyncManager.submitCulling(culling);
 * 
 * // Get ready culling results for rendering (may be from previous frame)
 * const readySlot = asyncManager.acquireReadyCulling();
 * if (readySlot) {
 *   // Use readySlot.compactedInterleavedBuffer and readySlot.indirectArgsBuffer for rendering
 * }
 * 
 * // After render submit, release the slot
 * asyncManager.releaseRendering(readySlot);
 * ```
 */
export class AsyncComputeManager {
  private readonly device: GPUDevice;
  private readonly ringBuffer: CullingRingBuffer;
  private readonly enabled: boolean;
  private readonly trackCompletion: boolean;

  // GPU resources for culling pipeline
  private uniformBuffer: GPUBuffer;
  private classifyPipeline!: GPUComputePipeline;
  private compactPipeline!: GPUComputePipeline;
  private finalizePipeline!: GPUComputePipeline;
  private classifyBindGroupLayout!: GPUBindGroupLayout;
  private compactBindGroupLayout!: GPUBindGroupLayout;
  private finalizeBindGroupLayout!: GPUBindGroupLayout;
  private emptyBindGroupLayout: GPUBindGroupLayout;
  private readonly frustumPlanes: FrustumPlane[] = new Array(6);

  // Metrics
  private metrics: AsyncComputeMetrics = {
    asyncCullingCount: 0,
    syncFallbackCount: 0,
    averageLatencyMs: 0,
    stalledFrameCount: 0,
  };
  private latencySamples: number[] = [];
  private disposed = false;

  constructor(device: GPUDevice, options: AsyncComputeManagerOptions = {}) {
    this.device = device;
    this.enabled = options.enabled ?? true;
    this.trackCompletion = options.trackCompletion ?? false;

    // Create ring buffer
    this.ringBuffer = new CullingRingBuffer(device, {
      slotCount: options.slotCount ?? 3,
      initialCapacity: options.initialCapacity ?? 1024,
      labelPrefix: options.labelPrefix ?? 'async-cull',
    });

    // Create uniform buffer for frustum planes
    this.uniformBuffer = device.createBuffer({
      label: 'async-cull-uniforms',
      size: FRUSTUM_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create empty bind group layout for placeholder groups
    this.emptyBindGroupLayout = device.createBindGroupLayout({
      label: 'async-cull-empty-bgl',
      entries: [],
    });

    // Initialize compute pipelines
    this.initializePipelines();

    Logger.debug(`[AsyncComputeManager] Created (enabled: ${this.enabled})`);
  }

  /**
   * Initializes GPU compute pipelines for culling
   */
  private initializePipelines(): void {
    const module = this.device.createShaderModule({
      label: 'async-culling-shader',
      code: ASYNC_CULLING_SHADER,
    });

    // Classify bind group layout
    this.classifyBindGroupLayout = this.device.createBindGroupLayout({
      label: 'async-cull-classify-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    // Compact bind group layout
    this.compactBindGroupLayout = this.device.createBindGroupLayout({
      label: 'async-cull-compact-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    // Finalize bind group layout
    this.finalizeBindGroupLayout = this.device.createBindGroupLayout({
      label: 'async-cull-finalize-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    // Create pipelines
    this.classifyPipeline = this.device.createComputePipeline({
      label: 'async-cull-classify-pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.classifyBindGroupLayout],
      }),
      compute: { module, entryPoint: 'classify' },
    });

    this.compactPipeline = this.device.createComputePipeline({
      label: 'async-cull-compact-pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.emptyBindGroupLayout, this.compactBindGroupLayout],
      }),
      compute: { module, entryPoint: 'compact' },
    });

    this.finalizePipeline = this.device.createComputePipeline({
      label: 'async-cull-finalize-pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.emptyBindGroupLayout, this.emptyBindGroupLayout, this.finalizeBindGroupLayout],
      }),
      compute: { module, entryPoint: 'finalizeDrawArgs' },
    });
  }

  /**
   * Updates the uniform buffer with frustum planes and instance info
   */
  private updateUniforms(viewProjection: Mat4, instanceCount: number, indexCount: number): void {
    const planes = extractFrustumPlanes(this.frustumPlanes, viewProjection);
    const data = new Float32Array(FRUSTUM_UNIFORM_SIZE / 4);
    
    for (let i = 0; i < 6; i++) {
      const plane = planes[i]!;
      const offset = i * 4;
      data[offset + 0] = plane.normal[0];
      data[offset + 1] = plane.normal[1];
      data[offset + 2] = plane.normal[2];
      data[offset + 3] = plane.d;
    }
    
    const miscOffset = 6 * 4;
    data[miscOffset + 0] = instanceCount;
    data[miscOffset + 1] = indexCount;
    data[miscOffset + 2] = MaterialComponent.FLAG_TRANSPARENT;
    data[miscOffset + 3] = 0;
    
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data.buffer, data.byteOffset, FRUSTUM_UNIFORM_SIZE);
  }

  /**
   * Checks if async compute is enabled and available
   */
  isEnabled(): boolean {
    return this.enabled && !this.disposed;
  }

  /**
   * Prepares culling work for the next frame.
   * Records compute passes to a separate command encoder.
   * Returns null if no slots are available or async is disabled.
   */
  prepareCulling(params: CullingParams): CullingResult | null {
    if (!this.enabled || this.disposed) {
      return null;
    }

    const { viewProjectionMatrix, geometry, frameResources } = params;
    const instanceCount = geometry.instanceCount;

    if (instanceCount === 0) {
      return null;
    }

    // Ensure ring buffer capacity
    this.ringBuffer.ensureCapacity(instanceCount);

    // Acquire a free slot
    const slot = this.ringBuffer.acquireForCulling(viewProjectionMatrix);
    if (!slot) {
      this.metrics.syncFallbackCount++;
      return null;
    }

    // Update uniforms
    this.updateUniforms(viewProjectionMatrix, instanceCount, geometry.indices.length);

    // Create separate encoder for async culling
    const encoder = this.device.createCommandEncoder({ label: 'async-culling-encoder' });

    // Record classify pass
    const classifyBindGroup = this.device.createBindGroup({
      layout: this.classifyBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: frameResources.instanceBoundsBuffer } },
        { binding: 2, resource: { buffer: frameResources.instanceInterleavedStagingBuffer } },
        { binding: 3, resource: { buffer: slot.opaqueIndicesBuffer } },
        { binding: 4, resource: { buffer: slot.transparentIndicesBuffer } },
        { binding: 5, resource: { buffer: slot.countsBuffer } },
      ],
    });

    const classifyPass = encoder.beginComputePass({ label: 'async-classify-pass' });
    classifyPass.setPipeline(this.classifyPipeline);
    classifyPass.setBindGroup(0, classifyBindGroup);
    classifyPass.dispatchWorkgroups(Math.ceil(instanceCount / WORKGROUP_SIZE));
    classifyPass.end();

    // Record compact pass
    const compactBindGroup = this.device.createBindGroup({
      layout: this.compactBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: slot.countsBuffer } },
        { binding: 1, resource: { buffer: slot.opaqueIndicesBuffer } },
        { binding: 2, resource: { buffer: slot.transparentIndicesBuffer } },
        { binding: 3, resource: { buffer: frameResources.instanceInterleavedStagingBuffer } },
        { binding: 4, resource: { buffer: slot.compactedInterleavedBuffer } },
      ],
    });

    const compactPass = encoder.beginComputePass({ label: 'async-compact-pass' });
    compactPass.setPipeline(this.compactPipeline);
    compactPass.setBindGroup(1, compactBindGroup);
    compactPass.dispatchWorkgroups(Math.ceil(instanceCount / WORKGROUP_SIZE));
    compactPass.end();

    // Record finalize pass
    const finalizeBindGroup = this.device.createBindGroup({
      layout: this.finalizeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: slot.countsBuffer } },
        { binding: 1, resource: { buffer: slot.indirectArgsBuffer } },
        { binding: 2, resource: { buffer: this.uniformBuffer } },
      ],
    });

    const finalizePass = encoder.beginComputePass({ label: 'async-finalize-pass' });
    finalizePass.setPipeline(this.finalizePipeline);
    finalizePass.setBindGroup(2, finalizeBindGroup);
    finalizePass.dispatchWorkgroups(1);
    finalizePass.end();

    return {
      slot,
      commandBuffer: encoder.finish(),
      instanceCount,
    };
  }

  /**
   * Submits culling work to the GPU queue.
   * The work will execute asynchronously.
   */
  submitCulling(result: CullingResult): void {
    if (!result || this.disposed) {
      return;
    }

    this.device.queue.submit([result.commandBuffer]);
    this.ringBuffer.submitCulling(result.slot, this.trackCompletion);
    this.metrics.asyncCullingCount++;
  }

  /**
   * Acquires a ready culling slot for rendering.
   * Returns the most recent completed culling results.
   * Returns null if no culling is ready.
   */
  acquireReadyCulling(): CullingFrame | null {
    if (!this.enabled || this.disposed) {
      return null;
    }

    const slot = this.ringBuffer.acquireForRendering();
    
    if (slot) {
      // Track latency for metrics
      const latency = performance.now() - slot.timestamp;
      this.latencySamples.push(latency);
      if (this.latencySamples.length > 60) {
        this.latencySamples.shift();
      }
      this.metrics.averageLatencyMs = 
        this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length;
    } else {
      this.metrics.stalledFrameCount++;
    }

    return slot;
  }

  /**
   * Releases a rendering slot back to the ring buffer
   */
  releaseRendering(slot: CullingFrame): void {
    if (!slot || this.disposed) {
      return;
    }

    this.ringBuffer.releaseRendering(slot);
  }

  /**
   * Gets statistics about ring buffer state
   */
  getRingBufferStats() {
    return this.ringBuffer.getStats();
  }

  /**
   * Gets performance metrics
   */
  getMetrics(): Readonly<AsyncComputeMetrics> {
    return { ...this.metrics };
  }

  /**
   * Resets performance metrics
   */
  resetMetrics(): void {
    this.metrics = {
      asyncCullingCount: 0,
      syncFallbackCount: 0,
      averageLatencyMs: 0,
      stalledFrameCount: 0,
    };
    this.latencySamples = [];
  }

  /**
   * Checks if a free slot is available for culling
   */
  hasFreeSlot(): boolean {
    return this.ringBuffer.hasFreeSot();
  }

  /**
   * Checks if a ready slot is available for rendering
   */
  hasReadySlot(): boolean {
    return this.ringBuffer.hasReadySlot();
  }

  /**
   * Waits for all pending compute work to complete
   */
  async flush(): Promise<void> {
    await this.ringBuffer.flush();
  }

  /**
   * Disposes all GPU resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.ringBuffer.dispose();

    try {
      this.uniformBuffer.destroy();
    } catch {
      // Ignore destruction errors
    }

    Logger.debug('[AsyncComputeManager] Disposed');
  }
}

