/**
 * GPU Compute-based Morph Target System
 * 
 * Provides efficient multi-target morph blending using compute shaders.
 */

export {
  ComputeMorphPass,
  MAX_MORPH_TARGETS,
  type MorphMeshData,
  type ComputeMorphPassConfig,
} from './ComputeMorphPass';

export {
  MorphTargetBuffer,
  type MorphTargetData,
  type MorphTargetBufferConfig,
} from './MorphTargetBuffer';

