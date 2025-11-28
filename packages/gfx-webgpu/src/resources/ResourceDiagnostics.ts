/**
 * ResourceDiagnostics - Centralized diagnostics for texture and material resources
 * 
 * Provides tools to:
 * - Detect missing textures
 * - Find orphaned materials (no textures)
 * - Track resource loading errors
 * - Log resource events
 */

import type { MaterialRegistry, MaterialDefinition, MaterialStatus } from '../materials/MaterialRegistry';
import type { TextureCache, CacheStats } from '../textures/TextureCache';

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface MissingTextureReport {
  materialId: string;
  materialName: string;
  textureType: 'albedo' | 'normal' | 'roughness' | 'metallic' | 'ao' | 'height';
  expectedPath: string;
}

export interface ResourceError {
  type: 'texture' | 'material' | 'atlas' | 'general';
  id: string;
  message: string;
  timestamp: number;
  details?: unknown;
}

export interface ResourceWarning {
  type: 'missing_texture' | 'orphaned_material' | 'unused_texture' | 'performance' | 'general';
  id: string;
  message: string;
  timestamp: number;
  details?: unknown;
}

export interface ResourceStats {
  materials: {
    total: number;
    byStatus: Record<MaterialStatus, number>;
    byCategory: Record<string, number>;
  };
  textures: {
    cached: number;
    memoryUsed: number;
    hitRate: number;
  };
  errors: number;
  warnings: number;
}

export interface DiagnosticsConfig {
  logLevel: LogLevel;
  maxErrors: number;
  maxWarnings: number;
  enableConsoleLogging: boolean;
}

const DEFAULT_CONFIG: DiagnosticsConfig = {
  logLevel: 'warn',
  maxErrors: 100,
  maxWarnings: 100,
  enableConsoleLogging: true,
};

// ============================================================================
// ResourceDiagnostics
// ============================================================================

export class ResourceDiagnostics {
  private config: DiagnosticsConfig;
  private materialRegistry: MaterialRegistry | null = null;
  private textureCache: TextureCache | null = null;

  private errors: ResourceError[] = [];
  private warnings: ResourceWarning[] = [];

  private errorCallbacks: Array<(error: ResourceError) => void> = [];
  private warningCallbacks: Array<(warning: ResourceWarning) => void> = [];

  constructor(config?: Partial<DiagnosticsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  /**
   * Set the material registry to monitor.
   */
  setMaterialRegistry(registry: MaterialRegistry): void {
    this.materialRegistry = registry;
  }

  /**
   * Set the texture cache to monitor.
   */
  setTextureCache(cache: TextureCache): void {
    this.textureCache = cache;
  }

  /**
   * Update diagnostics configuration.
   */
  updateConfig(config: Partial<DiagnosticsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable/disable logging at a specific level.
   */
  setLogLevel(level: LogLevel): void {
    this.config.logLevel = level;
  }

  // -------------------------------------------------------------------------
  // Missing Texture Detection
  // -------------------------------------------------------------------------

  /**
   * Get all materials with missing textures.
   */
  getMissingTextures(): MissingTextureReport[] {
    if (!this.materialRegistry) {
      this.logWarn('MaterialRegistry not set, cannot detect missing textures');
      return [];
    }

    const reports: MissingTextureReport[] = [];
    const materials = this.materialRegistry.listAll();

    for (const material of materials) {
      // Skip procedural materials
      if (material.isProcedural) continue;

      // Check each texture type
      const textureTypes: Array<keyof typeof material.textures> = [
        'albedo', 'normal', 'roughness', 'metallic', 'ao', 'height'
      ];

      for (const type of textureTypes) {
        const path = material.textures[type];
        if (path && !this.isTextureAvailable(path)) {
          reports.push({
            materialId: material.id,
            materialName: material.displayName,
            textureType: type,
            expectedPath: path,
          });
        }
      }
    }

    return reports;
  }

  /**
   * Check if a texture is available (in cache or loadable).
   */
  private isTextureAvailable(path: string): boolean {
    if (!this.textureCache) return true; // Assume available if no cache
    return this.textureCache.has(path);
  }

  // -------------------------------------------------------------------------
  // Orphaned/Unused Detection
  // -------------------------------------------------------------------------

  /**
   * Get materials without any textures defined.
   */
  getOrphanedMaterials(): string[] {
    if (!this.materialRegistry) return [];

    const orphaned: string[] = [];
    const materials = this.materialRegistry.listAll();

    for (const material of materials) {
      if (material.isProcedural) continue;

      const hasAnyTexture = Boolean(
        material.textures.albedo ||
        material.textures.normal ||
        material.textures.roughness ||
        material.textures.metallic ||
        material.textures.ao ||
        material.textures.height
      );

      if (!hasAnyTexture) {
        orphaned.push(material.id);
      }
    }

    return orphaned;
  }

  /**
   * Get cached textures not referenced by any material.
   */
  getUnusedTextures(): string[] {
    if (!this.materialRegistry || !this.textureCache) return [];

    // Collect all texture paths from materials
    const usedPaths = new Set<string>();
    const materials = this.materialRegistry.listAll();

    for (const material of materials) {
      if (material.textures.albedo) usedPaths.add(material.textures.albedo);
      if (material.textures.normal) usedPaths.add(material.textures.normal);
      if (material.textures.roughness) usedPaths.add(material.textures.roughness);
      if (material.textures.metallic) usedPaths.add(material.textures.metallic);
      if (material.textures.ao) usedPaths.add(material.textures.ao);
      if (material.textures.height) usedPaths.add(material.textures.height);
    }

    // Find cached textures not in use
    const cachedIds = this.textureCache.getCachedIds();
    return cachedIds.filter(id => !usedPaths.has(id));
  }

  // -------------------------------------------------------------------------
  // Error Materials
  // -------------------------------------------------------------------------

  /**
   * Get all materials in error state.
   */
  getErrorMaterials(): MaterialDefinition[] {
    if (!this.materialRegistry) return [];
    return this.materialRegistry.getByStatus('error');
  }

  /**
   * Get all materials still loading.
   */
  getLoadingMaterials(): MaterialDefinition[] {
    if (!this.materialRegistry) return [];
    return this.materialRegistry.getByStatus('loading');
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  /**
   * Get comprehensive resource statistics.
   */
  getStats(): ResourceStats {
    const materialStats = this.getMaterialStats();
    const textureStats = this.getTextureStats();

    return {
      materials: materialStats,
      textures: textureStats,
      errors: this.errors.length,
      warnings: this.warnings.length,
    };
  }

  private getMaterialStats(): ResourceStats['materials'] {
    if (!this.materialRegistry) {
      return {
        total: 0,
        byStatus: { pending: 0, loading: 0, ready: 0, error: 0 },
        byCategory: {},
      };
    }

    const materials = this.materialRegistry.listAll();
    const byStatus: Record<MaterialStatus, number> = {
      pending: 0,
      loading: 0,
      ready: 0,
      error: 0,
    };
    const byCategory: Record<string, number> = {};

    for (const material of materials) {
      byStatus[material.status]++;
      byCategory[material.category] = (byCategory[material.category] || 0) + 1;
    }

    return {
      total: materials.length,
      byStatus,
      byCategory,
    };
  }

  private getTextureStats(): ResourceStats['textures'] {
    if (!this.textureCache) {
      return { cached: 0, memoryUsed: 0, hitRate: 0 };
    }

    const cacheStats: CacheStats = this.textureCache.getStats();
    return {
      cached: cacheStats.textureCount,
      memoryUsed: cacheStats.memoryUsed,
      hitRate: cacheStats.hitRate,
    };
  }

  // -------------------------------------------------------------------------
  // Error/Warning Tracking
  // -------------------------------------------------------------------------

  /**
   * Record a resource error.
   */
  recordError(error: Omit<ResourceError, 'timestamp'>): void {
    const fullError: ResourceError = {
      ...error,
      timestamp: Date.now(),
    };

    this.errors.push(fullError);

    // Trim to max size
    if (this.errors.length > this.config.maxErrors) {
      this.errors.shift();
    }

    // Notify callbacks
    for (const callback of this.errorCallbacks) {
      try {
        callback(fullError);
      } catch (e) {
        console.error('[ResourceDiagnostics] Error callback threw:', e);
      }
    }

    // Log if enabled
    if (this.config.enableConsoleLogging && this.shouldLog('error')) {
      console.error(`[ResourceDiagnostics] ERROR [${error.type}] ${error.id}: ${error.message}`);
    }
  }

  /**
   * Record a resource warning.
   */
  recordWarning(warning: Omit<ResourceWarning, 'timestamp'>): void {
    const fullWarning: ResourceWarning = {
      ...warning,
      timestamp: Date.now(),
    };

    this.warnings.push(fullWarning);

    // Trim to max size
    if (this.warnings.length > this.config.maxWarnings) {
      this.warnings.shift();
    }

    // Notify callbacks
    for (const callback of this.warningCallbacks) {
      try {
        callback(fullWarning);
      } catch (e) {
        console.error('[ResourceDiagnostics] Warning callback threw:', e);
      }
    }

    // Log if enabled
    if (this.config.enableConsoleLogging && this.shouldLog('warn')) {
      console.warn(`[ResourceDiagnostics] WARN [${warning.type}] ${warning.id}: ${warning.message}`);
    }
  }

  /**
   * Get recent errors.
   */
  getErrors(limit?: number): ResourceError[] {
    if (limit === undefined) return [...this.errors];
    return this.errors.slice(-limit);
  }

  /**
   * Get recent warnings.
   */
  getWarnings(limit?: number): ResourceWarning[] {
    if (limit === undefined) return [...this.warnings];
    return this.warnings.slice(-limit);
  }

  /**
   * Clear all errors and warnings.
   */
  clearHistory(): void {
    this.errors = [];
    this.warnings = [];
  }

  // -------------------------------------------------------------------------
  // Event Callbacks
  // -------------------------------------------------------------------------

  /**
   * Subscribe to error events.
   */
  onError(callback: (error: ResourceError) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index >= 0) this.errorCallbacks.splice(index, 1);
    };
  }

  /**
   * Subscribe to warning events.
   */
  onWarning(callback: (warning: ResourceWarning) => void): () => void {
    this.warningCallbacks.push(callback);
    return () => {
      const index = this.warningCallbacks.indexOf(callback);
      if (index >= 0) this.warningCallbacks.splice(index, 1);
    };
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Validate all materials and collect issues.
   */
  validateAllMaterials(): {
    valid: boolean;
    errors: Array<{ materialId: string; errors: string[] }>;
    warnings: Array<{ materialId: string; warnings: string[] }>;
  } {
    if (!this.materialRegistry) {
      return { valid: false, errors: [], warnings: [] };
    }

    const allErrors: Array<{ materialId: string; errors: string[] }> = [];
    const allWarnings: Array<{ materialId: string; warnings: string[] }> = [];

    const validationResults = this.materialRegistry.validateAll();

    for (const [materialId, result] of validationResults) {
      if (result.errors.length > 0) {
        allErrors.push({ materialId, errors: result.errors });
      }
      if (result.warnings.length > 0) {
        allWarnings.push({ materialId, warnings: result.warnings });
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Run a full diagnostic check and return a report.
   */
  runFullDiagnostics(): {
    missingTextures: MissingTextureReport[];
    orphanedMaterials: string[];
    unusedTextures: string[];
    errorMaterials: MaterialDefinition[];
    loadingMaterials: MaterialDefinition[];
    validation: {
      valid: boolean;
      errors: Array<{ materialId: string; errors: string[] }>;
      warnings: Array<{ materialId: string; warnings: string[] }>;
    };
    stats: ResourceStats;
  } {
    return {
      missingTextures: this.getMissingTextures(),
      orphanedMaterials: this.getOrphanedMaterials(),
      unusedTextures: this.getUnusedTextures(),
      errorMaterials: this.getErrorMaterials(),
      loadingMaterials: this.getLoadingMaterials(),
      validation: this.validateAllMaterials(),
      stats: this.getStats(),
    };
  }

  // -------------------------------------------------------------------------
  // Logging
  // -------------------------------------------------------------------------

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const configIndex = levels.indexOf(this.config.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= configIndex;
  }

  private logWarn(message: string): void {
    if (this.config.enableConsoleLogging && this.shouldLog('warn')) {
      console.warn(`[ResourceDiagnostics] ${message}`);
    }
  }

  /**
   * Log a debug message.
   */
  debug(message: string, data?: unknown): void {
    if (this.config.enableConsoleLogging && this.shouldLog('debug')) {
      console.debug(`[ResourceDiagnostics] ${message}`, data ?? '');
    }
  }

  /**
   * Log an info message.
   */
  info(message: string, data?: unknown): void {
    if (this.config.enableConsoleLogging && this.shouldLog('info')) {
      console.info(`[ResourceDiagnostics] ${message}`, data ?? '');
    }
  }

  /**
   * Log a warning message.
   */
  warn(message: string, data?: unknown): void {
    if (this.config.enableConsoleLogging && this.shouldLog('warn')) {
      console.warn(`[ResourceDiagnostics] ${message}`, data ?? '');
    }
  }

  /**
   * Log an error message.
   */
  error(message: string, data?: unknown): void {
    if (this.config.enableConsoleLogging && this.shouldLog('error')) {
      console.error(`[ResourceDiagnostics] ${message}`, data ?? '');
    }
  }
}

