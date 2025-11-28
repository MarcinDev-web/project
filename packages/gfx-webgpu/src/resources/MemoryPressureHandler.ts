/**
 * MemoryPressureHandler - Automatic memory management for GPU resources
 * 
 * Monitors memory usage and automatically takes action when memory pressure is high:
 * - Evicts unused textures
 * - Reduces texture LOD for distant objects
 * - Compresses atlases if possible
 * - Notifies the application of memory conditions
 */

import type { TextureStreamingManager } from '../textures/TextureStreamingManager';
import type { TextureCache } from '../textures/TextureCache';
import type { ResourceDiagnostics } from './ResourceDiagnostics';

// ============================================================================
// Types
// ============================================================================

export type MemoryPressureLevel = 'normal' | 'warning' | 'critical' | 'emergency';

export interface MemoryPressureConfig {
  /** Enable automatic memory management */
  enabled: boolean;
  /** Check interval in milliseconds */
  checkIntervalMs: number;
  /** Memory pressure thresholds (0-1) */
  thresholds: {
    warning: number;
    critical: number;
    emergency: number;
  };
  /** Actions to take at each level */
  actions: {
    warning: MemoryAction[];
    critical: MemoryAction[];
    emergency: MemoryAction[];
  };
}

export type MemoryAction = 
  | 'evict_unused'
  | 'reduce_distant_lod'
  | 'reduce_invisible_lod'
  | 'reduce_all_lod'
  | 'clear_cache'
  | 'force_gc';

export interface MemoryStatus {
  /** Current pressure level */
  level: MemoryPressureLevel;
  /** Total memory used (bytes) */
  totalUsed: number;
  /** Total memory budget (bytes) */
  totalBudget: number;
  /** Usage percentage (0-1) */
  usage: number;
  /** Breakdown by source */
  breakdown: {
    streaming: number;
    cache: number;
    other: number;
  };
  /** Last action taken */
  lastAction?: MemoryAction;
  /** Last action timestamp */
  lastActionTime?: number;
}

const DEFAULT_CONFIG: MemoryPressureConfig = {
  enabled: true,
  checkIntervalMs: 1000,
  thresholds: {
    warning: 0.7,
    critical: 0.85,
    emergency: 0.95,
  },
  actions: {
    warning: ['evict_unused'],
    critical: ['evict_unused', 'reduce_distant_lod'],
    emergency: ['evict_unused', 'reduce_invisible_lod', 'reduce_all_lod', 'clear_cache'],
  },
};

// ============================================================================
// MemoryPressureHandler
// ============================================================================

export class MemoryPressureHandler {
  private config: MemoryPressureConfig;
  private streamingManager: TextureStreamingManager | null = null;
  private textureCache: TextureCache | null = null;
  private diagnostics: ResourceDiagnostics | null = null;
  
  private currentLevel: MemoryPressureLevel = 'normal';
  private lastCheckTime = 0;
  private lastActionTime = 0;
  private totalBudgetBytes: number;
  
  // Event callbacks
  private onPressureChangeCallbacks: Array<(level: MemoryPressureLevel, status: MemoryStatus) => void> = [];
  private onLowMemoryCallbacks: Array<() => void> = [];

  constructor(
    totalBudgetMB: number = 512,
    config?: Partial<MemoryPressureConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.totalBudgetBytes = totalBudgetMB * 1024 * 1024;
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  /**
   * Set the streaming manager to monitor.
   */
  setStreamingManager(manager: TextureStreamingManager): void {
    this.streamingManager = manager;
  }

  /**
   * Set the texture cache to monitor.
   */
  setTextureCache(cache: TextureCache): void {
    this.textureCache = cache;
  }

  /**
   * Set the diagnostics system for logging.
   */
  setDiagnostics(diagnostics: ResourceDiagnostics): void {
    this.diagnostics = diagnostics;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<MemoryPressureConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set total memory budget.
   */
  setBudget(budgetMB: number): void {
    this.totalBudgetBytes = budgetMB * 1024 * 1024;
  }

  // -------------------------------------------------------------------------
  // Monitoring
  // -------------------------------------------------------------------------

  /**
   * Check memory status and take action if needed.
   * Call this periodically (e.g., once per frame or on a timer).
   */
  update(forceCheck: boolean = false): void {
    if (!this.config.enabled) return;

    const now = this.now();
    
    // Rate limit checks
    if (!forceCheck && now - this.lastCheckTime < this.config.checkIntervalMs) {
      return;
    }
    
    this.lastCheckTime = now;
    
    // Get current status
    const status = this.getStatus();
    const newLevel = this.calculatePressureLevel(status.usage);
    
    // Check if level changed
    if (newLevel !== this.currentLevel) {
      const previousLevel = this.currentLevel;
      this.currentLevel = newLevel;
      
      this.diagnostics?.info(
        `Memory pressure changed: ${previousLevel} -> ${newLevel} (${(status.usage * 100).toFixed(1)}%)`
      );
      
      // Notify listeners
      for (const cb of this.onPressureChangeCallbacks) {
        try { cb(newLevel, status); } catch {}
      }
      
      // Trigger low memory callbacks
      if (newLevel === 'critical' || newLevel === 'emergency') {
        for (const cb of this.onLowMemoryCallbacks) {
          try { cb(); } catch {}
        }
      }
    }
    
    // Take action if needed
    if (newLevel !== 'normal') {
      this.handlePressure(newLevel);
    }
  }

  /**
   * Get current memory status.
   */
  getStatus(): MemoryStatus {
    const streamingUsed = this.streamingManager?.getStats().memoryUsageMB ?? 0;
    const cacheStats = this.textureCache?.getStats();
    const cacheUsed = (cacheStats?.memoryUsed ?? 0) / (1024 * 1024);
    
    const totalUsed = (streamingUsed + cacheUsed) * 1024 * 1024;
    const usage = totalUsed / this.totalBudgetBytes;
    
    return {
      level: this.currentLevel,
      totalUsed,
      totalBudget: this.totalBudgetBytes,
      usage,
      breakdown: {
        streaming: streamingUsed * 1024 * 1024,
        cache: cacheUsed * 1024 * 1024,
        other: 0,
      },
      lastAction: undefined,
      lastActionTime: this.lastActionTime,
    };
  }

  /**
   * Get current pressure level.
   */
  getPressureLevel(): MemoryPressureLevel {
    return this.currentLevel;
  }

  /**
   * Check if memory is under pressure.
   */
  isUnderPressure(): boolean {
    return this.currentLevel !== 'normal';
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /**
   * Handle memory pressure by taking configured actions.
   */
  handlePressure(level?: MemoryPressureLevel): void {
    const pressureLevel = level ?? this.currentLevel;
    if (pressureLevel === 'normal') return;
    
    const actions = this.config.actions[pressureLevel];
    
    for (const action of actions) {
      this.executeAction(action);
    }
  }

  /**
   * Execute a specific memory action.
   */
  executeAction(action: MemoryAction): void {
    this.diagnostics?.debug(`Executing memory action: ${action}`);
    
    switch (action) {
      case 'evict_unused':
        this.evictUnused();
        break;
      case 'reduce_distant_lod':
        this.reduceDistantLOD();
        break;
      case 'reduce_invisible_lod':
        this.reduceInvisibleLOD();
        break;
      case 'reduce_all_lod':
        this.reduceAllLOD();
        break;
      case 'clear_cache':
        this.clearCache();
        break;
      case 'force_gc':
        this.forceGC();
        break;
    }
    
    this.lastActionTime = this.now();
  }

  /**
   * Evict unused textures from streaming and cache.
   */
  private evictUnused(): void {
    const streamingEvicted = this.streamingManager?.evictUnused() ?? 0;
    const cacheEvicted = this.textureCache?.evictUnused() ?? 0;
    
    this.diagnostics?.info(`Evicted ${streamingEvicted} streaming + ${cacheEvicted} cached textures`);
  }

  /**
   * Reduce LOD for distant textures.
   */
  private reduceDistantLOD(): void {
    const reduced = this.streamingManager?.reduceQuality('distant') ?? 0;
    this.diagnostics?.info(`Reduced LOD for ${reduced} distant textures`);
  }

  /**
   * Reduce LOD for invisible textures.
   */
  private reduceInvisibleLOD(): void {
    const reduced = this.streamingManager?.reduceQuality('invisible') ?? 0;
    this.diagnostics?.info(`Reduced LOD for ${reduced} invisible textures`);
  }

  /**
   * Reduce LOD for all textures.
   */
  private reduceAllLOD(): void {
    const reduced = this.streamingManager?.reduceQuality('all') ?? 0;
    this.diagnostics?.info(`Reduced LOD for ${reduced} textures`);
  }

  /**
   * Clear texture cache.
   */
  private clearCache(): void {
    if (this.textureCache) {
      const freed = this.textureCache.defragment();
      this.diagnostics?.info(`Cleared ${freed} textures from cache`);
    }
  }

  /**
   * Force garbage collection if available.
   */
  private forceGC(): void {
    // Note: gc() is not available in all environments
    if (typeof globalThis !== 'undefined' && 'gc' in globalThis) {
      try {
        (globalThis as { gc?: () => void }).gc?.();
        this.diagnostics?.debug('Forced garbage collection');
      } catch {
        // GC not available
      }
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Calculate pressure level from usage percentage.
   */
  private calculatePressureLevel(usage: number): MemoryPressureLevel {
    if (usage >= this.config.thresholds.emergency) return 'emergency';
    if (usage >= this.config.thresholds.critical) return 'critical';
    if (usage >= this.config.thresholds.warning) return 'warning';
    return 'normal';
  }

  /**
   * Get current timestamp.
   */
  private now(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  // -------------------------------------------------------------------------
  // Event Subscriptions
  // -------------------------------------------------------------------------

  /**
   * Subscribe to pressure level changes.
   */
  onPressureChange(
    callback: (level: MemoryPressureLevel, status: MemoryStatus) => void
  ): () => void {
    this.onPressureChangeCallbacks.push(callback);
    return () => {
      const index = this.onPressureChangeCallbacks.indexOf(callback);
      if (index >= 0) this.onPressureChangeCallbacks.splice(index, 1);
    };
  }

  /**
   * Subscribe to low memory events.
   */
  onLowMemory(callback: () => void): () => void {
    this.onLowMemoryCallbacks.push(callback);
    return () => {
      const index = this.onLowMemoryCallbacks.indexOf(callback);
      if (index >= 0) this.onLowMemoryCallbacks.splice(index, 1);
    };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Reset handler state.
   */
  reset(): void {
    this.currentLevel = 'normal';
    this.lastCheckTime = 0;
    this.lastActionTime = 0;
  }

  /**
   * Dispose handler.
   */
  dispose(): void {
    this.reset();
    this.onPressureChangeCallbacks = [];
    this.onLowMemoryCallbacks = [];
    this.streamingManager = null;
    this.textureCache = null;
    this.diagnostics = null;
  }
}

