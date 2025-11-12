import { Logger } from '../utils/logger';
import type { Scene, Entity } from '@engine/world';
import { Entity as WorldEntity } from '@engine/world';

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
 * Asset data structure returned from API
 */
interface AssetData {
  id: string;
  name: string;
  fileUrl?: string;
  sceneJSON?: string;
  entityData?: unknown;
  [key: string]: unknown;
}

/**
 * AssetStreaming manages dynamic loading/unloading of assets based on distance
 */
export class AssetStreaming {
  private config: AssetStreamingConfig;
  private scene: Scene;
  private loadingQueue: Array<{ id: string; priority: number }> = [];
  private loadingAssets = new Set<string>();
  private loadedAssets = new Set<string>();
  /** Map of asset ID to entities created from that asset */
  private assetEntities = new Map<string, Entity[]>();

  /**
   * Create asset streaming instance
   * @param scene - Scene to add/remove entities from
   * @param config - Optional configuration
   */
  constructor(scene: Scene, config?: Partial<AssetStreamingConfig>) {
    this.scene = scene;
    this.config = {
      maxLoadDistance: 200,
      unloadDistance: 250,
      maxConcurrentLoads: 5,
      ...config,
    };
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

    // Find and remove entities associated with this asset
    const entities = this.assetEntities.get(assetId);
    if (entities) {
      for (const entity of entities) {
        // Remove entity from scene (this will also detach subtree and cleanup)
        if (entity.parent) {
          entity.removeFromParent();
        } else {
          this.scene.removeEntity(entity);
        }
        
        // Dispose entity if it has a dispose method
        // Note: Entity doesn't have dispose, but components might need cleanup
        // The scene.removeEntity should handle cleanup via detachSubtree
      }
      this.assetEntities.delete(assetId);
      Logger.debug(`[AssetStreaming] Unloaded ${entities.length} entities for asset: ${assetId}`);
    }

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
      Logger.debug(`[AssetStreaming] Loading asset: ${assetId}`);
      
      // Fetch asset data from server
      const response = await fetch(`/api/shop/assets/${assetId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Asset not found: ${assetId}`);
        }
        throw new Error(`Failed to fetch asset: ${response.statusText} (${response.status})`);
      }

      const assetData = await response.json() as AssetData;
      
      // Create entities from asset data
      const entities = await this.createEntitiesFromAsset(assetData);
      
      // Add entities to scene
      for (const entity of entities) {
        this.scene.addEntity(entity);
      }
      
      // Track entities for this asset
      this.assetEntities.set(assetId, entities);
      
      this.loadedAssets.add(assetId);
      this.loadingAssets.delete(assetId);
      
      Logger.debug(`[AssetStreaming] Loaded asset: ${assetId} (${entities.length} entities)`);
      
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
   * Create entities from asset data
   */
  private async createEntitiesFromAsset(assetData: AssetData): Promise<Entity[]> {
    const entities: Entity[] = [];

    // If asset has sceneJSON, hydrate it
    if (assetData.sceneJSON && typeof assetData.sceneJSON === 'string') {
      // Create a temporary scene to hydrate entities
      // Note: This assumes sceneJSON contains a full scene
      // For individual entities, we'd parse differently
      try {
        const tempSceneData = JSON.parse(assetData.sceneJSON);
        
        // If it's a full scene with entities array
        if (tempSceneData.entities && Array.isArray(tempSceneData.entities)) {
          for (const entityData of tempSceneData.entities) {
            try {
              const entity = WorldEntity.fromJSON(entityData);
              // Mark entity with asset ID for tracking
              entity.userData.assetId = assetData.id;
              entities.push(entity);
            } catch (err) {
              Logger.warn(`[AssetStreaming] Failed to create entity from asset ${assetData.id}:`, err);
            }
          }
        } else if (tempSceneData.entities === undefined && tempSceneData.id) {
          // Single entity data
          const entity = WorldEntity.fromJSON(tempSceneData);
          entity.userData.assetId = assetData.id;
          entities.push(entity);
        }
      } catch (err) {
        Logger.warn(`[AssetStreaming] Failed to parse sceneJSON for asset ${assetData.id}:`, err);
      }
    } else if (assetData.entityData) {
      // If asset has entityData directly
      try {
        const entity = WorldEntity.fromJSON(assetData.entityData as Parameters<typeof WorldEntity.fromJSON>[0]);
        entity.userData.assetId = assetData.id;
        entities.push(entity);
      } catch (err) {
        Logger.warn(`[AssetStreaming] Failed to create entity from entityData for asset ${assetData.id}:`, err);
      }
    } else if (assetData.fileUrl) {
      // If asset has a file URL, fetch and parse it
      try {
        const fileResponse = await fetch(assetData.fileUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch asset file: ${fileResponse.statusText}`);
        }
        
        const fileData = await fileResponse.json();
        // Try to parse as entity or scene data
        if (fileData.entities && Array.isArray(fileData.entities)) {
          for (const entityData of fileData.entities) {
            const entity = WorldEntity.fromJSON(entityData);
            entity.userData.assetId = assetData.id;
            entities.push(entity);
          }
        } else if (fileData.id) {
          const entity = WorldEntity.fromJSON(fileData);
          entity.userData.assetId = assetData.id;
          entities.push(entity);
        }
      } catch (err) {
        Logger.warn(`[AssetStreaming] Failed to load asset file for ${assetData.id}:`, err);
      }
    }

    // If no entities were created, create a placeholder entity
    if (entities.length === 0) {
      Logger.warn(`[AssetStreaming] No entities created for asset ${assetData.id}, creating placeholder`);
      const placeholder = new WorldEntity(assetData.name || `Asset_${assetData.id}`);
      placeholder.userData.assetId = assetData.id;
      entities.push(placeholder);
    }

    return entities;
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
    this.assetEntities.clear();
  }
}

