export { initRenderer, type Renderer } from './core/Renderer';
export type { GeometryData } from './resources/resources';
export { PerformanceMonitor } from './core/PerformanceMonitor';
export type { CPUMetrics, GPUMetrics, SceneStats, MemoryStats, PerformanceSnapshot, PerformanceThresholds, } from './core/PerformanceMonitor';
export { GPUMemoryTracker } from './core/GPUMemoryTracker';
export type { MemoryAllocation, MemoryReport } from './core/GPUMemoryTracker';
export { ConnectedTextureSystem, CTMTextureMapper, CTMDebugger, CTM_PRESETS, type CTMNeighbors, type CTMConfig, type CTMPattern, type CTMTextureIndex, } from './textures/ConnectedTextures';
export { getBlock, getBlocksByCategory, getAllCategories, BLOCK_LIBRARY, type BlockDefinition, type BlockCategory, } from './blocks/BlockLibrary';
export { computeCascades, type CascadeParams, type CascadeResult } from './shadows/ShadowCascades';
export { ShadowPass } from './shadows/ShadowPass';
export { OcclusionCullingPass } from './core/OcclusionCullingPass';
export type { OcclusionCullingConfig, OcclusionTestResult } from './core/OcclusionCullingPass';
export { TextureStreamingManager } from './textures/TextureStreamingManager';
export type { TextureStreamingConfig, TextureEntry, TextureLOD } from './textures/TextureStreamingManager';
export { GeometryLODManager } from './core/GeometryLODManager';
export type { GeometryLODConfig, GeometryLODEntry, GeometryLODLevel, LODMeshData, } from './core/GeometryLODManager';
export { BrdfLutPass } from './postprocess/BrdfLut';
export { EnvironmentRenderer } from './renderers/EnvironmentRenderer';
//# sourceMappingURL=index.d.ts.map