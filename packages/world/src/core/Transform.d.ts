import { type Mat4, type Vec3 } from '@engine/core/math';
import { Component } from '../components/Component.js';
/**
 * Quaternion rotation [x, y, z, w]
 */
export type Quat = [number, number, number, number];
/**
 * Transform component representing position, rotation, and scale of an entity in 3D space.
 * Supports hierarchical transformations (local and world space).
 */
export declare class Transform extends Component {
    static readonly type = "Transform";
    /** Local position relative to parent */
    private _position;
    /** Local rotation as quaternion [x, y, z, w] */
    private _rotation;
    /** Local scale */
    private _scale;
    /** Cached local transformation matrix */
    private _localMatrix;
    /** Cached world transformation matrix */
    private _worldMatrix;
    /** Flag indicating if local matrix needs recalculation */
    private _localDirty;
    /** Flag indicating if world matrix needs recalculation */
    private _worldDirty;
    /** Parent transform for hierarchical transformations */
    private _parent;
    /** Child transforms linked via parent relationship */
    private _children;
    constructor(position?: Vec3, rotation?: Quat, scale?: Vec3);
    getType(): string;
    /**
     * Gets the local position (copy).
     */
    get position(): Vec3;
    /**
     * Sets the local position.
     */
    set position(value: Vec3);
    /**
     * Gets the local rotation quaternion (copy).
     */
    get rotation(): Quat;
    /**
     * Sets the local rotation quaternion (normalized).
     */
    set rotation(value: Quat);
    /**
     * Gets the local scale (copy).
     */
    get scale(): Vec3;
    /**
     * Sets the local scale.
     */
    set scale(value: Vec3);
    /**
     * Gets the parent transform.
     */
    get parent(): Transform | null;
    /**
     * Sets the parent transform and marks world matrix as dirty.
     */
    set parent(value: Transform | null);
    /**
     * Translates the transform by a delta vector.
     */
    translate(delta: Vec3): void;
    /**
     * Rotates the transform by Euler angles (radians).
     * @param axis - Rotation axis [x, y, z]
     * @param angle - Rotation angle in radians
     */
    rotate(axis: Vec3, angle: number): void;
    /**
     * Rotates the transform to look at a target position.
     * @param target - Target position in world space
     * @param up - Up vector (defaults to [0, 1, 0])
     */
    lookAt(target: Vec3, up?: Vec3): void;
    /**
     * Sets rotation from Euler angles (radians) in XYZ order.
     */
    setEulerAngles(x: number, y: number, z: number): void;
    /**
     * Scales the transform by multiplying current scale.
     */
    scaleBy(factor: Vec3): void;
    /**
     * Gets the local transformation matrix (4x4).
     */
    getLocalMatrix(): Mat4;
    /**
     * Gets the world transformation matrix (4x4).
     * Includes parent transformations if present.
     */
    getWorldMatrix(): Mat4;
    /**
     * Gets the world position by extracting it from world matrix.
     */
    getWorldPosition(): Vec3;
    /**
     * Writes world position into provided array to avoid allocations.
     */
    getWorldPositionInto(out: Vec3): Vec3;
    /**
     * Gets the forward direction vector in world space.
     */
    getForward(out?: Vec3): Vec3;
    /**
     * Gets the up direction vector in world space.
     */
    getUp(out?: Vec3): Vec3;
    /**
     * Writes the current local rotation into provided quaternion.
     */
    getRotationInto(out: Quat): Quat;
    /**
     * Writes the current local scale into provided vector.
     */
    getScaleInto(out: Vec3): Vec3;
    /**
     * Marks the local and world matrices as dirty.
     * Should be called after any transformation change.
     * Also marks parent's world matrix as dirty since children depend on it.
     */
    private markDirty;
    /**
     * Marks world matrix as dirty (called when parent changes).
     */
    markWorldDirty(): void;
    /**
     * Recalculates the local transformation matrix from position, rotation, and scale.
     */
    private updateLocalMatrix;
    /**
     * Recalculates the world transformation matrix.
     * Multiplies parent's world matrix with local matrix if parent exists.
     */
    private updateWorldMatrix;
    /**
     * Creates a copy of this transform.
     */
    clone(): Transform;
    /**
     * Serializes the transform to a plain object.
     */
    toJSON(): TransformData;
    /**
     * Creates a Transform from serialized data.
     */
    static fromJSON(data: TransformData): Transform;
}
/**
 * Serialized transform data.
 */
export interface TransformData {
    position: Vec3;
    rotation: Quat;
    scale: Vec3;
}
//# sourceMappingURL=Transform.d.ts.map