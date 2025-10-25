import { Scene } from '../../scene/Scene';
import { Entity } from '../../scene/Entity';
import { Logger } from '../../app/utils/logger';
import type { PlayManifest } from './PlayManifest';

/**
 * Manages separation between authoring and runtime worlds
 * 
 * Responsibilities:
 * - Maintain authoringWorld (editor) and runtimeWorld (gameplay) as separate scenes
 * - Create immutable snapshots of authoring world
 * - Clone authoring → runtime with component filtering
 * - Restore authoring from snapshot
 * - Prevent cross-contamination between worlds
 */
export class WorldManager {
  private authoringWorld: Scene;
  private runtimeWorld: Scene | null = null;
  private authoringSnapshot: string | null = null;

  constructor(authoringWorld: Scene) {
    this.authoringWorld = authoringWorld;
  }

  /**
   * Get the authoring world (editor scene)
   */
  getAuthoringWorld(): Scene {
    return this.authoringWorld;
  }

  /**
   * Get the runtime world (gameplay scene), if it exists
   */
  getRuntimeWorld(): Scene | null {
    return this.runtimeWorld;
  }

  /**
   * Check if runtime world exists
   */
  hasRuntimeWorld(): boolean {
    return this.runtimeWorld !== null;
  }

  /**
   * Create a snapshot of the current authoring world
   */
  snapshotAuthoring(): string {
    Logger.debug('Creating authoring world snapshot');
    this.authoringSnapshot = JSON.stringify(this.authoringWorld.toJSON());
    return this.authoringSnapshot;
  }

  /**
   * Get the current authoring snapshot
   */
  getAuthoringSnapshot(): string | null {
    return this.authoringSnapshot;
  }

  /**
   * Build runtime world from authoring world using manifest filter
   */
  buildRuntimeWorld(manifest: PlayManifest): Scene {
    if (this.runtimeWorld) {
      Logger.warn('Runtime world already exists, clearing it first');
      this.clearRuntimeWorld();
    }

    Logger.debug('Building runtime world from authoring world');

    const includeComponent = this.createRuntimeComponentPredicate(manifest);

    // Create new runtime scene
    this.runtimeWorld = new Scene(`${this.authoringWorld.name} (Runtime)`);
    
    // Clone entities from authoring to runtime with filtering
    const authoringData = this.authoringWorld.toJSON();
    
    for (const entityData of authoringData.entities) {
      try {
        const clonedEntity = this.cloneEntityForRuntime(entityData, manifest, includeComponent);
        if (clonedEntity) {
          this.runtimeWorld.addEntity(clonedEntity);
        }
      } catch (error) {
        Logger.warn(`Failed to clone entity ${entityData.name}:`, error as Error);
      }
    }
    
    Logger.debug(`Runtime world built with ${this.runtimeWorld.entityCount} entities`);
    return this.runtimeWorld;
  }

  /**
   * Restore authoring world from snapshot
   */
  restoreAuthoring(): void {
    if (!this.authoringSnapshot) {
      Logger.warn('No authoring snapshot to restore');
      return;
    }

    Logger.debug('Restoring authoring world from snapshot');
    
    try {
      const data = JSON.parse(this.authoringSnapshot);
      const restored = Scene.fromJSON(data);
      
      // Clear current authoring world and restore from snapshot
      this.authoringWorld.clear();
      restored.rootEntities.forEach((entity) => {
        this.authoringWorld.addEntity(entity);
      });
      
      Logger.debug('Authoring world restored successfully');
    } catch (error) {
      Logger.error('Failed to restore authoring world:', error as Error);
      throw error;
    }
  }

  /**
   * Clear and dispose runtime world
   */
  clearRuntimeWorld(): void {
    if (!this.runtimeWorld) {
      return;
    }

    Logger.debug('Clearing runtime world');
    
    try {
      this.runtimeWorld.clear();
      this.runtimeWorld = null;
    } catch (error) {
      Logger.warn('Error clearing runtime world:', error as Error);
      this.runtimeWorld = null;
    }
  }

  /**
   * Clear authoring snapshot
   */
  clearSnapshot(): void {
    this.authoringSnapshot = null;
  }

  /**
   * Dispose of all worlds and snapshots
   */
  dispose(): void {
    this.clearRuntimeWorld();
    this.clearSnapshot();
  }

  /**
   * Clone entity data for runtime with component filtering
   */
  private cloneEntityForRuntime(
    entityData: any,
    manifest: PlayManifest,
    includeComponent: (componentType: unknown) => boolean,
  ): Entity | null {
    // Skip entities explicitly excluded
    if (manifest.excludedEntityIds.includes(entityData.id)) {
      return null;
    }

    // Skip editor-only entities (marked by userData)
    if (entityData.userData?.editorOnly === true) {
      return null;
    }

    // Deep clone entity data
    const clonedData = JSON.parse(JSON.stringify(entityData));
    
    // Filter components based on runtime component types
    if (clonedData.components && Array.isArray(clonedData.components)) {
      clonedData.components = clonedData.components.filter((comp: any) => {
        return includeComponent(comp?.type);
      });
    }

    // Recursively clone children
    if (clonedData.children && Array.isArray(clonedData.children)) {
      clonedData.children = clonedData.children
        .map((child: any) => this.cloneEntityDataForRuntime(child, manifest, includeComponent))
        .filter((child: any) => child !== null);
    }

    // Create entity from filtered data
    try {
      return Entity.fromJSON(clonedData);
    } catch (error) {
      Logger.warn(`Failed to create runtime entity from data:`, error as Error);
      return null;
    }
  }

  /**
   * Clone entity data recursively (helper for buildRuntimeWorld)
   */
  private cloneEntityDataForRuntime(
    entityData: any,
    manifest: PlayManifest,
    includeComponent: (componentType: unknown) => boolean,
  ): any | null {
    // Skip entities explicitly excluded
    if (manifest.excludedEntityIds.includes(entityData.id)) {
      return null;
    }

    // Skip editor-only entities
    if (entityData.userData?.editorOnly === true) {
      return null;
    }

    // Deep clone
    const clonedData = JSON.parse(JSON.stringify(entityData));
    
    // Filter components
    if (clonedData.components && Array.isArray(clonedData.components)) {
      clonedData.components = clonedData.components.filter((comp: any) => {
        return includeComponent(comp?.type);
      });
    }

    // Recursively filter children
    if (clonedData.children && Array.isArray(clonedData.children)) {
      clonedData.children = clonedData.children
        .map((child: any) => this.cloneEntityDataForRuntime(child, manifest, includeComponent))
        .filter((child: any) => child !== null);
    }

    return clonedData;
  }

  private createRuntimeComponentPredicate(
    manifest: PlayManifest,
  ): (componentType: unknown) => boolean {
    const runtimeTypes = Array.isArray(manifest.runtimeComponentTypes)
      ? manifest.runtimeComponentTypes
      : [];

    const rawTypes = new Set(runtimeTypes);
    const normalizedTypes = new Set(
      runtimeTypes.map((type) => this.normalizeComponentType(type)),
    );

    return (componentType: unknown): boolean => {
      if (typeof componentType !== 'string' || componentType.length === 0) {
        return false;
      }

      if (rawTypes.has(componentType)) {
        return true;
      }

      const normalizedComponent = this.normalizeComponentType(componentType);
      return normalizedTypes.has(normalizedComponent);
    };
  }

  private normalizeComponentType(type: string): string {
    const suffix = 'Component';
    const trimmed = type.endsWith(suffix)
      ? type.slice(0, type.length - suffix.length)
      : type;
    return trimmed.toLowerCase();
  }
}

