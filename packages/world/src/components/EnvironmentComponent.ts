import { Component } from './Component';
import { registerComponent } from './registry';
import type { Vec3 } from '@engine/core/math';

/**
 * Types of skybox rendering supported
 */
export type SkyboxType = 'solid' | 'gradient' | 'procedural-sky' | 'cubemap';

/**
 * Fog modes for distance-based atmosphere
 */
export type FogMode = 'none' | 'linear' | 'exponential' | 'exponential-squared';

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
  skyColor: Vec3 = [0.4, 0.6, 0.9];

  /** Horizon color for gradient and procedural sky */
  horizonColor: Vec3 = [0.8, 0.85, 0.9];

  /** Ground color (bottom) for gradient mode */
  groundColor: Vec3 = [0.3, 0.35, 0.4];

  /** Sun direction (normalized) for procedural sky */
  sunDirection: Vec3 = [0.3, 0.7, 0.5];

  /** Sun color for procedural sky */
  sunColor: Vec3 = [1.0, 0.95, 0.8];

  /** Sun intensity multiplier */
  sunIntensity: number = 1.0;

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
  ambientIntensity: number = 0.6;

  /** Exposure adjustment for HDR environments */
  exposure: number = 1.0;

  /** Whether environment rendering is enabled */
  enabled: boolean = true;

  getType(): string {
    return EnvironmentComponent.type;
  }

  /**
   * Normalizes the sun direction vector
   */
  normalizeSunDirection(): void {
    const len = Math.sqrt(
      this.sunDirection[0] * this.sunDirection[0] +
        this.sunDirection[1] * this.sunDirection[1] +
        this.sunDirection[2] * this.sunDirection[2]
    );
    if (len > 0.0001) {
      this.sunDirection[0] /= len;
      this.sunDirection[1] /= len;
      this.sunDirection[2] /= len;
    } else {
      // Default upward direction
      this.sunDirection = [0, 1, 0];
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

    this.sunDirection = [azimuth * 0.3, elevation, 0.5];
    this.normalizeSunDirection();

    // Adjust colors based on time of day
    if (hours < 6 || hours > 20) {
      // Night
      this.skyColor = [0.01, 0.02, 0.05];
      this.horizonColor = [0.05, 0.05, 0.1];
      this.sunIntensity = 0.0;
    } else if (hours < 8 || hours > 18) {
      // Dawn/Dusk
      const t = hours < 8 ? (hours - 6) / 2 : (20 - hours) / 2;
      this.skyColor = [0.4 * t, 0.3 * t, 0.5 * t];
      this.horizonColor = [1.0, 0.5 + 0.3 * t, 0.3 + 0.5 * t];
      this.sunIntensity = t * 0.8;
    } else {
      // Day
      this.skyColor = [0.4, 0.6, 0.9];
      this.horizonColor = [0.8, 0.85, 0.9];
      this.sunIntensity = 1.0;
    }
  }

  override clone(): EnvironmentComponent {
    const clone = new EnvironmentComponent();
    clone.skyboxType = this.skyboxType;
    clone.skyColor = [...this.skyColor] as Vec3;
    clone.horizonColor = [...this.horizonColor] as Vec3;
    clone.groundColor = [...this.groundColor] as Vec3;
    clone.sunDirection = [...this.sunDirection] as Vec3;
    clone.sunColor = [...this.sunColor] as Vec3;
    clone.sunIntensity = this.sunIntensity;
    clone.fogMode = this.fogMode;
    clone.fogColor = [...this.fogColor] as Vec3;
    clone.fogNear = this.fogNear;
    clone.fogFar = this.fogFar;
    clone.fogDensity = this.fogDensity;
    clone.ambientIntensity = this.ambientIntensity;
    clone.exposure = this.exposure;
    clone.enabled = this.enabled;
    return clone;
  }

  override toJSON(): EnvironmentComponentJSON {
    return {
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
    };
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
    if (typeof data.sunIntensity === 'number') this.sunIntensity = data.sunIntensity;
    if (typeof data.fogMode === 'string') this.fogMode = data.fogMode;
    if (Array.isArray(data.fogColor) && data.fogColor.length === 3) {
      this.fogColor = [...data.fogColor] as Vec3;
    }
    if (typeof data.fogNear === 'number') this.fogNear = data.fogNear;
    if (typeof data.fogFar === 'number') this.fogFar = data.fogFar;
    if (typeof data.fogDensity === 'number') this.fogDensity = data.fogDensity;
    if (typeof data.ambientIntensity === 'number') this.ambientIntensity = data.ambientIntensity;
    if (typeof data.exposure === 'number') this.exposure = data.exposure;
    if (typeof data.enabled === 'boolean') this.enabled = data.enabled;
  }
}

registerComponent(EnvironmentComponent.type, EnvironmentComponent);

