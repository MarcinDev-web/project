import type { Mat4, Vec3 } from '@engine/core/math';
/**
 * FPSCamera provides first-person camera controls with pointer lock support.
 *
 * Features:
 * - Track yaw/pitch orientation using mouse movement
 * - Request/release pointer lock on demand
 * - Produce view matrix from tracked orientation and player position
 * - Expose forward/right direction vectors for movement input
 * - Camera roll (rotation around forward axis)
 * - Camera shake system (for recoil, explosions, etc.)
 * - Head bob effect (for walking/running)
 * - Collision detection (prevent camera from penetrating geometry)
 */
export declare class FPSCamera {
    private readonly canvas;
    private readonly viewMatrix;
    private readonly forward;
    private readonly right;
    private yaw;
    private pitch;
    private targetYaw;
    private targetPitch;
    private rotationSmoothing;
    private eyeHeight;
    private sensitivity;
    private pitchLimit;
    private invertY;
    private pointerLockActive;
    private pendingPointerLock;
    private pointerDownHandler;
    constructor(canvas: HTMLCanvasElement, options?: {
        eyeHeight?: number;
        sensitivity?: number;
        pitchLimit?: number;
        /** Rotation smoothing time constant in seconds (default: 0.03). Lower = more responsive, higher = smoother. */
        rotationSmoothing?: number;
        /** Roll smoothing time constant in seconds (default: 0.05). Lower = more responsive, higher = smoother. */
        rollSmoothing?: number;
        /** Enable head bob effect (default: false) */
        headBobEnabled?: boolean;
        /** Head bob intensity (default: 0.02) */
        headBobIntensity?: number;
        /** Head bob speed multiplier (default: 10.0) */
        headBobSpeed?: number;
        /** Base FOV in radians (default: ~72° = 1.2566) */
        baseFov?: number;
        /** FOV smoothing time constant in seconds (default: 0.1). Lower = more responsive, higher = smoother. */
        fovSmoothing?: number;
        /** Sprint FOV multiplier (default: 1.1 = +10%) */
        sprintMultiplier?: number;
        /** Aim FOV multiplier (default: 0.7 = -30%) */
        aimMultiplier?: number;
    });
    setSensitivity(value: number): void;
    setEyeHeight(value: number): void;
    getEyeHeight(): number;
    setPitchLimit(value: number): void;
    setInvertY(value: boolean): void;
    dispose(): void;
    enable(): void;
    disable(): void;
    setYawPitch(yaw: number, pitch: number): void;
    /**
     * Set rotation smoothing time constant in seconds
     * Lower values = more responsive but less smooth
     * Higher values = smoother but slower response
     */
    setRotationSmoothing(tau: number): void;
    /**
     * Get rotation smoothing time constant
     */
    getRotationSmoothing(): number;
    getYawPitch(): {
        yaw: number;
        pitch: number;
    };
    /** Returns the view matrix for the given player world position. */
    getViewMatrix(playerPosition: Vec3): Mat4;
    /**
     * Returns the forward direction vector.
     * Note: Returns a reference to internal array. Do not mutate.
     */
    getForwardDirection(): Readonly<Vec3>;
    /**
     * Returns the right direction vector.
     * Note: Returns a reference to internal array. Do not mutate.
     */
    getRightDirection(): Readonly<Vec3>;
    /**
     * Set camera roll angle in radians (rotation around forward axis)
     */
    setRoll(roll: number): void;
    /**
     * Get current camera roll angle in radians
     */
    getRoll(): number;
    /**
     * Set roll smoothing time constant in seconds
     */
    setRollSmoothing(tau: number): void;
    /**
     * Add a camera shake effect (e.g., for recoil or explosions)
     * @param intensity Maximum shake intensity
     * @param duration Duration in seconds
     * @param decay Decay rate (0-1, higher = faster decay, default: 0.5)
     */
    addShake(intensity: number, duration: number, decay?: number): void;
    /**
     * Clear all active camera shakes
     */
    clearShakes(): void;
    /**
     * Get number of active camera shakes
     */
    getShakeCount(): number;
    /**
     * Enable or disable head bob effect
     */
    setHeadBobEnabled(enabled: boolean): void;
    /**
     * Set head bob intensity
     */
    setHeadBobIntensity(intensity: number): void;
    /**
     * Set head bob speed multiplier
     */
    setHeadBobSpeed(speed: number): void;
    /**
     * Get current head bob offset (for debugging)
     */
    getHeadBobOffset(): Readonly<Vec3>;
    /**
     * Enable or disable collision detection
     */
    setCollisionEnabled(enabled: boolean): void;
    /**
     * Set collision radius (eye sphere radius)
     */
    setCollisionRadius(radius: number): void;
    /**
     * Get collision radius
     */
    getCollisionRadius(): number;
    /**
     * Set collision provider (null to disable)
     */
    setCollisionProvider(provider: import('./types').IFPSCameraCollisionProvider | null): void;
    /**
     * Set base FOV in radians
     */
    setBaseFov(fov: number): void;
    /**
     * Get current FOV in radians (for CameraDirector projection matrix)
     */
    getFov(): number;
    /**
     * Set FOV multiplier (1.0 = normal, >1.0 = wider, <1.0 = narrower)
     */
    setFovMultiplier(multiplier: number): void;
    /**
     * Get current FOV multiplier
     */
    getFovMultiplier(): number;
    /**
     * Set sprint FOV multiplier (default: 1.1 = +10%)
     */
    setSprintMultiplier(multiplier: number): void;
    /**
     * Get sprint FOV multiplier
     */
    getSprintMultiplier(): number;
    /**
     * Set aim FOV multiplier (default: 0.7 = -30%)
     */
    setAimMultiplier(multiplier: number): void;
    /**
     * Get aim FOV multiplier
     */
    getAimMultiplier(): number;
    /**
     * Set FOV smoothing time constant in seconds
     */
    setFovSmoothing(tau: number): void;
    /** Called once per frame to ensure pointer lock state and smooth rotation. */
    update(deltaTime?: number, playerVelocity?: Vec3): void;
    private handlePointerLockChange;
    private handlePointerLockError;
    private handlePointerDown;
    private handleMouseMove;
    private updateDirectionVectors;
}
//# sourceMappingURL=FPSCamera.d.ts.map