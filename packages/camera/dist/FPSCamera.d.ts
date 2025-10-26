import type { Mat4, Vec3 } from '@engine/core/math';
/**
 * FPSCamera provides first-person camera controls with pointer lock support.
 *
 * Responsibilities:
 * - Track yaw/pitch orientation using mouse movement
 * - Request/release pointer lock on demand
 * - Produce view matrix from tracked orientation and player position
 * - Expose forward/right direction vectors for movement input
 */
export declare class FPSCamera {
    private readonly canvas;
    private readonly viewMatrix;
    private readonly forward;
    private readonly right;
    private yaw;
    private pitch;
    private eyeHeight;
    private sensitivity;
    private pitchLimit;
    private invertY;
    private pointerLockActive;
    private pendingPointerLock;
    constructor(canvas: HTMLCanvasElement, options?: {
        eyeHeight?: number;
        sensitivity?: number;
        pitchLimit?: number;
    });
    setSensitivity(value: number): void;
    setEyeHeight(value: number): void;
    setPitchLimit(value: number): void;
    setInvertY(value: boolean): void;
    dispose(): void;
    enable(): void;
    disable(): void;
    setYawPitch(yaw: number, pitch: number): void;
    getYawPitch(): {
        yaw: number;
        pitch: number;
    };
    /** Returns the view matrix for the given player world position. */
    getViewMatrix(playerPosition: Vec3): Mat4;
    getForwardDirection(): Vec3;
    getRightDirection(): Vec3;
    /** Called once per frame to ensure pointer lock state. */
    update(): void;
    private handlePointerLockChange;
    private handlePointerLockError;
    private handleMouseMove;
    private updateDirectionVectors;
}
//# sourceMappingURL=FPSCamera.d.ts.map