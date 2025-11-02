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
    currentMode = 'free-fly'; // Free-fly is the default editor camera
    blend = null;
    orbitControls;
    fpsCamera;
    editorCamera;
    thirdPersonCamera;
    canvas;
    scene;
    physicsWorld;
    currentFov = FOV_RADIANS;
    cameraOffset = [0, 0, 0];
    collisionRadius = 0.3;
    // Current matrices
    viewMatrix;
    projectionMatrix;
    // Scratch buffers for blend operations (to avoid allocations in hot path)
    blendScratch = {
        fromView: new Float32Array(16),
        fromProjection: new Float32Array(16),
        targetView: new Float32Array(16),
        fromWorld: new Float32Array(16),
        toWorld: new Float32Array(16),
        blendedWorld: new Float32Array(16),
        fromPos: new Float32Array(3),
        toPos: new Float32Array(3),
        blendedPos: new Float32Array(3),
        fromRot: new Float32Array(4),
        toRot: new Float32Array(4),
        blendedRot: new Float32Array(4),
    };
    // Player pose for FPS/third-person modes (injected from outside)
    playerPosition = null;
    playerForward = null;
    // Logger for debugging
    logger;
    constructor(config) {
        this.orbitControls = config.orbitControls;
        this.fpsCamera = config.fpsCamera;
        this.editorCamera = config.editorCamera;
        this.thirdPersonCamera = config.thirdPersonCamera ?? null;
        this.canvas = config.canvas;
        this.scene = config.scene ?? null;
        this.physicsWorld = config.physicsWorld ?? null;
        this.logger = config.logger ?? {
            debug: console.debug,
            warn: console.warn,
        };
        this.viewMatrix = new Float32Array(16);
        this.projectionMatrix = new Float32Array(16);
        // Initialize matrices so callers can query immediately after construction
        this.updateCameraState();
        // Enable the default camera mode (free-fly for editor)
        this.enableCameraForMode(this.currentMode);
    }
    /**
     * Set the current camera mode (instant switch, no blend)
     */
    setMode(mode) {
        if (this.currentMode === mode) {
            return;
        }
        this.logger?.debug(`Camera mode: ${this.currentMode} -> ${mode}`);
        // Disable previous mode's camera
        this.disableCameraForMode(this.currentMode, mode);
        this.currentMode = mode;
        this.blend = null;
        // Enable new mode's camera
        this.enableCameraForMode(this.currentMode);
        this.logger?.debug(`Mode switched to: ${mode}, editorCamera enabled: ${this.editorCamera?.isEnabled()}`);
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
            this.logger?.debug(`Camera instant switch: ${this.currentMode} -> ${toMode}`);
            this.currentMode = toMode;
            this.blend = null;
            this.updateCameraState();
            return;
        }
        this.logger?.debug(`Camera blend: ${this.currentMode} -> ${toMode} (${duration}s)`);
        // Capture current matrices for blending (using scratch buffers to avoid allocations)
        this.blendScratch.fromView.set(this.viewMatrix);
        this.blendScratch.fromProjection.set(this.projectionMatrix);
        // Create new blend state with copies of scratch buffers
        this.blend = {
            active: true,
            fromMode: this.currentMode,
            toMode: toMode,
            duration,
            elapsed: 0,
            fromView: new Float32Array(this.blendScratch.fromView),
            fromProjection: new Float32Array(this.blendScratch.fromProjection),
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
        // Update free-fly camera if active
        if (this.currentMode === 'free-fly') {
            if (this.editorCamera) {
                this.editorCamera.update(deltaTime);
            }
            else {
                this.logger?.warn('free-fly mode but editorCamera is null!');
            }
        }
        // Update third-person camera if active
        if (this.currentMode === 'third-person') {
            if (this.thirdPersonCamera && this.playerPosition) {
                const forward = this.playerForward ?? [0, 0, -1];
                this.thirdPersonCamera.update(this.playerPosition, forward, deltaTime);
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
            // Using scratch buffers to avoid allocations in hot path
            const duration = this.blend.duration > 0 ? this.blend.duration : 1e-6;
            const t = Math.min(this.blend.elapsed / duration, 1.0);
            const smoothT = this.smoothstep(t);
            // Compute target view matrix for the current mode (into scratch buffer)
            this.computeViewMatrix(this.currentMode, this.blendScratch.targetView);
            // Convert both views to camera world transforms (using scratch buffers)
            mat4Invert(this.blendScratch.fromWorld, this.blend.fromView);
            mat4Invert(this.blendScratch.toWorld, this.blendScratch.targetView);
            // Extract positions and rotations (into scratch buffers)
            mat4GetTranslationOut(this.blendScratch.fromPos, this.blendScratch.fromWorld);
            mat4GetTranslationOut(this.blendScratch.toPos, this.blendScratch.toWorld);
            lerpVec3Out(this.blendScratch.blendedPos, this.blendScratch.fromPos, this.blendScratch.toPos, smoothT);
            // Initialize rotations (quaternions)
            this.blendScratch.fromRot[0] = 0;
            this.blendScratch.fromRot[1] = 0;
            this.blendScratch.fromRot[2] = 0;
            this.blendScratch.fromRot[3] = 1;
            this.blendScratch.toRot[0] = 0;
            this.blendScratch.toRot[1] = 0;
            this.blendScratch.toRot[2] = 0;
            this.blendScratch.toRot[3] = 1;
            mat4GetRotationOut(this.blendScratch.fromRot, this.blendScratch.fromWorld);
            mat4GetRotationOut(this.blendScratch.toRot, this.blendScratch.toWorld);
            quatSlerpOut(this.blendScratch.blendedRot, this.blendScratch.fromRot, this.blendScratch.toRot, smoothT);
            // Recompose camera world transform, then invert to view (using scratch buffers)
            mat4FromQuatTranslation(this.blendScratch.blendedWorld, this.blendScratch.blendedRot, this.blendScratch.blendedPos);
            mat4Invert(this.viewMatrix, this.blendScratch.blendedWorld);
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
     * Set player position for FPS/third-person camera modes (legacy helper)
     */
    setPlayerPosition(position) {
        this.setPlayerPose(position);
    }
    /**
     * Set full player pose for camera modes
     */
    setPlayerPose(position, forward) {
        this.playerPosition = [...position];
        if (forward) {
            this.playerForward = this.normalizeVector(forward);
        }
    }
    /**
     * Update player forward direction independently
     */
    setPlayerForward(forward) {
        this.playerForward = this.normalizeVector(forward);
    }
    /**
     * Get player position
     */
    getPlayerPosition() {
        return this.playerPosition ? [...this.playerPosition] : null;
    }
    /**
     * Get player forward direction if available
     */
    getPlayerForward() {
        return this.playerForward ? [...this.playerForward] : null;
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
        this.playerForward = null;
        // Cleanup ALL cameras consistently
        this.orbitControls?.cleanup?.();
        this.fpsCamera?.dispose?.();
        this.editorCamera?.dispose?.();
        this.thirdPersonCamera?.dispose?.();
    }
    normalizeVector(vec) {
        const length = Math.hypot(vec[0], vec[1], vec[2]) || 1;
        return [vec[0] / length, vec[1] / length, vec[2] / length];
    }
    /**
     * Enable camera for a specific mode
     */
    enableCameraForMode(mode) {
        this.logger?.debug(`Enabling camera for mode: ${mode}`);
        switch (mode) {
            case 'orbit': {
                this.orbitControls.setEnabled(true);
                if (this.editorCamera && !this.editorCamera.isEnabled()) {
                    this.editorCamera.enable();
                    this.logger?.debug('EditorCamera enabled for orbit mode');
                }
                this.logger?.debug('Orbit controls enabled');
                break;
            }
            case 'fps': {
                // FPS camera is enabled by play mode
                if (this.fpsCamera) {
                    this.fpsCamera.enable();
                    this.logger?.debug('FPS camera enabled');
                }
                break;
            }
            case 'third-person': {
                if (this.thirdPersonCamera) {
                    this.thirdPersonCamera.enable();
                    this.logger?.debug('Third person camera enabled');
                }
                break;
            }
            case 'free-fly': {
                if (this.editorCamera) {
                    this.editorCamera.enable();
                    this.logger?.debug('EditorCamera enabled');
                }
                else {
                    this.logger?.warn('EditorCamera is null!');
                }
                this.orbitControls.setEnabled(false);
                this.logger?.debug('Orbit controls disabled');
                break;
            }
        }
    }
    /**
     * Disable camera for a specific mode
     */
    disableCameraForMode(mode, nextMode) {
        switch (mode) {
            case 'orbit':
                this.orbitControls.setEnabled(false);
                break;
            case 'fps':
                // FPS camera is disabled by play mode
                break;
            case 'third-person':
                if (this.thirdPersonCamera) {
                    this.thirdPersonCamera.disable();
                }
                break;
            case 'free-fly':
                if (nextMode === 'orbit') {
                    break;
                }
                if (this.editorCamera) {
                    this.editorCamera.disable();
                }
                break;
        }
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
                if (this.fpsCamera) {
                    let desiredCameraPosition;
                    if (this.playerPosition) {
                        desiredCameraPosition = [
                            this.playerPosition[0] + this.cameraOffset[0],
                            this.playerPosition[1] + this.cameraOffset[1],
                            this.playerPosition[2] + this.cameraOffset[2],
                        ];
                    }
                    else {
                        // Edit mode: calculate position from orbit controls
                        const { yaw, pitch, distance } = this.orbitControls.getState();
                        const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
                        const eyeY = Math.sin(pitch) * distance;
                        const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
                        desiredCameraPosition = [eyeX, eyeY, eyeZ];
                    }
                    const resolvedCameraPosition = this.resolveCameraCollision(desiredCameraPosition);
                    const eyeHeight = this.fpsCamera.getEyeHeight();
                    const basePosition = [
                        resolvedCameraPosition[0],
                        resolvedCameraPosition[1] - eyeHeight,
                        resolvedCameraPosition[2],
                    ];
                    const fpsView = this.fpsCamera.getViewMatrix(basePosition);
                    outMatrix.set(fpsView);
                }
                else {
                    // Fallback to orbit if FPS camera not available
                    this.computeViewMatrix('orbit', outMatrix);
                }
                break;
            }
            case 'third-person': {
                if (this.thirdPersonCamera && this.playerPosition) {
                    const view = this.thirdPersonCamera.getViewMatrix(this.playerPosition);
                    outMatrix.set(view);
                }
                else {
                    // Fallback to orbit if third person camera not available
                    this.computeViewMatrix('orbit', outMatrix);
                }
                break;
            }
            case 'free-fly': {
                if (this.editorCamera) {
                    const view = this.editorCamera.getViewMatrix();
                    outMatrix.set(view);
                }
                else {
                    // Fallback to orbit if editor camera not available
                    this.computeViewMatrix('orbit', outMatrix);
                }
                break;
            }
            default: {
                this.logger?.warn(`Unknown camera mode: ${mode}`);
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