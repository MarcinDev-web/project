import { Component } from './Component';
import { registerComponent } from './registry';
import { mat4LookAt, mat4Perspective, mat4Invert, type Mat4, type Vec3 } from '@engine/core/math';
import type { Entity } from '../Entity';

const DEFAULT_FOV = (60 * Math.PI) / 180; // 60 degrees in radians
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100;

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
export class CameraComponent extends Component {
  static readonly type = 'Camera';

  /** Projection mode (currently perspective only). */
  projection: ProjectionType = 'perspective';
  /** Field of view in radians for perspective projection. */
  fov = DEFAULT_FOV;
  /** Near clipping plane distance. */
  near = DEFAULT_NEAR;
  /** Far clipping plane distance. */
  far = DEFAULT_FAR;
  /** Marks this camera as the scene's primary camera. */
  primary = false;
  /** Optional explicit look-at target; when null, entity rotation defines orientation. */
  target: Vec3 | null = [0, 0, 0];
  /** Up direction used when target mode is active. */
  up: Vec3 = [0, 1, 0];

  getType(): string {
    return CameraComponent.type;
  }

  /**
   * Computes the projection matrix for the camera.
   */
  getProjectionMatrix(out: Mat4, aspect: number): Mat4 {
    if (this.projection === 'perspective') {
      return mat4Perspective(out, this.fov, aspect, this.near, this.far);
    }
    throw new Error(`Unsupported projection type: ${this.projection}`);
  }

  /**
   * Computes the view matrix using the owning entity's transform.
   * Falls back to look-at mode if the world matrix is not invertible.
   */
  getViewMatrix(entity: Entity, out: Mat4): Mat4 {
    const transform = entity.transform;
    const position = transform.getWorldPosition();

    if (this.target) {
      return mat4LookAt(out, position, this.target, this.up);
    }

    const worldMatrix = transform.getWorldMatrix();
    try {
      return mat4Invert(out, worldMatrix);
    } catch (error) {
      const fallbackTarget: Vec3 = [position[0], position[1], position[2] - 1];
      return mat4LookAt(out, position, fallbackTarget, this.up);
    }
  }

  override clone(): CameraComponent {
    const clone = new CameraComponent();
    clone.projection = this.projection;
    clone.fov = this.fov;
    clone.near = this.near;
    clone.far = this.far;
    clone.primary = this.primary;
    clone.target = this.target ? ([...this.target] as Vec3) : null;
    clone.up = [...this.up] as Vec3;
    return clone;
  }

  override toJSON(): CameraComponentJSON {
    return {
      projection: this.projection,
      fov: this.fov,
      near: this.near,
      far: this.far,
      primary: this.primary,
      target: this.target ? ([...this.target] as Vec3) : null,
      up: [...this.up] as Vec3,
    };
  }

  fromJSON(data: CameraComponentJSON): void {
    if (data.projection) this.projection = data.projection;
    if (typeof data.fov === 'number') this.fov = data.fov;
    if (typeof data.near === 'number') this.near = data.near;
    if (typeof data.far === 'number') this.far = data.far;
    if (typeof data.primary === 'boolean') this.primary = data.primary;
    if (Array.isArray(data.up) && data.up.length === 3) {
      this.up = [...data.up] as Vec3;
    }
    if (Array.isArray(data.target) && data.target.length === 3) {
      this.target = [...data.target] as Vec3;
    } else if (data.target === null) {
      this.target = null;
    }
  }
}

registerComponent(CameraComponent.type, CameraComponent);

