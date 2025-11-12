/**
 * Shared types for ECS Orbit camera in @engine/camera
 */

import type { Vec3 } from '@engine/core';

/** Degrees → radians */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Radians → degrees (utility, not used in hot paths) */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Clamp helper */
export function clamp(value: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return value < lo ? lo : value > hi ? hi : value;
}

/**
 * Input adapter interface for OrbitCameraSystem.
 * Kept independent of @engine/input; provide an adapter in the app.
 */
export interface IOrbitCameraInput {
  /** Accumulated pointer delta since last read (pixels). Should reset after read. */
  readPointerDelta(): { dx: number; dy: number };
  /** Accumulated wheel delta since last read (screen-agnostic units). Should reset after read. */
  readWheelDelta(): number;
  /** Whether orbit (rotate) interaction is currently active (e.g., RMB drag). */
  isOrbitActive(): boolean;
  /** Whether pan interaction is currently active (e.g., MMB drag). */
  isPanActive(): boolean;
  /** Active modifier keys (used to alter zoom policy). */
  getModifiers(): { shift: boolean; alt: boolean; ctrl: boolean };
  /** DPI or device scale relative to 96 DPI baseline. 1.0 if unknown. */
  getDpiScale(): number;
  /** Optional viewport size for pan scaling (pixels). */
  getViewportSize?(): { width: number; height: number };
  /** Optional cleanup hook for adapters that attach listeners. */
  dispose?(): void;
}

/** Clamp configuration for orbit camera */
export interface OrbitCameraClamps {
  pitchMin: number; // radians
  pitchMax: number; // radians
  radiusMin: number;
  radiusMax: number;
  fovMin: number; // radians
  fovMax: number; // radians
}

/** Damping time constants (seconds) for FPS-independent smoothing */
export interface OrbitCameraDamping {
  orbitTau: number;
  zoomTau: number;
  panTau: number;
}

/** Sensitivity scales (per pixel for rotate/pan, per wheel-unit for zoom) */
export interface OrbitCameraSensitivity {
  rotate: number; // radians per pixel at 96 DPI
  pan: number; // world units per pixel baseline (used with radius/FOV scaling)
  zoomRadius: number; // radius delta per wheel unit
  zoomFov: number; // radians delta per wheel unit
}

/** Mix between dolly (radius) and FOV zoom. Values should sum to ~1. */
export interface OrbitCameraZoomMix {
  radius: number;
  fov: number;
}

/** Public config to initialize OrbitCameraComponent */
export interface OrbitCameraConfig {
  yaw?: number; // radians
  pitch?: number; // radians
  radius?: number;
  fov?: number; // radians
  pivot?: Vec3;
  worldUp?: Vec3;
  clamp?: Partial<OrbitCameraClamps>;
  damping?: Partial<OrbitCameraDamping>;
  sensitivity?: Partial<OrbitCameraSensitivity>;
  zoomMix?: Partial<OrbitCameraZoomMix>;
}

/**
 * Collision provider interface for FPSCamera.
 * Computes corrected eye position to prevent camera from penetrating geometry.
 * Implementations must avoid allocations (mutate and return `out`).
 */
export interface IFPSCameraCollisionProvider {
  /**
   * Resolves eye position to prevent collision with geometry.
   * @param out Output vector (mutate this)
   * @param desiredEye Desired eye position
   * @param forward Forward direction vector
   * @returns Corrected eye position (same as `out`)
   */
  resolveEye(out: Vec3, desiredEye: Readonly<Vec3>, forward: Readonly<Vec3>): Vec3;
  /**
   * Optional cleanup hook
   */
  dispose?(): void;
}


