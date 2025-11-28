/**
 * ComputeMorphPass - GPU compute-based morph target blending
 * 
 * Blends multiple morph targets with arbitrary weights using compute shaders.
 * Can optionally be combined with skinning in a single pass for efficiency.
 */

import { MorphTargetBuffer, type MorphTargetData } from './MorphTargetBuffer';
import morphBlendShader from '../shaders/compute/morph_blend.wgsl?raw';

export const MAX_MORPH_TARGETS = 16;
const WORKGROUP_SIZE = 64;

export interface MorphMeshData {
  /** Base mesh positions (vec4 per vertex) */
  basePositions: Float32Array;
  /** Base mesh normals (vec4 per vertex) */
  baseNormals: Float32Array;
  /** Number of vertices */
  vertexCount: number;
}

export interface ComputeMorphPassConfig {
  /** Maximum morph targets per mesh */
  maxTargets?: number;
  /** Maximum vertices per mesh */
  maxVertices?: number;
}

interface MeshMorphResources {
  basePositionBuffer: GPUBuffer;
  baseNormalBuffer: GPUBuffer;
  morphBuffer: MorphTargetBuffer;
  outputPositionBuffer: GPUBuffer;
  outputNormalBuffer: GPUBuffer;
  vertexCount: number;
  bindGroup: GPUBindGroup | null;
}

export class ComputeMorphPass {
  private device: GPUDevice;
  private config: Required<ComputeMorphPassConfig>;
  
  // Pipeline resources
  private pipeline: GPUComputePipeline | null = null;
  private combinedPipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  
  // Per-mesh resources
  private meshResources = new Map<string, MeshMorphResources>();
  
  // Uniform buffer for weights
  private uniformBuffer: GPUBuffer | null = null;
  private uniformData: Float32Array;
  
  constructor(device: GPUDevice, config: ComputeMorphPassConfig = {}) {
    this.device = device;
    this.config = {
      maxTargets: config.maxTargets ?? MAX_MORPH_TARGETS,
      maxVertices: config.maxVertices ?? 65536,
    };
    
    // Uniform layout: vertexCount, targetCount, hasNormalDeltas, pad, weights[16]
    this.uniformData = new Float32Array(4 + MAX_MORPH_TARGETS);
    
    this.initialize();
  }
  
  private initialize(): void {
    // Create uniform buffer
    // Size: 4 u32s (16 bytes) + 4 vec4s for weights (64 bytes) = 80 bytes, align to 256
    this.uniformBuffer = this.device.createBuffer({
      label: 'morph-uniforms',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Create bind group layout
    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: 'morph-compute-bgl',
      entries: [
        // Uniforms
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        // Base positions
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        // Base normals
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        // Morph position deltas
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        // Morph normal deltas
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        // Output positions
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        // Output normals
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    
    // Create pipeline layout
    const pipelineLayout = this.device.createPipelineLayout({
      label: 'morph-compute-layout',
      bindGroupLayouts: [this.bindGroupLayout],
    });
    
    // Create shader module
    const shaderModule = this.device.createShaderModule({
      label: 'morph-compute-shader',
      code: morphBlendShader,
    });
    
    // Create main pipeline
    this.pipeline = this.device.createComputePipeline({
      label: 'morph-compute-pipeline',
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });
  }
  
  /**
   * Registers a mesh for GPU morph blending.
   */
  registerMesh(meshId: string, meshData: MorphMeshData, morphData: MorphTargetData): void {
    this.unregisterMesh(meshId);
    
    const { vertexCount, basePositions, baseNormals } = meshData;
    
    // Validate data sizes
    if (basePositions.length < vertexCount * 4) {
      throw new Error(`Base positions length ${basePositions.length} < expected ${vertexCount * 4}`);
    }
    if (baseNormals.length < vertexCount * 4) {
      throw new Error(`Base normals length ${baseNormals.length} < expected ${vertexCount * 4}`);
    }
    
    // Create base position buffer
    const basePositionBuffer = this.device.createBuffer({
      label: `morph-base-pos-${meshId}`,
      size: vertexCount * 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(basePositionBuffer, 0, basePositions.buffer as ArrayBuffer, basePositions.byteOffset, vertexCount * 4 * 4);
    
    // Create base normal buffer
    const baseNormalBuffer = this.device.createBuffer({
      label: `morph-base-nrm-${meshId}`,
      size: vertexCount * 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(baseNormalBuffer, 0, baseNormals.buffer as ArrayBuffer, baseNormals.byteOffset, vertexCount * 4 * 4);
    
    // Create morph target buffer
    const morphBuffer = new MorphTargetBuffer(this.device, {
      maxTargets: this.config.maxTargets,
      maxVertices: this.config.maxVertices,
    });
    morphBuffer.upload(morphData);
    
    // Create output buffers
    const outputPositionBuffer = this.device.createBuffer({
      label: `morph-out-pos-${meshId}`,
      size: vertexCount * 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC,
    });
    
    const outputNormalBuffer = this.device.createBuffer({
      label: `morph-out-nrm-${meshId}`,
      size: vertexCount * 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC,
    });
    
    this.meshResources.set(meshId, {
      basePositionBuffer,
      baseNormalBuffer,
      morphBuffer,
      outputPositionBuffer,
      outputNormalBuffer,
      vertexCount,
      bindGroup: null,
    });
  }
  
  /**
   * Updates morph target data for a registered mesh.
   */
  updateMorphTargets(meshId: string, morphData: MorphTargetData): void {
    const resources = this.meshResources.get(meshId);
    if (!resources) {
      throw new Error(`Mesh ${meshId} not registered`);
    }
    
    resources.morphBuffer.upload(morphData);
    resources.bindGroup = null; // Invalidate bind group
  }
  
  /**
   * Unregisters a mesh and releases its GPU resources.
   */
  unregisterMesh(meshId: string): void {
    const resources = this.meshResources.get(meshId);
    if (resources) {
      resources.basePositionBuffer.destroy();
      resources.baseNormalBuffer.destroy();
      resources.morphBuffer.dispose();
      resources.outputPositionBuffer.destroy();
      resources.outputNormalBuffer.destroy();
      this.meshResources.delete(meshId);
    }
  }
  
  /**
   * Dispatches morph blending compute for a mesh.
   * 
   * @param encoder Command encoder
   * @param meshId Registered mesh ID
   * @param weights Morph target weights (array of floats, one per target)
   * @returns Output position and normal buffers
   */
  dispatch(
    encoder: GPUCommandEncoder,
    meshId: string,
    weights: Float32Array | number[]
  ): { positions: GPUBuffer; normals: GPUBuffer } | null {
    const resources = this.meshResources.get(meshId);
    if (!resources || !this.pipeline || !this.bindGroupLayout) {
      return null;
    }
    
    const targetCount = resources.morphBuffer.targetCount;
    
    // Update uniforms
    const uniformView = new Uint32Array(this.uniformData.buffer, 0, 4);
    uniformView[0] = resources.vertexCount;
    uniformView[1] = targetCount;
    uniformView[2] = resources.morphBuffer.hasNormals ? 1 : 0;
    uniformView[3] = 0; // padding
    
    // Copy weights (clamped to max targets)
    const weightCount = Math.min(weights.length, MAX_MORPH_TARGETS);
    for (let i = 0; i < MAX_MORPH_TARGETS; i++) {
      this.uniformData[4 + i] = i < weightCount ? (weights[i] ?? 0) : 0;
    }
    
    this.device.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData.buffer as ArrayBuffer, this.uniformData.byteOffset, this.uniformData.byteLength);
    
    // Create or update bind group
    resources.bindGroup = this.device.createBindGroup({
      label: `morph-bg-${meshId}`,
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: resources.basePositionBuffer } },
        { binding: 2, resource: { buffer: resources.baseNormalBuffer } },
        { binding: 3, resource: { buffer: resources.morphBuffer.positionBuffer! } },
        { binding: 4, resource: { buffer: resources.morphBuffer.normalBuffer! } },
        { binding: 5, resource: { buffer: resources.outputPositionBuffer } },
        { binding: 6, resource: { buffer: resources.outputNormalBuffer } },
      ],
    });
    
    // Dispatch compute
    const computePass = encoder.beginComputePass({
      label: `morph-pass-${meshId}`,
    });
    
    computePass.setPipeline(this.pipeline);
    computePass.setBindGroup(0, resources.bindGroup);
    
    const workgroupCount = Math.ceil(resources.vertexCount / WORKGROUP_SIZE);
    computePass.dispatchWorkgroups(workgroupCount);
    
    computePass.end();
    
    return {
      positions: resources.outputPositionBuffer,
      normals: resources.outputNormalBuffer,
    };
  }
  
  /**
   * Gets output buffers for a mesh (without dispatching).
   */
  getOutputBuffers(meshId: string): { positions: GPUBuffer; normals: GPUBuffer } | null {
    const resources = this.meshResources.get(meshId);
    if (!resources) return null;
    
    return {
      positions: resources.outputPositionBuffer,
      normals: resources.outputNormalBuffer,
    };
  }
  
  /**
   * Gets the maximum supported morph targets.
   */
  get maxTargets(): number {
    return this.config.maxTargets;
  }
  
  /**
   * Disposes all GPU resources.
   */
  dispose(): void {
    for (const [meshId] of this.meshResources) {
      this.unregisterMesh(meshId);
    }
    
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
    this.pipeline = null;
    this.combinedPipeline = null;
    this.bindGroupLayout = null;
  }
}

