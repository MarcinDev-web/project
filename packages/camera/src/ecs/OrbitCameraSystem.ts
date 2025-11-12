import type { Scene } from '@engine/world';
import { CameraComponent, Transform } from '@engine/world';
import { crossVec3Out, dotVec3, lengthVec3, normalizeVec3Out, scaleVec3Out, type Vec3 } from '@engine/core';
import { damp, expDecayAlpha } from '../utils/Damper';
import { OrbitCameraComponent } from './OrbitCameraComponent';

/**
 * Scratch vectors to avoid allocations in hot path.
 * These are Float32Array instances cast to Vec3 for performance.
 * Note: Direct mutation requires 'as any' cast because Vec3 is a tuple type,
 * but Float32Array is compatible at runtime and provides zero-allocation performance.
 */
const V_RIGHT: Vec3 = new Float32Array(3) as unknown as Vec3;
const V_UP: Vec3 = new Float32Array(3) as unknown as Vec3;
const V_FORWARD: Vec3 = new Float32Array(3) as unknown as Vec3;
const V_TMP: Vec3 = new Float32Array(3) as unknown as Vec3;

export interface OrbitCameraSystemConfig {
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * System that updates entities with OrbitCameraComponent.
 * Reads input deltas, updates target state, applies FPS-independent smoothing,
 * and writes entity Transform position and CameraComponent FOV/target.
 */
export class OrbitCameraSystem {
  private readonly scene: Scene;
  private readonly logger: OrbitCameraSystemConfig['logger'];

  constructor(scene: Scene, config?: OrbitCameraSystemConfig) {
    this.scene = scene;
    this.logger = config?.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };
  }

  update(dt: number): void {
    if (!(dt > 0 && Number.isFinite(dt))) return;
    const entities = this.scene.queryEntities(OrbitCameraComponent, CameraComponent, Transform);
    if (entities.length === 0) return;

    for (const entity of entities) {
      const ctrl = entity.getComponent(OrbitCameraComponent);
      const cam = entity.getComponent(CameraComponent);
      const transform = entity.getComponent(Transform);
      if (!ctrl || !cam || !transform) continue;

      // 1) Read input
      const input = ctrl.input;
      let dx = 0, dy = 0, wheel = 0, orbitActive = false, panActive = false;
      let modShift = false, modAlt = false;
      let dpi = 1;
      let viewportH = 800; // fallback for pan scaling
      if (input) {
        try {
          const d = input.readPointerDelta();
          dx = d?.dx ?? 0;
          dy = d?.dy ?? 0;
          wheel = input.readWheelDelta?.() ?? 0;
          orbitActive = input.isOrbitActive?.() ?? false;
          panActive = input.isPanActive?.() ?? false;
          const m = input.getModifiers?.();
          modShift = !!m?.shift;
          modAlt = !!m?.alt;
          dpi = input.getDpiScale?.() ?? 1;
          const size = input.getViewportSize?.();
          if (size && size.height && Number.isFinite(size.height)) {
            viewportH = size.height;
          }
        } catch (err) {
          this.logger?.warn?.('OrbitCameraSystem: input adapter threw, ignoring frame');
        }
      }

      // 2) Update targets from input
      if (orbitActive && (dx !== 0 || dy !== 0)) {
        const rotScale = (ctrl.sensitivity.rotate || 0) * dpi;
        ctrl.targetYaw += dx * rotScale;
        ctrl.targetPitch += dy * rotScale;
        // Clamp pitch
        if (ctrl.targetPitch > ctrl.clamp.pitchMax) ctrl.targetPitch = ctrl.clamp.pitchMax;
        if (ctrl.targetPitch < ctrl.clamp.pitchMin) ctrl.targetPitch = ctrl.clamp.pitchMin;
      }

      if (wheel !== 0) {
        const zr = wheel * (ctrl.sensitivity.zoomRadius || 0) * dpi;
        const zf = wheel * (ctrl.sensitivity.zoomFov || 0) * dpi;
        if (modAlt && !modShift) {
          // FOV-only
          ctrl.targetFov += zf;
        } else if (modShift && !modAlt) {
          // Radius-only
          ctrl.targetRadius += zr;
        } else {
          // Mixed
          ctrl.targetRadius += zr * (ctrl.zoomMix.radius || 0);
          ctrl.targetFov += zf * (ctrl.zoomMix.fov || 0);
        }
        // Clamp
        if (ctrl.targetRadius < ctrl.clamp.radiusMin) ctrl.targetRadius = ctrl.clamp.radiusMin;
        if (ctrl.targetRadius > ctrl.clamp.radiusMax) ctrl.targetRadius = ctrl.clamp.radiusMax;
        if (ctrl.targetFov < ctrl.clamp.fovMin) ctrl.targetFov = ctrl.clamp.fovMin;
        if (ctrl.targetFov > ctrl.clamp.fovMax) ctrl.targetFov = ctrl.clamp.fovMax;
      }

      if (panActive && (dx !== 0 || dy !== 0)) {
        // Compute view basis from current (smoothed) yaw/pitch
        const cy = Math.cos(ctrl.yaw);
        const sy = Math.sin(ctrl.yaw);
        const cp = Math.cos(ctrl.pitch);
        const sp = Math.sin(ctrl.pitch);

        // Forward from camera toward target (pivot - eye), right = forward x up
        // forward = [sx, sy, sz] pointing from eye to pivot
        // Using spherical: forward = [cp * sy, sp, cp * cy]
        // Performance: Float32Array mutation requires 'as any' cast (see scratch vectors comment above)
        (V_FORWARD as any)[0] = cp * sy;
        (V_FORWARD as any)[1] = sp;
        (V_FORWARD as any)[2] = cp * cy;
        normalizeVec3Out(V_FORWARD, V_FORWARD);

        // Ensure worldUp not parallel to forward
        const upWorld = ctrl.worldUp;
        // right = normalize(forward × up)
        crossVec3Out(V_RIGHT, V_FORWARD, upWorld);
        const rightLen = lengthVec3(V_RIGHT);
        if (!(rightLen > 0)) {
          // Fallback to canonical right if degenerate
          // Performance: Float32Array mutation requires 'as any' cast (see scratch vectors comment above)
          (V_RIGHT as any)[0] = 1; (V_RIGHT as any)[1] = 0; (V_RIGHT as any)[2] = 0;
        } else {
          normalizeVec3Out(V_RIGHT, V_RIGHT);
        }
        // screen-up ≈ upWorld projected to plane orthogonal to forward
        // up = normalize(upWorld - dot(upWorld, forward) * forward)
        const du = dotVec3(upWorld, V_FORWARD);
        // Performance: Float32Array mutation requires 'as any' cast (see scratch vectors comment above)
        (V_UP as any)[0] = upWorld[0] - V_FORWARD[0] * du;
        (V_UP as any)[1] = upWorld[1] - V_FORWARD[1] * du;
        (V_UP as any)[2] = upWorld[2] - V_FORWARD[2] * du;
        normalizeVec3Out(V_UP, V_UP);

        // World units per pixel at current depth (approx)
        const unitsPerPx = (2 * ctrl.radius * Math.tan((ctrl.fov || Math.PI / 3) * 0.5)) / Math.max(1, viewportH);
        const panScale = (ctrl.sensitivity.pan || 0) * dpi * unitsPerPx;

        // desired pivot after raw delta (note dx pans left, dy pans up)
        // pivot' = pivot + (-dx * right + dy * up) * panScale
        // Performance: Float32Array mutation requires 'as any' cast (see scratch vectors comment above)
        (V_TMP as any)[0] = V_RIGHT[0] * -dx + V_UP[0] * dy;
        (V_TMP as any)[1] = V_RIGHT[1] * -dx + V_UP[1] * dy;
        (V_TMP as any)[2] = V_RIGHT[2] * -dx + V_UP[2] * dy;
        scaleVec3Out(V_TMP, V_TMP, panScale);

        // Smoothly approach desired pivot using pan damping
        const a = expDecayAlpha(ctrl.damping.panTau, dt);
        // pivot = pivot + (delta * a)
        // Performance: Float32Array mutation requires 'as any' cast (see scratch vectors comment above)
        // Using V_TMP for pivot calculation to avoid reusing V_RIGHT which represents right vector
        (V_TMP as any)[0] = ctrl.pivot[0] + V_TMP[0] * a;
        (V_TMP as any)[1] = ctrl.pivot[1] + V_TMP[1] * a;
        (V_TMP as any)[2] = ctrl.pivot[2] + V_TMP[2] * a;
        ctrl.pivot = [V_TMP[0], V_TMP[1], V_TMP[2]];
      }

      // 3) Smooth current toward targets
      ctrl.yaw = damp(ctrl.yaw, ctrl.targetYaw, ctrl.damping.orbitTau, dt);
      ctrl.pitch = damp(ctrl.pitch, ctrl.targetPitch, ctrl.damping.orbitTau, dt);
      ctrl.radius = damp(ctrl.radius, ctrl.targetRadius, ctrl.damping.zoomTau, dt);
      ctrl.fov = damp(ctrl.fov, ctrl.targetFov, ctrl.damping.zoomTau, dt);

      // Ensure clamps after smoothing
      if (ctrl.pitch > ctrl.clamp.pitchMax) ctrl.pitch = ctrl.clamp.pitchMax;
      if (ctrl.pitch < ctrl.clamp.pitchMin) ctrl.pitch = ctrl.clamp.pitchMin;
      if (ctrl.radius < ctrl.clamp.radiusMin) ctrl.radius = ctrl.clamp.radiusMin;
      if (ctrl.radius > ctrl.clamp.radiusMax) ctrl.radius = ctrl.clamp.radiusMax;
      if (ctrl.fov < ctrl.clamp.fovMin) ctrl.fov = ctrl.clamp.fovMin;
      if (ctrl.fov > ctrl.clamp.fovMax) ctrl.fov = ctrl.clamp.fovMax;

      // 4) Compute eye position from spherical (yaw, pitch, radius) around pivot
      const cy2 = Math.cos(ctrl.yaw);
      const sy2 = Math.sin(ctrl.yaw);
      const cp2 = Math.cos(ctrl.pitch);
      const sp2 = Math.sin(ctrl.pitch);
      // forward from eye to pivot (unit): [cp*sin(yaw), sp, cp*cos(yaw)]
      // Performance: Float32Array mutation requires 'as any' cast (see scratch vectors comment above)
      (V_FORWARD as any)[0] = cp2 * sy2;
      (V_FORWARD as any)[1] = sp2;
      (V_FORWARD as any)[2] = cp2 * cy2;
      // eye = pivot - forward * radius
      scaleVec3Out(V_TMP, V_FORWARD, ctrl.radius);
      // Performance: Float32Array mutation requires 'as any' cast (see scratch vectors comment above)
      (V_TMP as any)[0] = ctrl.pivot[0] - V_TMP[0];
      (V_TMP as any)[1] = ctrl.pivot[1] - V_TMP[1];
      (V_TMP as any)[2] = ctrl.pivot[2] - V_TMP[2];

      // 5) Write transform position and camera properties
      transform.position = [V_TMP[0], V_TMP[1], V_TMP[2]];
      cam.fov = ctrl.fov;
      cam.target = [...ctrl.pivot] as Vec3;
      cam.up = [...ctrl.worldUp] as Vec3;
    }
  }
}


