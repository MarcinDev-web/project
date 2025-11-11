import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { WeaponPresetType } from '../types/weapon.js';

export interface WeaponPickupComponentJSON {
  weaponPreset?: WeaponPresetType | undefined;
  canBePickedUp?: boolean;
  respawnTime?: number;
  autoRespawn?: boolean;
}

/**
 * WeaponPickupComponent marks an entity as a weapon that can be picked up from the ground.
 * 
 * Usage:
 * - Add this component to an entity with WeaponComponent to make it pickuppable
 * - Players can walk over it to pick it up
 * - Optionally respawns after being picked up
 */
export class WeaponPickupComponent extends Component {
  static readonly type = 'WeaponPickup';

  /**
   * Weapon preset type (if set, weapon will be recreated on pickup)
   * If not set, uses the existing WeaponComponent on the entity
   */
  weaponPreset?: WeaponPresetType | undefined;

  /**
   * Whether this weapon can currently be picked up
   */
  canBePickedUp = true;

  /**
   * Time in seconds before weapon respawns (if autoRespawn is true)
   */
  respawnTime = 10.0;

  /**
   * Whether weapon automatically respawns after being picked up
   */
  autoRespawn = false;

  /**
   * Time when weapon was picked up (for respawn timer)
   */
  pickedUpAt: number = -Infinity;

  getType(): string {
    return WeaponPickupComponent.type;
  }

  override clone(): WeaponPickupComponent {
    const clone = new WeaponPickupComponent();
    clone.weaponPreset = this.weaponPreset;
    clone.canBePickedUp = this.canBePickedUp;
    clone.respawnTime = this.respawnTime;
    clone.autoRespawn = this.autoRespawn;
    clone.pickedUpAt = this.pickedUpAt;
    return clone;
  }

  override toJSON(): WeaponPickupComponentJSON {
    return {
      weaponPreset: this.weaponPreset,
      canBePickedUp: this.canBePickedUp,
      respawnTime: this.respawnTime,
      autoRespawn: this.autoRespawn,
    };
  }

  fromJSON(data: WeaponPickupComponentJSON): void {
    if (data.weaponPreset !== undefined) {
      this.weaponPreset = data.weaponPreset;
    }
    if (typeof data.canBePickedUp === 'boolean') {
      this.canBePickedUp = data.canBePickedUp;
    }
    if (typeof data.respawnTime === 'number') {
      this.respawnTime = data.respawnTime;
    }
    if (typeof data.autoRespawn === 'boolean') {
      this.autoRespawn = data.autoRespawn;
    }
  }
}

registerComponent(WeaponPickupComponent.type, WeaponPickupComponent);

