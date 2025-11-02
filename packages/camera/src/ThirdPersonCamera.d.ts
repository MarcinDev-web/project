import type { Vec3, Mat4 } from '@engine/core/math';
import type { PhysicsWorld } from '@engine/world';
/**
 * Configuration for ThirdPersonCamera
 */
export interface ThirdPersonCameraConfig {
    /** Distance behind player (default: 3.5) */
    distance?: number;
    /** Height above player pivot (default: 1.2) */
    height?: number;
    /** Right offset for over-shoulder view (default: 0.6) */
    shoulderOffset?: number;
    /** Position lerp speed (default: 5.0) */
    followSpeed?: number;
    /** Auto-rotation speed toward player forward (default: 3.0) */
    rotationSpeed?: number;
    /** Sphere cast radius for collision detection (default: 0.3) */
    collisionRadius?: number;
    /** Pitch range in degrees [min, max] (default: [-30, 60]) */
    pitchRange?: [number, number];
    /** Mouse sensitivity for manual orbit (default: 0.003) */
    mouseSensitivity?: number;
    /** Enable auto-rotation (default: true) */
    enableAutoRotation?: boolean;
    /** Rotation smoothing time constant in seconds (default: 0.04). Lower = more responsive, higher = smoother. */
    rotationSmoothing?: number;
}
/**
 * ThirdPersonCamera provides over-the-shoulder camera controls for gameplay.
 *
 * Features:
 * - Fixed offset behind and above player (configurable)
 * - Mouse drag to orbit around player
 * - Auto-rotation: gradually rotates to follow player forward direction
 * - Collision-aware: pulls camera closer when hitting walls
 * - Smooth follow: lerp camera position to target position
 *
 * This is for gameplay third-person perspective.
 */
export declare class ThirdPersonCamera {
    private readonly canvas;
    private readonly physicsWorld;
    private readonly viewMatrix;
    private position;
    private yaw;
    private pitch;
    private targetYaw;
    private targetPitch;
    private rotationSmoothing;
    private distance;
    private height;
    private shoulderOffset;
    private followSpeed;
    private rotationSpeed;
    private collisionRadius;
    private pitchMin;
    private pitchMax;
    private mouseSensitivity;
    private enableAutoRotation;
    private isMouseDown;
    private lastMouseX;
    private lastMouseY;
    private activePointerId;
    private readonly forward;
    private readonly right;
    private readonly boundHandlers;
    private enabled;
    private disposed;
    constructor(canvas: HTMLCanvasElement, physicsWorld: PhysicsWorld | null, config?: ThirdPersonCameraConfig);
    /**
     * Enable the camera (attach event listeners)
     */
    enable(): void;
    /**
     * Disable the camera (detach event listeners)
     */
    disable(): void;
    /**
     * Dispose of the camera (cleanup)
     */
    dispose(): void;
    /**
     * Update camera based on player position and rotation
     * @param playerPosition - World position of the player
     * @param playerForward - Forward direction of the player (for auto-rotation)
     * @param deltaTime - Time since last frame in seconds
     */
    update(playerPosition: Vec3, playerForward: Vec3, deltaTime: number): void;
    /**
     * Get the current view matrix
     */
    getViewMatrix(playerPosition: Vec3): Mat4;
    /**
     * Get current camera position
     */
    getPosition(): Vec3;
    /**
     * Set camera position
     */
    setPosition(pos: Vec3): void;
    /**
     * Get current yaw and pitch
     */
    getOrientation(): {
        yaw: number;
        pitch: number;
    };
    /**
     * Set yaw and pitch
     */
    setOrientation(yaw: number, pitch: number): void;
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
    /**
     * Get configuration
     */
    getConfig(): Required<ThirdPersonCameraConfig>;
    /**
     * Update configuration
     */
    setConfig(config: Partial<ThirdPersonCameraConfig>): void;
    /**
     * Check if camera is enabled
     */
    isEnabled(): boolean;
    private calculateDesiredPosition;
    private resolveCollision;
    private updateDirectionVectors;
    private handlePointerDown;
    private handleMouseDown;
    private handleMouseUp;
    private handlePointerUp;
    private handleMouseMove;
    private handleBlur;
    private handlePointerCancel;
    private isPointerLocked;
    private handlePointerLockChange;
}
//# sourceMappingURL=ThirdPersonCamera.d.ts.map