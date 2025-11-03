import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { Vec3 } from '@engine/core/math';

export interface SpeedZoneComponentJSON {
  speedMultiplier?: number;
  direction?: [number, number, number];
}

/**
 * SpeedZoneComponent - Modifies player movement speed/direction
 *
 * Usage:
 * - Place on trigger zones to boost player speed
 * - Can apply directional boosts or speed multipliers
 */
export class SpeedZoneComponent extends Component {
  static readonly type = 'SpeedZone';

  /**
   * Speed multiplier (1.0 = normal, 2.0 = double speed)
   */
  speedMultiplier = 1.5;

  /**
   * Optional directional boost (if set, applies force in this direction)
   */
  direction?: Vec3;

  /**
   * Boost force magnitude (if direction is set)
   */
  boostForce = 5.0;

  getType(): string {
    return SpeedZoneComponent.type;
  }

  override clone(): SpeedZoneComponent {
    const clone = new SpeedZoneComponent();
    clone.speedMultiplier = this.speedMultiplier;
    if (this.direction) {
      clone.direction = [...this.direction] as Vec3;
    }
    clone.boostForce = this.boostForce;
    return clone;
  }

  override toJSON(): SpeedZoneComponentJSON {
    const result: SpeedZoneComponentJSON = {
      speedMultiplier: this.speedMultiplier,
    };
    if (this.direction) {
      result.direction = [...this.direction] as [number, number, number];
    }
    return result;
  }

  static fromJSON(data: SpeedZoneComponentJSON): SpeedZoneComponent {
    const component = new SpeedZoneComponent();
    if (typeof data.speedMultiplier === 'number') {
      component.speedMultiplier = data.speedMultiplier;
    }
    if (Array.isArray(data.direction) && data.direction.length === 3) {
      component.direction = data.direction as Vec3;
    }
    return component;
  }
}

registerComponent(SpeedZoneComponent.type, SpeedZoneComponent);

