import type { Vec3, Mat4 } from '@engine/core/math';
/**
 * Configuration for EditorCameraController
 */
export interface EditorCameraConfig {
    /** Movement speed in units per second (default: 5.0) */
    moveSpeed?: number;
    /** Sprint multiplier when Shift is held (default: 2.0) */
    sprintMultiplier?: number;
    /** Slow multiplier when Alt is held (default: 0.3) */
    slowMultiplier?: number;
    /** Mouse sensitivity for look (radians per pixel, default: 0.003) */
    lookSensitivity?: number;
    /** Maximum pitch angle in radians (default: 89° = ~1.553) */
    pitchLimit?: number;
    /** Initial camera position (default: [0, 2, 5]) */
    initialPosition?: Vec3;
    /** Initial yaw in radians (default: 0) */
    initialYaw?: number;
    /** Initial pitch in radians (default: 0) */
    initialPitch?: number;
}
/**
 * EditorCameraController provides free-fly camera controls for the editor.
 *
 * Features:
 * - WASD movement (with Shift to sprint, Alt to slow down)
 * - Right mouse button + drag for look
 * - Q/E for vertical movement (up/down)
 * - Mouse wheel to adjust movement speed
 * - No collision, can fly through anything
 *
 * This is NOT for gameplay - it's for editor navigation.
 */
export declare class EditorCameraController {
    private readonly canvas;
    private readonly viewMatrix;
    private position;
    private yaw;
    private pitch;
    private moveSpeed;
    private readonly sprintMultiplier;
    private readonly slowMultiplier;
    private readonly lookSensitivity;
    private readonly pitchLimit;
    private readonly keysPressed;
    private isRightMouseDown;
    private lastMouseX;
    private lastMouseY;
    private readonly forward;
    private readonly right;
    private readonly up;
    private readonly boundHandlers;
    private enabled;
    private disposed;
    constructor(canvas: HTMLCanvasElement, config?: EditorCameraConfig);
    /**
     * Enable the controller (attach event listeners)
     */
    enable(): void;
    /**
     * Disable the controller (detach event listeners)
     */
    disable(): void;
    /**
     * Dispose of the controller (cleanup)
     */
    dispose(): void;
    /**
     * Update camera based on input state (call every frame)
     * @param deltaTime - Time since last frame in seconds
     */
    update(deltaTime: number): void;
    /**
     * Get the current view matrix
     */
    getViewMatrix(): Mat4;
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
     * Get forward direction vector
     */
    getForward(): Vec3;
    /**
     * Get right direction vector
     */
    getRight(): Vec3;
    /**
     * Get current move speed
     */
    getMoveSpeed(): number;
    /**
     * Set move speed
     */
    setMoveSpeed(speed: number): void;
    /**
     * Check if controller is enabled
     */
    isEnabled(): boolean;
    private handleKeyDown;
    private handleKeyUp;
    private handleMouseDown;
    private handleMouseUp;
    private handleMouseMove;
    private handleWheel;
    private handleBlur;
    private updateDirectionVectors;
}
//# sourceMappingURL=EditorCameraController.d.ts.map