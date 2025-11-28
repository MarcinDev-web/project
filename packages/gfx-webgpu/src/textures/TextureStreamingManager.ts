/**
 * Texture Streaming Manager
 *
 * Manages LOD-based texture loading for efficient memory usage.
 * Loads high-resolution textures only for visible/close objects.
 *
 * Features:
 * - Distance-based LOD selection
 * - Priority queue for async loading
 * - Memory budget management
 * - Automatic eviction of unused textures
 */

import { Logger } from '@engine/core/utils';
import { createTextureSafe, type SafeTextureCreationOptions } from './TextureCreationHelpers';
import type { TextureCompressionManager } from './TextureCompressionManager';

export type TextureLOD = 'low' | 'medium' | 'high' | 'ultra';

export type TexturePriorityLevel = 'critical' | 'high' | 'normal' | 'low' | 'background';

export interface TextureStreamingConfig {
  enabled: boolean;
  memoryBudgetMB: number; // Total texture memory budget
  lodDistances: {
    ultra: number; // Distance for ultra quality (full res)
    high: number; // Distance for high quality
    medium: number; // Distance for medium quality
    // Below medium distance = low quality
  };
  maxConcurrentLoads: number; // Max textures loading simultaneously
  evictionStrategy: 'lru' | 'distance' | 'hybrid'; // Eviction strategy when over budget
  preloadDistance: number; // Distance to start preloading higher LOD
}

/**
 * Enhanced streaming configuration with memory budgets and priorities.
 */
export interface EnhancedStreamingConfig extends TextureStreamingConfig {
  /** Memory budgets by texture category */
  memoryBudgets: {
    /** MB for regular textures */
    textures: number;
    /** MB for texture atlases */
    atlases: number;
    /** MB for procedurally generated textures */
    procedural: number;
  };
  /** Priority multipliers for different scenarios */
  priorityRules: {
    /** Priority multiplier for visible entities */
    visibleEntities: number;
    /** Priority multiplier for recently used textures */
    recentlyUsed: number;
    /** Priority multiplier for textures near player */
    nearPlayer: number;
    /** Priority multiplier for emissive/important materials */
    importantMaterials: number;
  };
  /** Memory pressure thresholds */
  memoryPressure: {
    /** Percentage of budget to trigger warning */
    warningThreshold: number;
    /** Percentage of budget to trigger aggressive eviction */
    criticalThreshold: number;
    /** Percentage of budget to target after eviction */
    targetAfterEviction: number;
  };
  /** Cleanup settings */
  cleanup: {
    /** Interval in frames between cleanup runs */
    intervalFrames: number;
    /** Maximum age in ms before texture can be evicted */
    maxAgeMs: number;
  };
}

const DEFAULT_CONFIG: TextureStreamingConfig = {
  enabled: true,
  memoryBudgetMB: 512, // 512 MB texture budget
  lodDistances: {
    ultra: 10,
    high: 25,
    medium: 50,
  },
  maxConcurrentLoads: 4,
  evictionStrategy: 'lru',
  preloadDistance: 1.2, // Preload when 20% closer
};

const DEFAULT_ENHANCED_CONFIG: EnhancedStreamingConfig = {
  ...DEFAULT_CONFIG,
  memoryBudgets: {
    textures: 256,
    atlases: 128,
    procedural: 64,
  },
  priorityRules: {
    visibleEntities: 2.0,
    recentlyUsed: 1.5,
    nearPlayer: 3.0,
    importantMaterials: 2.5,
  },
  memoryPressure: {
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
    targetAfterEviction: 0.7,
  },
  cleanup: {
    intervalFrames: 60,
    maxAgeMs: 30000,
  },
};

export type TextureCategory = 'texture' | 'atlas' | 'procedural';

export interface TextureEntry {
  id: string;
  url: string;
  currentLOD: TextureLOD | null;
  targetLOD: TextureLOD;
  texture: GPUTexture | null;
  size: number; // Bytes
  lastUsed: number;
  distance: number; // Distance from camera
  priority: number; // Loading priority (higher = more important)
  priorityLevel: TexturePriorityLevel; // Explicit priority level
  loading: boolean;
  /** Texture category for budget tracking */
  category: TextureCategory;
  /** Whether texture is currently visible */
  isVisible: boolean;
  /** Whether texture is marked as important */
  isImportant: boolean;
  /** Material reference (for validation) */
  materialRef?: string;
}

export interface LoadRequest {
  entry: TextureEntry;
  lod: TextureLOD;
  priority: number;
}

export interface StreamingStats {
  textureCount: number;
  loadedCount: number;
  memoryUsageMB: number;
  memoryBudgetMB: number;
  queuedLoads: number;
  activeLoads: number;
  /** Memory usage by category */
  memoryByCategory: Record<TextureCategory, number>;
  /** Textures by LOD */
  texturesByLOD: Record<TextureLOD, number>;
  /** Memory pressure level (0-1) */
  memoryPressure: number;
  /** Whether aggressive eviction is active */
  aggressiveEviction: boolean;
}

/**
 * TextureStreamingManager manages texture LOD streaming.
 */
export class TextureStreamingManager {
  private config: EnhancedStreamingConfig;
  private device: GPUDevice;
  private compressionManager?: TextureCompressionManager;
  private textures = new Map<string, TextureEntry>();
  private loadQueue: LoadRequest[] = [];
  private activeLoads = new Set<string>();
  private currentMemoryUsage = 0;
  private memoryByCategory: Record<TextureCategory, number> = {
    texture: 0,
    atlas: 0,
    procedural: 0,
  };
  private frameCount = 0;
  private aggressiveEviction = false;

  // Event callbacks
  private onMemoryWarningCallbacks: Array<() => void> = [];
  private onMemoryCriticalCallbacks: Array<() => void> = [];

  constructor(
    device: GPUDevice,
    config?: Partial<TextureStreamingConfig> | Partial<EnhancedStreamingConfig>,
    compressionManager?: TextureCompressionManager
  ) {
    this.device = device;
    this.config = { ...DEFAULT_ENHANCED_CONFIG, ...config } as EnhancedStreamingConfig;
    this.compressionManager = compressionManager;
  }

  /**
   * Updates the compression manager (called when device is recreated)
   */
  setCompressionManager(compressionManager?: TextureCompressionManager): void {
    this.compressionManager = compressionManager;
  }

  /**
   * Registers a texture for streaming.
   */
  registerTexture(
    id: string,
    url: string,
    initialDistance = Infinity,
    options?: {
      category?: TextureCategory;
      priorityLevel?: TexturePriorityLevel;
      isImportant?: boolean;
      materialRef?: string;
    }
  ): void {
    if (this.textures.has(id)) return;

    const targetLOD = this.calculateTargetLOD(initialDistance);
    const category = options?.category ?? 'texture';
    const priorityLevel = options?.priorityLevel ?? 'normal';

    const entry: TextureEntry = {
      id,
      url,
      currentLOD: null,
      targetLOD,
      texture: null,
      size: 0,
      lastUsed: this.now(),
      distance: initialDistance,
      priority: this.calculatePriority(initialDistance, targetLOD, priorityLevel),
      priorityLevel,
      loading: false,
      category,
      isVisible: false,
      isImportant: options?.isImportant ?? false,
    };
    if (options?.materialRef !== undefined) {
      entry.materialRef = options.materialRef;
    }
    this.textures.set(id, entry);
  }

  /**
   * Set visibility status for a texture (for frustum culling integration).
   */
  setTextureVisible(id: string, isVisible: boolean): void {
    const entry = this.textures.get(id);
    if (!entry) return;

    entry.isVisible = isVisible;
    
    // Recalculate priority when visibility changes
    if (isVisible) {
      entry.priority = this.calculatePriority(
        entry.distance,
        entry.targetLOD,
        entry.priorityLevel,
        true
      );
    }
  }

  /**
   * Bulk update visibility for multiple textures.
   */
  updateVisibility(visibleIds: Set<string>): void {
    for (const entry of this.textures.values()) {
      const wasVisible = entry.isVisible;
      entry.isVisible = visibleIds.has(entry.id);
      
      // Recalculate priority if visibility changed
      if (entry.isVisible !== wasVisible) {
        entry.priority = this.calculatePriority(
          entry.distance,
          entry.targetLOD,
          entry.priorityLevel,
          entry.isVisible
        );
      }
    }

    // Re-sort load queue after visibility changes
    this.loadQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Set priority level for a texture.
   */
  setPriorityLevel(id: string, level: TexturePriorityLevel): void {
    const entry = this.textures.get(id);
    if (!entry) return;

    entry.priorityLevel = level;
    entry.priority = this.calculatePriority(
      entry.distance,
      entry.targetLOD,
      level,
      entry.isVisible
    );
  }

  /**
   * Mark a texture as important (will be prioritized and protected from eviction).
   */
  setImportant(id: string, isImportant: boolean): void {
    const entry = this.textures.get(id);
    if (entry) {
      entry.isImportant = isImportant;
    }
  }

  /**
   * Updates texture distance and triggers LOD changes if needed.
   */
  updateTextureDistance(id: string, distance: number): void {
    const entry = this.textures.get(id);
    if (!entry) return;

    entry.distance = distance;
    entry.lastUsed = this.now();

    const newTargetLOD = this.calculateTargetLOD(distance);
    
    if (newTargetLOD !== entry.targetLOD) {
      entry.targetLOD = newTargetLOD;
      entry.priority = this.calculatePriority(distance, newTargetLOD);

      // Queue load if upgrading LOD
      if (this.shouldUpgradeLOD(entry.currentLOD, newTargetLOD)) {
        this.queueLoad(entry, newTargetLOD);
      }
      // Queue unload if downgrading (to free memory)
      else if (this.shouldDowngradeLOD(entry.currentLOD, newTargetLOD)) {
        this.queueUnload(entry, newTargetLOD);
      }
    }
  }

  /**
   * Gets texture for rendering.
   * Returns null if not loaded yet.
   */
  getTexture(id: string): GPUTexture | null {
    const entry = this.textures.get(id);
    if (!entry) return null;

    entry.lastUsed = this.now();
    return entry.texture;
  }

  /**
   * Updates streaming system (call once per frame).
   */
  update(): void {
    if (!this.config.enabled) return;

    this.frameCount++;

    // Process load queue
    this.processLoadQueue();

    // Check memory budget and evict if needed
    if (this.currentMemoryUsage > this.config.memoryBudgetMB * 1024 * 1024) {
      this.evictTextures();
    }

    // Periodic cleanup
    if (this.frameCount % this.config.cleanup.intervalFrames === 0) {
      this.cleanup();
    }
  }

  /**
   * Gets streaming statistics.
   */
  getStats(): StreamingStats {
    let loadedCount = 0;
    const texturesByLOD: Record<TextureLOD, number> = { low: 0, medium: 0, high: 0, ultra: 0 };
    
    for (const entry of this.textures.values()) {
      if (entry.texture) {
        loadedCount++;
        if (entry.currentLOD) {
          texturesByLOD[entry.currentLOD]++;
        }
      }
    }

    const memoryPressure = this.currentMemoryUsage / (this.config.memoryBudgetMB * 1024 * 1024);

    return {
      textureCount: this.textures.size,
      loadedCount,
      memoryUsageMB: this.currentMemoryUsage / (1024 * 1024),
      memoryBudgetMB: this.config.memoryBudgetMB,
      queuedLoads: this.loadQueue.length,
      activeLoads: this.activeLoads.size,
      memoryByCategory: { ...this.memoryByCategory },
      texturesByLOD,
      memoryPressure,
      aggressiveEviction: this.aggressiveEviction,
    };
  }

  /**
   * Get memory pressure level (0-1).
   */
  getMemoryPressure(): number {
    return this.currentMemoryUsage / (this.config.memoryBudgetMB * 1024 * 1024);
  }

  /**
   * Check if memory budget is exceeded.
   */
  isOverBudget(): boolean {
    return this.currentMemoryUsage > this.config.memoryBudgetMB * 1024 * 1024;
  }

  /**
   * Subscribe to memory warning events.
   */
  onMemoryWarning(callback: () => void): () => void {
    this.onMemoryWarningCallbacks.push(callback);
    return () => {
      const index = this.onMemoryWarningCallbacks.indexOf(callback);
      if (index >= 0) this.onMemoryWarningCallbacks.splice(index, 1);
    };
  }

  /**
   * Subscribe to memory critical events.
   */
  onMemoryCritical(callback: () => void): () => void {
    this.onMemoryCriticalCallbacks.push(callback);
    return () => {
      const index = this.onMemoryCriticalCallbacks.indexOf(callback);
      if (index >= 0) this.onMemoryCriticalCallbacks.splice(index, 1);
    };
  }

  /**
   * Reduce quality for distant objects to free memory.
   */
  reduceQuality(target: 'all' | 'distant' | 'invisible'): number {
    let reduced = 0;
    
    for (const entry of this.textures.values()) {
      if (!entry.texture || !entry.currentLOD) continue;
      
      let shouldReduce = false;
      
      switch (target) {
        case 'all':
          shouldReduce = entry.currentLOD !== 'low';
          break;
        case 'distant':
          shouldReduce = entry.distance > this.config.lodDistances.high && entry.currentLOD !== 'low';
          break;
        case 'invisible':
          shouldReduce = !entry.isVisible && entry.currentLOD !== 'low';
          break;
      }
      
      if (shouldReduce && !entry.isImportant) {
        const lowerLOD = this.getLowerLOD(entry.currentLOD);
        if (lowerLOD) {
          this.queueUnload(entry, lowerLOD);
          reduced++;
        }
      }
    }
    
    return reduced;
  }

  /**
   * Get next lower LOD level.
   */
  private getLowerLOD(lod: TextureLOD): TextureLOD | null {
    switch (lod) {
      case 'ultra': return 'high';
      case 'high': return 'medium';
      case 'medium': return 'low';
      case 'low': return null;
    }
  }

  /**
   * Disposes all textures and clears state.
   */
  dispose(): void {
    for (const entry of this.textures.values()) {
      this.destroyTexture(entry);
    }
    this.textures.clear();
    this.loadQueue = [];
    this.activeLoads.clear();
    this.currentMemoryUsage = 0;
  }

  /**
   * Calculates target LOD based on distance.
   */
  private calculateTargetLOD(distance: number): TextureLOD {
    if (distance <= this.config.lodDistances.ultra) return 'ultra';
    if (distance <= this.config.lodDistances.high) return 'high';
    if (distance <= this.config.lodDistances.medium) return 'medium';
    return 'low';
  }

  /**
   * Calculates loading priority based on distance, LOD, and other factors.
   */
  private calculatePriority(
    distance: number,
    lod: TextureLOD,
    priorityLevel: TexturePriorityLevel = 'normal',
    isVisible: boolean = false
  ): number {
    // Base priority from distance
    const distanceFactor = 1000 / (distance + 1);
    
    // LOD factor
    const lodFactor = { low: 1, medium: 2, high: 3, ultra: 4 }[lod];
    
    // Priority level multiplier
    const levelMultiplier: Record<TexturePriorityLevel, number> = {
      critical: 10,
      high: 5,
      normal: 1,
      low: 0.5,
      background: 0.1,
    };
    
    let priority = distanceFactor * lodFactor * levelMultiplier[priorityLevel];
    
    // Apply visibility multiplier
    if (isVisible) {
      priority *= this.config.priorityRules.visibleEntities;
    }
    
    // Apply near-player boost for close objects
    if (distance < this.config.lodDistances.ultra) {
      priority *= this.config.priorityRules.nearPlayer;
    }
    
    return priority;
  }

  /**
   * Checks if should upgrade LOD.
   */
  private shouldUpgradeLOD(current: TextureLOD | null, target: TextureLOD): boolean {
    if (!current) return true; // Not loaded yet
    
    const lodOrder = { low: 0, medium: 1, high: 2, ultra: 3 };
    return lodOrder[target] > lodOrder[current];
  }

  /**
   * Checks if should downgrade LOD.
   */
  private shouldDowngradeLOD(current: TextureLOD | null, target: TextureLOD): boolean {
    if (!current) return false; // Not loaded yet
    
    const lodOrder = { low: 0, medium: 1, high: 2, ultra: 3 };
    return lodOrder[target] < lodOrder[current];
  }

  /**
   * Queues texture load.
   */
  private queueLoad(entry: TextureEntry, lod: TextureLOD): void {
    // Remove existing load request for this texture
    this.loadQueue = this.loadQueue.filter((req) => req.entry.id !== entry.id);

    // Add new request
    this.loadQueue.push({
      entry,
      lod,
      priority: entry.priority,
    });

    // Sort by priority (highest first)
    this.loadQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Queues texture unload (downgrade).
   */
  private queueUnload(entry: TextureEntry, targetLOD: TextureLOD): void {
    // Destroy current texture
    this.destroyTexture(entry);
    entry.currentLOD = null;

    // Queue load of lower LOD
    this.queueLoad(entry, targetLOD);
  }

  /**
   * Processes load queue.
   */
  private processLoadQueue(): void {
    while (
      this.loadQueue.length > 0 &&
      this.activeLoads.size < this.config.maxConcurrentLoads
    ) {
      const request = this.loadQueue.shift();
      if (!request) break;

      const { entry, lod } = request;

      // Skip if already loading or already at target LOD
      if (entry.loading || entry.currentLOD === lod) continue;

      // Start load
      this.startLoad(entry, lod);
    }
  }

  /**
   * Starts async texture load.
   */
  private async startLoad(entry: TextureEntry, lod: TextureLOD): Promise<void> {
    entry.loading = true;
    this.activeLoads.add(entry.id);

    try {
      // Construct LOD-specific URL (append LOD suffix)
      const lodUrl = this.getLODUrl(entry.url, lod);

      // Load texture data
      const texture = await this.loadTextureFromURL(lodUrl, lod);

      // Check if still needed (might have changed while loading)
      if (entry.targetLOD !== lod) {
        texture.destroy();
        return;
      }

      // Destroy old texture if present
      this.destroyTexture(entry);

      // Set new texture
      entry.texture = texture;
      entry.currentLOD = lod;
      entry.size = this.estimateTextureSize(texture);
      this.currentMemoryUsage += entry.size;
      this.memoryByCategory[entry.category] += entry.size;

      Logger.debug(`Loaded texture ${entry.id} at ${lod} LOD (${(entry.size / 1024).toFixed(1)} KB)`);
    } catch (err: unknown) {
      Logger.error(`Failed to load texture ${entry.id}:`, err as Error);
    } finally {
      entry.loading = false;
      this.activeLoads.delete(entry.id);
    }
  }

  /**
   * Loads texture from URL.
   */
  private async loadTextureFromURL(url: string, lod: TextureLOD): Promise<GPUTexture> {
    // Fetch image
    const response = await fetch(url);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    // Determine format based on compression manager
    let format: GPUTextureFormat = 'rgba8unorm';
    const safeOptions: SafeTextureCreationOptions | undefined = this.compressionManager
      ? {
          compressionManager: this.compressionManager,
          type: 'color',
        }
      : undefined;

    if (this.compressionManager) {
      format = this.compressionManager.getTextureFormat();
    }

    // Create texture with compression fallback
    const texture = createTextureSafe(
      this.device,
      {
        label: `streamed-texture-${lod}`,
        size: { width: imageBitmap.width, height: imageBitmap.height },
        format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      },
      safeOptions
    );

    // Upload image data
    this.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture },
      { width: imageBitmap.width, height: imageBitmap.height }
    );

    return texture;
  }

  /**
   * Gets LOD-specific URL.
   */
  private getLODUrl(baseUrl: string, lod: TextureLOD): string {
    // Insert LOD suffix before extension
    // Example: "texture.png" -> "texture_low.png"
    const lastDot = baseUrl.lastIndexOf('.');
    if (lastDot === -1) {
      return `${baseUrl}_${lod}`;
    }
    return `${baseUrl.slice(0, lastDot)}_${lod}${baseUrl.slice(lastDot)}`;
  }

  /**
   * Estimates texture size in bytes.
   */
  private estimateTextureSize(texture: GPUTexture): number {
    const width = (texture as { width?: number }).width ?? 1;
    const height = (texture as { height?: number }).height ?? 1;
    const format = (texture as { format?: string }).format ?? 'rgba8unorm';
    
    // Simplified size calculation (4 bytes per pixel for rgba8unorm)
    const bytesPerPixel = 4;
    return width * height * bytesPerPixel;
  }

  /**
   * Evicts textures to stay within memory budget.
   */
  private evictTextures(): void {
    const entries = Array.from(this.textures.values()).filter(
      (e) => e.texture !== null && !e.isImportant
    );

    // Check memory pressure level
    const pressure = this.getMemoryPressure();
    
    if (pressure >= this.config.memoryPressure.criticalThreshold) {
      this.aggressiveEviction = true;
      for (const cb of this.onMemoryCriticalCallbacks) {
        try { cb(); } catch {}
      }
    } else if (pressure >= this.config.memoryPressure.warningThreshold) {
      for (const cb of this.onMemoryWarningCallbacks) {
        try { cb(); } catch {}
      }
    }

    // Sort by eviction strategy
    if (this.config.evictionStrategy === 'lru') {
      // Least recently used first
      entries.sort((a, b) => a.lastUsed - b.lastUsed);
    } else if (this.config.evictionStrategy === 'distance') {
      // Furthest distance first
      entries.sort((a, b) => b.distance - a.distance);
    } else {
      // Hybrid: combine LRU and distance
      entries.sort((a, b) => {
        // Invisible textures first
        if (a.isVisible !== b.isVisible) {
          return a.isVisible ? 1 : -1;
        }
        // Then by distance (further first)
        const distanceScore = (b.distance - a.distance) / 100;
        // Combined with recency (older first)
        const recencyScore = (a.lastUsed - b.lastUsed) / 10000;
        return distanceScore + recencyScore;
      });
    }

    // Target memory level
    const targetMemory = this.config.memoryBudgetMB * 1024 * 1024 * 
      this.config.memoryPressure.targetAfterEviction;
    let evicted = 0;
    let freedBytes = 0;

    for (const entry of entries) {
      if (this.currentMemoryUsage <= targetMemory) break;

      const entrySize = entry.size;
      this.destroyTexture(entry);
      entry.currentLOD = null;
      evicted++;
      freedBytes += entrySize;
    }

    if (evicted > 0) {
      Logger.info(`Evicted ${evicted} textures, freed ${(freedBytes / 1024 / 1024).toFixed(1)} MB`);
    }

    // Reset aggressive eviction flag if we're under budget
    if (this.currentMemoryUsage <= targetMemory) {
      this.aggressiveEviction = false;
    }
  }

  /**
   * Force eviction of unused textures.
   */
  evictUnused(): number {
    const now = this.now();
    const maxAge = this.config.cleanup.maxAgeMs;
    let evicted = 0;

    for (const entry of this.textures.values()) {
      if (!entry.texture) continue;
      if (entry.isImportant) continue;
      
      const age = now - entry.lastUsed;
      
      if (age > maxAge && !entry.isVisible) {
        this.destroyTexture(entry);
        entry.currentLOD = null;
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Destroys texture and updates memory usage.
   */
  private destroyTexture(entry: TextureEntry): void {
    if (!entry.texture) return;

    try {
      entry.texture.destroy();
    } catch {}

    this.currentMemoryUsage -= entry.size;
    this.memoryByCategory[entry.category] -= entry.size;
    entry.texture = null;
    entry.size = 0;
  }

  /**
   * Cleans up unused textures.
   */
  private cleanup(): void {
    const now = this.now();
    const maxAge = this.config.cleanup.maxAgeMs;

    for (const entry of this.textures.values()) {
      if (!entry.texture) continue;
      if (entry.isImportant) continue;
      
      const age = now - entry.lastUsed;
      
      // Remove very old, unused, invisible textures
      if (age > maxAge && !entry.isVisible) {
        this.destroyTexture(entry);
        entry.currentLOD = null;
      }
    }
  }

  /**
   * Gets current timestamp.
   */
  private now(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<TextureStreamingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): TextureStreamingConfig {
    return { ...this.config };
  }
}

