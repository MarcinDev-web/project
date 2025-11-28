/**
 * Skinning Pipeline Utilities
 * 
 * Supports two skinning approaches:
 * 1. Vertex Shader Skinning - Classic approach, skinning done per-frame in VS
 * 2. Compute Shader Skinning - Pre-transforms vertices, reused across passes
 * 
 * For compute skinning, use ComputeSkinningPass from '../skinning/ComputeSkinningPass'
 */

export { ComputeSkinningPass, SkinningMode } from '../skinning/ComputeSkinningPass';
export type { SkinningMeshData, ComputeSkinningPassConfig } from '../skinning/ComputeSkinningPass';

// ============================================================================
// Vertex Shader Skinning (legacy/simple path)
// ============================================================================

/**
 * Creates bind group layout for vertex shader skinning.
 * Bindings:
 * - 0: Uniform buffer with joint count
 * - 1: Storage buffer with joint matrices
 */
export function createSkinningBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'skinning-bgl',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });
}

/**
 * Creates bind group for vertex shader skinning.
 */
export function createSkinningBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  uniforms: GPUBuffer,
  jointBuffer: GPUBuffer
): GPUBindGroup {
  return device.createBindGroup({
    label: 'skinning-bg',
    layout,
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: { buffer: jointBuffer } },
    ],
  });
}

// ============================================================================
// Compute Shader Skinning Vertex Buffer Layout
// ============================================================================

/**
 * Vertex buffer layout for consuming compute-skinned output.
 * The compute skinning pass outputs interleaved position + normal.
 */
export function createSkinnedVertexBufferLayout(): GPUVertexBufferLayout {
  return {
    arrayStride: 32, // 8 floats: vec4 position + vec4 normal
    stepMode: 'vertex',
    attributes: [
      {
        // Skinned position
        shaderLocation: 0,
        offset: 0,
        format: 'float32x4',
      },
      {
        // Skinned normal
        shaderLocation: 1,
        offset: 16,
        format: 'float32x4',
      },
    ],
  };
}

/**
 * Configuration for choosing skinning approach.
 */
export interface SkinningPipelineConfig {
  /** Use compute shader skinning (recommended for multi-pass rendering) */
  useComputeSkinning: boolean;
  /** Skinning mode when using compute path */
  computeSkinningMode?: 'lbs' | 'dqs';
}


