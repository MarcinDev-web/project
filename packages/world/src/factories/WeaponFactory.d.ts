import { WeaponComponent } from '../components/WeaponComponent.js';
import type { WeaponPresetType } from '../types/weapon.js';
/**
 * Create a weapon component from a preset
 * @param preset - Weapon preset type
 * @param attachmentIds - Optional array of attachment IDs (for reference, apply via AttachmentComponent)
 * @returns New WeaponComponent instance
 */
export declare function createWeapon(preset: WeaponPresetType, attachmentIds?: string[]): WeaponComponent;
/**
 * Create a custom weapon with manual stats
 * @param stats - Custom weapon stats
 * @returns New WeaponComponent instance
 */
export declare function createCustomWeapon(stats: {
    type?: 'hitscan' | 'projectile';
    damage?: number;
    fireRate?: number;
    range?: number;
    spread?: number;
    maxAmmo?: number;
    reloadDuration?: number;
    projectileSpeed?: number;
    projectileLifetime?: number;
}): WeaponComponent;
//# sourceMappingURL=WeaponFactory.d.ts.map