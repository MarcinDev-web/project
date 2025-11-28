/**
 * ResourceManager - Central facade for texture and material management
 * 
 * Consolidates all resource subsystems into a single entry point:
 * - TextureManager (loading, procedural generation)
 * - MaterialRegistry (material definitions, validation)
 * - TextureCache (caching, LRU eviction)
 * - TextureStreamingManager (LOD streaming)
 * - ResourceDiagnostics (error detection, logging)
 */

import { type IDisposable, EventBus } from '@engine/core';
import { TextureManager } from '../textures/TextureManager';
import { TextureCache, globalTextureCache } from '../textures/TextureCache';
import { TextureStreamingManager, type TextureStreamingConfig } from '../textures/TextureStreamingManager';
import { MaterialRegistry, type MaterialDefinition, type MaterialCategory, type MaterialRegistryEvents } from '../materials/MaterialRegistry';
import { ResourceDiagnostics, type ResourceStats, type LogLevel } from './ResourceDiagnostics';
import type { PipelineCache } from '../pipeline/PipelineCache';

// ============================================================================
// Types
// ============================================================================

export interface ResourceManagerConfig {
  /** Texture cache configuration */
  cache: {
    maxMemoryBytes: number;
    maxTextures: number;
    enableLRU: boolean;
    evictionTimeout: number;
  };
  /** Streaming configuration */
  streaming: Partial<TextureStreamingConfig>;
  /** Diagnostics configuration */
  diagnostics: {
    logLevel: LogLevel;
    enableConsoleLogging: boolean;
  };
  /** Procedural texture size */
  proceduralTextureSize: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  materialId?: string;
}

export interface ResourceInitResult {
  success: boolean;
  error?: string;
  materialsLoaded: number;
  texturesCached: number;
}

const DEFAULT_CONFIG: ResourceManagerConfig = {
  cache: {
    maxMemoryBytes: 256 * 1024 * 1024, // 256MB
    maxTextures: 1000,
    enableLRU: true,
    evictionTimeout: 30000,
  },
  streaming: {
    enabled: true,
    memoryBudgetMB: 512,
  },
  diagnostics: {
    logLevel: 'warn',
    enableConsoleLogging: true,
  },
  proceduralTextureSize: 128,
};

// ============================================================================
// ResourceManager
// ============================================================================

export class ResourceManager implements IDisposable {
  private _device: GPUDevice | null = null;
  private _pipelineCache: PipelineCache | undefined;
  private _initialized = false;
  private config: ResourceManagerConfig;

  // Subsystems
  private _textures: TextureManager;
  private _materials: MaterialRegistry;
  private _materialEventBus: EventBus;
  private _cache: TextureCache;
  private _streaming: TextureStreamingManager | null = null;
  private _diagnostics: ResourceDiagnostics;

  constructor(config?: Partial<ResourceManagerConfig>) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);

    // Initialize subsystems (non-GPU dependent)
    this._cache = new TextureCache(this.config.cache);
    this._materialEventBus = new EventBus();
    this._materials = new MaterialRegistry(this._materialEventBus);
    this._diagnostics = new ResourceDiagnostics(this.config.diagnostics);
    this._textures = new TextureManager(undefined, this.config.proceduralTextureSize);

    // Connect diagnostics to subsystems
    this._diagnostics.setMaterialRegistry(this._materials);
    this._diagnostics.setTextureCache(this._cache);

    // Subscribe to material events for diagnostics
    this._materials.on('material:error', ({ id, error }) => {
      this._diagnostics.recordError({
        type: 'material',
        id,
        message: error,
      });
    });

    this._diagnostics.info('ResourceManager created');
  }

  private mergeConfig(
    defaults: ResourceManagerConfig,
    overrides?: Partial<ResourceManagerConfig>
  ): ResourceManagerConfig {
    if (!overrides) return defaults;
    return {
      cache: { ...defaults.cache, ...overrides.cache },
      streaming: { ...defaults.streaming, ...overrides.streaming },
      diagnostics: { ...defaults.diagnostics, ...overrides.diagnostics },
      proceduralTextureSize: overrides.proceduralTextureSize ?? defaults.proceduralTextureSize,
    };
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  /**
   * Initialize GPU-dependent resources.
   */
  initialize(device: GPUDevice, pipelineCache?: PipelineCache): ResourceInitResult {
    if (this._initialized) {
      this._diagnostics.warn('ResourceManager already initialized');
      return {
        success: true,
        materialsLoaded: this._materials.count,
        texturesCached: this._cache.getCachedIds().length,
      };
    }

    try {
      this._device = device;
      this._pipelineCache = pipelineCache;

      // Initialize texture manager with GPU
      this._textures.initializeGPU(device, pipelineCache);

      // Initialize streaming manager
      this._streaming = new TextureStreamingManager(
        device,
        this.config.streaming as TextureStreamingConfig
      );

      this._initialized = true;
      this._diagnostics.info('ResourceManager initialized with GPU device');

      return {
        success: true,
        materialsLoaded: this._materials.count,
        texturesCached: this._cache.getCachedIds().length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._diagnostics.recordError({
        type: 'general',
        id: 'initialization',
        message: `Failed to initialize ResourceManager: ${message}`,
        details: error,
      });

      return {
        success: false,
        error: message,
        materialsLoaded: 0,
        texturesCached: 0,
      };
    }
  }

  /**
   * Check if the manager has been initialized with a GPU device.
   */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Get the GPU device (if initialized).
   */
  get device(): GPUDevice | null {
    return this._device;
  }

  // -------------------------------------------------------------------------
  // Subsystem Access
  // -------------------------------------------------------------------------

  /**
   * Access the texture manager.
   */
  get textures(): TextureManager {
    return this._textures;
  }

  /**
   * Access the material registry.
   */
  get materials(): MaterialRegistry {
    return this._materials;
  }

  /**
   * Access the texture cache.
   */
  get cache(): TextureCache {
    return this._cache;
  }

  /**
   * Access the streaming manager (requires GPU initialization).
   */
  get streaming(): TextureStreamingManager | null {
    return this._streaming;
  }

  /**
   * Access the diagnostics system.
   */
  get diagnostics(): ResourceDiagnostics {
    return this._diagnostics;
  }

  // -------------------------------------------------------------------------
  // Material Operations
  // -------------------------------------------------------------------------

  /**
   * Register a material definition.
   */
  registerMaterial(definition: MaterialDefinition): void {
    this._materials.register(definition);
    this._diagnostics.debug(`Material registered: ${definition.id}`);
  }

  /**
   * Register multiple materials.
   */
  registerMaterials(definitions: MaterialDefinition[]): void {
    this._materials.registerBatch(definitions);
    this._diagnostics.debug(`${definitions.length} materials registered`);
  }

  /**
   * Get a material by string ID.
   */
  getMaterial(id: string): MaterialDefinition | undefined {
    return this._materials.get(id);
  }

  /**
   * Get a material by atlas index.
   */
  getMaterialByAtlasIndex(index: number): MaterialDefinition | undefined {
    return this._materials.getByAtlasIndex(index);
  }

  /**
   * Get all materials in a category.
   */
  getMaterialsByCategory(category: MaterialCategory): MaterialDefinition[] {
    return this._materials.getByCategory(category);
  }

  /**
   * Resolve a material reference to an atlas index.
   * Returns fallback index if material not found.
   */
  resolveAtlasIndex(materialRef: string, fallbackIndex: number = 0): number {
    const material = this._materials.get(materialRef);
    if (!material) {
      this._diagnostics.recordWarning({
        type: 'missing_texture',
        id: materialRef,
        message: `Material "${materialRef}" not found, using fallback index ${fallbackIndex}`,
      });
      return fallbackIndex;
    }
    return material.atlasIndex;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Validate a specific material.
   */
  validateMaterial(materialId: string): ValidationResult {
    const result = this._materials.validate(materialId);
    return {
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      materialId,
    };
  }

  /**
   * Validate all materials and return issues.
   */
  validateAllMaterials(): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();
    const validationMap = this._materials.validateAll();

    for (const [id, result] of validationMap) {
      results.set(id, {
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        materialId: id,
      });
    }

    return results;
  }

  /**
   * Get list of materials with missing textures.
   */
  getMissingTextures(): string[] {
    const missing = this._diagnostics.getMissingTextures();
    return missing.map(report => report.expectedPath);
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  /**
   * Get comprehensive resource statistics.
   */
  getStats(): ResourceStats {
    return this._diagnostics.getStats();
  }

  /**
   * Get memory usage information.
   */
  getMemoryUsage(): {
    cacheUsed: number;
    cacheMax: number;
    cachePercent: number;
    streamingUsed: number;
    streamingMax: number;
  } {
    const cacheStats = this._cache.getStats();
    const streamingStats = this._streaming?.getStats();

    return {
      cacheUsed: cacheStats.memoryUsed,
      cacheMax: this.config.cache.maxMemoryBytes,
      cachePercent: this._cache.getMemoryUsagePercent(),
      streamingUsed: (streamingStats?.memoryUsageMB ?? 0) * 1024 * 1024,
      streamingMax: (this.config.streaming.memoryBudgetMB ?? 512) * 1024 * 1024,
    };
  }

  // -------------------------------------------------------------------------
  // Streaming Operations
  // -------------------------------------------------------------------------

  /**
   * Update streaming system (call once per frame).
   */
  updateStreaming(): void {
    this._streaming?.update();
  }

  /**
   * Register a texture for streaming.
   */
  registerStreamingTexture(id: string, url: string, initialDistance?: number): void {
    this._streaming?.registerTexture(id, url, initialDistance);
  }

  /**
   * Update texture distance for streaming priority.
   */
  updateTextureDistance(id: string, distance: number): void {
    this._streaming?.updateTextureDistance(id, distance);
  }

  // -------------------------------------------------------------------------
  // Cache Operations
  // -------------------------------------------------------------------------

  /**
   * Evict unused textures from cache.
   */
  evictUnusedTextures(): number {
    return this._cache.evictUnused();
  }

  /**
   * Defragment cache by removing unreferenced textures.
   */
  defragmentCache(): number {
    return this._cache.defragment();
  }

  /**
   * Clear all cached textures.
   */
  clearCache(): void {
    this._cache.clear();
    this._diagnostics.info('Texture cache cleared');
  }

  // -------------------------------------------------------------------------
  // Diagnostics Operations
  // -------------------------------------------------------------------------

  /**
   * Run full diagnostics and return report.
   */
  runDiagnostics(): ReturnType<ResourceDiagnostics['runFullDiagnostics']> {
    return this._diagnostics.runFullDiagnostics();
  }

  /**
   * Set diagnostics log level.
   */
  setLogLevel(level: LogLevel): void {
    this._diagnostics.setLogLevel(level);
  }

  /**
   * Subscribe to resource errors.
   */
  onError(callback: Parameters<ResourceDiagnostics['onError']>[0]): () => void {
    return this._diagnostics.onError(callback);
  }

  /**
   * Subscribe to resource warnings.
   */
  onWarning(callback: Parameters<ResourceDiagnostics['onWarning']>[0]): () => void {
    return this._diagnostics.onWarning(callback);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Dispose all resources.
   */
  dispose(): void {
    this._diagnostics.info('Disposing ResourceManager');

    // Dispose streaming
    this._streaming?.dispose();
    this._streaming = null;

    // Clear cache
    this._cache.clear();

    // Clear materials
    this._materials.clear();

    // Unload textures
    this._textures.unloadAll();

    this._device = null;
    this._pipelineCache = undefined;
    this._initialized = false;

    this._diagnostics.info('ResourceManager disposed');
  }
}

// ============================================================================
// Global Instance (optional, for backward compatibility)
// ============================================================================

let _globalResourceManager: ResourceManager | null = null;

/**
 * Get or create the global ResourceManager instance.
 * Note: Prefer creating your own instance for better control.
 */
export function getGlobalResourceManager(): ResourceManager {
  if (!_globalResourceManager) {
    _globalResourceManager = new ResourceManager();
  }
  return _globalResourceManager;
}

/**
 * Set a custom global ResourceManager instance.
 */
export function setGlobalResourceManager(manager: ResourceManager): void {
  if (_globalResourceManager) {
    _globalResourceManager.dispose();
  }
  _globalResourceManager = manager;
}

/**
 * Dispose the global ResourceManager instance.
 */
export function disposeGlobalResourceManager(): void {
  if (_globalResourceManager) {
    _globalResourceManager.dispose();
    _globalResourceManager = null;
  }
}

