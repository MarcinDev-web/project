import { Component } from './Component.js';
import { registerComponent } from './registry.js';

/**
 * MorphBindingComponent - connects entity to morph target animation data
 * 
 * Supports both CPU-side weights (for vertex shader morphing) and
 * GPU buffer references (for compute shader morphing).
 */
export class MorphBindingComponent extends Component {
  static readonly type = 'MorphBinding';

  /** Number of morph targets for this mesh */
  targetCount = 0;
  
  /** Current morph weights (CPU-side, for upload to GPU) */
  weights: Float32Array | null = null; // length = targetCount

  // =========================================================================
  // GPU Compute Morphing Support
  // =========================================================================
  
  /** 
   * Unique mesh ID for GPU morph pass registration.
   * Set this to enable compute-based morphing.
   */
  gpuMeshId: string | null = null;
  
  /**
   * Whether compute-based morphing is enabled for this entity.
   * When true, the morph system will use ComputeMorphPass instead of
   * vertex shader morphing.
   */
  useComputeMorph = false;
  
  /**
   * GPU output position buffer reference (set by morph system after dispatch).
   * Can be bound directly to render pipeline.
   */
  gpuPositionBuffer: GPUBuffer | null = null;
  
  /**
   * GPU output normal buffer reference (set by morph system after dispatch).
   * Can be bound directly to render pipeline.
   */
  gpuNormalBuffer: GPUBuffer | null = null;
  
  /**
   * Marks weights as dirty, requiring GPU re-dispatch.
   */
  weightsDirty = false;

  getType(): string {
    return MorphBindingComponent.type;
  }

  /**
   * Sets morph weight for a specific target.
   */
  setWeight(targetIndex: number, weight: number): void {
    if (!this.weights || targetIndex < 0 || targetIndex >= this.targetCount) {
      return;
    }
    this.weights[targetIndex] = weight;
    this.weightsDirty = true;
  }

  /**
   * Sets all morph weights at once.
   */
  setWeights(weights: Float32Array | number[]): void {
    if (!this.weights) return;
    
    const count = Math.min(weights.length, this.targetCount);
    for (let i = 0; i < count; i++) {
      this.weights[i] = weights[i] ?? 0;
    }
    this.weightsDirty = true;
  }

  override clone(): MorphBindingComponent {
    const clone = new MorphBindingComponent();
    clone.targetCount = this.targetCount;
    clone.weights = this.weights ? new Float32Array(this.weights) : null;
    clone.gpuMeshId = this.gpuMeshId;
    clone.useComputeMorph = this.useComputeMorph;
    // GPU buffers are not cloned - they're managed by the morph system
    return clone;
  }
  
  /**
   * Resets GPU references (call when disposing or re-registering mesh).
   */
  resetGpuReferences(): void {
    this.gpuPositionBuffer = null;
    this.gpuNormalBuffer = null;
    this.weightsDirty = true;
  }
}

registerComponent(MorphBindingComponent.type, MorphBindingComponent);
