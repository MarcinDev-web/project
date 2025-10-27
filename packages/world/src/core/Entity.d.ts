import { Component, type ComponentClass } from '../components/Component';
import { Transform } from '../core/Transform';
import type { Scene } from '../core/Scene';
import { type MeshKind } from '../components/MeshComponent';
import type { RgbaColor } from '../utils/colors';
import type { MeshBounds } from '../systems/Raycaster';
/**
 * Unique identifier for entities.
 */
export type EntityId = string;
/**
 * Entity represents a game object in the scene.
 * It has a unique ID, name, transform, and can have child entities.
 */
export declare class Entity {
    /** Unique identifier */
    readonly id: EntityId;
    /** Human-readable name */
    name: string;
    /** Transform component (position, rotation, scale) */
    readonly transform: Transform;
    /** Arbitrary user data attached to the entity (legacy field kept for compatibility) */
    userData: Record<string, unknown>;
    /** Parent entity (null if root) */
    private _parent;
    /** Child entities */
    private _children;
    /** Whether this entity is active/visible */
    private _active;
    /** Owning scene (null if not part of a scene) */
    private _scene;
    /** Registered components keyed by their class */
    private readonly _components;
    /** Custom mesh bounds for raycasting (optional, defaults to AABB from scale) */
    meshBounds: MeshBounds | null;
    constructor(name?: string, transform?: Transform, id?: EntityId);
    /**
     * Mesh/geometry type proxying the MeshComponent. Defaults to 'cube' when no component is present.
     */
    get meshType(): MeshKind;
    set meshType(value: MeshKind);
    /**
     * Material color proxying the MaterialComponent. Defaults to [1,1,1,1] when no component is present.
     */
    get color(): RgbaColor;
    set color(value: RgbaColor);
    /**
     * Gets whether this entity is active.
     */
    get active(): boolean;
    /**
     * Sets whether this entity is active.
     * Inactive entities are not rendered or updated.
     */
    set active(value: boolean);
    /**
     * Gets the parent entity.
     */
    get parent(): Entity | null;
    /**
     * Gets the owning scene if this entity is attached to one.
     */
    get scene(): Scene | null;
    /**
     * Gets all child entities (readonly).
     */
    get children(): ReadonlyArray<Entity>;
    /**
     * Adds a child entity to this entity.
     * Updates transform hierarchy.
     */
    addChild(child: Entity): void;
    /**
     * Removes a child entity from this entity.
     */
    removeChild(child: Entity): boolean;
    /**
     * Removes this entity from its parent.
     */
    removeFromParent(): boolean;
    /**
     * Finds a child entity by ID.
     */
    findChildById(id: EntityId): Entity | null;
    /**
     * Finds a child entity by name (first match).
     */
    findChildByName(name: string): Entity | null;
    /**
     * Gets all descendant entities (depth-first).
     */
    getDescendants(): Entity[];
    /**
     * Traverses the entity tree and calls callback for each entity.
     * @param callback - Function to call for each entity. Return false to stop traversal.
     */
    traverse(callback: (entity: Entity) => boolean | void): void;
    /**
     * Gets whether this entity is a descendant of another entity.
     */
    isDescendantOf(ancestor: Entity): boolean;
    /**
     * Internal: bind or unbind this entity to a scene; only Scene should call this.
     */
    _bindScene(scene: Scene | null): void;
    /**
     * Clones this entity (shallow clone - doesn't clone children).
     */
    clone(): Entity;
    /**
     * Deep clones this entity including all children.
     */
    deepClone(): Entity;
    /**
     * Serializes the entity and its children to JSON.
     */
    toJSON(): EntityData;
    /**
     * Creates an Entity from serialized data.
     */
    static fromJSON(data: EntityData): Entity;
    addComponent<T extends Component>(component: T): T;
    getComponent<T extends Component>(componentClass: ComponentClass<T>): T | null;
    hasComponent<T extends Component>(componentClass: ComponentClass<T>): boolean;
    removeComponent<T extends Component>(componentClass: ComponentClass<T>): T | null;
    /**
     * Returns a snapshot list of all component constructors present on this entity.
     */
    getComponentTypes(): ComponentClass[];
    private serializeComponents;
    private deserializeComponents;
}
/**
 * Serialized entity data.
 */
export interface EntityData {
    id: EntityId;
    name: string;
    active: boolean;
    components?: Array<{
        type: string;
        props?: Record<string, unknown>;
    }>;
    transform: {
        position: [number, number, number];
        rotation: [number, number, number, number];
        scale: [number, number, number];
    };
    meshType?: MeshKind;
    color?: RgbaColor;
    userData?: Record<string, unknown>;
    children: EntityData[];
}
//# sourceMappingURL=Entity.d.ts.map