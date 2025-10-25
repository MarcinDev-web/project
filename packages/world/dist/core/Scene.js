import { Entity } from '../core/Entity';
import { CameraComponent } from '../components/CameraComponent';
import { Logger } from '@engine/core/utils';
import { EventBus } from '@engine/core/event';
/**
 * Scene manages a hierarchy of entities.
 * Acts as the root container for all game objects.
 */
export class Scene {
    /** Scene name */
    name;
    /** Root entities (entities without parents) */
    _rootEntities = [];
    /** Fast lookup table for entities by ID */
    _entityMap = new Map();
    /** Index of entities by component type for fast queries */
    _componentIndex = new Map();
    /** Scene cameras indexed by entity id */
    _cameraMap = new Map();
    /** Cached primary camera entity id */
    _primaryCameraId = null;
    /** Scene-wide event bus for messaging between entities/scripts */
    events;
    /** Optional scripting runtime context injected when ScriptSystem is active */
    scriptRuntime = null;
    constructor(name = 'Scene') {
        this.name = name;
        this.events = new EventBus();
    }
    /**
     * Gets all root entities (readonly).
     */
    get rootEntities() {
        return this._rootEntities;
    }
    /** Returns the primary camera entity if present. */
    get primaryCamera() {
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
    get cameras() {
        return Array.from(this._cameraMap.values());
    }
    /** Sets the primary camera entity. */
    setPrimaryCamera(entity) {
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
    get entityCount() {
        return this._entityMap.size;
    }
    /**
     * Adds a root entity to the scene.
     */
    addEntity(entity) {
        if (this._entityMap.has(entity.id)) {
            Logger.warn(`Entity ${entity.id} already exists in scene`);
            return;
        }
        this._rootEntities.push(entity);
        // Bind subtree to this scene and register in entity map
        this.attachSubtree(entity);
    }
    createEntity(name) {
        const entity = new Entity(name);
        this.addEntity(entity);
        return entity;
    }
    /**
     * Removes a root entity from the scene.
     */
    removeEntity(entity) {
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
    removeEntityById(id) {
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
    findEntityById(id) {
        return this._entityMap.get(id) ?? null;
    }
    /**
     * Finds all entities with a given name.
     */
    findEntitiesByName(name) {
        const results = [];
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
    getAllEntities() {
        return Array.from(this._entityMap.values());
    }
    /**
     * Gets all active entities (flat list).
     */
    getActiveEntities() {
        return Array.from(this._entityMap.values()).filter((e) => e.active);
    }
    /**
     * Queries entities that have all specified component types.
     * Returns all entities when no component classes are provided.
     */
    queryEntities(...componentClasses) {
        if (componentClasses.length === 0)
            return this.getAllEntities();
        const sets = componentClasses.map((cls) => this._componentIndex.get(cls));
        if (sets.some((s) => !s || s.size === 0))
            return [];
        const sorted = sets.slice().sort((a, b) => a.size - b.size);
        const smallest = sorted[0];
        const result = [];
        outer: for (const entity of smallest) {
            for (let i = 1; i < sorted.length; i++) {
                const bucket = sorted[i];
                if (!bucket || !bucket.has(entity))
                    continue outer;
            }
            result.push(entity);
        }
        return result;
    }
    /**
     * Traverses all entities in the scene.
     */
    traverse(callback) {
        for (const root of this._rootEntities) {
            root.traverse(callback);
        }
    }
    /**
     * Clears all entities from the scene.
     */
    clear() {
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
    attachSubtree(entity) {
        const bind = (e) => {
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
    detachSubtree(entity) {
        const unbind = (e) => {
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
    _onComponentAdded(entity, componentType) {
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
    _onComponentRemoved(entity, componentType) {
        this._unindexComponent(entity, componentType);
        if (componentType === CameraComponent) {
            this._unregisterCamera(entity);
            this._ensurePrimaryCamera();
        }
    }
    _indexComponent(entity, componentType) {
        let bucket = this._componentIndex.get(componentType);
        if (!bucket) {
            bucket = new Set();
            this._componentIndex.set(componentType, bucket);
        }
        bucket.add(entity);
    }
    _unindexComponent(entity, componentType) {
        const bucket = this._componentIndex.get(componentType);
        if (!bucket)
            return;
        bucket.delete(entity);
        if (bucket.size === 0) {
            this._componentIndex.delete(componentType);
        }
    }
    _registerCamera(entity, camera) {
        this._cameraMap.set(entity.id, entity);
        if (camera.primary) {
            this._setPrimaryCamera(entity);
        }
    }
    _unregisterCamera(entity) {
        if (!this._cameraMap.has(entity.id))
            return;
        this._cameraMap.delete(entity.id);
        if (this._primaryCameraId === entity.id) {
            this._primaryCameraId = null;
        }
    }
    _setPrimaryCamera(entity) {
        for (const cameraEntity of this._cameraMap.values()) {
            const component = cameraEntity.getComponent(CameraComponent);
            if (component) {
                component.primary = cameraEntity === entity;
            }
        }
        this._primaryCameraId = entity.id;
    }
    _ensurePrimaryCamera() {
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
    toJSON() {
        return {
            name: this.name,
            entities: this._rootEntities.map((e) => e.toJSON()),
        };
    }
    /**
     * Creates a Scene from serialized data.
     */
    static fromJSON(data) {
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
            }
            catch (error) {
                throw new Error(`Failed to deserialize entity: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return scene;
    }
    /**
     * Exports the scene as a JSON string.
     */
    export() {
        return JSON.stringify(this.toJSON(), null, 2);
    }
    /**
     * Imports a scene from a JSON string.
     */
    static import(json) {
        // Validate input
        if (typeof json !== 'string' || json.trim() === '') {
            throw new Error('Invalid JSON string: must be a non-empty string');
        }
        try {
            // Parse JSON
            const data = JSON.parse(json);
            // fromJSON will perform full validation
            return Scene.fromJSON(data);
        }
        catch (error) {
            // Provide detailed error message
            if (error instanceof SyntaxError) {
                throw new Error(`Failed to parse scene JSON: ${error.message}`);
            }
            throw new Error(`Failed to import scene: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
//# sourceMappingURL=Scene.js.map