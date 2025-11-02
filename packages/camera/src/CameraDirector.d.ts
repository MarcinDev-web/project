import type { Mat4, Vec3 } from '@engine/core/math';
import type { Scene } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { OrbitControls } from './OrbitCamera';
import type { FPSCamera } from './FPSCamera';
import type { EditorCameraController } from './EditorCameraController';
import type { ThirdPersonCamera } from './ThirdPersonCamera';
/**
 * Camera mode types
 */
export type CameraMode = 'orbit' | 'fps' | 'third-person' | 'free-fly';
/**
 * Camera configuration for each mode
 */
export interface CameraDirectorConfig {
    orbitControls: OrbitControls;
    fpsCamera: FPSCamera | null;
    editorCamera: EditorCameraController | null;
    thirdPersonCamera?: ThirdPersonCamera | null;
    canvas: HTMLCanvasElement;
    scene?: Scene;
    physicsWorld?: PhysicsWorld | null;
    logger?: {
        debug: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
    };
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
    private readonly editorCamera;
    private readonly thirdPersonCamera;
    private readonly canvas;
    private readonly scene;
    private readonly physicsWorld;
    private currentFov;
    private cameraOffset;
    private collisionRadius;
    private readonly viewMatrix;
    private readonly projectionMatrix;
    private readonly blendScratch;
    private playerPosition;
    private playerForward;
    private logger;
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
     * Set player position for FPS/third-person camera modes (legacy helper)
     */
    setPlayerPosition(position: Vec3): void;
    /**
     * Set full player pose for camera modes
     */
    setPlayerPose(position: Vec3, forward?: Vec3): void;
    /**
     * Update player forward direction independently
     */
    setPlayerForward(forward: Vec3): void;
    /**
     * Get player position
     */
    getPlayerPosition(): Vec3 | null;
    /**
     * Get player forward direction if available
     */
    getPlayerForward(): Vec3 | null;
    /**
     * Check if currently blending
     */
    isBlending(): boolean;
    /**
     * Dispose of resources
     */
    dispose(): void;
    private normalizeVector;
    /**
     * Enable camera for a specific mode
     */
    private enableCameraForMode;
    /**
     * Disable camera for a specific mode
     */
    private disableCameraForMode;
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