import type { Mat4, Vec3 } from '@engine/core/math';
import type { Scene } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { OrbitControls } from './OrbitCamera';
import type { FPSCamera } from './FPSCamera';
/**
 * Camera mode types
 */
export type CameraMode = 'orbit' | 'fps' | 'follow';
/**
 * Camera configuration for each mode
 */
export interface CameraDirectorConfig {
    orbitControls: OrbitControls;
    fpsCamera: FPSCamera | null;
    canvas: HTMLCanvasElement;
    scene?: Scene;
    physicsWorld?: PhysicsWorld | null;
}
/**
 * CameraDirector manages camera modes and smooth transitions
 *
 * Responsibilities:
 * - Switch between orbit, FPS, and follow cameras
 * - Blend smoothly between camera modes
 * - Generate view and projection matrices
 * - Centralized camera state management
 */
export declare class CameraDirector {
    private currentMode;
    private blend;
    private readonly orbitControls;
    private readonly fpsCamera;
    private readonly canvas;
    private readonly scene;
    private readonly physicsWorld;
    private currentFov;
    private cameraOffset;
    private collisionRadius;
    private readonly viewMatrix;
    private readonly projectionMatrix;
    private playerPosition;
    constructor(config: CameraDirectorConfig);
    /**
     * Set the current camera mode (instant switch, no blend)
     */
    setMode(mode: CameraMode): void;
    /**
     * Blend from current mode to target mode over duration
     */
    startBlend(toMode: CameraMode, duration?: number): void;
    /**
     * Get current camera mode
     */
    getMode(): CameraMode;
    /**
     * Update camera state and blending
     */
    update(deltaTime: number): void;
    /**
     * Get the active view matrix
     */
    getViewMatrix(): Mat4;
    /**
     * Get the active projection matrix
     */
    getProjectionMatrix(): Mat4;
    setFov(radians: number): void;
    setCameraOffset(offset: Vec3): void;
    setCollisionRadius(radius: number): void;
    /**
     * Set player position for FPS camera mode
     */
    setPlayerPosition(position: Vec3): void;
    /**
     * Get player position
     */
    getPlayerPosition(): Vec3 | null;
    /**
     * Check if currently blending
     */
    isBlending(): boolean;
    /**
     * Dispose of resources
     */
    dispose(): void;
    /**
     * Update internal camera state based on current mode
     */
    private updateCameraState;
    /**
     * Compute view matrix for a specific mode
     */
    private computeViewMatrix;
    private resolveCameraCollision;
    /**
     * Smooth interpolation function (ease-in-out)
     */
    private smoothstep;
}
//# sourceMappingURL=CameraDirector.d.ts.map