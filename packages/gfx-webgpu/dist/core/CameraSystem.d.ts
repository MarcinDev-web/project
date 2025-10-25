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
import type { Mat4, Vec3 } from '@engine/core/math';
export type OrbitControlsState = {
    distance: number;
    azimuth: number;
    elevation: number;
    yaw?: number;
    pitch?: number;
    target: Vec3;
};
import type { Entity, Scene } from '@engine/world';
export interface CameraMatrices {
    projection: Mat4;
    view: Mat4;
    viewProjection: Mat4;
    eyePosition: Vec3;
}
/**
 * CameraSystem manages camera matrix calculations and updates.
 */
export declare class CameraSystem {
    private projectionMatrix;
    private viewMatrix;
    private viewProjectionMatrix;
    constructor();
    /**
     * Updates camera matrices from entity camera or orbit controls.
     * Returns matrices and eye position.
     */
    updateCamera(cameraEntity: Entity | null, scene: Scene | null, getOrbitState: () => OrbitControlsState, aspect: number): CameraMatrices;
    /**
     * Gets the current view-projection matrix (reused buffer).
     */
    getViewProjectionMatrix(): Mat4;
    /**
     * Gets the current projection matrix (reused buffer).
     */
    getProjectionMatrix(): Mat4;
    /**
     * Gets the current view matrix (reused buffer).
     */
    getViewMatrix(): Mat4;
}
//# sourceMappingURL=CameraSystem.d.ts.map