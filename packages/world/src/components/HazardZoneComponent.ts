import { Component } from './Component.js';
import { registerComponent } from './registry.js';

export interface HazardZoneComponentJSON {
  damagePerSecond?: number;
  damageOnEnter?: number;
  killZone?: boolean;
}

/**
 * HazardZoneComponent - Damages or kills players in the zone
 *
 * Usage:
 * - Place on trigger zones or colliders
 * - Damages players who enter/stay in the zone
 * - Can be used for lava, spikes, etc.
 */
export class HazardZoneComponent extends Component {
  static readonly type = 'HazardZone';

  /**
   * Damage per second while in zone (0 = only on enter)
   */
  damagePerSecond = 0;

  /**
   * Instant damage on entering zone
   */
  damageOnEnter = 0;

  /**
   * If true, instantly kills player on enter
   */
  killZone = false;

  getType(): string {
    return HazardZoneComponent.type;
  }

  override clone(): HazardZoneComponent {
    const clone = new HazardZoneComponent();
    clone.damagePerSecond = this.damagePerSecond;
    clone.damageOnEnter = this.damageOnEnter;
    clone.killZone = this.killZone;
    return clone;
  }

  override toJSON(): HazardZoneComponentJSON {
    return {
      damagePerSecond: this.damagePerSecond,
      damageOnEnter: this.damageOnEnter,
      killZone: this.killZone,
    };
  }

  static fromJSON(data: HazardZoneComponentJSON): HazardZoneComponent {
    const component = new HazardZoneComponent();
    if (typeof data.damagePerSecond === 'number') {
      component.damagePerSecond = data.damagePerSecond;
    }
    if (typeof data.damageOnEnter === 'number') {
      component.damageOnEnter = data.damageOnEnter;
    }
    if (typeof data.killZone === 'boolean') {
      component.killZone = data.killZone;
    }
    return component;
  }
}

registerComponent(HazardZoneComponent.type, HazardZoneComponent);
