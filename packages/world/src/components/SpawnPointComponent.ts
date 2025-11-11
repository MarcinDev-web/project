import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { WeaponPresetType } from '../types/weapon.js';

export interface SpawnPointComponentJSON {
  isDefault?: boolean;
  rotation?: number; // Yaw rotation in radians
  giveWeaponOnSpawn?: boolean;
  weaponPreset?: WeaponPresetType | undefined;
  givePvPLoadout?: boolean;
}

/**
 * SpawnPointComponent marks an entity as a potential player spawn location.
 *
 * Usage:
 * - Place entities with this component in the scene to define spawn points
 * - Mark one as `isDefault: true` to designate the primary spawn point
 * - The spawn system will use the entity's transform position for spawning
 * - Set `giveWeaponOnSpawn: true` to automatically give weapon to players spawning here
 */
export class SpawnPointComponent extends Component {
  static readonly type = 'SpawnPoint';

  /**
   * If true, this is the primary/default spawn point.
   * If multiple spawn points have isDefault=true, the first one found is used.
   */
  isDefault = false;

  /**
   * Optional spawn rotation (yaw) in radians.
   * If not set, uses the entity's rotation.
   */
  rotation = 0;

  /**
   * If true, automatically give weapon to player when they spawn at this point.
   * Requires either `weaponPreset` or `givePvPLoadout` to be set.
   */
  giveWeaponOnSpawn = false;

  /**
   * Weapon preset to give on spawn (if `giveWeaponOnSpawn` is true).
   * Ignored if `givePvPLoadout` is true.
   */
  weaponPreset?: WeaponPresetType | undefined;

  /**
   * If true, give full PvP loadout (rifle + pistol + sniper) on spawn.
   * Takes precedence over `weaponPreset`.
   */
  givePvPLoadout = false;

  getType(): string {
    return SpawnPointComponent.type;
  }

  override clone(): SpawnPointComponent {
    const clone = new SpawnPointComponent();
    clone.isDefault = this.isDefault;
    clone.rotation = this.rotation;
    clone.giveWeaponOnSpawn = this.giveWeaponOnSpawn;
    clone.weaponPreset = this.weaponPreset;
    clone.givePvPLoadout = this.givePvPLoadout;
    return clone;
  }

  override toJSON(): SpawnPointComponentJSON {
    return {
      isDefault: this.isDefault,
      rotation: this.rotation,
      giveWeaponOnSpawn: this.giveWeaponOnSpawn,
      weaponPreset: this.weaponPreset,
      givePvPLoadout: this.givePvPLoadout,
    };
  }

  fromJSON(data: SpawnPointComponentJSON): void {
    if (typeof data.isDefault === 'boolean') {
      this.isDefault = data.isDefault;
    }
    if (typeof data.rotation === 'number') {
      this.rotation = data.rotation;
    }
    if (typeof data.giveWeaponOnSpawn === 'boolean') {
      this.giveWeaponOnSpawn = data.giveWeaponOnSpawn;
    }
    if (data.weaponPreset !== undefined) {
      this.weaponPreset = data.weaponPreset;
    }
    if (typeof data.givePvPLoadout === 'boolean') {
      this.givePvPLoadout = data.givePvPLoadout;
    }
  }
}

registerComponent(SpawnPointComponent.type, SpawnPointComponent);
