import { extractFrustumPlanes, type Mat4, type FrustumPlane } from '@engine/core/math';
import { Logger } from '@engine/core/utils';
import type { GeometryData, FrameResources } from '../resources/resources';
import { buildIndirectDrawArgs } from './InstancePipelineTypes';
import { MaterialComponent } from '@engine/world';
import { INSTANCE_STRIDE, INSTANCE_MATERIAL_PARAMS_OFFSET } from './InstanceManager';

const WORKGROUP_SIZE = 64;
const FRUSTUM_UNIFORM_SIZE = 128; // bytes (6 planes + misc vec4)
const COUNTS_BUFFER_SIZE = 16; // opaque + transparent with padding

/**
 * GPU compute shader for instance culling and compaction.
 * 
 * Uses interleaved buffer layout (24 floats = 96 bytes per instance):
 * - offset: vec3 (3 floats) at offset 0
 * - colorScale: vec4 (4 floats) at offset 3
 * - secondaryColor: vec4 (4 floats) at offset 7
 * - emissiveColor: vec4 (4 floats) at offset 11
 * - materialParams: vec4 (4 floats) at offset 15
 * - rotation: vec4 (4 floats) at offset 19
 * - materialId: f32 (1 float) at offset 23
 */
const INSTANCE_PIPELINE_SHADER = /* wgsl */ `
const INSTANCE_STRIDE: u32 = ${INSTANCE_STRIDE}u;
const MATERIAL_PARAMS_OFFSET: u32 = ${INSTANCE_MATERIAL_PARAMS_OFFSET}u;

struct InstanceUniforms {
  planes: array<vec4<f32>, 6>,
  misc: vec4<f32>,
};

struct VisibilityCounters {
  opaque: atomic<u32>,
  transparent: atomic<u32>,
};

@group(0) @binding(0) var<uniform> classifyUniforms: InstanceUniforms;
@group(0) @binding(1) var<storage, read> instanceBounds: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> instanceInterleaved: array<f32>;
@group(0) @binding(3) var<storage, read_write> visibleOpaqueIndices: array<u32>;
@group(0) @binding(4) var<storage, read_write> visibleTransparentIndices: array<u32>;
@group(0) @binding(5) var<storage, read_write> classifyCounts: VisibilityCounters;

fn isVisible(bounds: vec4<f32>) -> bool {
  for (var i: u32 = 0u; i < 6u; i = i + 1u) {
    let plane = classifyUniforms.planes[i];
    let dist =
      plane.x * bounds.x +
      plane.y * bounds.y +
      plane.z * bounds.z +
      plane.w;
    if (dist < -bounds.w) {
      return false;
    }
  }
  return true;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn classify(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let instanceIndex = global_id.x;
  let maxInstances = u32(classifyUniforms.misc.x);
  if (instanceIndex >= maxInstances) {
    return;
  }

  let bounds = instanceBounds[instanceIndex];
  if (!isVisible(bounds)) {
    return;
  }

  // Read materialParams from interleaved buffer at offset 15
  let paramsBase = instanceIndex * INSTANCE_STRIDE + MATERIAL_PARAMS_OFFSET;
  let alpha = instanceInterleaved[paramsBase + 0u];
  let flags = u32(instanceInterleaved[paramsBase + 3u]);
  let transparentFlag = u32(classifyUniforms.misc.z);
  let isTransparent =
    ((flags & transparentFlag) != 0u) || (alpha < 0.999);

  if (isTransparent) {
    let writeIdx = atomicAdd(&classifyCounts.transparent, 1u);
    visibleTransparentIndices[writeIdx] = instanceIndex;
  } else {
    let writeIdx = atomicAdd(&classifyCounts.opaque, 1u);
    visibleOpaqueIndices[writeIdx] = instanceIndex;
  }
}

@group(1) @binding(0) var<storage, read_write> compactCounts: VisibilityCounters;
@group(1) @binding(1) var<storage, read> compactOpaqueIndices: array<u32>;
@group(1) @binding(2) var<storage, read> compactTransparentIndices: array<u32>;
@group(1) @binding(3) var<storage, read> compactSource: array<f32>;
@group(1) @binding(4) var<storage, read_write> compactDestination: array<f32>;

// Copy entire instance (24 floats) from source to destination
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
@group(2) @binding(2) var<uniform> finalizeUniforms: InstanceUniforms;

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

export interface InstancePipelineExecuteParams {
  encoder: GPUCommandEncoder;
  frameResources: FrameResources;
  geometry: GeometryData;
  viewProjectionMatrix: Mat4;
}

/**
 * Parameters for async culling with external buffers
 */
export interface AsyncCullingParams {
  /** Command encoder to record compute passes */
  encoder: GPUCommandEncoder;
  /** View-projection matrix for frustum planes */
  viewProjectionMatrix: Mat4;
  /** Instance count to process */
  instanceCount: number;
  /** Index count for draw arguments */
  indexCount: number;
  /** Input bounds buffer */
  boundsBuffer: GPUBuffer;
  /** Input interleaved instance buffer */
  interleavedStagingBuffer: GPUBuffer;
  /** Output opaque indices buffer */
  opaqueIndicesBuffer: GPUBuffer;
  /** Output transparent indices buffer */
  transparentIndicesBuffer: GPUBuffer;
  /** Output counts buffer */
  countsBuffer: GPUBuffer;
  /** Output compacted interleaved buffer */
  compactedInterleavedBuffer: GPUBuffer;
  /** Output indirect args buffer */
  indirectArgsBuffer: GPUBuffer;
}

export class GpuInstancePipeline {
  private readonly device: GPUDevice;
  private readonly uniformBuffer: GPUBuffer;
  private readonly frustumPlanes: FrustumPlane[] = new Array(6);
  private classifyPipeline!: GPUComputePipeline;
  private compactPipeline!: GPUComputePipeline;
  private finalizePipeline!: GPUComputePipeline;
  private classifyBindGroupLayout!: GPUBindGroupLayout;
  private compactBindGroupLayout!: GPUBindGroupLayout;
  private finalizeBindGroupLayout!: GPUBindGroupLayout;
  private emptyBindGroupLayout: GPUBindGroupLayout;
  private countsBuffer: GPUBuffer | null = null;
  private opaqueIndicesBuffer: GPUBuffer | null = null;
  private transparentIndicesBuffer: GPUBuffer | null = null;
  private capacity = 0;

  constructor(device: GPUDevice) {
    this.device = device;
    this.uniformBuffer = device.createBuffer({
      label: 'gpu-instance-uniforms',
      size: FRUSTUM_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.emptyBindGroupLayout = device.createBindGroupLayout({
      label: 'gpu-instance-empty-bind-group',
      entries: [],
    });
    this.initializePipelines();
  }

  dispose(): void {
    try {
      this.countsBuffer?.destroy();
      this.opaqueIndicesBuffer?.destroy();
      this.transparentIndicesBuffer?.destroy();
      this.uniformBuffer.destroy();
    } catch {
      // ignore
    }
    this.countsBuffer = null;
    this.opaqueIndicesBuffer = null;
    this.transparentIndicesBuffer = null;
  }

  execute(params: InstancePipelineExecuteParams): boolean {
    const { geometry } = params;
    const instanceCount = geometry.instanceCount;
    if (instanceCount === 0) {
      this.writeZeroDrawArgs(params.frameResources);
      return true;
    }

    if (!this.ensureCapacity(instanceCount)) {
      this.writeZeroDrawArgs(params.frameResources);
      return false;
    }

    this.updateUniforms(params.viewProjectionMatrix, instanceCount, geometry.indices.length);
    this.resetCounters();

    try {
      this.runClassifyPass(params, instanceCount);
      this.runCompactionPass(params, instanceCount);
      this.runFinalizePass(params.encoder, params.frameResources);
      return true;
    } catch (error) {
      Logger.warn('[GpuInstancePipeline] compute pass failed, falling back to CPU path', error);
      this.writeZeroDrawArgs(params.frameResources);
      return false;
    }
  }

  /**
   * Records culling passes to external buffers for async compute.
   * This allows culling to be submitted separately from rendering.
   * 
   * @param params - Async culling parameters with external buffers
   * @returns true if recording succeeded
   */
  recordAsyncCulling(params: AsyncCullingParams): boolean {
    const { 
      encoder, 
      viewProjectionMatrix, 
      instanceCount, 
      indexCount,
      boundsBuffer,
      interleavedStagingBuffer,
      opaqueIndicesBuffer,
      transparentIndicesBuffer,
      countsBuffer,
      compactedInterleavedBuffer,
      indirectArgsBuffer,
    } = params;

    if (instanceCount === 0) {
      return false;
    }

    // Update uniforms with the provided matrix and counts
    this.updateUniforms(viewProjectionMatrix, instanceCount, indexCount);

    try {
      // Record classify pass with external buffers
      const classifyBindGroup = this.device.createBindGroup({
        layout: this.classifyBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: { buffer: boundsBuffer } },
          { binding: 2, resource: { buffer: interleavedStagingBuffer } },
          { binding: 3, resource: { buffer: opaqueIndicesBuffer } },
          { binding: 4, resource: { buffer: transparentIndicesBuffer } },
          { binding: 5, resource: { buffer: countsBuffer } },
        ],
      });

      const classifyPass = encoder.beginComputePass({ label: 'async-gpu-instance-classify-pass' });
      classifyPass.setPipeline(this.classifyPipeline);
      classifyPass.setBindGroup(0, classifyBindGroup);
      classifyPass.dispatchWorkgroups(Math.ceil(instanceCount / WORKGROUP_SIZE));
      classifyPass.end();

      // Record compact pass with external buffers
      const compactBindGroup = this.device.createBindGroup({
        layout: this.compactBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: countsBuffer } },
          { binding: 1, resource: { buffer: opaqueIndicesBuffer } },
          { binding: 2, resource: { buffer: transparentIndicesBuffer } },
          { binding: 3, resource: { buffer: interleavedStagingBuffer } },
          { binding: 4, resource: { buffer: compactedInterleavedBuffer } },
        ],
      });

      const compactPass = encoder.beginComputePass({ label: 'async-gpu-instance-compact-pass' });
      compactPass.setPipeline(this.compactPipeline);
      compactPass.setBindGroup(1, compactBindGroup);
      compactPass.dispatchWorkgroups(Math.ceil(instanceCount / WORKGROUP_SIZE));
      compactPass.end();

      // Record finalize pass with external buffers
      const finalizeBindGroup = this.device.createBindGroup({
        layout: this.finalizeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: countsBuffer } },
          { binding: 1, resource: { buffer: indirectArgsBuffer } },
          { binding: 2, resource: { buffer: this.uniformBuffer } },
        ],
      });

      const finalizePass = encoder.beginComputePass({ label: 'async-gpu-instance-finalize-pass' });
      finalizePass.setPipeline(this.finalizePipeline);
      finalizePass.setBindGroup(2, finalizeBindGroup);
      finalizePass.dispatchWorkgroups(1);
      finalizePass.end();

      return true;
    } catch (error) {
      Logger.warn('[GpuInstancePipeline] async culling record failed:', error);
      return false;
    }
  }

  /**
   * Gets the bind group layouts for external use (e.g., async compute manager)
   */
  getBindGroupLayouts(): {
    classify: GPUBindGroupLayout;
    compact: GPUBindGroupLayout;
    finalize: GPUBindGroupLayout;
  } {
    return {
      classify: this.classifyBindGroupLayout,
      compact: this.compactBindGroupLayout,
      finalize: this.finalizeBindGroupLayout,
    };
  }

  /**
   * Gets the compute pipelines for external use
   */
  getPipelines(): {
    classify: GPUComputePipeline;
    compact: GPUComputePipeline;
    finalize: GPUComputePipeline;
  } {
    return {
      classify: this.classifyPipeline,
      compact: this.compactPipeline,
      finalize: this.finalizePipeline,
    };
  }

  /**
   * Gets the uniform buffer for frustum planes
   */
  getUniformBuffer(): GPUBuffer {
    return this.uniformBuffer;
  }

  /**
   * Public method to update uniforms for external async culling
   */
  prepareUniforms(viewProjection: Mat4, instanceCount: number, indexCount: number): void {
    this.updateUniforms(viewProjection, instanceCount, indexCount);
  }

  private initializePipelines(): void {
    const module = this.device.createShaderModule({
      label: 'gpu-instance-pipeline-shader',
      code: INSTANCE_PIPELINE_SHADER,
    });

    this.classifyBindGroupLayout = this.device.createBindGroupLayout({
      label: 'gpu-instance-classify-layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    // Simplified compact bind group - no longer needs uniform for component count
    this.compactBindGroupLayout = this.device.createBindGroupLayout({
      label: 'gpu-instance-compact-layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });

    this.finalizeBindGroupLayout = this.device.createBindGroupLayout({
      label: 'gpu-instance-finalize-layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      ],
    });

    this.classifyPipeline = this.device.createComputePipeline({
      label: 'gpu-instance-classify-pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.classifyBindGroupLayout],
      }),
      compute: {
        module,
        entryPoint: 'classify',
      },
    });

    this.compactPipeline = this.device.createComputePipeline({
      label: 'gpu-instance-compact-pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.emptyBindGroupLayout, this.compactBindGroupLayout],
      }),
      compute: {
        module,
        entryPoint: 'compact',
      },
    });

    this.finalizePipeline = this.device.createComputePipeline({
      label: 'gpu-instance-finalize-pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.emptyBindGroupLayout, this.emptyBindGroupLayout, this.finalizeBindGroupLayout],
      }),
      compute: {
        module,
        entryPoint: 'finalizeDrawArgs',
      },
    });
  }

  private ensureCapacity(instanceCount: number): boolean {
    const needed = Math.max(instanceCount, 1);
    if (needed <= this.capacity && this.countsBuffer && this.opaqueIndicesBuffer && this.transparentIndicesBuffer) {
      return true;
    }
    const newCapacity = Math.max(this.capacity * 2, needed);
    try {
      this.countsBuffer?.destroy();
      this.opaqueIndicesBuffer?.destroy();
      this.transparentIndicesBuffer?.destroy();
    } catch {
      // ignore
    }

    this.countsBuffer = this.device.createBuffer({
      label: 'gpu-instance-counts',
      size: COUNTS_BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.opaqueIndicesBuffer = this.device.createBuffer({
      label: 'gpu-instance-opaque-indices',
      size: newCapacity * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.transparentIndicesBuffer = this.device.createBuffer({
      label: 'gpu-instance-transparent-indices',
      size: newCapacity * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.capacity = newCapacity;
    return true;
  }

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

  private resetCounters(): void {
    if (!this.countsBuffer) {
      return;
    }
    const zeros = new Uint32Array([0, 0, 0, 0]);
    this.device.queue.writeBuffer(this.countsBuffer, 0, zeros);
  }

  private runClassifyPass(params: InstancePipelineExecuteParams, instanceCount: number): void {
    if (!this.countsBuffer || !this.opaqueIndicesBuffer || !this.transparentIndicesBuffer) {
      throw new Error('GPU instance buffers not ready');
    }
    const { frameResources } = params;
    const bindGroup = this.device.createBindGroup({
      layout: this.classifyBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: frameResources.instanceBoundsBuffer } },
        { binding: 2, resource: { buffer: frameResources.instanceInterleavedStagingBuffer } },
        { binding: 3, resource: { buffer: this.opaqueIndicesBuffer } },
        { binding: 4, resource: { buffer: this.transparentIndicesBuffer } },
        { binding: 5, resource: { buffer: this.countsBuffer } },
      ],
    });

    const pass = params.encoder.beginComputePass({ label: 'gpu-instance-classify-pass' });
    pass.setPipeline(this.classifyPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(instanceCount / WORKGROUP_SIZE));
    pass.end();
  }

  /**
   * Single compaction pass that copies all 24 floats per instance.
   * This replaces the previous 7 separate passes (one per attribute).
   */
  private runCompactionPass(params: InstancePipelineExecuteParams, instanceCount: number): void {
    if (!this.countsBuffer || !this.opaqueIndicesBuffer || !this.transparentIndicesBuffer) {
      throw new Error('GPU instance buffers not ready');
    }
    const { frameResources } = params;

    const bindGroup = this.device.createBindGroup({
      layout: this.compactBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.countsBuffer } },
        { binding: 1, resource: { buffer: this.opaqueIndicesBuffer } },
        { binding: 2, resource: { buffer: this.transparentIndicesBuffer } },
        { binding: 3, resource: { buffer: frameResources.instanceInterleavedStagingBuffer } },
        { binding: 4, resource: { buffer: frameResources.instanceInterleavedBuffer } },
      ],
    });

    const pass = params.encoder.beginComputePass({ label: 'gpu-instance-compact-pass' });
    pass.setPipeline(this.compactPipeline);
    pass.setBindGroup(1, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(instanceCount / WORKGROUP_SIZE));
    pass.end();
  }

  private runFinalizePass(encoder: GPUCommandEncoder, frameResources: FrameResources): void {
    if (!this.countsBuffer) {
      throw new Error('GPU instance counters missing');
    }
    const bindGroup = this.device.createBindGroup({
      layout: this.finalizeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.countsBuffer } },
        { binding: 1, resource: { buffer: frameResources.instanceIndirectArgsBuffer } },
        { binding: 2, resource: { buffer: this.uniformBuffer } },
      ],
    });

    const pass = encoder.beginComputePass({ label: 'gpu-instance-finalize-pass' });
    pass.setPipeline(this.finalizePipeline);
    pass.setBindGroup(2, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
  }

  private writeZeroDrawArgs(frameResources: FrameResources): void {
    const data = buildIndirectDrawArgs(0, 0, 0);
    this.device.queue.writeBuffer(
      frameResources.instanceIndirectArgsBuffer,
      0,
      data.buffer as ArrayBuffer,
      data.byteOffset,
      data.byteLength
    );
  }
}
