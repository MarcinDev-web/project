import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { Vec3 } from '@engine/core/math';

const LEGACY_SKY_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [0.4, 0.6, 0.9],
  [0.05, 0.08, 0.12],
];

const LEGACY_HORIZON_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [0.8, 0.85, 0.9],
  [0.15, 0.18, 0.22],
];

const LEGACY_GROUND_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [0.3, 0.35, 0.4],
  [0.05, 0.06, 0.08],
];

const LEGACY_SUN_COLORS: ReadonlyArray<readonly [number, number, number]> = [[1.0, 0.95, 0.8]];

const LEGACY_SUN_INTENSITIES: ReadonlyArray<number> = [1.0];
const LEGACY_AMBIENT_INTENSITIES: ReadonlyArray<number> = [0.6, 0.3];

const NEW_DEFAULT_SKY_COLOR: readonly [number, number, number] = [0.2, 0.33, 0.62];
const NEW_DEFAULT_HORIZON_COLOR: readonly [number, number, number] = [0.32, 0.45, 0.68];
const NEW_DEFAULT_GROUND_COLOR: readonly [number, number, number] = [0.08, 0.1, 0.16];
const NEW_DEFAULT_SUN_COLOR: readonly [number, number, number] = [1.05, 1.0, 0.9];
const NEW_DEFAULT_SUN_INTENSITY = 1.1;
const NEW_DEFAULT_AMBIENT_INTENSITY = 0.35;
const DEFAULT_CLOUD_DENSITY = 0.7;
const DEFAULT_CLOUD_SPEED = 0.03;
const DEFAULT_CLOUD_ALTITUDE = 1200;
const DEFAULT_CLOUD_THICKNESS = 800;

// Physical sky (Rayleigh/Mie scattering) defaults
const DEFAULT_RAYLEIGH = 2.0;
const DEFAULT_TURBIDITY = 4.0;
const DEFAULT_MIE_COEFFICIENT = 0.005;
const DEFAULT_MIE_DIRECTIONAL_G = 0.8;

// WebGPU types (available in browser/WebGPU environment)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface GPUTexture {}
}

/**
 * Types of skybox rendering supported
 * - 'solid': Single color fill
 * - 'gradient': Gradient from sky to horizon to ground
 * - 'procedural-sky': Simple procedural sky with sun
 * - 'physical-sky': Physically-based sky with Rayleigh/Mie scattering
 * - 'cubemap': HDR/LDR cubemap texture
 */
export type SkyboxType = 'solid' | 'gradient' | 'procedural-sky' | 'physical-sky' | 'cubemap';

/**
 * Fog modes for distance-based atmosphere
 */
export type FogMode = 'none' | 'linear' | 'exponential' | 'exponential-squared';

/**
 * Visual presets for environment rendering
 */
export type VisualPreset = 'stylized-balanced' | 'cinematic' | 'low';

export interface EnvironmentComponentJSON {
  skyboxType?: SkyboxType;
  skyColor?: Vec3;
  horizonColor?: Vec3;
  groundColor?: Vec3;
  sunDirection?: Vec3;
  sunColor?: Vec3;
  sunIntensity?: number;
  fogMode?: FogMode;
  fogColor?: Vec3;
  fogNear?: number;
  fogFar?: number;
  fogDensity?: number;
  ambientIntensity?: number;
  exposure?: number;
  enabled?: boolean;
  cloudsEnabled?: boolean;
  cloudDensity?: number;
  cloudSpeed?: number;
  cloudAltitude?: number;
  cloudThickness?: number;
  visualPreset?: VisualPreset;
  // Physical sky (Rayleigh/Mie) parameters
  rayleigh?: number;
  turbidity?: number;
  mieCoefficient?: number;
  mieDirectionalG?: number;
}

/**
 * EnvironmentComponent defines the skybox and atmospheric settings for a scene.
 * Only one environment component should be active per scene.
 */
export class EnvironmentComponent extends Component {
  static readonly type = 'Environment';

  /** Type of skybox rendering */
  skyboxType: SkyboxType = 'procedural-sky';

  /** Sky color (top) for gradient and procedural sky */
  skyColor: Vec3 = [...NEW_DEFAULT_SKY_COLOR] as Vec3;

  /** Horizon color for gradient and procedural sky */
  horizonColor: Vec3 = [...NEW_DEFAULT_HORIZON_COLOR] as Vec3;

  /** Ground color (bottom) for gradient mode */
  groundColor: Vec3 = [...NEW_DEFAULT_GROUND_COLOR] as Vec3;

  /** Sun direction (normalized) for procedural sky */
  private _sunDirection: Vec3 = [0.3, 0.7, 0.5];

  /** Sun color for procedural sky */
  sunColor: Vec3 = [...NEW_DEFAULT_SUN_COLOR] as Vec3;

  /** Sun intensity multiplier */
  private _sunIntensity: number = NEW_DEFAULT_SUN_INTENSITY;

  /** Fog rendering mode */
  fogMode: FogMode = 'none';

  /** Fog color */
  fogColor: Vec3 = [0.7, 0.8, 0.9];

  /** Fog start distance (for linear fog) */
  fogNear: number = 10.0;

  /** Fog end distance (for linear fog) */
  fogFar: number = 100.0;

  /** Fog density (for exponential fog) */
  fogDensity: number = 0.02;

  /** Ambient light intensity from environment */
  private _ambientIntensity: number = NEW_DEFAULT_AMBIENT_INTENSITY;

  /** Exposure adjustment for HDR environments */
  private _exposure: number = 1.0;

  /** Whether environment rendering is enabled */
  enabled: boolean = true;

  /** Whether clouds are enabled in procedural sky */
  cloudsEnabled: boolean = true;

  /** Cloud density (0.0 - 1.0) */
  cloudDensity: number = DEFAULT_CLOUD_DENSITY;

  /** Cloud animation speed */
  cloudSpeed: number = DEFAULT_CLOUD_SPEED;

  /** Cloud layer altitude in world units */
  cloudAltitude: number = DEFAULT_CLOUD_ALTITUDE;

  /** Cloud layer thickness in world units */
  cloudThickness: number = DEFAULT_CLOUD_THICKNESS;

  // ===== Physical sky (Rayleigh/Mie scattering) parameters =====

  /** Rayleigh scattering coefficient (affects blue color intensity) */
  rayleigh: number = DEFAULT_RAYLEIGH;

  /** Atmospheric turbidity (haze/particles, affects Mie scattering) */
  turbidity: number = DEFAULT_TURBIDITY;

  /** Mie scattering coefficient (affects sun halo size) */
  mieCoefficient: number = DEFAULT_MIE_COEFFICIENT;

  /** Mie directional G parameter (affects sun halo shape, -1 to 1) */
  mieDirectionalG: number = DEFAULT_MIE_DIRECTIONAL_G;

  /** Visual preset for rendering quality/features */
  private _visualPreset: VisualPreset | undefined;
  get visualPreset(): VisualPreset | undefined {
    return this._visualPreset;
  }

  set visualPreset(value: VisualPreset | undefined) {
    if (value === undefined) {
      this._visualPreset = undefined;
      return;
    }
    if (value === 'stylized-balanced' || value === 'cinematic' || value === 'low') {
      this._visualPreset = value;
    }
  }


  /** Cubemap texture resource (set by renderer, not serialized) */
  cubemapTexture?: GPUTexture;

  /** Path to cubemap file (for serialization/loading) */
  cubemapPath?: string;

  getType(): string {
    return EnvironmentComponent.type;
  }

  /**
   * Gets the sun direction (always normalized)
   */
  get sunDirection(): Vec3 {
    return this._sunDirection;
  }

  /**
   * Sets the sun direction and auto-normalizes it
   */
  set sunDirection(value: Vec3) {
    if (!Array.isArray(value) || value.length !== 3) {
      return; // Invalid input, keep current value
    }
    this._sunDirection = [...value] as Vec3;
    this.normalizeSunDirection();
  }

  /**
   * Gets the sun intensity (always >= 0)
   */
  get sunIntensity(): number {
    return this._sunIntensity;
  }

  /**
   * Sets the sun intensity with clamping (>= 0, allows HDR > 1.0)
   */
  set sunIntensity(value: number) {
    if (!Number.isFinite(value)) {
      return; // Invalid input, keep current value
    }
    this._sunIntensity = Math.max(0, value);
  }

  /**
   * Gets the ambient intensity (always >= 0)
   */
  get ambientIntensity(): number {
    return this._ambientIntensity;
  }

  /**
   * Sets the ambient intensity with clamping (>= 0, <= 10)
   */
  set ambientIntensity(value: number) {
    if (!Number.isFinite(value)) {
      return; // Invalid input, keep current value
    }
    this._ambientIntensity = Math.max(0, Math.min(10, value));
  }

  /**
   * Gets the exposure value (always > 0)
   */
  get exposure(): number {
    return this._exposure;
  }

  /**
   * Sets the exposure with clamping (> 0, <= 10)
   */
  set exposure(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      return; // Invalid input, keep current value
    }
    this._exposure = Math.min(10, value);
  }

  /**
   * Sets the cubemap texture and path
   * @param texture The GPU texture (will be managed by renderer lifecycle)
   * @param path Optional path/identifier for the cubemap
   */
  setCubemap(texture: GPUTexture | undefined, path?: string): void {
    if (texture) {
      this.cubemapTexture = texture;
      this.skyboxType = 'cubemap';
    } else {
      delete this.cubemapTexture;
    }
    if (path !== undefined) {
      this.cubemapPath = path;
    } else {
      delete this.cubemapPath;
    }
  }

  /**
   * Clears the cubemap and resets to procedural sky
   */
  clearCubemap(): void {
    delete this.cubemapTexture;
    delete this.cubemapPath;
    if (this.skyboxType === 'cubemap') {
      this.skyboxType = 'procedural-sky';
    }
  }

  /**
   * Normalizes the sun direction vector
   */
  normalizeSunDirection(): void {
    const len = Math.sqrt(
      this._sunDirection[0] * this._sunDirection[0] +
        this._sunDirection[1] * this._sunDirection[1] +
        this._sunDirection[2] * this._sunDirection[2]
    );
    if (len > 0.0001) {
      this._sunDirection[0] /= len;
      this._sunDirection[1] /= len;
      this._sunDirection[2] /= len;
    } else {
      // Default upward direction
      this._sunDirection = [0, 1, 0];
    }
  }

  private upgradeLegacyDefaults(): void {
    const approxEqual = (a: number, b: number) => Math.abs(a - b) < 0.0005;
    const matchesColor = (value: Vec3, candidates: ReadonlyArray<readonly [number, number, number]>) =>
      candidates.some((candidate) =>
        approxEqual(value[0], candidate[0]) &&
        approxEqual(value[1], candidate[1]) &&
        approxEqual(value[2], candidate[2])
      );

    if (matchesColor(this.skyColor, LEGACY_SKY_COLORS)) {
      this.skyColor = [...NEW_DEFAULT_SKY_COLOR] as Vec3;
    }
    if (matchesColor(this.horizonColor, LEGACY_HORIZON_COLORS)) {
      this.horizonColor = [...NEW_DEFAULT_HORIZON_COLOR] as Vec3;
    }
    if (matchesColor(this.groundColor, LEGACY_GROUND_COLORS)) {
      this.groundColor = [...NEW_DEFAULT_GROUND_COLOR] as Vec3;
    }
    if (matchesColor(this.sunColor, LEGACY_SUN_COLORS)) {
      this.sunColor = [...NEW_DEFAULT_SUN_COLOR] as Vec3;
    }
    if (LEGACY_SUN_INTENSITIES.some((value) => approxEqual(this._sunIntensity, value))) {
      this._sunIntensity = NEW_DEFAULT_SUN_INTENSITY;
    }
    if (LEGACY_AMBIENT_INTENSITIES.some((value) => approxEqual(this._ambientIntensity, value))) {
      this._ambientIntensity = NEW_DEFAULT_AMBIENT_INTENSITY;
    }
    if (!Number.isFinite(this.cloudDensity)) {
      this.cloudDensity = DEFAULT_CLOUD_DENSITY;
    }
    if (!Number.isFinite(this.cloudSpeed)) {
      this.cloudSpeed = DEFAULT_CLOUD_SPEED;
    }
    if (
      this._visualPreset !== undefined &&
      this._visualPreset !== 'stylized-balanced' &&
      this._visualPreset !== 'cinematic' &&
      this._visualPreset !== 'low'
    ) {
      this._visualPreset = undefined;
    }
  }

  /**
   * Sets time of day (0-24 hours) and updates sun position accordingly
   */
  setTimeOfDay(hours: number): void {
    // Clamp to 0-24 range
    hours = ((hours % 24) + 24) % 24;

    // Convert hours to radians (0 = midnight at horizon, 12 = noon at zenith)
    const angle = ((hours - 6) / 12) * Math.PI; // -6 so that 6am = sunrise

    // Sun moves in an arc from east to west
    const elevation = Math.sin(angle);
    const azimuth = Math.cos(angle);

    this._sunDirection = [azimuth * 0.3, elevation, 0.5];
    this.normalizeSunDirection();

    // Adjust colors based on time of day
    if (hours < 6 || hours > 20) {
      // Night
      this.skyColor = [0.015, 0.035, 0.09];
      this.horizonColor = [0.06, 0.08, 0.16];
      this.sunColor = [0.4, 0.45, 0.6];
      this._sunIntensity = 0.0;
    } else if (hours < 8 || hours > 18) {
      // Dawn/Dusk
      const t = hours < 8 ? (hours - 6) / 2 : (20 - hours) / 2;
      this.skyColor = [0.06 + 0.18 * t, 0.1 + 0.24 * t, 0.22 + 0.42 * t];
      this.horizonColor = [0.28 + 0.44 * t, 0.2 + 0.4 * t, 0.2 + 0.42 * t];
      this.sunColor = [1.25, 0.65 + 0.35 * t, 0.4 + 0.5 * t];
      this._sunIntensity = t * 1.1;
    } else {
      // Day
      this.skyColor = [0.2, 0.33, 0.62];
      this.horizonColor = [0.32, 0.45, 0.68];
      this.sunColor = [1.05, 1.0, 0.9];
      this._sunIntensity = 1.1;
    }
  }

  override clone(): EnvironmentComponent {
    const clone = new EnvironmentComponent();
    clone.skyboxType = this.skyboxType;
    clone.skyColor = [...this.skyColor] as Vec3;
    clone.horizonColor = [...this.horizonColor] as Vec3;
    clone.groundColor = [...this.groundColor] as Vec3;
    clone._sunDirection = [...this._sunDirection] as Vec3;
    clone.sunColor = [...this.sunColor] as Vec3;
    clone._sunIntensity = this._sunIntensity;
    clone.fogMode = this.fogMode;
    clone.fogColor = [...this.fogColor] as Vec3;
    clone.fogNear = this.fogNear;
    clone.fogFar = this.fogFar;
    clone.fogDensity = this.fogDensity;
    clone._ambientIntensity = this._ambientIntensity;
    clone._exposure = this._exposure;
    clone.enabled = this.enabled;
    clone.cloudsEnabled = this.cloudsEnabled;
    clone.cloudDensity = this.cloudDensity;
    clone.cloudSpeed = this.cloudSpeed;
    clone.cloudAltitude = this.cloudAltitude;
    clone.cloudThickness = this.cloudThickness;
    clone.rayleigh = this.rayleigh;
    clone.turbidity = this.turbidity;
    clone.mieCoefficient = this.mieCoefficient;
    clone.mieDirectionalG = this.mieDirectionalG;
    clone._visualPreset = this._visualPreset;
    return clone;
  }

  override toJSON(): EnvironmentComponentJSON {
    const json: EnvironmentComponentJSON = {
      skyboxType: this.skyboxType,
      skyColor: [...this.skyColor] as Vec3,
      horizonColor: [...this.horizonColor] as Vec3,
      groundColor: [...this.groundColor] as Vec3,
      sunDirection: [...this.sunDirection] as Vec3,
      sunColor: [...this.sunColor] as Vec3,
      sunIntensity: this.sunIntensity,
      fogMode: this.fogMode,
      fogColor: [...this.fogColor] as Vec3,
      fogNear: this.fogNear,
      fogFar: this.fogFar,
      fogDensity: this.fogDensity,
      ambientIntensity: this.ambientIntensity,
      exposure: this.exposure,
      enabled: this.enabled,
      cloudsEnabled: this.cloudsEnabled,
      cloudDensity: this.cloudDensity,
      cloudSpeed: this.cloudSpeed,
      cloudAltitude: this.cloudAltitude,
      cloudThickness: this.cloudThickness,
      rayleigh: this.rayleigh,
      turbidity: this.turbidity,
      mieCoefficient: this.mieCoefficient,
      mieDirectionalG: this.mieDirectionalG,
    };

    if (this._visualPreset !== undefined) {
      json.visualPreset = this._visualPreset;
    }

    return json;
  }

  fromJSON(data: EnvironmentComponentJSON): void {
    if (typeof data.skyboxType === 'string') this.skyboxType = data.skyboxType;
    if (Array.isArray(data.skyColor) && data.skyColor.length === 3) {
      this.skyColor = [...data.skyColor] as Vec3;
    }
    if (Array.isArray(data.horizonColor) && data.horizonColor.length === 3) {
      this.horizonColor = [...data.horizonColor] as Vec3;
    }
    if (Array.isArray(data.groundColor) && data.groundColor.length === 3) {
      this.groundColor = [...data.groundColor] as Vec3;
    }
    if (Array.isArray(data.sunDirection) && data.sunDirection.length === 3) {
      this.sunDirection = [...data.sunDirection] as Vec3;
    }
    if (Array.isArray(data.sunColor) && data.sunColor.length === 3) {
      this.sunColor = [...data.sunColor] as Vec3;
    }
    if (typeof data.sunIntensity === 'number') this._sunIntensity = Math.max(0, data.sunIntensity);
    if (typeof data.fogMode === 'string') this.fogMode = data.fogMode;
    if (Array.isArray(data.fogColor) && data.fogColor.length === 3) {
      this.fogColor = [...data.fogColor] as Vec3;
    }
    if (typeof data.fogNear === 'number') this.fogNear = data.fogNear;
    if (typeof data.fogFar === 'number') this.fogFar = data.fogFar;
    if (typeof data.fogDensity === 'number') this.fogDensity = data.fogDensity;
    if (typeof data.ambientIntensity === 'number')
      this._ambientIntensity = Math.max(0, Math.min(10, data.ambientIntensity));
    if (typeof data.exposure === 'number' && data.exposure > 0)
      this._exposure = Math.min(10, data.exposure);
    if (typeof data.enabled === 'boolean') this.enabled = data.enabled;
    if (typeof data.cloudsEnabled === 'boolean') this.cloudsEnabled = data.cloudsEnabled;
    if (typeof data.cloudDensity === 'number')
      this.cloudDensity = Math.max(0, Math.min(1, data.cloudDensity));
    if (typeof data.cloudSpeed === 'number')
      this.cloudSpeed = Math.max(0, Math.min(1, data.cloudSpeed));
    if (typeof data.cloudAltitude === 'number')
      this.cloudAltitude = Math.max(0, data.cloudAltitude);
    if (typeof data.cloudThickness === 'number')
      this.cloudThickness = Math.max(1, data.cloudThickness);
    // Physical sky parameters
    if (typeof data.rayleigh === 'number')
      this.rayleigh = Math.max(0, Math.min(10, data.rayleigh));
    if (typeof data.turbidity === 'number')
      this.turbidity = Math.max(0, Math.min(20, data.turbidity));
    if (typeof data.mieCoefficient === 'number')
      this.mieCoefficient = Math.max(0, Math.min(0.1, data.mieCoefficient));
    if (typeof data.mieDirectionalG === 'number')
      this.mieDirectionalG = Math.max(-1, Math.min(1, data.mieDirectionalG));
    if (
      data.visualPreset === 'stylized-balanced' ||
      data.visualPreset === 'cinematic' ||
      data.visualPreset === 'low'
    ) {
      this.visualPreset = data.visualPreset;
    }

    this.upgradeLegacyDefaults();
  }
}

registerComponent(EnvironmentComponent.type, EnvironmentComponent);
