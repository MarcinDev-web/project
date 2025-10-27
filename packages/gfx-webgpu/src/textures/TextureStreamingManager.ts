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

export type TextureLOD = 'low' | 'medium' | 'high' | 'ultra';

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
  evictionStrategy: 'lru' | 'distance'; // Eviction strategy when over budget
  preloadDistance: number; // Distance to start preloading higher LOD
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
  loading: boolean;
}

export interface LoadRequest {
  entry: TextureEntry;
  lod: TextureLOD;
  priority: number;
}

/**
 * TextureStreamingManager manages texture LOD streaming.
 */
export class TextureStreamingManager {
  private config: TextureStreamingConfig;
  private device: GPUDevice;
  private textures = new Map<string, TextureEntry>();
  private loadQueue: LoadRequest[] = [];
  private activeLoads = new Set<string>();
  private currentMemoryUsage = 0;
  private frameCount = 0;

  constructor(device: GPUDevice, config?: Partial<TextureStreamingConfig>) {
    this.device = device;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registers a texture for streaming.
   */
  registerTexture(id: string, url: string, initialDistance = Infinity): void {
    if (this.textures.has(id)) return;

    const targetLOD = this.calculateTargetLOD(initialDistance);

    this.textures.set(id, {
      id,
      url,
      currentLOD: null,
      targetLOD,
      texture: null,
      size: 0,
      lastUsed: this.now(),
      distance: initialDistance,
      priority: this.calculatePriority(initialDistance, targetLOD),
      loading: false,
    });
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

    // Periodic cleanup (every 60 frames)
    if (this.frameCount % 60 === 0) {
      this.cleanup();
    }
  }

  /**
   * Gets streaming statistics.
   */
  getStats(): {
    textureCount: number;
    loadedCount: number;
    memoryUsageMB: number;
    memoryBudgetMB: number;
    queuedLoads: number;
    activeLoads: number;
  } {
    let loadedCount = 0;
    for (const entry of this.textures.values()) {
      if (entry.texture) loadedCount++;
    }

    return {
      textureCount: this.textures.size,
      loadedCount,
      memoryUsageMB: this.currentMemoryUsage / (1024 * 1024),
      memoryBudgetMB: this.config.memoryBudgetMB,
      queuedLoads: this.loadQueue.length,
      activeLoads: this.activeLoads.size,
    };
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
   * Calculates loading priority based on distance and LOD.
   */
  private calculatePriority(distance: number, lod: TextureLOD): number {
    // Closer = higher priority
    // Higher LOD = higher priority
    const distanceFactor = 1000 / (distance + 1);
    const lodFactor = { low: 1, medium: 2, high: 3, ultra: 4 }[lod];
    return distanceFactor * lodFactor;
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

    // Create texture
    const texture = this.device.createTexture({
      label: `streamed-texture-${lod}`,
      size: { width: imageBitmap.width, height: imageBitmap.height },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

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
    const entries = Array.from(this.textures.values()).filter((e) => e.texture !== null);

    // Sort by eviction strategy
    if (this.config.evictionStrategy === 'lru') {
      // Least recently used first
      entries.sort((a, b) => a.lastUsed - b.lastUsed);
    } else {
      // Furthest distance first
      entries.sort((a, b) => b.distance - a.distance);
    }

    // Evict until under budget
    const targetMemory = this.config.memoryBudgetMB * 1024 * 1024 * 0.9; // 90% of budget
    let evicted = 0;

    for (const entry of entries) {
      if (this.currentMemoryUsage <= targetMemory) break;

      this.destroyTexture(entry);
      entry.currentLOD = null;
      evicted++;
    }

    if (evicted > 0) {
      Logger.info(`Evicted ${evicted} textures to free memory`);
    }
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
    entry.texture = null;
    entry.size = 0;
  }

  /**
   * Cleans up unused textures.
   */
  private cleanup(): void {
    const now = this.now();
    const maxAge = 30000; // 30 seconds

    for (const entry of this.textures.values()) {
      const age = now - entry.lastUsed;
      
      // Remove very old, unused textures
      if (age > maxAge && entry.texture) {
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

