import { Component } from './Component';
import { registerComponent } from './registry';
import type { Vec3 } from '@engine/core';

export interface LaunchPadComponentJSON {
  force?: number;
  direction?: [number, number, number];
}

/**
 * LaunchPadComponent - Launches player in a specific direction
 *
 * Usage:
 * - Place to launch players in a direction
 * - Useful for parkour and platforming
 */
export class LaunchPadComponent extends Component {
  static readonly type = 'LaunchPad';

  /**
   * Launch force magnitude
   */
  force = 10.0;

  /**
   * Launch direction (normalized)
   */
  direction: Vec3 = [0, 1, 0];

  /**
   * Activation radius in world units
   */
  activationRadius = 1.5;

  /**
   * Cooldown period in milliseconds (0 = no cooldown)
   */
  cooldownMs = 500;

  getType(): string {
    return LaunchPadComponent.type;
  }

  override clone(): LaunchPadComponent {
    const clone = new LaunchPadComponent();
    clone.force = this.force;
    clone.direction = [...this.direction] as Vec3;
    clone.activationRadius = this.activationRadius;
    clone.cooldownMs = this.cooldownMs;
    return clone;
  }

  override toJSON(): LaunchPadComponentJSON {
    return {
      force: this.force,
      direction: [...this.direction] as [number, number, number],
    };
  }

  static fromJSON(data: LaunchPadComponentJSON): LaunchPadComponent {
    const component = new LaunchPadComponent();
    if (typeof data.force === 'number') {
      component.force = data.force;
    }
    if (Array.isArray(data.direction) && data.direction.length === 3) {
      component.direction = data.direction as Vec3;
    }
    return component;
  }
}

registerComponent(LaunchPadComponent.type, LaunchPadComponent);

