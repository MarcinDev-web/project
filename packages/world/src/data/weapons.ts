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
export const WEAPON_PRESETS: Record<WeaponPresetType, WeaponPresetData> = {
  rifle: {
    preset: 'rifle',
    type: 'hitscan',
    damage: 30,
    fireRate: 10, // 600 RPM
    range: 150,
    spread: 0.015,
    maxAmmo: 30,
    reloadDuration: 2.5,
  },
  shotgun: {
    preset: 'shotgun',
    type: 'projectile',
    damage: 25, // Per pellet, should fire multiple pellets
    fireRate: 1.5, // 90 RPM
    range: 20, // Short range
    spread: 0.08, // High spread
    maxAmmo: 8,
    reloadDuration: 3.0,
    projectileSpeed: 40,
    projectileLifetime: 0.5, // Short lifetime for close range
  },
  sniper: {
    preset: 'sniper',
    type: 'hitscan',
    damage: 100,
    fireRate: 1.5, // 90 RPM
    range: 300,
    spread: 0.001, // Very low spread
    maxAmmo: 5,
    reloadDuration: 3.5,
  },
  pistol: {
    preset: 'pistol',
    type: 'hitscan',
    damage: 25,
    fireRate: 6, // 360 RPM
    range: 80,
    spread: 0.025,
    maxAmmo: 12,
    reloadDuration: 2.0,
  },
  smg: {
    preset: 'smg',
    type: 'hitscan',
    damage: 20,
    fireRate: 12, // 720 RPM
    range: 100,
    spread: 0.03,
    maxAmmo: 25,
    reloadDuration: 2.2,
  },
  custom: {
    preset: 'custom',
    type: 'hitscan',
    damage: 25,
    fireRate: 10,
    range: 100,
    spread: 0.02,
    maxAmmo: 30,
    reloadDuration: 2.0,
  },
} as const;

/**
 * Get weapon preset data by preset type
 * @param preset - Weapon preset type
 * @returns Weapon preset data
 */
export function getWeaponPreset(preset: WeaponPresetType): WeaponPresetData {
  return WEAPON_PRESETS[preset];
}

/**
 * Get all available weapon presets
 * @returns Array of all weapon preset types
 */
export function getAllWeaponPresets(): WeaponPresetType[] {
  return Object.keys(WEAPON_PRESETS) as WeaponPresetType[];
}
