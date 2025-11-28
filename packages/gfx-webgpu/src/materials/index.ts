/**
 * Materials System
 * 
 * Central exports for material management.
 */

// Material class and manager
export { Material, type AlphaMode } from './Material';
export { MaterialManager, type SerializedMaterial } from './MaterialManager';

// Material Registry (new)
export {
  MaterialRegistry,
  type MaterialDefinition,
  type MaterialCategory,
  type MaterialStatus,
  type MaterialTextures,
  type MaterialProperties,
  type MaterialValidationResult,
  type MaterialRegistryEvents,
} from './MaterialRegistry';

// Material Library (new)
export {
  BUILTIN_MATERIALS,
  MATERIAL_ATLAS_MAP,
  ATLAS_MATERIAL_MAP,
  initializeMaterialLibrary,
  getMaterialsByCategory,
  getMaterialsByTag,
  getBuiltinMaterial,
  isBuiltinMaterial,
  resolveAtlasIndex,
  resolveMaterialName,
  DEFAULT_MATERIAL_ID,
  DEFAULT_ATLAS_INDEX,
  BUILTIN_MATERIAL_COUNT,
} from './MaterialLibrary';

// Fallback Materials (new)
export {
  FallbackTextureManager,
  FALLBACK_CONFIGS,
  generateFallbackTexture,
  createFallbackGPUTexture,
  createAllFallbackTextures,
  generateSolidTexture,
  generateFlatNormalMap,
  createFlatNormalTexture,
  type FallbackType,
  type FallbackConfig,
  type GeneratedFallbackTexture,
} from './FallbackMaterials';

// Material Presets
export { MaterialPresets, type MaterialPresetName, type MaterialPreset } from './MaterialPresets';

// Texture Binding Manager
export { TextureBindingManager, type FallbackTextures } from './TextureBindingManager';

