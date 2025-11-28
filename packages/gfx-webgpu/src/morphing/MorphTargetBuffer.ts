/**
 * MorphTargetBuffer - GPU buffer management for morph target deltas
 * 
 * Stores morph target position and normal deltas on GPU for compute-based blending.
 * Deltas are packed contiguously: [target0_vertex0, target0_vertex1, ..., target1_vertex0, ...]
 */

export interface MorphTargetData {
  /** Number of morph targets */
  targetCount: number;
  /** Number of vertices per target */
  vertexCount: number;
  /** Position deltas: Float32Array of vec4s, length = targetCount * vertexCount * 4 */
  positionDeltas: Float32Array;
  /** Optional normal deltas: Float32Array of vec4s, same length as positionDeltas */
  normalDeltas?: Float32Array;
}

export interface MorphTargetBufferConfig {
  /** Maximum number of morph targets supported */
  maxTargets: number;
  /** Maximum number of vertices per mesh */
  maxVertices: number;
}

export class MorphTargetBuffer {
  private device: GPUDevice;
  private config: MorphTargetBufferConfig;
  
  // GPU buffers
  private positionDeltaBuffer: GPUBuffer | null = null;
  private normalDeltaBuffer: GPUBuffer | null = null;
  
  // Current data dimensions
  private currentTargetCount = 0;
  private currentVertexCount = 0;
  private hasNormalDeltas = false;
  
  constructor(device: GPUDevice, config: MorphTargetBufferConfig) {
    this.device = device;
    this.config = config;
    this.initialize();
  }
  
  private initialize(): void {
    const maxElements = this.config.maxTargets * this.config.maxVertices;
    const bufferSize = maxElements * 4 * 4; // vec4<f32> per element
    
    this.positionDeltaBuffer = this.device.createBuffer({
      label: 'morph-position-deltas',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    
    this.normalDeltaBuffer = this.device.createBuffer({
      label: 'morph-normal-deltas',
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }
  
  /**
   * Uploads morph target data to GPU buffers.
   */
  upload(data: MorphTargetData): void {
    const { targetCount, vertexCount, positionDeltas, normalDeltas } = data;
    
    if (targetCount > this.config.maxTargets) {
      throw new Error(`Target count ${targetCount} exceeds max ${this.config.maxTargets}`);
    }
    if (vertexCount > this.config.maxVertices) {
      throw new Error(`Vertex count ${vertexCount} exceeds max ${this.config.maxVertices}`);
    }
    
    this.currentTargetCount = targetCount;
    this.currentVertexCount = vertexCount;
    this.hasNormalDeltas = !!normalDeltas;
    
    // Upload position deltas
    const expectedSize = targetCount * vertexCount * 4;
    if (positionDeltas.length < expectedSize) {
      throw new Error(`Position deltas length ${positionDeltas.length} < expected ${expectedSize}`);
    }
    
    this.device.queue.writeBuffer(
      this.positionDeltaBuffer!,
      0,
      positionDeltas.buffer,
      positionDeltas.byteOffset,
      expectedSize * 4 // bytes
    );
    
    // Upload normal deltas if provided
    if (normalDeltas) {
      if (normalDeltas.length < expectedSize) {
        throw new Error(`Normal deltas length ${normalDeltas.length} < expected ${expectedSize}`);
      }
      
      this.device.queue.writeBuffer(
        this.normalDeltaBuffer!,
        0,
        normalDeltas.buffer,
        normalDeltas.byteOffset,
        expectedSize * 4
      );
    }
  }
  
  /**
   * Creates morph target data from sparse format (common in glTF).
   * Sparse format: only stores non-zero deltas with indices.
   */
  static createFromSparse(
    vertexCount: number,
    targets: Array<{
      indices: Uint32Array;
      positionDeltas: Float32Array;
      normalDeltas?: Float32Array;
    }>
  ): MorphTargetData {
    const targetCount = targets.length;
    const positionDeltas = new Float32Array(targetCount * vertexCount * 4);
    let hasNormals = false;
    let normalDeltas: Float32Array | undefined;
    
    // Check if any target has normals
    for (const target of targets) {
      if (target.normalDeltas) {
        hasNormals = true;
        break;
      }
    }
    
    if (hasNormals) {
      normalDeltas = new Float32Array(targetCount * vertexCount * 4);
    }
    
    // Expand sparse to dense
    for (let t = 0; t < targetCount; t++) {
      const target = targets[t]!;
      const baseOffset = t * vertexCount * 4;
      
      for (let i = 0; i < target.indices.length; i++) {
        const vertIdx = target.indices[i]!;
        const dstOffset = baseOffset + vertIdx * 4;
        const srcOffset = i * 3; // Assuming vec3 input
        
        // Position delta
        positionDeltas[dstOffset + 0] = target.positionDeltas[srcOffset + 0] ?? 0;
        positionDeltas[dstOffset + 1] = target.positionDeltas[srcOffset + 1] ?? 0;
        positionDeltas[dstOffset + 2] = target.positionDeltas[srcOffset + 2] ?? 0;
        positionDeltas[dstOffset + 3] = 0; // w = 0 for deltas
        
        // Normal delta
        if (normalDeltas && target.normalDeltas) {
          normalDeltas[dstOffset + 0] = target.normalDeltas[srcOffset + 0] ?? 0;
          normalDeltas[dstOffset + 1] = target.normalDeltas[srcOffset + 1] ?? 0;
          normalDeltas[dstOffset + 2] = target.normalDeltas[srcOffset + 2] ?? 0;
          normalDeltas[dstOffset + 3] = 0;
        }
      }
    }
    
    return {
      targetCount,
      vertexCount,
      positionDeltas,
      normalDeltas,
    };
  }
  
  /**
   * Creates morph target data from dense format (vec3 arrays per target).
   */
  static createFromDense(
    targets: Array<{
      positionDeltas: Float32Array; // vec3 per vertex
      normalDeltas?: Float32Array;  // vec3 per vertex
    }>
  ): MorphTargetData {
    if (targets.length === 0) {
      return {
        targetCount: 0,
        vertexCount: 0,
        positionDeltas: new Float32Array(0),
      };
    }
    
    const targetCount = targets.length;
    const vertexCount = Math.floor(targets[0]!.positionDeltas.length / 3);
    
    const positionDeltas = new Float32Array(targetCount * vertexCount * 4);
    let normalDeltas: Float32Array | undefined;
    
    // Check for normals
    const hasNormals = targets.some(t => t.normalDeltas);
    if (hasNormals) {
      normalDeltas = new Float32Array(targetCount * vertexCount * 4);
    }
    
    // Convert vec3 to vec4
    for (let t = 0; t < targetCount; t++) {
      const target = targets[t]!;
      const baseOffset = t * vertexCount * 4;
      
      for (let v = 0; v < vertexCount; v++) {
        const srcOffset = v * 3;
        const dstOffset = baseOffset + v * 4;
        
        positionDeltas[dstOffset + 0] = target.positionDeltas[srcOffset + 0] ?? 0;
        positionDeltas[dstOffset + 1] = target.positionDeltas[srcOffset + 1] ?? 0;
        positionDeltas[dstOffset + 2] = target.positionDeltas[srcOffset + 2] ?? 0;
        positionDeltas[dstOffset + 3] = 0;
        
        if (normalDeltas && target.normalDeltas) {
          normalDeltas[dstOffset + 0] = target.normalDeltas[srcOffset + 0] ?? 0;
          normalDeltas[dstOffset + 1] = target.normalDeltas[srcOffset + 1] ?? 0;
          normalDeltas[dstOffset + 2] = target.normalDeltas[srcOffset + 2] ?? 0;
          normalDeltas[dstOffset + 3] = 0;
        }
      }
    }
    
    return {
      targetCount,
      vertexCount,
      positionDeltas,
      normalDeltas,
    };
  }
  
  get positionBuffer(): GPUBuffer | null {
    return this.positionDeltaBuffer;
  }
  
  get normalBuffer(): GPUBuffer | null {
    return this.normalDeltaBuffer;
  }
  
  get targetCount(): number {
    return this.currentTargetCount;
  }
  
  get vertexCount(): number {
    return this.currentVertexCount;
  }
  
  get hasNormals(): boolean {
    return this.hasNormalDeltas;
  }
  
  dispose(): void {
    this.positionDeltaBuffer?.destroy();
    this.normalDeltaBuffer?.destroy();
    this.positionDeltaBuffer = null;
    this.normalDeltaBuffer = null;
  }
}

