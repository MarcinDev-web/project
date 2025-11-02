/**
 * Shared types for ECS Orbit camera in @engine/camera
 */
import type { Vec3 } from '@engine/core';
/** Degrees → radians */
export declare function degToRad(deg: number): number;
/** Radians → degrees (utility, not used in hot paths) */
export declare function radToDeg(rad: number): number;
/** Clamp helper */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * Input adapter interface for OrbitCameraSystem.
 * Kept independent of @engine/input; provide an adapter in the app.
 */
export interface IOrbitCameraInput {
    /** Accumulated pointer delta since last read (pixels). Should reset after read. */
    readPointerDelta(): {
        dx: number;
        dy: number;
    };
    /** Accumulated wheel delta since last read (screen-agnostic units). Should reset after read. */
    readWheelDelta(): number;
    /** Whether orbit (rotate) interaction is currently active (e.g., RMB drag). */
    isOrbitActive(): boolean;
    /** Whether pan interaction is currently active (e.g., MMB drag). */
    isPanActive(): boolean;
    /** Active modifier keys (used to alter zoom policy). */
    getModifiers(): {
        shift: boolean;
        alt: boolean;
        ctrl: boolean;
    };
    /** DPI or device scale relative to 96 DPI baseline. 1.0 if unknown. */
    getDpiScale(): number;
    /** Optional viewport size for pan scaling (pixels). */
    getViewportSize?(): {
        width: number;
        height: number;
    };
    /** Optional cleanup hook for adapters that attach listeners. */
    dispose?(): void;
}
/** Clamp configuration for orbit camera */
export interface OrbitCameraClamps {
    pitchMin: number;
    pitchMax: number;
    radiusMin: number;
    radiusMax: number;
    fovMin: number;
    fovMax: number;
}
/** Damping time constants (seconds) for FPS-independent smoothing */
export interface OrbitCameraDamping {
    orbitTau: number;
    zoomTau: number;
    panTau: number;
}
/** Sensitivity scales (per pixel for rotate/pan, per wheel-unit for zoom) */
export interface OrbitCameraSensitivity {
    rotate: number;
    pan: number;
    zoomRadius: number;
    zoomFov: number;
}
/** Mix between dolly (radius) and FOV zoom. Values should sum to ~1. */
export interface OrbitCameraZoomMix {
    radius: number;
    fov: number;
}
/** Public config to initialize OrbitCameraComponent */
export interface OrbitCameraConfig {
    yaw?: number;
    pitch?: number;
    radius?: number;
    fov?: number;
    pivot?: Vec3;
    worldUp?: Vec3;
    clamp?: Partial<OrbitCameraClamps>;
    damping?: Partial<OrbitCameraDamping>;
    sensitivity?: Partial<OrbitCameraSensitivity>;
    zoomMix?: Partial<OrbitCameraZoomMix>;
}
//# sourceMappingURL=types.d.ts.map