/**
 * GPU Frustum Culler
 * 
 * Performs frustum culling on the GPU using compute shaders.
 * Compacts visible instances and prepares indirect draw commands.
 */
import type { Mat4, Vec3, FrustumPlane } from '@engine/core/math';
import { extractFrustumPlanes } from '@engine/core/math';
import { FrameRingBuffer } from '@engine/core/memory';
import { PipelineCache } from '../pipeline/PipelineCache';
import { Logger } from '@engine/core/utils';

/**
 * GPU frustum culling system.
 */
export class GPUFrustumCuller {
  private device: GPUDevice;
  private pipelineCache: PipelineCache;
  private frameRingBuffer: FrameRingBuffer;
  private cullPipeline: GPUComputePipeline | null = null;
  private compactPipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private cullBindGroup: GPUBindGroup | null = null;
  private compactBindGroup: GPUBindGroup | null = null;
  
  // Buffers
  private frustumUniformBuffer: GPUBuffer | null = null;
  private visibleCountBuffer: GPUBuffer | null = null;
  private visibleIndicesBuffer: GPUBuffer | null = null;
  private drawIndirectBuffer: GPUBuffer | null = null;

  // Reusable frustum plane array
  private frustumPlanes: FrustumPlane[] = [
    { normal: [0, 0, 0], d: 0 },
    { normal: [0, 0, 0], d: 0 },
    { normal: [0, 0, 0], d: 0 },
    { normal: [0, 0, 0], d: 0 },
    { normal: [0, 0, 0], d: 0 },
    { normal: [0, 0, 0], d: 0 },
  ];

  private initialized = false;

  constructor(device: GPUDevice, pipelineCache: PipelineCache, frameRingBuffer: FrameRingBuffer) {
    this.device = device;
    this.pipelineCache = pipelineCache;
    this.frameRingBuffer = frameRingBuffer;
    // Initialize asynchronously - will be ready on first use
    this.initialize().catch((err) => {
      Logger.warn('GPU frustum culler async initialization failed:', err);
    });
  }

  /**
   * Ensures the culler is initialized.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
      this.initialized = true;
    }
  }

  /**
   * Initializes GPU culling resources.
   */
  private async initialize(): Promise<void> {
    try {
      // Use inline shader code (shader file can be loaded separately if needed)
      const shaderCode = this.getCullShaderCode();
      
      const shaderModule = this.device.createShaderModule({
        label: 'gpu-frustum-cull-shader',
        code: shaderCode,
      });

      // Create bind group layout
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'gpu-cull-bgl',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'uniform' },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'read-only-storage' },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' },
          },
          {
            binding: 4,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: 'storage' },
          },
        ],
      });

      const pipelineLayout = this.device.createPipelineLayout({
        label: 'gpu-cull-pipeline-layout',
        bindGroupLayouts: [this.bindGroupLayout],
      });

      // Create compute pipelines
      this.cullPipeline = this.device.createComputePipeline({
        label: 'gpu-cull-pipeline',
        layout: pipelineLayout,
        compute: {
          module: shaderModule,
          entryPoint: 'main',
        },
      });

      this.compactPipeline = this.device.createComputePipeline({
        label: 'gpu-cull-compact-pipeline',
        layout: pipelineLayout,
        compute: {
          module: shaderModule,
          entryPoint: 'compact',
        },
      });

      // Create buffers
      this.frustumUniformBuffer = this.device.createBuffer({
        label: 'frustum-uniform',
        size: 96, // 6 planes * 16 bytes (vec3 + f32)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      this.visibleCountBuffer = this.device.createBuffer({
        label: 'visible-count',
        size: 4, // u32
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });

      // Draw indirect buffer (DrawIndexedIndirect = 5 * u32 = 20 bytes)
      this.drawIndirectBuffer = this.device.createBuffer({
        label: 'draw-indirect',
        size: 20,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
      });

      // Create bind groups
      this.updateBindGroups();

      this.initialized = true;
    } catch (err) {
      Logger.warn('GPU frustum culler initialization failed:', err);
      this.cullPipeline = null;
      this.compactPipeline = null;
      this.initialized = false;
    }
  }

  /**
   * Updates bind groups with current buffers.
   */
  private updateBindGroups(): void {
    if (!this.bindGroupLayout || !this.frustumUniformBuffer || !this.visibleCountBuffer || !this.drawIndirectBuffer) {
      return;
    }

    this.cullBindGroup = this.device.createBindGroup({
      label: 'gpu-cull-bg',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.frustumUniformBuffer } },
        { binding: 3, resource: { buffer: this.visibleCountBuffer } },
        { binding: 4, resource: { buffer: this.drawIndirectBuffer } },
      ],
    });

    this.compactBindGroup = this.device.createBindGroup({
      label: 'gpu-cull-compact-bg',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 3, resource: { buffer: this.visibleCountBuffer } },
        { binding: 4, resource: { buffer: this.drawIndirectBuffer } },
      ],
    });
  }

  /**
   * Performs GPU frustum culling.
   * 
   * @param encoder - Command encoder
   * @param viewProjectionMatrix - View-projection matrix
   * @param instancePositionBuffer - Buffer containing instance positions
   * @param maxInstances - Maximum number of instances
   * @param indexCount - Number of indices per instance
   * @returns Draw indirect buffer and visible count, or null if not initialized
   */
  async cull(
    encoder: GPUCommandEncoder,
    viewProjectionMatrix: Mat4,
    instancePositionBuffer: GPUBuffer,
    maxInstances: number,
    indexCount: number
  ): Promise<{ drawIndirectBuffer: GPUBuffer; visibleCountBuffer: GPUBuffer } | null> {
    await this.ensureInitialized();
    
    if (!this.cullPipeline || !this.compactPipeline || !this.cullBindGroup || !this.compactBindGroup) {
      return null;
    }

    // Extract frustum planes
    extractFrustumPlanes(this.frustumPlanes, viewProjectionMatrix);

    // Upload frustum planes to GPU
    const frustumData = new Float32Array(24); // 6 planes * 4 floats (vec3 + d)
    for (let i = 0; i < 6; i++) {
      const plane = this.frustumPlanes[i]!;
      const offset = i * 4;
      frustumData[offset + 0] = plane.normal[0];
      frustumData[offset + 1] = plane.normal[1];
      frustumData[offset + 2] = plane.normal[2];
      frustumData[offset + 3] = plane.d;
    }
    this.device.queue.writeBuffer(this.frustumUniformBuffer!, 0, frustumData);

    // Reset visible count
    const zeroCount = new Uint32Array([0]);
    this.device.queue.writeBuffer(this.visibleCountBuffer!, 0, zeroCount);

    // Ensure visible indices buffer is large enough
    if (!this.visibleIndicesBuffer || this.visibleIndicesBuffer.size < maxInstances * 4) {
      this.visibleIndicesBuffer?.destroy();
      this.visibleIndicesBuffer = this.device.createBuffer({
        label: 'visible-indices',
        size: maxInstances * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      this.updateBindGroups();
    }

    // Update cull bind group with instance position buffer
    if (this.bindGroupLayout) {
      this.cullBindGroup = this.device.createBindGroup({
        label: 'gpu-cull-bg',
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.frustumUniformBuffer! } },
          { binding: 1, resource: { buffer: instancePositionBuffer } },
          { binding: 2, resource: { buffer: this.visibleIndicesBuffer } },
          { binding: 3, resource: { buffer: this.visibleCountBuffer! } },
          { binding: 4, resource: { buffer: this.drawIndirectBuffer! } },
        ],
      });
    }

    // Initialize draw command
    const drawCommand = new Uint32Array(5);
    drawCommand[0] = indexCount; // indexCount
    drawCommand[1] = 0; // instanceCount (will be set by compact pass)
    drawCommand[2] = 0; // firstIndex
    drawCommand[3] = 0; // baseVertex
    drawCommand[4] = 0; // firstInstance
    this.device.queue.writeBuffer(this.drawIndirectBuffer!, 0, drawCommand);

    // Run culling compute pass
    const computePass = encoder.beginComputePass({ label: 'gpu-frustum-cull' });
    computePass.setPipeline(this.cullPipeline);
    computePass.setBindGroup(0, this.cullBindGroup);
    
    const workgroupCount = Math.ceil(maxInstances / 64);
    computePass.dispatchWorkgroups(workgroupCount);
    computePass.end();

    // Run compact pass to finalize draw command
    const compactPass = encoder.beginComputePass({ label: 'gpu-cull-compact' });
    compactPass.setPipeline(this.compactPipeline);
    compactPass.setBindGroup(0, this.compactBindGroup);
    compactPass.dispatchWorkgroups(1);
    compactPass.end();

    return {
      drawIndirectBuffer: this.drawIndirectBuffer!,
      visibleCountBuffer: this.visibleCountBuffer!,
    };
  }

  /**
   * Gets the compute shader code.
   */
  private getCullShaderCode(): string {
    return `
      struct FrustumPlane {
        normal: vec3<f32>,
        d: f32,
      }

      struct Frustum {
        planes: array<FrustumPlane, 6>,
      }

      @group(0) @binding(0) var<uniform> frustum: Frustum;
      @group(0) @binding(1) var<storage, read> instancePositions: array<vec3<f32>>;
      @group(0) @binding(2) var<storage, read_write> visibleIndices: array<u32>;
      @group(0) @binding(3) var<storage, read_write> visibleCount: atomic<u32>;
      @group(0) @binding(4) var<storage, read_write> drawCommand: array<u32, 5>;

      fn testAABBAgainstPlane(aabbMin: vec3<f32>, aabbMax: vec3<f32>, plane: FrustumPlane) -> bool {
        let px = select(aabbMin.x, aabbMax.x, plane.normal.x >= 0.0);
        let py = select(aabbMin.y, aabbMax.y, plane.normal.y >= 0.0);
        let pz = select(aabbMin.z, aabbMax.z, plane.normal.z >= 0.0);
        let distance = dot(plane.normal, vec3<f32>(px, py, pz)) + plane.d;
        return distance >= 0.0;
      }

      fn isInstanceVisible(instanceIndex: u32) -> bool {
        let pos = instancePositions[instanceIndex];
        let halfSize = vec3<f32>(0.5, 0.5, 0.5);
        let aabbMin = pos - halfSize;
        let aabbMax = pos + halfSize;
        
        for (var i = 0u; i < 6u; i++) {
          if (!testAABBAgainstPlane(aabbMin, aabbMax, frustum.planes[i])) {
            return false;
          }
        }
        return true;
      }

      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let instanceIndex = globalId.x;
        let totalInstances = arrayLength(&instancePositions);
        
        if (instanceIndex >= totalInstances) {
          return;
        }
        
        if (isInstanceVisible(instanceIndex)) {
          let outputIndex = atomicAdd(&visibleCount, 1u);
          visibleIndices[outputIndex] = instanceIndex;
        }
      }

      @compute @workgroup_size(1)
      fn compact(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let count = atomicLoad(&visibleCount);
        drawCommand[1] = count; // instanceCount
      }
    `;
  }

  /**
   * Disposes resources.
   */
  dispose(): void {
    try {
      this.frustumUniformBuffer?.destroy();
      this.visibleCountBuffer?.destroy();
      this.visibleIndicesBuffer?.destroy();
      this.drawIndirectBuffer?.destroy();
    } catch {
      // ignore
    }
    this.frustumUniformBuffer = null;
    this.visibleCountBuffer = null;
    this.visibleIndicesBuffer = null;
    this.drawIndirectBuffer = null;
    this.cullPipeline = null;
    this.compactPipeline = null;
  }
}



