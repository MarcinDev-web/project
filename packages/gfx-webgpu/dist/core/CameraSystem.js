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
import { CameraComponent } from '../../scene/components/CameraComponent';
import { FOV_RADIANS, Z_NEAR, Z_FAR } from '../config';
/**
 * CameraSystem manages camera matrix calculations and updates.
 */
export class CameraSystem {
    projectionMatrix;
    viewMatrix;
    viewProjectionMatrix;
    constructor() {
        this.projectionMatrix = new Float32Array(16);
        this.viewMatrix = new Float32Array(16);
        this.viewProjectionMatrix = new Float32Array(16);
    }
    /**
     * Updates camera matrices from entity camera or orbit controls.
     * Returns matrices and eye position.
     */
    updateCamera(cameraEntity, scene, getOrbitState, aspect) {
        const camera = cameraEntity ?? scene?.primaryCamera ?? null;
        const cameraComponent = camera?.getComponent(CameraComponent) ?? null;
        let eyeX = 0;
        let eyeY = 0;
        let eyeZ = 0;
        if (camera && cameraComponent) {
            // Use entity-based camera
            cameraComponent.getProjectionMatrix(this.projectionMatrix, aspect);
            cameraComponent.getViewMatrix(camera, this.viewMatrix);
            mat4Multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
            const worldPos = camera.transform.getWorldPosition();
            eyeX = worldPos[0];
            eyeY = worldPos[1];
            eyeZ = worldPos[2];
        }
        else {
            // Fallback to orbit controls
            const { yaw, pitch, distance } = getOrbitState();
            mat4Perspective(this.projectionMatrix, FOV_RADIANS, aspect, Z_NEAR, Z_FAR);
            eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
            eyeY = Math.sin(pitch) * distance;
            eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
            mat4LookAt(this.viewMatrix, [eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);
            mat4Multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
        }
        return {
            projection: this.projectionMatrix,
            view: this.viewMatrix,
            viewProjection: this.viewProjectionMatrix,
            eyePosition: [eyeX, eyeY, eyeZ],
        };
    }
    /**
     * Gets the current view-projection matrix (reused buffer).
     */
    getViewProjectionMatrix() {
        return this.viewProjectionMatrix;
    }
    /**
     * Gets the current projection matrix (reused buffer).
     */
    getProjectionMatrix() {
        return this.projectionMatrix;
    }
    /**
     * Gets the current view matrix (reused buffer).
     */
    getViewMatrix() {
        return this.viewMatrix;
    }
}
//# sourceMappingURL=CameraSystem.js.map