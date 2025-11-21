/**
 * Camera System
 *
 * Manages camera matrix calculations for both entity-based cameras
 * and fallback orbit controls.
 *
 * Responsibilities:
 * - View matrix calculation
 * - Projection matrix calculation
 * - Camera position extraction
 * - Orbit controls fallback
 */

import { mat4Perspective, mat4LookAt, mat4Multiply } from '@engine/core/math';
import type { Mat4, Vec3 } from '@engine/core/math';
import type { OrbitControlsState } from '@engine/camera';
import { CameraComponent } from '@engine/world';
import type { Entity, Scene } from '@engine/world';
import { FOV_RADIANS, Z_NEAR, Z_FAR } from '../config';

export interface CameraMatrices {
  projection: Mat4;
  view: Mat4;
  viewProjection: Mat4;
  eyePosition: Vec3;
}

/**
 * CameraSystem manages camera matrix calculations and updates.
 */
export class CameraSystem {
  private projectionMatrix: Float32Array;
  private viewMatrix: Float32Array;
  private viewProjectionMatrix: Float32Array;
  private eyePosition: Float32Array;

  constructor() {
    this.projectionMatrix = new Float32Array(16);
    this.viewMatrix = new Float32Array(16);
    this.viewProjectionMatrix = new Float32Array(16);
    this.eyePosition = new Float32Array(3);
  }

  /**
   * Updates camera matrices from entity camera or orbit controls.
   * Internal state is updated; use getters to retrieve matrices.
   */
  updateCamera(
    cameraEntity: Entity | null,
    scene: Scene | null,
    getOrbitState: () => OrbitControlsState,
    aspect: number
  ): void {
    const camera = cameraEntity ?? scene?.primaryCamera ?? null;
    const cameraComponent = camera?.getComponent(CameraComponent) ?? null;

    if (camera && cameraComponent) {
      // Use entity-based camera
      cameraComponent.getProjectionMatrix(this.projectionMatrix, aspect);
      cameraComponent.getViewMatrix(camera, this.viewMatrix);
      mat4Multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);

      const worldPos = camera.transform.getWorldPosition();
      this.eyePosition[0] = worldPos[0];
      this.eyePosition[1] = worldPos[1];
      this.eyePosition[2] = worldPos[2];
    } else {
      // Fallback to orbit controls
      const { yaw, pitch, distance } = getOrbitState();
      mat4Perspective(this.projectionMatrix, FOV_RADIANS, aspect, Z_NEAR, Z_FAR);

      const actualYaw = yaw;
      const actualPitch = pitch;
      
      this.eyePosition[0] = Math.cos(actualPitch) * Math.sin(actualYaw) * distance;
      this.eyePosition[1] = Math.sin(actualPitch) * distance;
      this.eyePosition[2] = Math.cos(actualPitch) * Math.cos(actualYaw) * distance;

      mat4LookAt(this.viewMatrix, this.eyePosition as unknown as Vec3, [0, 0, 0], [0, 1, 0]);
      mat4Multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
    }
  }

  /**
   * Gets the current view-projection matrix (reused buffer).
   */
  getViewProjectionMatrix(): Mat4 {
    return this.viewProjectionMatrix;
  }

  /**
   * Gets the current projection matrix (reused buffer).
   */
  getProjectionMatrix(): Mat4 {
    return this.projectionMatrix;
  }

  /**
   * Gets the current view matrix (reused buffer).
   */
  getViewMatrix(): Mat4 {
    return this.viewMatrix;
  }

  /**
   * Gets the current eye position (reused buffer).
   */
  getEyePosition(): Vec3 {
    return this.eyePosition as unknown as Vec3;
  }
}
