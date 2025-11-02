import { Component, registerComponent } from '@engine/world';
import type { Vec3 } from '@engine/core';
import {
  clamp,
  degToRad,
  type IOrbitCameraInput,
  type OrbitCameraClamps,
  type OrbitCameraConfig,
  type OrbitCameraDamping,
  type OrbitCameraSensitivity,
  type OrbitCameraZoomMix,
} from '../types';

/**
 * ECS Orbit camera component holding state and configuration.
 * System updates this data based on input and applies transforms to the entity.
 */
export class OrbitCameraComponent extends Component {
  static readonly type = 'OrbitCameraControl';

  // Current state (smoothed)
  yaw = 0; // radians
  pitch = 0; // radians
  radius = 5.0;
  fov = degToRad(55);

  // Target state (driven by input)
  targetYaw = 0;
  targetPitch = 0;
  targetRadius = 5.0;
  targetFov = degToRad(55);

  // Orbit frame
  pivot: Vec3 = [0, 0, 0];
  worldUp: Vec3 = [0, 1, 0];

  // Limits and behavior
  clamp: OrbitCameraClamps = {
    pitchMin: degToRad(-85),
    pitchMax: degToRad(85),
    radiusMin: 0.3,
    radiusMax: 100,
    fovMin: degToRad(20),
    fovMax: degToRad(75),
  };

  damping: OrbitCameraDamping = {
    orbitTau: 0.10,
    zoomTau: 0.08,
    panTau: 0.06,
  };

  sensitivity: OrbitCameraSensitivity = {
    // ~0.25 deg per pixel @ 96 DPI
    rotate: degToRad(0.25),
    // baseline pan factor (system scales by radius/FOV and viewport)
    pan: 1.0,
    // wheel deltas (system mixes radius/FOV per zoomMix)
    zoomRadius: 0.25,
    zoomFov: degToRad(1.5),
  };

  zoomMix: OrbitCameraZoomMix = {
    radius: 0.7,
    fov: 0.3,
  };

  /** Optional input adapter injected by application */
  input?: IOrbitCameraInput;

  constructor(config?: OrbitCameraConfig) {
    super();
    if (!config) return;

    if (typeof config.yaw === 'number') {
      this.yaw = this.targetYaw = config.yaw;
    }
    if (typeof config.pitch === 'number') {
      const p = clamp(config.pitch, this.clamp.pitchMin, this.clamp.pitchMax);
      this.pitch = this.targetPitch = p;
    }
    if (typeof config.radius === 'number') {
      const r = clamp(config.radius, this.clamp.radiusMin, this.clamp.radiusMax);
      this.radius = this.targetRadius = r;
    }
    if (typeof config.fov === 'number') {
      const f = clamp(config.fov, this.clamp.fovMin, this.clamp.fovMax);
      this.fov = this.targetFov = f;
    }
    if (config.pivot) this.pivot = [...config.pivot] as Vec3;
    if (config.worldUp) this.worldUp = [...config.worldUp] as Vec3;

    if (config.clamp) {
      this.clamp = { ...this.clamp, ...config.clamp };
      // Re-clamp any provided values
      this.pitch = clamp(this.pitch, this.clamp.pitchMin, this.clamp.pitchMax);
      this.targetPitch = clamp(this.targetPitch, this.clamp.pitchMin, this.clamp.pitchMax);
      this.radius = clamp(this.radius, this.clamp.radiusMin, this.clamp.radiusMax);
      this.targetRadius = clamp(this.targetRadius, this.clamp.radiusMin, this.clamp.radiusMax);
      this.fov = clamp(this.fov, this.clamp.fovMin, this.clamp.fovMax);
      this.targetFov = clamp(this.targetFov, this.clamp.fovMin, this.clamp.fovMax);
    }
    if (config.damping) this.damping = { ...this.damping, ...config.damping };
    if (config.sensitivity) this.sensitivity = { ...this.sensitivity, ...config.sensitivity };
    if (config.zoomMix) this.zoomMix = { ...this.zoomMix, ...config.zoomMix };
  }

  getType(): string {
    return OrbitCameraComponent.type;
  }

  clone(): OrbitCameraComponent {
    const clone = new OrbitCameraComponent();
    clone.yaw = this.yaw;
    clone.pitch = this.pitch;
    clone.radius = this.radius;
    clone.fov = this.fov;
    clone.targetYaw = this.targetYaw;
    clone.targetPitch = this.targetPitch;
    clone.targetRadius = this.targetRadius;
    clone.targetFov = this.targetFov;
    clone.pivot = [...this.pivot] as Vec3;
    clone.worldUp = [...this.worldUp] as Vec3;
    clone.clamp = { ...this.clamp };
    clone.damping = { ...this.damping };
    clone.sensitivity = { ...this.sensitivity };
    clone.zoomMix = { ...this.zoomMix };
    // input is intentionally not cloned (owned by application wiring)
    return clone;
  }

  toJSON(): Record<string, unknown> {
    return {
      yaw: this.yaw,
      pitch: this.pitch,
      radius: this.radius,
      fov: this.fov,
      pivot: [...this.pivot],
      worldUp: [...this.worldUp],
      clamp: { ...this.clamp },
      damping: { ...this.damping },
      sensitivity: { ...this.sensitivity },
      zoomMix: { ...this.zoomMix },
    };
  }

  fromJSON(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const obj = data as Record<string, unknown>;
    const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const vec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number');

    if (num(obj.yaw)) this.yaw = this.targetYaw = obj.yaw;
    if (num(obj.pitch)) {
      const p = clamp(obj.pitch, this.clamp.pitchMin, this.clamp.pitchMax);
      this.pitch = this.targetPitch = p;
    }
    if (num(obj.radius)) {
      const r = clamp(obj.radius, this.clamp.radiusMin, this.clamp.radiusMax);
      this.radius = this.targetRadius = r;
    }
    if (num(obj.fov)) {
      const f = clamp(obj.fov, this.clamp.fovMin, this.clamp.fovMax);
      this.fov = this.targetFov = f;
    }
    if (vec3(obj.pivot)) this.pivot = [...(obj.pivot as Vec3)] as Vec3;
    if (vec3(obj.worldUp)) this.worldUp = [...(obj.worldUp as Vec3)] as Vec3;

    if (obj.clamp && typeof obj.clamp === 'object') {
      this.clamp = { ...this.clamp, ...(obj.clamp as Partial<OrbitCameraClamps>) };
    }
    if (obj.damping && typeof obj.damping === 'object') {
      this.damping = { ...this.damping, ...(obj.damping as Partial<OrbitCameraDamping>) };
    }
    if (obj.sensitivity && typeof obj.sensitivity === 'object') {
      this.sensitivity = { ...this.sensitivity, ...(obj.sensitivity as Partial<OrbitCameraSensitivity>) };
    }
    if (obj.zoomMix && typeof obj.zoomMix === 'object') {
      this.zoomMix = { ...this.zoomMix, ...(obj.zoomMix as Partial<OrbitCameraZoomMix>) };
    }

    // Final clamps
    this.pitch = clamp(this.pitch, this.clamp.pitchMin, this.clamp.pitchMax);
    this.targetPitch = clamp(this.targetPitch, this.clamp.pitchMin, this.clamp.pitchMax);
    this.radius = clamp(this.radius, this.clamp.radiusMin, this.clamp.radiusMax);
    this.targetRadius = clamp(this.targetRadius, this.clamp.radiusMin, this.clamp.radiusMax);
    this.fov = clamp(this.fov, this.clamp.fovMin, this.clamp.fovMax);
    this.targetFov = clamp(this.targetFov, this.clamp.fovMin, this.clamp.fovMax);
  }

  protected onDetach(): void {
    // Allow input adapter to clean up any listeners/resources
    try {
      this.input?.dispose?.();
    } catch {
      // ignore adapter disposal errors
    }
    delete this.input;
  }
}

registerComponent(OrbitCameraComponent.type, OrbitCameraComponent);


