import { Component } from './Component.js';
import type { WeaponPresetType } from '../types/weapon.js';
export interface SpawnPointComponentJSON {
    isDefault?: boolean;
    rotation?: number;
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
export declare class SpawnPointComponent extends Component {
    static readonly type = "SpawnPoint";
    /**
     * If true, this is the primary/default spawn point.
     * If multiple spawn points have isDefault=true, the first one found is used.
     */
    isDefault: boolean;
    /**
     * Optional spawn rotation (yaw) in radians.
     * If not set, uses the entity's rotation.
     */
    rotation: number;
    /**
     * If true, automatically give weapon to player when they spawn at this point.
     * Requires either `weaponPreset` or `givePvPLoadout` to be set.
     */
    giveWeaponOnSpawn: boolean;
    /**
     * Weapon preset to give on spawn (if `giveWeaponOnSpawn` is true).
     * Ignored if `givePvPLoadout` is true.
     */
    weaponPreset?: WeaponPresetType | undefined;
    /**
     * If true, give full PvP loadout (rifle + pistol + sniper) on spawn.
     * Takes precedence over `weaponPreset`.
     */
    givePvPLoadout: boolean;
    getType(): string;
    clone(): SpawnPointComponent;
    toJSON(): SpawnPointComponentJSON;
    fromJSON(data: SpawnPointComponentJSON): void;
}
//# sourceMappingURL=SpawnPointComponent.d.ts.map