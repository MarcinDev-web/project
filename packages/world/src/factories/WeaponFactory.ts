import { WeaponComponent, type WeaponComponentData } from '../components/WeaponComponent.js';
import type { WeaponPresetType } from '../types/weapon.js';
import { getWeaponPreset } from '../data/weapons.js';

/**
 * Create a weapon component from a preset
 * @param preset - Weapon preset type
 * @param attachmentIds - Optional array of attachment IDs (for reference, apply via AttachmentComponent)
 * @returns New WeaponComponent instance
 */
export function createWeapon(
  preset: WeaponPresetType,
  attachmentIds?: string[]
): WeaponComponent {
  const presetData = getWeaponPreset(preset);
  
  // Create base weapon from preset
  const weaponData: WeaponComponentData = {
    type: presetData.type,
    damage: presetData.damage,
    fireRate: presetData.fireRate,
    range: presetData.range,
    spread: presetData.spread,
    maxAmmo: presetData.maxAmmo,
    reloadDuration: presetData.reloadDuration,
  };
  
  if (presetData.projectileSpeed !== undefined) {
    weaponData.projectileSpeed = presetData.projectileSpeed;
  }
  if (presetData.projectileLifetime !== undefined) {
    weaponData.projectileLifetime = presetData.projectileLifetime;
  }
  
  const weapon = new WeaponComponent(weaponData);

  // Store preset type for reference
  weapon.weaponPreset = preset;

  // Store attachment IDs for reference (attachments are applied via AttachmentComponent)
  if (attachmentIds && attachmentIds.length > 0) {
    (weapon as { _initialAttachmentIds?: string[] })._initialAttachmentIds = attachmentIds;
  }

  return weapon;
}

/**
 * Create a custom weapon with manual stats
 * @param stats - Custom weapon stats
 * @returns New WeaponComponent instance
 */
export function createCustomWeapon(stats: {
  type?: 'hitscan' | 'projectile';
  damage?: number;
  fireRate?: number;
  range?: number;
  spread?: number;
  maxAmmo?: number;
  reloadDuration?: number;
  projectileSpeed?: number;
  projectileLifetime?: number;
}): WeaponComponent {
  return new WeaponComponent(stats);
}
