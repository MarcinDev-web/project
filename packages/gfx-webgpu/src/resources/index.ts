/**
 * Resource Management System
 * 
 * Central exports for texture and material resource management.
 */

export {
  ResourceManager,
  getGlobalResourceManager,
  setGlobalResourceManager,
  disposeGlobalResourceManager,
  type ResourceManagerConfig,
  type ValidationResult,
  type ResourceInitResult,
} from './ResourceManager';

export {
  ResourceDiagnostics,
  type LogLevel,
  type MissingTextureReport,
  type ResourceError,
  type ResourceWarning,
  type ResourceStats,
  type DiagnosticsConfig,
} from './ResourceDiagnostics';

export {
  SceneValidator,
  type SceneMaterialReference,
  type SceneValidationResult,
  type MissingMaterialInfo,
  type ErrorMaterialInfo,
  type ValidationWarning,
} from './SceneValidator';

export {
  MemoryPressureHandler,
  type MemoryPressureConfig,
  type MemoryPressureLevel,
  type MemoryAction,
  type MemoryStatus,
} from './MemoryPressureHandler';

// GPU Atlas Material Builder
export {
  buildGPUAtlasMaterials,
  buildGPUAtlasMaterialsSync,
  buildWasmAtlasMaterials,
  initializeWasmTextureProcessor,
  isWasmTextureProcessorAvailable,
  type GPUMaterialDefinition,
  type BuiltAtlasMaterial,
} from './GPUAtlasMaterialBuilder';

// GPU Material Definitions
export {
  GPU_MATERIAL_DEFINITIONS,
  GPU_MATERIAL_INDEX_MAP,
  GPU_INDEX_MATERIAL_MAP,
  getGPUMaterialDefinition,
  getGPUMaterialByIndex,
  hasEmission,
  getEmissiveMaterials,
  GPU_MATERIAL_COUNT,
  GPU_TEXTURE_SIZE,
} from './GPUMaterialDefinitions';

// Atlas Creation Options
export { type TextureAtlasOptions } from './resources';

