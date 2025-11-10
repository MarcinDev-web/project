import { Logger } from '../utils/logger';

/**
 * Asset streaming configuration
 */
export interface AssetStreamingConfig {
  /** Maximum distance to load assets */
  maxLoadDistance: number;
  /** Distance to unload assets */
  unloadDistance: number;
  /** Maximum concurrent asset loads */
  maxConcurrentLoads: number;
}

/**
 * AssetStreaming manages dynamic loading/unloading of assets based on distance
 */
export class AssetStreaming {
  private config: AssetStreamingConfig = {
    maxLoadDistance: 200,
    unloadDistance: 250,
    maxConcurrentLoads: 5,
  };
  
  private loadingQueue: Array<{ id: string; priority: number }> = [];
  private loadingAssets = new Set<string>();
  private loadedAssets = new Set<string>();

  /**
   * Initialize asset streaming
   */
  initialize(config?: Partial<AssetStreamingConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    Logger.debug('[AssetStreaming] Initialized');
  }

  /**
   * Request asset to be loaded
   */
  requestAsset(assetId: string, priority: number = 0): void {
    if (this.loadedAssets.has(assetId) || this.loadingAssets.has(assetId)) {
      return; // Already loaded or loading
    }

    // Add to queue
    this.loadingQueue.push({ id: assetId, priority });
    this.loadingQueue.sort((a, b) => b.priority - a.priority); // Sort by priority
    
    // Process queue
    this.processQueue();
  }

  /**
   * Unload asset
   */
  unloadAsset(assetId: string): void {
    if (!this.loadedAssets.has(assetId)) {
      return; // Not loaded
    }

    // TODO: Actually unload asset from memory
    this.loadedAssets.delete(assetId);
    Logger.debug(`[AssetStreaming] Unloaded asset: ${assetId}`);
  }

  /**
   * Check if asset is loaded
   */
  isAssetLoaded(assetId: string): boolean {
    return this.loadedAssets.has(assetId);
  }

  /**
   * Check if asset is loading
   */
  isAssetLoading(assetId: string): boolean {
    return this.loadingAssets.has(assetId);
  }

  /**
   * Process loading queue
   */
  private processQueue(): void {
    while (
      this.loadingQueue.length > 0 &&
      this.loadingAssets.size < this.config.maxConcurrentLoads
    ) {
      const item = this.loadingQueue.shift();
      if (!item) {
        break;
      }

      this.loadingAssets.add(item.id);
      void this.loadAsset(item.id);
    }
  }

  /**
   * Load asset (async)
   */
  private async loadAsset(assetId: string): Promise<void> {
    try {
      // TODO: Actually load asset from server/storage
      Logger.debug(`[AssetStreaming] Loading asset: ${assetId}`);
      
      // Simulate loading
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      this.loadedAssets.add(assetId);
      this.loadingAssets.delete(assetId);
      
      Logger.debug(`[AssetStreaming] Loaded asset: ${assetId}`);
      
      // Process next item in queue
      this.processQueue();
    } catch (error) {
      Logger.error(`[AssetStreaming] Failed to load asset ${assetId}:`, error as unknown as Error);
      this.loadingAssets.delete(assetId);
      
      // Process next item in queue
      this.processQueue();
    }
  }

  /**
   * Update - call periodically to manage asset loading based on distance
   */
  update(playerPosition: [number, number, number], assetPositions: Map<string, [number, number, number]>): void {
    for (const [assetId, position] of assetPositions) {
      const distance = this.calculateDistance(playerPosition, position);
      
      if (distance <= this.config.maxLoadDistance && !this.isAssetLoaded(assetId) && !this.isAssetLoading(assetId)) {
        // Request load
        const priority = this.config.maxLoadDistance - distance; // Closer = higher priority
        this.requestAsset(assetId, priority);
      } else if (distance > this.config.unloadDistance && this.isAssetLoaded(assetId)) {
        // Unload
        this.unloadAsset(assetId);
      }
    }
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(a: [number, number, number], b: [number, number, number]): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Unload all assets
    for (const assetId of this.loadedAssets) {
      this.unloadAsset(assetId);
    }
    
    this.loadingQueue = [];
    this.loadingAssets.clear();
    this.loadedAssets.clear();
  }
}

