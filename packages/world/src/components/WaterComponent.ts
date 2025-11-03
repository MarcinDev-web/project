import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { Vec2, Vec4 } from '@engine/core/math';

export interface WaterComponentJSON {
  size?: Vec2;
  waveSpeed?: number;
  waveHeight?: number;
  waveFrequency?: number;
  waveDirection?: Vec2;
  waterColor?: Vec4;
  foamColor?: Vec4;
  foamThreshold?: number;
  transparency?: number;
  refractionStrength?: number;
  reflectionStrength?: number;
  causticsEnabled?: boolean;
  enabled?: boolean;
}

/**
 * WaterComponent defines water rendering properties for a water body entity.
 * Each entity with a WaterComponent represents a single water plane.
 */
export class WaterComponent extends Component {
  static readonly type = 'Water';

  /** Water plane dimensions (width, height) in world units */
  size: Vec2 = [10, 10];

  /** Wave animation speed (phase speed multiplier) */
  waveSpeed: number = 1.0;

  /** Wave amplitude (height) in world units */
  waveHeight: number = 0.3;

  /** Wave frequency (how many waves per unit) */
  waveFrequency: number = 1.0;

  /** Primary wave direction (normalized 2D vector) */
  waveDirection: Vec2 = [1, 0];

  /** Base water color (RGBA) */
  waterColor: Vec4 = [0.2, 0.5, 0.8, 0.7];

  /** Foam color at edges and wave peaks (RGBA) */
  foamColor: Vec4 = [1.0, 1.0, 1.0, 0.9];

  /** Foam generation threshold (0-1, higher = more foam) */
  foamThreshold: number = 0.7;

  /** Water transparency (0 = opaque, 1 = fully transparent) */
  transparency: number = 0.3;

  /** Refraction distortion strength */
  refractionStrength: number = 0.1;

  /** Reflection intensity (0-1) */
  reflectionStrength: number = 0.8;

  /** Enable caustics effect (light patterns underwater) */
  causticsEnabled: boolean = true;

  /** Whether water rendering is enabled */
  enabled: boolean = true;

  getType(): string {
    return WaterComponent.type;
  }

  /**
   * Normalizes the wave direction vector to ensure it's unit length
   */
  normalizeWaveDirection(): void {
    const len = Math.sqrt(
      this.waveDirection[0] * this.waveDirection[0] +
        this.waveDirection[1] * this.waveDirection[1]
    );
    if (len > 0.0001) {
      this.waveDirection[0] /= len;
      this.waveDirection[1] /= len;
    } else {
      // Default to positive X direction
      this.waveDirection = [1, 0];
    }
  }

  override clone(): WaterComponent {
    const clone = new WaterComponent();
    clone.size = [...this.size] as Vec2;
    clone.waveSpeed = this.waveSpeed;
    clone.waveHeight = this.waveHeight;
    clone.waveFrequency = this.waveFrequency;
    clone.waveDirection = [...this.waveDirection] as Vec2;
    clone.waterColor = [...this.waterColor] as Vec4;
    clone.foamColor = [...this.foamColor] as Vec4;
    clone.foamThreshold = this.foamThreshold;
    clone.transparency = this.transparency;
    clone.refractionStrength = this.refractionStrength;
    clone.reflectionStrength = this.reflectionStrength;
    clone.causticsEnabled = this.causticsEnabled;
    clone.enabled = this.enabled;
    return clone;
  }

  override toJSON(): WaterComponentJSON {
    return {
      size: [...this.size] as Vec2,
      waveSpeed: this.waveSpeed,
      waveHeight: this.waveHeight,
      waveFrequency: this.waveFrequency,
      waveDirection: [...this.waveDirection] as Vec2,
      waterColor: [...this.waterColor] as Vec4,
      foamColor: [...this.foamColor] as Vec4,
      foamThreshold: this.foamThreshold,
      transparency: this.transparency,
      refractionStrength: this.refractionStrength,
      reflectionStrength: this.reflectionStrength,
      causticsEnabled: this.causticsEnabled,
      enabled: this.enabled,
    };
  }

  fromJSON(data: WaterComponentJSON): void {
    if (Array.isArray(data.size) && data.size.length === 2) {
      this.size = [...data.size] as Vec2;
    }
    if (typeof data.waveSpeed === 'number' && Number.isFinite(data.waveSpeed)) {
      this.waveSpeed = data.waveSpeed;
    }
    if (typeof data.waveHeight === 'number' && Number.isFinite(data.waveHeight)) {
      this.waveHeight = Math.max(0, data.waveHeight);
    }
    if (typeof data.waveFrequency === 'number' && Number.isFinite(data.waveFrequency)) {
      this.waveFrequency = Math.max(0.001, data.waveFrequency);
    }
    if (Array.isArray(data.waveDirection) && data.waveDirection.length === 2) {
      this.waveDirection = [...data.waveDirection] as Vec2;
      this.normalizeWaveDirection();
    }
    if (Array.isArray(data.waterColor) && data.waterColor.length === 4) {
      this.waterColor = [...data.waterColor] as Vec4;
    }
    if (Array.isArray(data.foamColor) && data.foamColor.length === 4) {
      this.foamColor = [...data.foamColor] as Vec4;
    }
    if (typeof data.foamThreshold === 'number' && Number.isFinite(data.foamThreshold)) {
      this.foamThreshold = Math.max(0, Math.min(1, data.foamThreshold));
    }
    if (typeof data.transparency === 'number' && Number.isFinite(data.transparency)) {
      this.transparency = Math.max(0, Math.min(1, data.transparency));
    }
    if (typeof data.refractionStrength === 'number' && Number.isFinite(data.refractionStrength)) {
      this.refractionStrength = Math.max(0, data.refractionStrength);
    }
    if (typeof data.reflectionStrength === 'number' && Number.isFinite(data.reflectionStrength)) {
      this.reflectionStrength = Math.max(0, Math.min(1, data.reflectionStrength));
    }
    if (typeof data.causticsEnabled === 'boolean') {
      this.causticsEnabled = data.causticsEnabled;
    }
    if (typeof data.enabled === 'boolean') {
      this.enabled = data.enabled;
    }
  }
}

registerComponent(WaterComponent.type, WaterComponent);

