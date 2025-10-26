/** Default yaw/pitch rotation speed (radians per pixel). */
export declare const ROTATE_SPEED = 0.005;
/** Default zoom multiplier applied per wheel step. */
export declare const ZOOM_SPEED = 0.1;
/** Minimum allowed camera distance. */
export declare const MIN_DISTANCE = 0.75;
/** Maximum allowed camera distance. */
export declare const MAX_DISTANCE = 20;
/** Maximum absolute pitch (in radians) away from horizon. */
export declare const PITCH_LIMIT: number;
/** Default initial camera distance. */
export declare const INITIAL_DISTANCE = 3;
/**
 * Current orbit control state expressed in yaw, pitch and distance.
 * - yaw: rotation around the vertical axis (radians)
 * - pitch: rotation around the horizontal axis (radians)
 * - distance: radial distance from the target
 */
export interface OrbitControlsState {
    yaw: number;
    pitch: number;
    distance: number;
}
/** Optional configuration for OrbitCamera. */
export interface OrbitControlsConfig {
    /** Multiplier for mouse-move rotation sensitivity. Defaults to `ROTATE_SPEED`. */
    rotateSpeed?: number;
    /** Multiplier for wheel zoom sensitivity. Defaults to `ZOOM_SPEED`. */
    zoomSpeed?: number;
    /** Lower clamp for camera distance. Defaults to `MIN_DISTANCE`. */
    minDistance?: number;
    /** Upper clamp for camera distance. Defaults to `MAX_DISTANCE`. */
    maxDistance?: number;
    /** Maximum absolute pitch angle in radians. Defaults to `PITCH_LIMIT`. */
    pitchLimit?: number;
    /** Starting camera distance. Defaults to `INITIAL_DISTANCE`. */
    initialDistance?: number;
}
/**
 * OrbitCamera provides orbit-style mouse controls for a canvas element.
 *
 * Interactions:
 * - Left mouse drag: adjust yaw and pitch.
 * - Mouse wheel: zoom in/out with clamped distance.
 *
 * Cursor is set to `grab`/`grabbing` while active. Call `cleanup` to remove
 * listeners and restore cursor styles.
 */
export declare class OrbitCamera {
    private readonly canvas;
    private readonly controller;
    private readonly rotateSpeed;
    private readonly zoomSpeed;
    private readonly minDistance;
    private readonly maxDistance;
    private readonly pitchLimit;
    private yaw;
    private pitch;
    private distance;
    private isDragging;
    private enabled;
    private lastX;
    private lastY;
    private activeDragController;
    constructor(canvas: HTMLCanvasElement, config?: OrbitControlsConfig);
    /**
     * Returns the current immutable control state.
     */
    getState(): OrbitControlsState;
    /**
     * Sets yaw/pitch/distance at once (values are clamped).
     */
    setState(state: {
        yaw: number;
        pitch: number;
        distance: number;
    }): void;
    /**
     * Applies one of preset camera states.
     */
    setPreset(state: {
        yaw: number;
        pitch: number;
        distance: number;
    }): void;
    /**
     * Enables or disables camera interaction (used when UI is focused).
     */
    setEnabled(enabled: boolean): void;
    /**
     * Removes all event listeners and resets cursor changes.
     */
    cleanup(): void;
    private updateCursor;
    private setupEventListeners;
}
/**
 * Public API for backward compatibility with createOrbitControls function
 */
export interface OrbitControls {
    /** Returns the current immutable control state. */
    getState(): OrbitControlsState;
    /** Removes all event listeners and resets cursor changes. */
    cleanup(): void;
    /** Enables or disables camera interaction (used when UI is focused). */
    setEnabled(enabled: boolean): void;
    /** Sets yaw/pitch/distance at once (values are clamped). */
    setState(state: {
        yaw: number;
        pitch: number;
        distance: number;
    }): void;
    /** Applies one of preset camera states. */
    setPreset(state: {
        yaw: number;
        pitch: number;
        distance: number;
    }): void;
}
/**
 * Creates orbit-style mouse controls for a canvas element (backward compatibility function).
 *
 * @param canvas - Target canvas to attach event listeners to.
 * @param config - Optional configuration to override defaults.
 * @returns Public API with `getState` and `cleanup`.
 */
export declare function createOrbitControls(canvas: HTMLCanvasElement, config?: OrbitControlsConfig): OrbitControls;
//# sourceMappingURL=OrbitCamera.d.ts.map