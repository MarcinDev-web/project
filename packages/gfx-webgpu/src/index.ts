export { initRenderer } from './core/Renderer';

// Renderer Types (from RendererTypes module)
export type {
  Renderer,
  GridRenderer,
  RendererOptions,
  RenderSettings,
  GpuTimingsHandler,
  CpuTimingsHandler,
  ShadowMetricsHandler,
  RenderStatsHandler,
  ExtendedFrameResources,
} from './core/RendererTypes';

// Frame Loop (new module)
export { FrameLoop, type FrameState } from './core/FrameLoop';

// Device Manager (new module)
export { DeviceManager, type DeviceCreationResult, type DeviceEventDetail } from './core/DeviceManager';

// Frame Resource Factory (new module)
export { FrameResourceFactory, createVertexBufferLayouts } from './core/FrameResourceFactory';

export type { GeometryData } from './resources/resources';

// Adapter probing and capabilities
export {
  pickAdapter,
  probeAdapterCapabilities,
  probeResultToCapabilities,
  validateMinimumLimits,
  type FeatureTier,
  type AdapterProbeResult,
  type SubgroupProbeResult,
} from './core/adapterProbing';
export type { RendererCapabilities, TextureCompressionSupport, SubgroupCapabilities } from './config';

// Performance monitoring
export { PerformanceMonitor } from './core/PerformanceMonitor';
export type {
  CPUMetrics,
  GPUMetrics,
  SceneStats,
  MemoryStats,
  PerformanceSnapshot,
  PerformanceThresholds,
} from './core/PerformanceMonitor';
export { GPUMemoryTracker } from './core/GPUMemoryTracker';
export type { MemoryAllocation, MemoryReport } from './core/GPUMemoryTracker';

// Connected Textures
export {
  ConnectedTextureSystem,
  CTMTextureMapper,
  CTMDebugger,
  CTM_PRESETS,
  type CTMNeighbors,
  type CTMConfig,
  type CTMPattern,
  type CTMTextureIndex,
} from './textures/ConnectedTextures';

// Block Library (re-exported from @engine/blocks for backwards compatibility)
export {
  getBlock,
  getBlocksByCategory,
  getAllCategories,
  BLOCK_LIBRARY,
  type BlockDefinition,
  type BlockCategory,
} from '@engine/blocks';

// Shadow System
export { computeCascades, ShadowCascadeCalculator, type CascadeParams, type CascadeResult } from './shadows/ShadowCascades';
export { ShadowPass } from './shadows/ShadowPass';

// Occlusion Culling
export { OcclusionCullingPass } from './core/OcclusionCullingPass';
export type { OcclusionCullingConfig, OcclusionTestResult } from './core/OcclusionCullingPass';

// Texture Streaming
export { TextureStreamingManager } from './textures/TextureStreamingManager';
export type { TextureStreamingConfig, TextureEntry, TextureLOD } from './textures/TextureStreamingManager';

// Texture Compression
export { TextureCompressionManager } from './textures/TextureCompressionManager';
export type { CompressionFormat, CompressionOptions } from './textures/TextureCompressionManager';

// Texture Creation Helpers
export {
  createTextureSafe,
  createTextureFromDataSafe,
  isTextureFormatSupported,
  getSupportedTextureFormats,
} from './textures/TextureCreationHelpers';
export type { SafeTextureCreationOptions } from './textures/TextureCreationHelpers';

// Geometry LOD
export { GeometryLODManager } from './core/GeometryLODManager';
export type {
  GeometryLODConfig,
  GeometryLODEntry,
  GeometryLODLevel,
  LODMeshData,
} from './core/GeometryLODManager';

// Post-Processing & Environment
export { BrdfLutPass } from './postprocess/BrdfLut';
export { PrefilterEnvPass } from './postprocess/PrefilterEnv';
export { BloomPass } from './postprocess/BloomPass';
export { FXAAPass } from './postprocess/FXAAPass';
export { OutlinePass, type OutlineConfig } from './postprocess/OutlinePass';
export { StylizedColorGradingPass, type StylizedColorGradingConfig } from './postprocess/StylizedColorGrading';
export { EnvironmentRenderer } from './renderers/EnvironmentRenderer';

// Stylized/Cartoon Shaders
export { createStylizedShaderCode, createStylizedSimpleShaderCode, WGSL_STYLIZED_HELPERS } from './shaders/stylized';
export { VolumetricCloudPass, type VolumetricCloudParams } from './renderers/VolumetricCloudPass';
export {
  HybridVolumetricCloudPass,
  type HybridVolumetricCloudParams,
  type CloudType,
} from './renderers/HybridVolumetricCloudPass';
export { ProceduralWeatherMap, type WeatherMapParams } from './textures/ProceduralWeatherMap';

// Lighting
export { ForwardPlus } from './lighting/ForwardPlus';
export type { PointLight } from './lighting/ForwardPlus';
export { WaterRenderer } from './renderers/WaterRenderer';
export { VegetationRenderer } from './renderers/VegetationRenderer';
export type { VegetationRendererConfig } from './renderers/VegetationRenderer';

// Benchmarking
export { generateBenchmarkScene } from './core/BenchmarkScene';
export type { BenchmarkConfig } from './core/BenchmarkScene';

// Render Graph
export { RenderGraph } from './renderer/RenderGraph';
export type { RenderTexture, RenderPassNode } from './renderer/RenderGraph';

// Pipeline Cache
export { PipelineCache } from './pipeline/PipelineCache';

// ============================================================================
// GPU Skinning (Compute-based)
// ============================================================================
export {
  ComputeSkinningPass,
  SkinningMode,
  type SkinningMeshData,
  type ComputeSkinningPassConfig,
  createSkinningBindGroupLayout,
  createSkinningBindGroup,
  createSkinnedVertexBufferLayout,
  type SkinningPipelineConfig,
} from './pipeline/augmentMeshPipelineWithSkinning';
export {
  mat4ToDualQuat,
  jointMatricesToDualQuats,
  normalizeDualQuat,
  blendDualQuats,
  initDualQuatWasm,
  isDualQuatWasmReady,
  clearDualQuatWasm,
  DualQuaternionAccelerator,
  type DualQuaternion,
} from './skinning/DualQuaternion';

// ============================================================================
// GPU Morph Targets (Compute-based)
// ============================================================================
export {
  ComputeMorphPass,
  MAX_MORPH_TARGETS,
  MorphTargetBuffer,
  type MorphMeshData,
  type ComputeMorphPassConfig,
  type MorphTargetData,
  type MorphTargetBufferConfig,
} from './morphing/index';

// ============================================================================
// SDF (Signed Distance Field) Generation
// ============================================================================
export {
  SDFVolumeGenerator,
  SDFAtlas,
  type SDFVolumeConfig,
  type AABBCollider,
  type SphereCollider,
  type SDFAtlasConfig,
  type SDFVolumeEntry,
} from './sdf/index';

// ============================================================================
// GPU Particle System with Collision Detection
// ============================================================================
export {
  ParticleCollisionManager,
  CollisionMode,
  type ParticleCollisionConfig,
  type CollisionGeometry,
} from './particles/index';

// GPU Culling
export { GPUFrustumCuller } from './core/GPUFrustumCuller';
export type { CullResult, BVHNode, GPUBVHData, CullingStrategy, GPUFrustumCullerOptions, HiZOcclusionParams } from './core/GPUFrustumCuller';
export { GPUBVHBuilder } from './core/GPUBVHBuilder';
export type { GPUBVHBuilderOptions, SceneBounds, GPUBVHBuildResult } from './core/GPUBVHBuilder';

// Screen-Space LOD
export { ScreenSpaceLOD } from './core/ScreenSpaceLOD';
export type { LODSelection, LODLevelConfig } from './core/ScreenSpaceLOD';

// Async Compute for Frame Overlap
export { AsyncComputeManager } from './core/AsyncComputeManager';
export type {
  AsyncComputeManagerOptions,
  CullingParams,
  CullingResult,
  AsyncComputeMetrics,
} from './core/AsyncComputeManager';
export { CullingRingBuffer } from './core/CullingRingBuffer';
export type {
  CullingFrame,
  CullingFrameState,
  CullingRingBufferOptions,
} from './core/CullingRingBuffer';
export {
  AsyncTextureQueue,
  TexturePriority,
} from './textures/AsyncTextureQueue';
export type {
  TextureRequest,
  TextureResult,
  AsyncTextureQueueOptions,
  QueueStats,
} from './textures/AsyncTextureQueue';

// Subgroup (Wave) Operations for GPU Compute Optimization
export {
  detectSubgroupCapabilities,
  shouldUseSubgroupPipeline,
  createClassifyPipelines,
  selectPipeline,
  generateSubgroupClassifyShader,
  generateStandardClassifyShader,
  SUBGROUP_WORKGROUP_SIZE,
  MAX_SUBGROUPS,
  type SubgroupPipelineConfig,
  type SubgroupPipelineSet,
  type CreateSubgroupPipelineOptions,
} from './core/SubgroupPipelineManager';

// ============================================================================
// NEW: Centralized Resource Management System
// ============================================================================

// Resource Manager (Central Facade)
export {
  ResourceManager,
  getGlobalResourceManager,
  setGlobalResourceManager,
  disposeGlobalResourceManager,
  type ResourceManagerConfig,
  type ValidationResult,
  type ResourceInitResult,
} from './resources/index';

// Resource Diagnostics
export {
  ResourceDiagnostics,
  type LogLevel,
  type MissingTextureReport,
  type ResourceError,
  type ResourceWarning,
  type ResourceStats,
  type DiagnosticsConfig,
} from './resources/index';

// Scene Validation
export {
  SceneValidator,
  type SceneMaterialReference,
  type SceneValidationResult,
  type MissingMaterialInfo,
  type ErrorMaterialInfo,
  type ValidationWarning,
} from './resources/index';

// Memory Pressure Handler
export {
  MemoryPressureHandler,
  type MemoryPressureConfig,
  type MemoryPressureLevel,
  type MemoryAction,
  type MemoryStatus,
} from './resources/index';

// ============================================================================
// NEW: Material System
// ============================================================================

// Material Registry
export {
  MaterialRegistry,
  type MaterialDefinition,
  type MaterialCategory,
  type MaterialStatus,
  type MaterialTextures,
  type MaterialProperties,
  type MaterialValidationResult,
  type MaterialRegistryEvents,
} from './materials/index';

// Material Library
export {
  BUILTIN_MATERIALS,
  MATERIAL_ATLAS_MAP,
  ATLAS_MATERIAL_MAP,
  initializeMaterialLibrary,
  getMaterialsByCategory as getMaterialLibraryByCategory,
  getMaterialsByTag,
  getBuiltinMaterial,
  isBuiltinMaterial,
  resolveAtlasIndex,
  resolveMaterialName,
  DEFAULT_MATERIAL_ID,
  DEFAULT_ATLAS_INDEX,
  BUILTIN_MATERIAL_COUNT,
} from './materials/index';

// Fallback Materials
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
} from './materials/index';

// Enhanced Texture Streaming Types
export type {
  EnhancedStreamingConfig,
  TexturePriorityLevel,
  TextureCategory,
  StreamingStats,
} from './textures/TextureStreamingManager';

// Procedural Texture Generator
export {
  ProceduralTextureGenerator,
  type PBRTextureData,
} from './textures/ProceduralTextureGenerator';

// GPU Atlas Material Builder and Definitions
export {
  buildGPUAtlasMaterials,
  buildGPUAtlasMaterialsSync,
  buildWasmAtlasMaterials,
  initializeWasmTextureProcessor,
  isWasmTextureProcessorAvailable,
  GPU_MATERIAL_DEFINITIONS,
  GPU_MATERIAL_INDEX_MAP,
  GPU_INDEX_MATERIAL_MAP,
  getGPUMaterialDefinition,
  getGPUMaterialByIndex,
  hasEmission,
  getEmissiveMaterials,
  GPU_MATERIAL_COUNT,
  GPU_TEXTURE_SIZE,
  type GPUMaterialDefinition,
  type BuiltAtlasMaterial,
  type TextureAtlasOptions,
} from './resources/index';

