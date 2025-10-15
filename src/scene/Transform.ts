import {
  mat4FromQuatTranslationScale,
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
  mat4Multiply,
  type Mat4,
  type Vec3,
} from '../math';
import { Component } from './components/Component';

/**
 * Quaternion rotation [x, y, z, w]
 */
export type Quat = [number, number, number, number];

/**
 * Transform component representing position, rotation, and scale of an entity in 3D space.
 * Supports hierarchical transformations (local and world space).
 */
export class Transform extends Component {
  static readonly type = 'Transform';
  /** Local position relative to parent */
  private _position: Vec3 = [0, 0, 0];
  /** Local rotation as quaternion [x, y, z, w] */
  private _rotation: Quat = [0, 0, 0, 1];
  /** Local scale */
  private _scale: Vec3 = [1, 1, 1];
  /** Cached local transformation matrix */
  private _localMatrix: Mat4 = new Float32Array(16);
  /** Cached world transformation matrix */
  private _worldMatrix: Mat4 = new Float32Array(16);
  /** Flag indicating if local matrix needs recalculation */
  private _localDirty = true;
  /** Flag indicating if world matrix needs recalculation */
  private _worldDirty = true;
  /** Parent transform for hierarchical transformations */
  private _parent: Transform | null = null;
  /** Child transforms linked via parent relationship */
  private _children: Set<Transform> = new Set();

  constructor(position?: Vec3, rotation?: Quat, scale?: Vec3) {
    super();
    if (position) this._position = [...position];
    if (rotation) this._rotation = quatNormalize([...rotation]);
    if (scale) this._scale = [...scale];
  }

  getType(): string {
    return 'Transform';
  }

  /**
   * Gets the local position (copy).
   */
  get position(): Vec3 {
    return [...this._position];
  }

  /**
   * Sets the local position.
   */
  set position(value: Vec3) {
    this._position = [...value];
    this.markDirty();
  }

  /**
   * Gets the local rotation quaternion (copy).
   */
  get rotation(): Quat {
    return [...this._rotation];
  }

  /**
   * Sets the local rotation quaternion (normalized).
   */
  set rotation(value: Quat) {
    this._rotation = quatNormalize([...value]);
    this.markDirty();
  }

  /**
   * Gets the local scale (copy).
   */
  get scale(): Vec3 {
    return [...this._scale];
  }

  /**
   * Sets the local scale.
   */
  set scale(value: Vec3) {
    this._scale = [...value];
    this.markDirty();
  }

  /**
   * Gets the parent transform.
   */
  get parent(): Transform | null {
    return this._parent;
  }

  /**
   * Sets the parent transform and marks world matrix as dirty.
   */
  set parent(value: Transform | null) {
    // Detach from existing parent
    if (this._parent) {
      this._parent._children.delete(this);
    }

    this._parent = value;

    // Attach to new parent
    if (this._parent) {
      this._parent._children.add(this);
    }

    // Parent change affects this world matrix and all descendants
    this.markWorldDirty();
  }

  /**
   * Translates the transform by a delta vector.
   */
  translate(delta: Vec3): void {
    this._position[0] += delta[0];
    this._position[1] += delta[1];
    this._position[2] += delta[2];
    this.markDirty();
  }

  /**
   * Rotates the transform by Euler angles (radians).
   * @param axis - Rotation axis [x, y, z]
   * @param angle - Rotation angle in radians
   */
  rotate(axis: Vec3, angle: number): void {
    const deltaQuat = quatFromAxisAngle(axis, angle);
    this._rotation = quatMultiply(this._rotation, deltaQuat);
    this._rotation = quatNormalize(this._rotation);
    this.markDirty();
  }

  /**
   * Sets rotation from Euler angles (radians) in XYZ order.
   */
  setEulerAngles(x: number, y: number, z: number): void {
    const qx = quatFromAxisAngle([1, 0, 0], x);
    const qy = quatFromAxisAngle([0, 1, 0], y);
    const qz = quatFromAxisAngle([0, 0, 1], z);
    this._rotation = quatMultiply(quatMultiply(qx, qy), qz);
    this._rotation = quatNormalize(this._rotation);
    this.markDirty();
  }

  /**
   * Scales the transform by multiplying current scale.
   */
  scaleBy(factor: Vec3): void {
    this._scale[0] *= factor[0];
    this._scale[1] *= factor[1];
    this._scale[2] *= factor[2];
    this.markDirty();
  }

  /**
   * Gets the local transformation matrix (4x4).
   */
  getLocalMatrix(): Mat4 {
    if (this._localDirty) {
      this.updateLocalMatrix();
    }
    return this._localMatrix;
  }

  /**
   * Gets the world transformation matrix (4x4).
   * Includes parent transformations if present.
   */
  getWorldMatrix(): Mat4 {
    if (this._worldDirty) {
      this.updateWorldMatrix();
    }
    return this._worldMatrix;
  }

  /**
   * Gets the world position by extracting it from world matrix.
   */
  getWorldPosition(): Vec3 {
    const world = this.getWorldMatrix();
    return [world[12] ?? 0, world[13] ?? 0, world[14] ?? 0];
  }

  /**
   * Gets the forward direction vector in world space.
   */
  getForward(out: Vec3 = [0, 0, -1]): Vec3 {
    const world = this.getWorldMatrix();
    const x = world[8] ?? 0;
    const y = world[9] ?? 0;
    const z = world[10] ?? 0;
    const length = Math.hypot(x, y, z) || 1;
    out[0] = -x / length;
    out[1] = -y / length;
    out[2] = -z / length;
    return out;
  }

  /**
   * Gets the up direction vector in world space.
   */
  getUp(out: Vec3 = [0, 1, 0]): Vec3 {
    const world = this.getWorldMatrix();
    const x = world[4] ?? 0;
    const y = world[5] ?? 0;
    const z = world[6] ?? 0;
    const length = Math.hypot(x, y, z) || 1;
    out[0] = x / length;
    out[1] = y / length;
    out[2] = z / length;
    return out;
  }

  /**
   * Marks the local and world matrices as dirty.
   * Should be called after any transformation change.
   * Also marks parent's world matrix as dirty since children depend on it.
   */
  private markDirty(): void {
    this._localDirty = true;
    // Local change affects this and all descendants in world space
    this.markWorldDirty();
  }

  /**
   * Marks world matrix as dirty (called when parent changes).
   */
  markWorldDirty(): void {
    if (!this._worldDirty) {
      this._worldDirty = true;
    }
    // Propagate to children so their cached world matrices get recomputed lazily
    if (this._children.size > 0) {
      for (const child of this._children) {
        child.markWorldDirty();
      }
    }
  }

  /**
   * Recalculates the local transformation matrix from position, rotation, and scale.
   */
  private updateLocalMatrix(): void {
    // Compose full transform using quaternion rotation, translation and scale
    mat4FromQuatTranslationScale(this._localMatrix, this._rotation, this._position, this._scale);
    this._localDirty = false;
  }

  /**
   * Recalculates the world transformation matrix.
   * Multiplies parent's world matrix with local matrix if parent exists.
   */
  private updateWorldMatrix(): void {
    // First ensure local matrix is up to date
    if (this._localDirty) {
      this.updateLocalMatrix();
    }

    const local = this._localMatrix;

    if (this._parent) {
      const parentWorld = this._parent.getWorldMatrix();
      mat4Multiply(this._worldMatrix, parentWorld, local);
    } else {
      // No parent, world = local
      this._worldMatrix.set(local);
    }

    this._worldDirty = false;
  }

  /**
   * Creates a copy of this transform.
   */
  override clone(): Transform {
    const clone = new Transform(this._position, this._rotation, this._scale);
    clone._parent = this._parent;
    return clone;
  }

  /**
   * Serializes the transform to a plain object.
   */
  toJSON(): TransformData {
    return {
      position: [...this._position],
      rotation: [...this._rotation],
      scale: [...this._scale],
    };
  }

  /**
   * Creates a Transform from serialized data.
   */
  static fromJSON(data: TransformData): Transform {
    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid transform data: must be an object');
    }

    // Validate position
    if (!Array.isArray(data.position) || data.position.length !== 3) {
      throw new Error('Invalid transform data: position must be [x, y, z]');
    }
    if (!data.position.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error('Invalid transform data: position values must be finite numbers');
    }

    // Validate rotation (quaternion)
    if (!Array.isArray(data.rotation) || data.rotation.length !== 4) {
      throw new Error('Invalid transform data: rotation must be [x, y, z, w] quaternion');
    }
    if (!data.rotation.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error('Invalid transform data: rotation values must be finite numbers');
    }

    // Validate scale
    if (!Array.isArray(data.scale) || data.scale.length !== 3) {
      throw new Error('Invalid transform data: scale must be [x, y, z]');
    }
    if (!data.scale.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      throw new Error('Invalid transform data: scale values must be finite numbers');
    }

    return new Transform(data.position, data.rotation, data.scale);
  }
}

/**
 * Serialized transform data.
 */
export interface TransformData {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}
