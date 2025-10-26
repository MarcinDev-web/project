import { mat4LookAt, mat4Perspective, mat4Invert, mat4FromQuatTranslation, mat4GetTranslationOut, mat4GetRotationOut, lerpVec3Out, quatSlerpOut } from '@engine/core/math';
// Default rendering config constants
const FOV_RADIANS = (2 * Math.PI) / 5;
const Z_NEAR = 0.1;
const Z_FAR = 100;
/**
 * CameraDirector manages camera modes and smooth transitions
 *
 * Responsibilities:
 * - Switch between orbit, FPS, and follow cameras
 * - Blend smoothly between camera modes
 * - Generate view and projection matrices
 * - Centralized camera state management
 */
export class CameraDirector {
    currentMode = 'orbit';
    blend = null;
    orbitControls;
    fpsCamera;
    canvas;
    scene;
    physicsWorld;
    currentFov = FOV_RADIANS;
    cameraOffset = [0, 0, 0];
    collisionRadius = 0.3;
    // Current matrices
    viewMatrix;
    projectionMatrix;
    // Player position for FPS mode (injected from outside)
    playerPosition = null;
    constructor(config) {
        this.orbitControls = config.orbitControls;
        this.fpsCamera = config.fpsCamera;
        this.canvas = config.canvas;
        this.scene = config.scene ?? null;
        this.physicsWorld = config.physicsWorld ?? null;
        this.viewMatrix = new Float32Array(16);
        this.projectionMatrix = new Float32Array(16);
        // Initialize matrices so callers can query immediately after construction
        this.updateCameraState();
    }
    /**
     * Set the current camera mode (instant switch, no blend)
     */
    setMode(mode) {
        if (this.currentMode === mode) {
            return;
        }
        console.debug(`Camera mode: ${this.currentMode} → ${mode}`);
        this.currentMode = mode;
        this.blend = null;
        this.updateCameraState();
    }
    /**
     * Blend from current mode to target mode over duration
     */
    startBlend(toMode, duration = 0.5) {
        if (this.currentMode === toMode) {
            return;
        }
        // Treat non-positive durations as an instant switch (no blend)
        if (duration <= 0) {
            console.debug(`Camera instant switch: ${this.currentMode} → ${toMode}`);
            this.currentMode = toMode;
            this.blend = null;
            this.updateCameraState();
            return;
        }
        console.debug(`Camera blend: ${this.currentMode} → ${toMode} (${duration}s)`);
        // Capture current matrices for blending
        const fromView = new Float32Array(16);
        const fromProjection = new Float32Array(16);
        fromView.set(this.viewMatrix);
        fromProjection.set(this.projectionMatrix);
        this.blend = {
            active: true,
            fromMode: this.currentMode,
            toMode: toMode,
            duration,
            elapsed: 0,
            fromView,
            fromProjection,
        };
        this.currentMode = toMode;
    }
    /**
     * Get current camera mode
     */
    getMode() {
        return this.currentMode;
    }
    /**
     * Update camera state and blending
     */
    update(deltaTime) {
        // Update blend if active
        if (this.blend) {
            this.blend.elapsed += deltaTime;
            if (this.blend.elapsed >= this.blend.duration) {
                // Blend complete
                this.blend = null;
            }
        }
        this.updateCameraState();
    }
    /**
     * Get the active view matrix
     */
    getViewMatrix() {
        if (this.blend && this.blend.active) {
            // Return blended view matrix using position/rotation decomposition
            const duration = this.blend.duration > 0 ? this.blend.duration : 1e-6;
            const t = Math.min(this.blend.elapsed / duration, 1.0);
            const smoothT = this.smoothstep(t);
            // Compute target view matrix for the current mode
            const targetView = new Float32Array(16);
            this.computeViewMatrix(this.currentMode, targetView);
            // Convert both views to camera world transforms
            const fromWorld = new Float32Array(16);
            const toWorld = new Float32Array(16);
            mat4Invert(fromWorld, this.blend.fromView);
            mat4Invert(toWorld, targetView);
            // Extract positions and rotations
            const fromPos = [0, 0, 0];
            const toPos = [0, 0, 0];
            const blendedPos = [0, 0, 0];
            mat4GetTranslationOut(fromPos, fromWorld);
            mat4GetTranslationOut(toPos, toWorld);
            lerpVec3Out(blendedPos, fromPos, toPos, smoothT);
            const fromRot = [0, 0, 0, 1];
            const toRot = [0, 0, 0, 1];
            const blendedRot = [0, 0, 0, 1];
            mat4GetRotationOut(fromRot, fromWorld);
            mat4GetRotationOut(toRot, toWorld);
            quatSlerpOut(blendedRot, fromRot, toRot, smoothT);
            // Recompose camera world transform, then invert to view
            const blendedWorld = new Float32Array(16);
            mat4FromQuatTranslation(blendedWorld, blendedRot, blendedPos);
            mat4Invert(this.viewMatrix, blendedWorld);
            return this.viewMatrix;
        }
        return this.viewMatrix;
    }
    /**
     * Get the active projection matrix
     */
    getProjectionMatrix() {
        return this.projectionMatrix;
    }
    setFov(radians) {
        if (!Number.isFinite(radians) || radians <= 0) {
            return;
        }
        this.currentFov = radians;
        this.updateCameraState();
    }
    setCameraOffset(offset) {
        this.cameraOffset = [...offset];
    }
    setCollisionRadius(radius) {
        if (radius > 0) {
            this.collisionRadius = radius;
        }
    }
    /**
     * Set player position for FPS camera mode
     */
    setPlayerPosition(position) {
        this.playerPosition = position;
    }
    /**
     * Get player position
     */
    getPlayerPosition() {
        return this.playerPosition;
    }
    /**
     * Check if currently blending
     */
    isBlending() {
        return this.blend !== null && this.blend.active;
    }
    /**
     * Dispose of resources
     */
    dispose() {
        this.blend = null;
        this.playerPosition = null;
    }
    /**
     * Update internal camera state based on current mode
     */
    updateCameraState() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const aspect = width > 0 && height > 0 ? (width / height) : 1;
        // Always update projection (same for all modes currently)
        mat4Perspective(this.projectionMatrix, this.currentFov, aspect, Z_NEAR, Z_FAR);
        // Update view matrix based on mode (if not blending)
        if (!this.blend) {
            this.computeViewMatrix(this.currentMode, this.viewMatrix);
        }
    }
    /**
     * Compute view matrix for a specific mode
     */
    computeViewMatrix(mode, outMatrix) {
        switch (mode) {
            case 'orbit': {
                const { yaw, pitch, distance } = this.orbitControls.getState();
                const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
                const eyeY = Math.sin(pitch) * distance;
                const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
                mat4LookAt(outMatrix, [eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);
                break;
            }
            case 'fps': {
                if (this.fpsCamera && this.playerPosition) {
                    const basePosition = [
                        this.playerPosition[0] + this.cameraOffset[0],
                        this.playerPosition[1] + this.cameraOffset[1],
                        this.playerPosition[2] + this.cameraOffset[2],
                    ];
                    const cameraPosition = this.resolveCameraCollision(basePosition);
                    const fpsView = this.fpsCamera.getViewMatrix(cameraPosition);
                    outMatrix.set(fpsView);
                }
                else {
                    // Fallback to orbit if FPS camera not available
                    this.computeViewMatrix('orbit', outMatrix);
                }
                break;
            }
            case 'follow': {
                // TODO: Implement third-person follow camera
                // For now, fallback to orbit
                this.computeViewMatrix('orbit', outMatrix);
                break;
            }
            default: {
                console.warn(`Unknown camera mode: ${mode}`);
                this.computeViewMatrix('orbit', outMatrix);
            }
        }
    }
    resolveCameraCollision(playerPosition) {
        if (!this.physicsWorld || !this.scene || !this.fpsCamera) {
            return playerPosition;
        }
        const eyeOffset = [playerPosition[0], playerPosition[1], playerPosition[2]];
        const forward = this.fpsCamera.getForwardDirection();
        const desiredPosition = [
            eyeOffset[0],
            eyeOffset[1],
            eyeOffset[2],
        ];
        const rayOrigin = [
            eyeOffset[0],
            eyeOffset[1],
            eyeOffset[2],
        ];
        const rayDirection = [forward[0] * -1, forward[1] * -1, forward[2] * -1];
        const hit = this.physicsWorld.raycast(rayOrigin, rayDirection, {
            maxDistance: this.collisionRadius,
            ignoreEntities: [],
        });
        if (hit && hit.distance < this.collisionRadius) {
            const penetration = this.collisionRadius - hit.distance;
            desiredPosition[0] += rayDirection[0] * penetration;
            desiredPosition[1] += rayDirection[1] * penetration;
            desiredPosition[2] += rayDirection[2] * penetration;
        }
        return desiredPosition;
    }
    /**
     * Smooth interpolation function (ease-in-out)
     */
    smoothstep(t) {
        return t * t * (3 - 2 * t);
    }
}
//# sourceMappingURL=CameraDirector.js.map