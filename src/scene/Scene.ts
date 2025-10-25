import { Entity, type EntityId, type EntityData } from './Entity';
import type { ComponentClass } from './components/Component';
import { CameraComponent } from './components/CameraComponent';
import { Logger } from '../app/utils/logger';
import { EventBus } from '../logic/EventBus';
import type { ScriptRuntime } from '../logic/types';

/**
 * Scene manages a hierarchy of entities.
 * Acts as the root container for all game objects.
 */
export class Scene {
  /** Scene name */
  name: string;
  /** Root entities (entities without parents) */
  private _rootEntities: Entity[] = [];
  /** Fast lookup table for entities by ID */
  private _entityMap = new Map<EntityId, Entity>();
  /** Index of entities by component type for fast queries */
  private _componentIndex = new Map<ComponentClass, Set<Entity>>();
  /** Scene cameras indexed by entity id */
  private _cameraMap = new Map<EntityId, Entity>();
  /** Cached primary camera entity id */
  private _primaryCameraId: EntityId | null = null;
  /** Scene-wide event bus for messaging between entities/scripts */
  readonly events: EventBus;
  /** Optional scripting runtime context injected when ScriptSystem is active */
  scriptRuntime: ScriptRuntime | null = null;

  constructor(name = 'Scene') {
    this.name = name;
    this.events = new EventBus();
  }

  /**
   * Gets all root entities (readonly).
   */
  get rootEntities(): ReadonlyArray<Entity> {
    return this._rootEntities;
  }

  /** Returns the primary camera entity if present. */
  get primaryCamera(): Entity | null {
    if (this._primaryCameraId) {
      const entity = this._cameraMap.get(this._primaryCameraId);
      if (entity) {
        return entity;
      }
      this._primaryCameraId = null;
    }
    return null;
  }

  /** Returns all entities that have a camera component. */
  get cameras(): Entity[] {
    return Array.from(this._cameraMap.values());
  }

  /** Sets the primary camera entity. */
  setPrimaryCamera(entity: Entity | null): void {
    if (entity === null) {
      this._primaryCameraId = null;
      for (const cameraEntity of this._cameraMap.values()) {
        const cameraComponent = cameraEntity.getComponent(CameraComponent);
        if (cameraComponent) {
          cameraComponent.primary = false;
        }
      }
      this._ensurePrimaryCamera();
      return;
    }

    if (!this._cameraMap.has(entity.id)) {
      throw new Error('Primary camera must belong to the scene and have a CameraComponent');
    }

    this._setPrimaryCamera(entity);
  }

  /**
   * Gets total number of entities in the scene (including children).
   */
  get entityCount(): number {
    return this._entityMap.size;
  }

  /**
   * Adds a root entity to the scene.
   */
  addEntity(entity: Entity): void {
    if (this._entityMap.has(entity.id)) {
      Logger.warn(`Entity ${entity.id} already exists in scene`);
      return;
    }

    this._rootEntities.push(entity);
    // Bind subtree to this scene and register in entity map
    this.attachSubtree(entity);
  }

  createEntity(name: string): Entity {
    const entity = new Entity(name);
    this.addEntity(entity);
    return entity;
  }

  /**
   * Removes a root entity from the scene.
   */
  removeEntity(entity: Entity): boolean {
    const index = this._rootEntities.indexOf(entity);
    if (index === -1) {
      return false;
    }

    this._rootEntities.splice(index, 1);
    // Detach subtree first so entityMap stays in sync
    this.detachSubtree(entity);
    return true;
  }

  /**
   * Removes an entity by ID.
   */
  removeEntityById(id: EntityId): boolean {
    const entity = this._entityMap.get(id);
    if (!entity) {
      return false;
    }

    // Remove from parent if it has one
    if (entity.parent) {
      // First unlink from parent (this triggers detachSubtree via parent.removeChild)
      // Then ensure this scene's bookkeeping is updated for the subtree
      entity.removeFromParent();
      // In case parent.removeChild didn't touch this scene (defensive), detach here
      if (this._entityMap.has(entity.id)) {
        this.detachSubtree(entity);
      }
      return true;
    }

    // Otherwise remove as root entity
    return this.removeEntity(entity);
  }

  /**
   * Finds an entity by ID.
   */
  findEntityById(id: EntityId): Entity | null {
    return this._entityMap.get(id) ?? null;
  }

  /**
   * Finds all entities with a given name.
   */
  findEntitiesByName(name: string): Entity[] {
    const results: Entity[] = [];
    for (const entity of this._entityMap.values()) {
      if (entity.name === name) {
        results.push(entity);
      }
    }
    return results;
  }

  /**
   * Gets all entities in the scene (flat list).
   */
  getAllEntities(): Entity[] {
    return Array.from(this._entityMap.values());
  }

  /**
   * Gets all active entities (flat list).
   */
  getActiveEntities(): Entity[] {
    return Array.from(this._entityMap.values()).filter((e) => e.active);
  }

  /**
   * Queries entities that have all specified component types.
   * Returns all entities when no component classes are provided.
   */
  queryEntities(...componentClasses: ComponentClass[]): Entity[] {
    if (componentClasses.length === 0) return this.getAllEntities();

    const sets = componentClasses.map((cls) => this._componentIndex.get(cls));
    if (sets.some((s) => !s || s.size === 0)) return [];

    const sorted = (sets as Array<Set<Entity>>).slice().sort((a, b) => a.size - b.size);
    const smallest = sorted[0]!;

    const result: Entity[] = [];
    outer: for (const entity of smallest) {
      for (let i = 1; i < sorted.length; i++) {
        const bucket = sorted[i];
        if (!bucket || !bucket.has(entity)) continue outer;
      }
      result.push(entity);
    }
    return result;
  }

  /**
   * Traverses all entities in the scene.
   */
  traverse(callback: (entity: Entity) => boolean | void): void {
    for (const root of this._rootEntities) {
      root.traverse(callback);
    }
  }

  /**
   * Clears all entities from the scene.
   */
  clear(): void {
    for (const entity of this._rootEntities) {
      entity._bindScene(null);
    }
    this._rootEntities = [];
    this._entityMap.clear();
    this._componentIndex.clear();
    this._cameraMap.clear();
    this._primaryCameraId = null;
    this.events.clear();
    this.scriptRuntime = null;
  }

  /**
   * Binds an entity and its subtree to this scene and registers in entity map.
   */
  attachSubtree(entity: Entity): void {
    const bind = (e: Entity) => {
      e._bindScene(this);
      this._entityMap.set(e.id, e);
      // Index components present on the entity
      for (const componentType of e.getComponentTypes()) {
        this._indexComponent(e, componentType);
      }
      const cameraComponent = e.getComponent(CameraComponent);
      if (cameraComponent) {
        this._registerCamera(e, cameraComponent);
      }
    };
    bind(entity);
    for (const child of entity.children) {
      this.attachSubtree(child);
    }
    this._ensurePrimaryCamera();
  }

  /**
   * Unbinds an entity and its subtree from this scene and unregisters from entity map.
   */
  detachSubtree(entity: Entity): void {
    const unbind = (e: Entity) => {
      e._bindScene(null);
      this._entityMap.delete(e.id);
      // Remove entity from index for all its components
      for (const componentType of e.getComponentTypes()) {
        this._unindexComponent(e, componentType);
        if (componentType === CameraComponent) {
          this._cameraMap.delete(e.id);
          if (this._primaryCameraId === e.id) {
            this._primaryCameraId = null;
          }
        }
      }
    };
    unbind(entity);
    for (const child of entity.children) {
      this.detachSubtree(child);
    }
    this._ensurePrimaryCamera();
  }

  /** @internal */
  _onComponentAdded(entity: Entity, componentType: ComponentClass): void {
    this._indexComponent(entity, componentType);
    if (componentType === CameraComponent) {
      const cameraComponent = entity.getComponent(CameraComponent);
      if (cameraComponent) {
        this._registerCamera(entity, cameraComponent);
        this._ensurePrimaryCamera();
      }
    }
  }

  /** @internal */
  _onComponentRemoved(entity: Entity, componentType: ComponentClass): void {
    this._unindexComponent(entity, componentType);
    if (componentType === CameraComponent) {
      this._unregisterCamera(entity);
      this._ensurePrimaryCamera();
    }
  }

  private _indexComponent(entity: Entity, componentType: ComponentClass): void {
    let bucket = this._componentIndex.get(componentType);
    if (!bucket) {
      bucket = new Set<Entity>();
      this._componentIndex.set(componentType, bucket);
    }
    bucket.add(entity);
  }

  private _unindexComponent(entity: Entity, componentType: ComponentClass): void {
    const bucket = this._componentIndex.get(componentType);
    if (!bucket) return;
    bucket.delete(entity);
    if (bucket.size === 0) {
      this._componentIndex.delete(componentType);
    }
  }

  private _registerCamera(entity: Entity, camera: CameraComponent): void {
    this._cameraMap.set(entity.id, entity);
    if (camera.primary) {
      this._setPrimaryCamera(entity);
    }
  }

  private _unregisterCamera(entity: Entity): void {
    if (!this._cameraMap.has(entity.id)) return;
    this._cameraMap.delete(entity.id);
    if (this._primaryCameraId === entity.id) {
      this._primaryCameraId = null;
    }
  }

  private _setPrimaryCamera(entity: Entity): void {
    for (const cameraEntity of this._cameraMap.values()) {
      const component = cameraEntity.getComponent(CameraComponent);
      if (component) {
        component.primary = cameraEntity === entity;
      }
    }
    this._primaryCameraId = entity.id;
  }

  private _ensurePrimaryCamera(): void {
    if (this._primaryCameraId && this._cameraMap.has(this._primaryCameraId)) {
      return;
    }

    const cameras = Array.from(this._cameraMap.values());
    const fallback = cameras.find((entity) => {
      const camera = entity.getComponent(CameraComponent);
      return camera?.primary;
    }) ?? cameras[0] ?? null;

    if (fallback) {
      this._setPrimaryCamera(fallback);
    }
  }

  /**
   * Serializes the scene to JSON.
   */
  toJSON(): SceneData {
    return {
      name: this.name,
      entities: this._rootEntities.map((e) => e.toJSON()),
    };
  }

  /**
   * Creates a Scene from serialized data.
   */
  static fromJSON(data: SceneData): Scene {
    // Validate root data object
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid scene data: must be an object');
    }

    // Validate name field
    if (data.name === undefined || data.name === null || typeof data.name !== 'string') {
      throw new Error('Invalid scene data: name is required and must be a string');
    }

    // Validate entities array
    if (!Array.isArray(data.entities)) {
      throw new Error('Invalid scene data: entities must be an array');
    }

    // Create scene with validated data
    const scene = new Scene(data.name);

    // Deserialize entities (Entity.fromJSON will validate each entity)
    for (const entityData of data.entities) {
      try {
        const entity = Entity.fromJSON(entityData);
        scene.addEntity(entity);
      } catch (error) {
        throw new Error(
          `Failed to deserialize entity: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return scene;
  }

  /**
   * Exports the scene as a JSON string.
   */
  export(): string {
    return JSON.stringify(this.toJSON(), null, 2);
  }

  /**
   * Imports a scene from a JSON string.
   */
  static import(json: string): Scene {
    // Validate input
    if (typeof json !== 'string' || json.trim() === '') {
      throw new Error('Invalid JSON string: must be a non-empty string');
    }

    try {
      // Parse JSON
      const data = JSON.parse(json);

      // fromJSON will perform full validation
      return Scene.fromJSON(data);
    } catch (error) {
      // Provide detailed error message
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse scene JSON: ${error.message}`);
      }
      throw new Error(
        `Failed to import scene: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Serialized scene data.
 */
export interface SceneData {
  name: string;
  entities: EntityData[];
}
