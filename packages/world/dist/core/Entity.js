import { Component } from '../components/Component';
import { getComponentConstructor } from '../components/registry';
import { Transform } from '../core/Transform';
import { MeshComponent } from '../components/MeshComponent';
import { MaterialComponent } from '../components/MaterialComponent';
import { Logger } from '@engine/core/utils';
let nextEntityId = 0;
/**
 * Generates a unique entity ID.
 */
function generateEntityId() {
    return `entity_${nextEntityId++}`;
}
/**
 * Entity represents a game object in the scene.
 * It has a unique ID, name, transform, and can have child entities.
 */
export class Entity {
    /** Unique identifier */
    id;
    /** Human-readable name */
    name;
    /** Transform component (position, rotation, scale) */
    transform;
    /** Arbitrary user data attached to the entity (legacy field kept for compatibility) */
    userData = {};
    /** Parent entity (null if root) */
    _parent = null;
    /** Child entities */
    _children = [];
    /** Whether this entity is active/visible */
    _active = true;
    /** Owning scene (null if not part of a scene) */
    _scene = null;
    /** Registered components keyed by their class */
    _components = new Map();
    /** Custom mesh bounds for raycasting (optional, defaults to AABB from scale) */
    meshBounds = null;
    constructor(name = 'Entity', transform, id) {
        // If ID is provided (e.g., during deserialization), use it; otherwise generate new one
        if (id) {
            this.id = id;
            // Update global counter to avoid ID conflicts
            const idMatch = id.match(/^entity_(\d+)$/);
            if (idMatch && idMatch[1]) {
                const idNum = parseInt(idMatch[1], 10);
                if (!isNaN(idNum) && idNum >= nextEntityId) {
                    nextEntityId = idNum + 1;
                }
            }
        }
        else {
            this.id = generateEntityId();
        }
        this.name = name;
        const transformComponent = transform ?? new Transform();
        this.transform = transformComponent;
        this.addComponent(transformComponent);
    }
    /**
     * Mesh/geometry type proxying the MeshComponent. Defaults to 'cube' when no component is present.
     */
    get meshType() {
        const mesh = this.getComponent(MeshComponent);
        return mesh?.meshType ?? 'cube';
    }
    set meshType(value) {
        let mesh = this.getComponent(MeshComponent);
        if (!mesh) {
            mesh = new MeshComponent();
            this.addComponent(mesh);
        }
        mesh.meshType = value;
    }
    /**
     * Material color proxying the MaterialComponent. Defaults to [1,1,1,1] when no component is present.
     */
    get color() {
        const material = this.getComponent(MaterialComponent);
        return material?.color ?? [1, 1, 1, 1];
    }
    set color(value) {
        let material = this.getComponent(MaterialComponent);
        if (!material) {
            material = new MaterialComponent();
            this.addComponent(material);
        }
        material.color = [...value];
    }
    /**
     * Gets whether this entity is active.
     */
    get active() {
        return this._active;
    }
    /**
     * Sets whether this entity is active.
     * Inactive entities are not rendered or updated.
     */
    set active(value) {
        this._active = value;
    }
    /**
     * Gets the parent entity.
     */
    get parent() {
        return this._parent;
    }
    /**
     * Gets the owning scene if this entity is attached to one.
     */
    get scene() {
        return this._scene;
    }
    /**
     * Gets all child entities (readonly).
     */
    get children() {
        return this._children;
    }
    /**
     * Adds a child entity to this entity.
     * Updates transform hierarchy.
     */
    addChild(child) {
        if (child._parent === this) {
            return; // Already a child
        }
        // Prevent circular dependencies: cannot add an ancestor as a child
        if (this.isDescendantOf(child)) {
            throw new Error('Cannot add child: would create circular dependency');
        }
        // Remove from previous parent
        if (child._parent) {
            child._parent.removeChild(child);
        }
        child._parent = this;
        const childTransform = child.getComponent(Transform);
        if (!childTransform) {
            throw new Error('Child entity must have a Transform component');
        }
        childTransform.parent = this.transform;
        this._children.push(child);
        // If this entity is part of a scene, attach the child's subtree to the same scene
        if (this._scene) {
            this._scene.attachSubtree(child);
        }
    }
    /**
     * Removes a child entity from this entity.
     */
    removeChild(child) {
        const index = this._children.indexOf(child);
        if (index === -1) {
            return false;
        }
        // If attached to a scene, detach the child's subtree from the scene first
        if (this._scene) {
            this._scene.detachSubtree(child);
        }
        child._parent = null;
        const childTransform = child.getComponent(Transform);
        if (childTransform) {
            childTransform.parent = null;
        }
        this._children.splice(index, 1);
        return true;
    }
    /**
     * Removes this entity from its parent.
     */
    removeFromParent() {
        if (this._parent) {
            return this._parent.removeChild(this);
        }
        return false;
    }
    /**
     * Finds a child entity by ID.
     */
    findChildById(id) {
        if (this.id === id) {
            return this;
        }
        for (const child of this._children) {
            const found = child.findChildById(id);
            if (found) {
                return found;
            }
        }
        return null;
    }
    /**
     * Finds a child entity by name (first match).
     */
    findChildByName(name) {
        if (this.name === name) {
            return this;
        }
        for (const child of this._children) {
            const found = child.findChildByName(name);
            if (found) {
                return found;
            }
        }
        return null;
    }
    /**
     * Gets all descendant entities (depth-first).
     */
    getDescendants() {
        const result = [];
        for (const child of this._children) {
            result.push(child);
            result.push(...child.getDescendants());
        }
        return result;
    }
    /**
     * Traverses the entity tree and calls callback for each entity.
     * @param callback - Function to call for each entity. Return false to stop traversal.
     */
    traverse(callback) {
        if (callback(this) === false) {
            return;
        }
        for (const child of this._children) {
            child.traverse(callback);
        }
    }
    /**
     * Gets whether this entity is a descendant of another entity.
     */
    isDescendantOf(ancestor) {
        let current = this._parent;
        while (current) {
            if (current === ancestor) {
                return true;
            }
            current = current._parent;
        }
        return false;
    }
    /**
     * Internal: bind or unbind this entity to a scene; only Scene should call this.
     */
    _bindScene(scene) {
        this._scene = scene;
    }
    /**
     * Clones this entity (shallow clone - doesn't clone children).
     */
    clone() {
        const clone = new Entity(this.name, this.transform.clone());
        clone._active = this._active;
        clone.userData = { ...this.userData };
        for (const component of this._components.values()) {
            if (component instanceof Transform) {
                continue;
            }
            const cloned = component.clone();
            clone.addComponent(cloned);
        }
        return clone;
    }
    /**
     * Deep clones this entity including all children.
     */
    deepClone() {
        const clone = this.clone();
        for (const child of this._children) {
            clone.addChild(child.deepClone());
        }
        return clone;
    }
    /**
     * Serializes the entity and its children to JSON.
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            active: this._active,
            // Include legacy fields for compatibility with existing tooling/tests
            meshType: this.meshType,
            color: [...this.color],
            userData: { ...this.userData },
            components: this.serializeComponents(),
            transform: this.transform.toJSON(),
            children: this._children.map((child) => child.toJSON()),
        };
    }
    /**
     * Creates an Entity from serialized data.
     */
    static fromJSON(data) {
        // Validate root data object
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid entity data: must be an object');
        }
        // Validate required fields
        if (!data.id || typeof data.id !== 'string') {
            throw new Error('Invalid entity data: id is required and must be a string');
        }
        if (data.name === undefined || data.name === null || typeof data.name !== 'string') {
            throw new Error('Invalid entity data: name is required and must be a string');
        }
        if (typeof data.active !== 'boolean') {
            throw new Error('Invalid entity data: active must be a boolean');
        }
        // Validate transform (Transform.fromJSON will do deeper validation)
        if (!data.transform || typeof data.transform !== 'object') {
            throw new Error('Invalid entity data: transform is required');
        }
        // Validate optional color field
        if (data.color !== undefined) {
            if (!Array.isArray(data.color) || data.color.length !== 4) {
                throw new Error('Invalid entity data: color must be [r, g, b, a] with 4 values');
            }
            if (!data.color.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1)) {
                throw new Error('Invalid entity data: color values must be numbers between 0 and 1');
            }
        }
        // Validate optional meshType field
        if (data.meshType !== undefined && typeof data.meshType !== 'string') {
            throw new Error('Invalid entity data: meshType must be a string');
        }
        // Validate optional userData field
        if (data.userData !== undefined &&
            (typeof data.userData !== 'object' || data.userData === null || Array.isArray(data.userData))) {
            throw new Error('Invalid entity data: userData must be an object');
        }
        // Validate children array
        if (!Array.isArray(data.children)) {
            throw new Error('Invalid entity data: children must be an array');
        }
        // Validate components array if present
        if (data.components !== undefined && !Array.isArray(data.components)) {
            throw new Error('Invalid entity data: components must be an array');
        }
        // Create entity with validated data, passing the original ID to preserve it
        const entity = new Entity(data.name, Transform.fromJSON(data.transform), data.id);
        entity._active = data.active;
        // Restore components first when provided
        entity.deserializeComponents(data.components ?? []);
        // Restore legacy fields (or override) for compatibility
        if (data.meshType)
            entity.meshType = data.meshType;
        if (data.color)
            entity.color = [...data.color];
        if (data.userData)
            entity.userData = { ...data.userData };
        // Recursively restore children with validation
        for (const childData of data.children) {
            const child = Entity.fromJSON(childData);
            entity.addChild(child);
        }
        return entity;
    }
    addComponent(component) {
        const type = component.constructor;
        if (this._components.has(type)) {
            throw new Error(`Entity already has component of type ${type.name}`);
        }
        this._components.set(type, component);
        component._attach(this);
        // Update scene component index when attached to a scene
        if (this._scene) {
            this._scene._onComponentAdded(this, type);
        }
        return component;
    }
    getComponent(componentClass) {
        const component = this._components.get(componentClass);
        return component ?? null;
    }
    hasComponent(componentClass) {
        return this._components.has(componentClass);
    }
    removeComponent(componentClass) {
        const component = this._components.get(componentClass);
        if (!component) {
            return null;
        }
        this._components.delete(componentClass);
        component._detach();
        // Update scene component index when attached to a scene
        if (this._scene) {
            this._scene._onComponentRemoved(this, componentClass);
        }
        return component;
    }
    /**
     * Returns a snapshot list of all component constructors present on this entity.
     */
    getComponentTypes() {
        return Array.from(this._components.keys());
    }
    serializeComponents() {
        const out = [];
        for (const [, component] of this._components.entries()) {
            // Skip built-in Transform component from ECS payload
            if (component.getType && component.getType() === Transform.type)
                continue;
            const ctor = component.constructor;
            const typeId = ctor.type ?? ctor.name;
            const props = component.toJSON();
            if (props && typeof props === 'object' && Object.keys(props).length > 0) {
                out.push({ type: typeId, props: props });
            }
            else {
                out.push({ type: typeId });
            }
        }
        return out;
    }
    deserializeComponents(components) {
        for (const { type, props } of components) {
            const ctor = getComponentConstructor(type);
            if (!ctor) {
                Logger.warn(`Unknown component type: ${type}`);
                continue;
            }
            const instance = new ctor();
            // Best-effort hydration if component exposes fromJSON on instance
            // Use unknown and guard the method existence and type
            const maybeInstance = instance;
            const maybeProps = props ?? {};
            if (typeof maybeInstance === 'object' &&
                maybeInstance !== null &&
                'fromJSON' in maybeInstance &&
                typeof maybeInstance.fromJSON === 'function') {
                try {
                    maybeInstance.fromJSON(maybeProps);
                }
                catch (err) {
                    Logger.warn(`Failed to hydrate component ${type}:`, err);
                }
            }
            this.addComponent(instance);
        }
    }
}
//# sourceMappingURL=Entity.js.map