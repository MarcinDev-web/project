import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { Vec3 } from '@engine/core/math';

/**
 * Types of lights supported by the lighting system
 */
export type LightType = 'directional' | 'point' | 'spot' | 'ambient';

/**
 * Light component for entities that emit light
 */
export class LightComponent extends Component {
  static readonly type = 'Light';

  /** Type of light source */
  lightType: LightType = 'directional';

  /** Light color (RGB, 0-1 range) */
  color: Vec3 = [1, 1, 1];

  /** Light intensity multiplier */
  intensity: number = 1.0;

  /** Range for point/spot lights (world units) */
  range: number = 10.0;

  /** Direction for directional/spot lights (normalized) */
  direction: Vec3 = [0, -1, 0];

  /** Inner cone angle for spot lights (radians) */
  innerConeAngle: number = Math.PI / 6; // 30 degrees

  /** Outer cone angle for spot lights (radians) */
  outerConeAngle: number = Math.PI / 4; // 45 degrees

  /** Whether this light is enabled */
  enabled: boolean = true;

  getType(): string {
    return LightComponent.type;
  }

  clone(): LightComponent {
    const clone = new LightComponent();
    clone.lightType = this.lightType;
    clone.color = [...this.color] as Vec3;
    clone.intensity = this.intensity;
    clone.range = this.range;
    clone.direction = [...this.direction] as Vec3;
    clone.innerConeAngle = this.innerConeAngle;
    clone.outerConeAngle = this.outerConeAngle;
    clone.enabled = this.enabled;
    return clone;
  }

  toJSON(): Record<string, unknown> {
    return {
      lightType: this.lightType,
      color: [...this.color],
      intensity: this.intensity,
      range: this.range,
      direction: [...this.direction],
      innerConeAngle: this.innerConeAngle,
      outerConeAngle: this.outerConeAngle,
      enabled: this.enabled,
    };
  }

  fromJSON(data: Record<string, unknown>): void {
    if (typeof data.lightType === 'string') this.lightType = data.lightType as LightType;
    if (Array.isArray(data.color) && data.color.length === 3) {
      this.color = [...data.color] as Vec3;
    }
    if (typeof data.intensity === 'number') this.intensity = data.intensity;
    if (typeof data.range === 'number') this.range = data.range;
    if (Array.isArray(data.direction) && data.direction.length === 3) {
      this.direction = [...data.direction] as Vec3;
    }
    if (typeof data.innerConeAngle === 'number') this.innerConeAngle = data.innerConeAngle;
    if (typeof data.outerConeAngle === 'number') this.outerConeAngle = data.outerConeAngle;
    if (typeof data.enabled === 'boolean') this.enabled = data.enabled;
  }
}

registerComponent(LightComponent.type, LightComponent);
