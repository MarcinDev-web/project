import { Component, type ComponentClass } from './components/Component';
import { getComponentConstructor } from './components/registry';
import { Transform } from './Transform';
import type { Scene } from './Scene';
import { MeshComponent, type MeshKind } from './components/MeshComponent';
import { MaterialComponent } from './components/MaterialComponent';
import type { RgbaColor } from '../utils/colors';
import type { MeshBounds } from './Raycaster';
import { Logger } from '../logger';

/**
 * Unique identifier for entities.
 */
export type EntityId = string;

let nextEntityId = 0;

/**
 * Generates a unique entity ID.
 */
function generateEntityId(): EntityId {
  return `entity_${nextEntityId++}`;
}

/**
 * Entity represents a game object in the scene.
 * It has a unique ID, name, transform, and can have child entities.
 */
export class Entity {
  /** Unique identifier */
  readonly id: EntityId;
  /** Human-readable name */
  name: string;
  /** Transform component (position, rotation, scale) */
  readonly transform: Transform;
  /** Arbitrary user data attached to the entity (legacy field kept for compatibility) */
  userData: Record<string, unknown> = {};
  /** Parent entity (null if root) */
  private _parent: Entity | null = null;
  /** Child entities */
  private _children: Entity[] = [];
  /** Whether this entity is active/visible */
  private _active = true;
  /** Owning scene (null if not part of a scene) */
  private _scene: Scene | null = null;
  /** Registered components keyed by their class */
  private readonly _components = new Map<ComponentClass, Component>();
  /** Custom mesh bounds for raycasting (optional, defaults to AABB from scale) */
  meshBounds: MeshBounds | null = null;

  constructor(name = 'Entity', transform?: Transform, id?: EntityId) {
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
    } else {
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
  get meshType(): MeshKind {
    const mesh = this.getComponent(MeshComponent);
    return mesh?.meshType ?? 'cube';
  }
  set meshType(value: MeshKind) {
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
  get color(): RgbaColor {
    const material = this.getComponent(MaterialComponent);
    return material?.color ?? [1, 1, 1, 1];
  }
  set color(value: RgbaColor) {
    let material = this.getComponent(MaterialComponent);
    if (!material) {
      material = new MaterialComponent();
      this.addComponent(material);
    }
    material.color = [...value] as RgbaColor;
  }

  /**
   * Gets whether this entity is active.
   */
  get active(): boolean {
    return this._active;
  }

  /**
   * Sets whether this entity is active.
   * Inactive entities are not rendered or updated.
   */
  set active(value: boolean) {
    this._active = value;
  }

  /**
   * Gets the parent entity.
   */
  get parent(): Entity | null {
    return this._parent;
  }

  /**
   * Gets the owning scene if this entity is attached to one.
   */
  get scene(): Scene | null {
    return this._scene;
  }

  /**
   * Gets all child entities (readonly).
   */
  get children(): ReadonlyArray<Entity> {
    return this._children;
  }

  /**
   * Adds a child entity to this entity.
   * Updates transform hierarchy.
   */
  addChild(child: Entity): void {
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
  removeChild(child: Entity): boolean {
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
  removeFromParent(): boolean {
    if (this._parent) {
      return this._parent.removeChild(this);
    }
    return false;
  }

  /**
   * Finds a child entity by ID.
   */
  findChildById(id: EntityId): Entity | null {
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
  findChildByName(name: string): Entity | null {
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
  getDescendants(): Entity[] {
    const result: Entity[] = [];
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
  traverse(callback: (entity: Entity) => boolean | void): void {
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
  isDescendantOf(ancestor: Entity): boolean {
    let current: Entity | null = this._parent;
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
  _bindScene(scene: Scene | null): void {
    this._scene = scene;
  }

  /**
   * Clones this entity (shallow clone - doesn't clone children).
   */
  clone(): Entity {
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
  deepClone(): Entity {
    const clone = this.clone();
    for (const child of this._children) {
      clone.addChild(child.deepClone());
    }
    return clone;
  }

  /**
   * Serializes the entity and its children to JSON.
   */
  toJSON(): EntityData {
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
  static fromJSON(data: EntityData): Entity {
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
      if (
        !data.color.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1)
      ) {
        throw new Error('Invalid entity data: color values must be numbers between 0 and 1');
      }
    }

    // Validate optional meshType field
    if (data.meshType !== undefined && typeof data.meshType !== 'string') {
      throw new Error('Invalid entity data: meshType must be a string');
    }

    // Validate optional userData field
    if (
      data.userData !== undefined &&
      (typeof data.userData !== 'object' || data.userData === null || Array.isArray(data.userData))
    ) {
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
    if (data.meshType) entity.meshType = data.meshType;
    if (data.color) entity.color = [...data.color] as RgbaColor;
    if (data.userData) entity.userData = { ...data.userData };

    // Recursively restore children with validation
    for (const childData of data.children) {
      const child = Entity.fromJSON(childData);
      entity.addChild(child);
    }

    return entity;
  }

  addComponent<T extends Component>(component: T): T {
    const type = component.constructor as ComponentClass<T>;
    if (this._components.has(type)) {
      throw new Error(`Entity already has component of type ${type.name}`);
    }
    this._components.set(type, component);
    component._attach(this);
    // Update scene component index when attached to a scene
    if (this._scene) {
      this._scene._onComponentAdded(this, type as ComponentClass);
    }
    return component;
  }

  getComponent<T extends Component>(componentClass: ComponentClass<T>): T | null {
    const component = this._components.get(componentClass);
    return (component as T | undefined) ?? null;
  }

  hasComponent<T extends Component>(componentClass: ComponentClass<T>): boolean {
    return this._components.has(componentClass);
  }

  removeComponent<T extends Component>(componentClass: ComponentClass<T>): T | null {
    const component = this._components.get(componentClass);
    if (!component) {
      return null;
    }
    this._components.delete(componentClass);
    component._detach();
    // Update scene component index when attached to a scene
    if (this._scene) {
      this._scene._onComponentRemoved(this, componentClass as ComponentClass);
    }
    return component as T;
  }

  /**
   * Returns a snapshot list of all component constructors present on this entity.
   */
  getComponentTypes(): ComponentClass[] {
    return Array.from(this._components.keys());
  }

  private serializeComponents(): Array<{ type: string; props?: Record<string, unknown> }> {
    const out: Array<{ type: string; props?: Record<string, unknown> }> = [];
    for (const [, component] of this._components.entries()) {
      // Skip built-in Transform component from ECS payload
      if (component.getType && component.getType() === Transform.type) continue;
      const ctor = component.constructor as ComponentClass;
      const typeId = ctor.type ?? ctor.name;
      const props = component.toJSON();
      if (props && typeof props === 'object' && Object.keys(props).length > 0) {
        out.push({ type: typeId, props: props as Record<string, unknown> });
      } else {
        out.push({ type: typeId });
      }
    }
    return out;
  }


  private deserializeComponents(
    components: Array<{ type: string; props?: Record<string, unknown> }>
  ): void {
    for (const { type, props } of components) {
      const ctor = getComponentConstructor(type);
      if (!ctor) {
        Logger.warn(`Unknown component type: ${type}`);
        continue;
      }
      const instance = new ctor();
      // Best-effort hydration if component exposes fromJSON on instance
      // Use unknown and guard the method existence and type
      const maybeInstance: unknown = instance;
      const maybeProps: unknown = props ?? {};
      if (
        typeof maybeInstance === 'object' &&
        maybeInstance !== null &&
        'fromJSON' in (maybeInstance as Record<string, unknown>) &&
        typeof (maybeInstance as { fromJSON?: unknown }).fromJSON === 'function'
      ) {
        try {
          (maybeInstance as { fromJSON: (data: unknown) => void }).fromJSON(maybeProps);
        } catch (err) {
          Logger.warn(`Failed to hydrate component ${type}:`, err);
        }
      }
      this.addComponent(instance);
    }
  }
}

/**
 * Serialized entity data.
 */
export interface EntityData {
  id: EntityId;
  name: string;
  active: boolean;
  // Optional ECS components payload (new format)
  components?: Array<{
    type: string;
    props?: Record<string, unknown>;
  }>;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number, number];
    scale: [number, number, number];
  };
  // Legacy fields kept optional for compatibility during transition
  meshType?: MeshKind;
  color?: RgbaColor;
  userData?: Record<string, unknown>;
  children: EntityData[];
}
