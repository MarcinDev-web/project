/**
 * ComputeSkinningPass - GPU compute-based skeletal skinning
 * 
 * Pre-transforms vertices using compute shaders, supporting both:
 * - Linear Blend Skinning (LBS) - classic matrix blending
 * - Dual Quaternion Skinning (DQS) - better rotation interpolation
 * 
 * Benefits:
 * - Single skinning pass reused across render passes (main, shadow, etc.)
 * - Dual quaternion eliminates "candy wrapper" artifacts
 * - Decouples animation from rendering pipeline
 */

import { DualQuaternionAccelerator } from './DualQuaternion';

// Import shader code
import skinningComputeShader from '../shaders/compute/skinning_compute.wgsl?raw';

export const enum SkinningMode {
  LBS = 0, // Linear Blend Skinning
  DQS = 1, // Dual Quaternion Skinning
}

export interface SkinningMeshData {
  /** Base mesh positions (vec4 per vertex) */
  positions: Float32Array;
  /** Base mesh normals (vec4 per vertex) */
  normals: Float32Array;
  /** Joint indices per vertex (uvec4) */
  jointIndices: Uint32Array;
  /** Joint weights per vertex (vec4, should sum to 1) */
  jointWeights: Float32Array;
  /** Number of vertices */
  vertexCount: number;
}

export interface ComputeSkinningPassConfig {
  /** Skinning algorithm: LBS or DQS */
  mode: SkinningMode;
  /** Maximum number of joints supported */
  maxJoints: number;
}

const WORKGROUP_SIZE = 64;

export class ComputeSkinningPass {
  private device: GPUDevice;
  private config: ComputeSkinningPassConfig;
  
  // Pipeline resources
  private pipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  
  // Per-mesh resources (keyed by mesh ID)
  private meshResources = new Map<string, MeshSkinningResources>();
  
  // Shared uniform buffer
  private uniformBuffer: GPUBuffer | null = null;
  private uniformData = new Uint32Array(4); // vertexCount, jointCount, skinningMode, pad
  
  // Joint transform buffers
  private jointMatrixBuffer: GPUBuffer | null = null;
  private jointDualQuatBuffer: GPUBuffer | null = null;
  private maxJointBufferSize = 0;
  
  // Dual quaternion accelerator for zero-allocation conversion (hot path)
  private dqAccelerator: DualQuaternionAccelerator;
  
  constructor(device: GPUDevice, config: ComputeSkinningPassConfig) {
    this.device = device;
    this.config = config;
    this.dqAccelerator = new DualQuaternionAccelerator(config.maxJoints);
    this.initialize();
  }
  
  private initialize(): void {
    // Create uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      label: 'skinning-uniforms',
      size: 16, // 4 u32s
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Create bind group layout
    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: 'skinning-compute-bgl',
      entries: [
        // Uniforms
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' },
        },
        // Input vertices
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        // Output vertices
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' },
        },
        // Joint matrices (LBS)
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
        // Joint dual quaternions (DQS)
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' },
        },
      ],
    });
    
    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      label: 'skinning-compute-layout',
      bindGroupLayouts: [this.bindGroupLayout],
    });
    
    // Create compute pipeline
    const shaderModule = this.device.createShaderModule({
      label: 'skinning-compute-shader',
      code: skinningComputeShader,
    });
    
    this.pipeline = this.device.createComputePipeline({
      label: 'skinning-compute-pipeline',
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });
    
    // Initialize joint buffers with default size
    this.resizeJointBuffers(this.config.maxJoints);
  }
  
  private resizeJointBuffers(jointCount: number): void {
    if (jointCount <= this.maxJointBufferSize) return;
    
    const newSize = Math.max(jointCount, this.maxJointBufferSize * 2, 64);
    
    // Destroy old buffers
    this.jointMatrixBuffer?.destroy();
    this.jointDualQuatBuffer?.destroy();
    
    // Create new buffers
    // Matrices: jointCount * 16 floats (mat4x4)
    this.jointMatrixBuffer = this.device.createBuffer({
      label: 'skinning-joint-matrices',
      size: newSize * 16 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    
    // Dual quaternions: jointCount * 8 floats (2 x vec4)
    this.jointDualQuatBuffer = this.device.createBuffer({
      label: 'skinning-joint-dualquats',
      size: newSize * 8 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    
    this.maxJointBufferSize = newSize;
  }
  
  /**
   * Registers a mesh for GPU skinning.
   * Call once per mesh during setup.
   */
  registerMesh(meshId: string, data: SkinningMeshData): void {
    // Clean up existing resources for this mesh
    this.unregisterMesh(meshId);
    
    const { vertexCount } = data;
    
    // Create input vertex buffer (interleaved: position, normal, indices, weights)
    // Layout: vec4 position, vec4 normal, uvec4 indices, vec4 weights = 16 floats per vertex
    const inputSize = vertexCount * 16 * 4; // 16 floats * 4 bytes
    const inputBuffer = this.device.createBuffer({
      label: `skinning-input-${meshId}`,
      size: inputSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    
    // Pack input data
    const inputData = new ArrayBuffer(inputSize);
    const floatView = new Float32Array(inputData);
    const uintView = new Uint32Array(inputData);
    
    for (let i = 0; i < vertexCount; i++) {
      const offset = i * 16;
      
      // Position (vec4)
      floatView[offset + 0] = data.positions[i * 4 + 0] ?? 0;
      floatView[offset + 1] = data.positions[i * 4 + 1] ?? 0;
      floatView[offset + 2] = data.positions[i * 4 + 2] ?? 0;
      floatView[offset + 3] = data.positions[i * 4 + 3] ?? 1;
      
      // Normal (vec4)
      floatView[offset + 4] = data.normals[i * 4 + 0] ?? 0;
      floatView[offset + 5] = data.normals[i * 4 + 1] ?? 0;
      floatView[offset + 6] = data.normals[i * 4 + 2] ?? 1;
      floatView[offset + 7] = data.normals[i * 4 + 3] ?? 0;
      
      // Joint indices (uvec4)
      uintView[offset + 8] = data.jointIndices[i * 4 + 0] ?? 0;
      uintView[offset + 9] = data.jointIndices[i * 4 + 1] ?? 0;
      uintView[offset + 10] = data.jointIndices[i * 4 + 2] ?? 0;
      uintView[offset + 11] = data.jointIndices[i * 4 + 3] ?? 0;
      
      // Joint weights (vec4)
      floatView[offset + 12] = data.jointWeights[i * 4 + 0] ?? 0;
      floatView[offset + 13] = data.jointWeights[i * 4 + 1] ?? 0;
      floatView[offset + 14] = data.jointWeights[i * 4 + 2] ?? 0;
      floatView[offset + 15] = data.jointWeights[i * 4 + 3] ?? 0;
    }
    
    this.device.queue.writeBuffer(inputBuffer, 0, inputData);
    
    // Create output buffer (position + normal = 8 floats per vertex)
    const outputSize = vertexCount * 8 * 4;
    const outputBuffer = this.device.createBuffer({
      label: `skinning-output-${meshId}`,
      size: outputSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC,
    });
    
    this.meshResources.set(meshId, {
      inputBuffer,
      outputBuffer,
      vertexCount,
      bindGroup: null, // Created lazily when joint count is known
    });
  }
  
  /**
   * Unregisters a mesh and releases its GPU resources.
   */
  unregisterMesh(meshId: string): void {
    const resources = this.meshResources.get(meshId);
    if (resources) {
      resources.inputBuffer.destroy();
      resources.outputBuffer.destroy();
      this.meshResources.delete(meshId);
    }
  }
  
  /**
   * Updates joint transforms and dispatches skinning compute for a mesh.
   * 
   * @param encoder Command encoder to record compute commands
   * @param meshId Registered mesh ID
   * @param jointMatrices Joint transformation matrices (mat4x4 per joint)
   * @param jointCount Number of active joints
   */
  dispatch(
    encoder: GPUCommandEncoder,
    meshId: string,
    jointMatrices: Float32Array,
    jointCount: number
  ): GPUBuffer | null {
    const resources = this.meshResources.get(meshId);
    if (!resources || !this.pipeline || !this.bindGroupLayout) {
      return null;
    }
    
    // Ensure joint buffers are large enough
    this.resizeJointBuffers(jointCount);
    
    // Upload joint matrices
    this.device.queue.writeBuffer(
      this.jointMatrixBuffer!,
      0,
      jointMatrices.buffer,
      jointMatrices.byteOffset,
      jointCount * 16 * 4
    );
    
    // Convert and upload dual quaternions if in DQS mode
    // Uses WASM-accelerated zero-copy path when available
    if (this.config.mode === SkinningMode.DQS) {
      this.dqAccelerator.uploadToGPU(
        this.device.queue,
        this.jointDualQuatBuffer!,
        jointMatrices,
        jointCount
      );
    }
    
    // Update uniforms
    this.uniformData[0] = resources.vertexCount;
    this.uniformData[1] = jointCount;
    this.uniformData[2] = this.config.mode;
    this.uniformData[3] = 0; // padding
    this.device.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData);
    
    // Create or update bind group
    resources.bindGroup = this.device.createBindGroup({
      label: `skinning-bg-${meshId}`,
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: resources.inputBuffer } },
        { binding: 2, resource: { buffer: resources.outputBuffer } },
        { binding: 3, resource: { buffer: this.jointMatrixBuffer! } },
        { binding: 4, resource: { buffer: this.jointDualQuatBuffer! } },
      ],
    });
    
    // Dispatch compute
    const computePass = encoder.beginComputePass({
      label: `skinning-pass-${meshId}`,
    });
    
    computePass.setPipeline(this.pipeline);
    computePass.setBindGroup(0, resources.bindGroup);
    
    const workgroupCount = Math.ceil(resources.vertexCount / WORKGROUP_SIZE);
    computePass.dispatchWorkgroups(workgroupCount);
    
    computePass.end();
    
    return resources.outputBuffer;
  }
  
  /**
   * Gets the skinned vertex output buffer for a mesh.
   * Use this to bind the skinned vertices in your render pipeline.
   */
  getOutputBuffer(meshId: string): GPUBuffer | null {
    return this.meshResources.get(meshId)?.outputBuffer ?? null;
  }
  
  /**
   * Sets the skinning mode (LBS or DQS).
   */
  setMode(mode: SkinningMode): void {
    this.config.mode = mode;
  }
  
  /**
   * Gets current skinning mode.
   */
  getMode(): SkinningMode {
    return this.config.mode;
  }
  
  /**
   * Disposes all GPU resources.
   */
  dispose(): void {
    // Dispose mesh resources
    for (const [meshId] of this.meshResources) {
      this.unregisterMesh(meshId);
    }
    
    // Dispose shared resources
    this.uniformBuffer?.destroy();
    this.jointMatrixBuffer?.destroy();
    this.jointDualQuatBuffer?.destroy();
    this.dqAccelerator.dispose();
    
    this.uniformBuffer = null;
    this.jointMatrixBuffer = null;
    this.jointDualQuatBuffer = null;
    this.pipeline = null;
    this.bindGroupLayout = null;
  }
  
  /**
   * Returns whether WASM acceleration is active for dual quaternion conversion.
   */
  get isWasmAccelerated(): boolean {
    return this.dqAccelerator.isWasmAccelerated;
  }
}

interface MeshSkinningResources {
  inputBuffer: GPUBuffer;
  outputBuffer: GPUBuffer;
  vertexCount: number;
  bindGroup: GPUBindGroup | null;
}

