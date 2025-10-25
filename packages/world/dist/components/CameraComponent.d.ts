import { Component } from './Component';
import { type Mat4, type Vec3 } from '@engine/core/math';
import type { Entity } from '../core/Entity';
export type ProjectionType = 'perspective';
export interface CameraComponentJSON {
    projection?: ProjectionType;
    fov?: number;
    near?: number;
    far?: number;
    primary?: boolean;
    target?: Vec3 | null;
    up?: Vec3;
}
/**
 * CameraComponent defines view/projection settings for an entity.
 * The owning entity's transform provides the camera position (and orientation when no explicit target is used).
 */
export declare class CameraComponent extends Component {
    static readonly type = "Camera";
    /** Projection mode (currently perspective only). */
    projection: ProjectionType;
    /** Field of view in radians for perspective projection. */
    fov: number;
    /** Near clipping plane distance. */
    near: number;
    /** Far clipping plane distance. */
    far: number;
    /** Marks this camera as the scene's primary camera. */
    primary: boolean;
    /** Optional explicit look-at target; when null, entity rotation defines orientation. */
    target: Vec3 | null;
    /** Up direction used when target mode is active. */
    up: Vec3;
    getType(): string;
    /**
     * Computes the projection matrix for the camera.
     */
    getProjectionMatrix(out: Mat4, aspect: number): Mat4;
    /**
     * Computes the view matrix using the owning entity's transform.
     * Falls back to look-at mode if the world matrix is not invertible.
     */
    getViewMatrix(entity: Entity, out: Mat4): Mat4;
    clone(): CameraComponent;
    toJSON(): CameraComponentJSON;
    fromJSON(data: CameraComponentJSON): void;
}
//# sourceMappingURL=CameraComponent.d.ts.map