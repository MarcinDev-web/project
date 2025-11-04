export { initRenderer, type Renderer } from './core/Renderer';
export type { GeometryData } from './resources/resources';

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
export { computeCascades, type CascadeParams, type CascadeResult } from './shadows/ShadowCascades';
export { ShadowPass } from './shadows/ShadowPass';

// Occlusion Culling
export { OcclusionCullingPass } from './core/OcclusionCullingPass';
export type { OcclusionCullingConfig, OcclusionTestResult } from './core/OcclusionCullingPass';

// Texture Streaming
export { TextureStreamingManager } from './textures/TextureStreamingManager';
export type { TextureStreamingConfig, TextureEntry, TextureLOD } from './textures/TextureStreamingManager';

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
export { EnvironmentRenderer } from './renderers/EnvironmentRenderer';

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

// GPU Culling
export { GPUFrustumCuller } from './core/GPUFrustumCuller';

// Screen-Space LOD
export { ScreenSpaceLOD } from './core/ScreenSpaceLOD';
export type { LODSelection, LODLevelConfig } from './core/ScreenSpaceLOD';

