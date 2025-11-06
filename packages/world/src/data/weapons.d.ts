import type { WeaponPresetType } from '../types/weapon.js';
import type { WeaponType } from '../components/WeaponComponent.js';
/**
 * Base weapon stats definition
 */
export interface WeaponPresetData {
    /** Weapon preset type */
    preset: WeaponPresetType;
    /** Weapon type (hitscan or projectile) */
    type: WeaponType;
    /** Damage per shot */
    damage: number;
    /** Fire rate in shots per second */
    fireRate: number;
    /** Maximum range for hitscan, or projectile lifetime for projectile */
    range: number;
    /** Spread angle in radians (for hitscan) */
    spread: number;
    /** Maximum ammo capacity */
    maxAmmo: number;
    /** Reload duration in seconds */
    reloadDuration: number;
    /** Projectile speed (for projectile type only) */
    projectileSpeed?: number;
    /** Projectile lifetime in seconds (overrides range for projectile type) */
    projectileLifetime?: number;
}
/**
 * Weapon presets for PvP gameplay
 * Balanced for competitive play
 */
export declare const WEAPON_PRESETS: Record<WeaponPresetType, WeaponPresetData>;
/**
 * Get weapon preset data by preset type
 * @param preset - Weapon preset type
 * @returns Weapon preset data
 */
export declare function getWeaponPreset(preset: WeaponPresetType): WeaponPresetData;
/**
 * Get all available weapon presets
 * @returns Array of all weapon preset types
 */
export declare function getAllWeaponPresets(): WeaponPresetType[];
//# sourceMappingURL=weapons.d.ts.map