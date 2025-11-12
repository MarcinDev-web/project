import { Component } from './Component.js';
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
export declare class WeaponPickupComponent extends Component {
    static readonly type = "WeaponPickup";
    /**
     * Weapon preset type (if set, weapon will be recreated on pickup)
     * If not set, uses the existing WeaponComponent on the entity
     */
    weaponPreset?: WeaponPresetType | undefined;
    /**
     * Whether this weapon can currently be picked up
     */
    canBePickedUp: boolean;
    /**
     * Time in seconds before weapon respawns (if autoRespawn is true)
     */
    respawnTime: number;
    /**
     * Whether weapon automatically respawns after being picked up
     */
    autoRespawn: boolean;
    /**
     * Time when weapon was picked up (for respawn timer)
     */
    pickedUpAt: number;
    getType(): string;
    clone(): WeaponPickupComponent;
    toJSON(): WeaponPickupComponentJSON;
    fromJSON(data: WeaponPickupComponentJSON): void;
}
//# sourceMappingURL=WeaponPickupComponent.d.ts.map