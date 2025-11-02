import { Entity, type EntityId, type EntityData } from '../core/Entity';
import type { ComponentClass } from '../components/Component';
import { EventBus } from '@engine/core/event';
import type { ScriptRuntime } from '@engine/core/script';
/**
 * Scene manages a hierarchy of entities.
 * Acts as the root container for all game objects.
 */
export declare class Scene {
    /** Scene name */
    name: string;
    /** Root entities (entities without parents) */
    private _rootEntities;
    /** Fast lookup table for entities by ID */
    private _entityMap;
    /** Index of entities by component type for fast queries */
    private _componentIndex;
    /** Scene cameras indexed by entity id */
    private _cameraMap;
    /** Cached primary camera entity id */
    private _primaryCameraId;
    /** Scene-wide event bus for messaging between entities/scripts */
    readonly events: EventBus;
    /** Optional scripting runtime context injected when ScriptSystem is active */
    scriptRuntime: ScriptRuntime | null;
    private _queryCache;
    private _activeEntitiesCache;
    private _allEntitiesCache;
    private _queryCacheDirty;
    constructor(name?: string);
    /**
     * Gets all root entities (readonly).
     */
    get rootEntities(): ReadonlyArray<Entity>;
    /** Returns the primary camera entity if present. */
    get primaryCamera(): Entity | null;
    /** Returns all entities that have a camera component. */
    get cameras(): Entity[];
    /** Sets the primary camera entity. */
    setPrimaryCamera(entity: Entity | null): void;
    /**
     * Gets total number of entities in the scene (including children).
     */
    get entityCount(): number;
    /**
     * Adds a root entity to the scene.
     */
    addEntity(entity: Entity): void;
    createEntity(name: string): Entity;
    /**
     * Removes a root entity from the scene.
     */
    removeEntity(entity: Entity): boolean;
    /**
     * Removes an entity by ID.
     */
    removeEntityById(id: EntityId): boolean;
    /**
     * Finds an entity by ID.
     */
    findEntityById(id: EntityId): Entity | null;
    /**
     * Finds all entities with a given name.
     */
    findEntitiesByName(name: string): Entity[];
    /**
     * Gets all entities in the scene (flat list).
     * Uses cache to avoid allocation on every call.
     */
    getAllEntities(): Entity[];
    /**
     * Gets all active entities (flat list).
     * Uses cache to avoid allocation and filtering on every call.
     */
    getActiveEntities(): Entity[];
    /**
     * Queries entities that have all specified component types.
     * Returns all entities when no component classes are provided.
     * Uses cache to avoid recomputation on every call.
     */
    queryEntities(...componentClasses: ComponentClass[]): Entity[];
    /**
     * Traverses all entities in the scene.
     */
    traverse(callback: (entity: Entity) => boolean | void): void;
    /**
     * Clears all entities from the scene.
     */
    clear(): void;
    /**
     * Binds an entity and its subtree to this scene and registers in entity map.
     */
    attachSubtree(entity: Entity): void;
    /**
     * Unbinds an entity and its subtree from this scene and unregisters from entity map.
     */
    detachSubtree(entity: Entity): void;
    /** @internal */
    _onComponentAdded(entity: Entity, componentType: ComponentClass): void;
    /** @internal */
    _onComponentRemoved(entity: Entity, componentType: ComponentClass): void;
    /**
     * Invalidates the query cache, forcing queries to recompute.
     * Called when entities or components are added/removed.
     */
    private invalidateQueryCache;
    /**
     * Validates the query cache after batch updates.
     * Can be called to mark cache as valid after known safe state.
     */
    validateQueryCache(): void;
    private _indexComponent;
    private _unindexComponent;
    private _registerCamera;
    private _unregisterCamera;
    private _setPrimaryCamera;
    private _ensurePrimaryCamera;
    /**
     * Serializes the scene to JSON.
     */
    toJSON(): SceneData;
    /**
     * Creates a Scene from serialized data.
     */
    static fromJSON(data: SceneData): Scene;
    /**
     * Exports the scene as a JSON string.
     */
    export(): string;
    /**
     * Imports a scene from a JSON string.
     */
    static import(json: string): Scene;
}
/**
 * Serialized scene data.
 */
export interface SceneData {
    name: string;
    entities: EntityData[];
}
//# sourceMappingURL=Scene.d.ts.map