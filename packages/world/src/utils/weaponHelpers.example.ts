/**
 * Weapon System Usage Examples
 *
 * This file demonstrates how creators can use the weapon system.
 * These are examples and won't be compiled in production builds.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Entity } from '../core/Entity.js';
import type { Scene } from '../core/Scene.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { InventorySystem } from '../systems/InventorySystem.js';
import {
  setupWeaponEntity,
  setupInventory,
  setupPvPLoadout,
  WeaponLoadouts,
  addAmmo,
  addAttachment,
  changeAmmoType,
  getEffectiveWeaponStats,
} from './weaponHelpers.js';

/**
 * Example 1: Simple weapon setup
 */
export function example1_SimpleWeapon(scene: Scene, entity: Entity) {
  // Setup entity with a rifle
  setupWeaponEntity(entity, 'rifle', {
    attachments: ['red_dot', 'vertical_grip'],
    ammoType: 'standard',
    ammoCount: 90,
  });

  // Get weapon systems
  const weaponSystem = new WeaponSystem(scene);
  new InventorySystem(scene);

  // Fire weapon
  weaponSystem.fire(entity, [0, 0, -1]); // Fire forward

  // Reload
  weaponSystem.reload(entity);
}

/**
 * Example 2: Inventory setup with multiple weapons
 */
export function example2_Inventory(scene: Scene, entity: Entity) {
  // Setup full inventory
  setupPvPLoadout(entity);

  // Or custom inventory
  setupInventory(entity, [
    { preset: 'rifle', attachments: ['red_dot'], ammoType: 'standard' },
    { preset: 'sniper', attachments: ['sniper_scope'], ammoType: 'armor_piercing' },
    { preset: 'pistol', ammoType: 'hollow_point' },
  ]);

  const inventorySystem = new InventorySystem(scene);
  const weaponSystem = new WeaponSystem(scene);

  // Switch to second weapon (index 1)
  inventorySystem.switchWeapon(entity, 1);

  // Fire active weapon
  weaponSystem.fire(entity);
}

/**
 * Example 3: Using weapon loadouts
 */
export function example3_Loadouts(entity: Entity) {
  // Quick setup with preset loadout
  WeaponLoadouts.assaultRifle(entity);
  WeaponLoadouts.sniper(entity);
  WeaponLoadouts.closeQuarters(entity);
}

/**
 * Example 4: Dynamic weapon customization
 */
export function example4_DynamicCustomization(scene: Scene, entity: Entity) {
  // Start with basic weapon
  setupWeaponEntity(entity, 'rifle');

  // Add attachment later
  addAttachment(entity, 'extended_mag');
  addAttachment(entity, 'suppressor');

  // Change ammo type
  changeAmmoType(entity, 'armor_piercing');

  // Add more ammo
  addAmmo(entity, 'armor_piercing', 30);

  // Check effective stats
  const stats = getEffectiveWeaponStats(entity);
  // eslint-disable-next-line no-console
  console.log('Effective damage:', stats?.damage);
  // eslint-disable-next-line no-console
  console.log('Effective spread:', stats?.spread);

  const weaponSystem = new WeaponSystem(scene);

  // Fire with modified stats
  weaponSystem.fire(entity);
}

/**
 * Example 5: Event handling
 */
export function example5_Events(scene: Scene, entity: Entity) {
  setupWeaponEntity(entity, 'rifle');

  // Listen to weapon events

  scene.events.on('weapon:fire', (event: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.log('Weapon fired:', event.damage, event.weaponType);
  });

  scene.events.on('weapon:reload', (event: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.log('Reloading:', event.reloadDuration);
  });

  // Inventory events

  scene.events.on('weapon:switched', (event: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.log('Weapon switched to index:', event.newWeaponIndex);
  });

  scene.events.on('inventory:updated', (event: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.log('Inventory action:', event.action);
  });
}

/**
 * Example 6: Ammo management
 */
export function example6_AmmoManagement(entity: Entity) {
  setupWeaponEntity(entity, 'rifle', {
    ammoType: 'standard',
    ammoCount: 90,
  });

  // Add different ammo types
  addAmmo(entity, 'armor_piercing', 30);
  addAmmo(entity, 'hollow_point', 20);
  addAmmo(entity, 'incendiary', 15);

  // Switch ammo type in weapon
  changeAmmoType(entity, 'armor_piercing');
}

/**
 * Example 7: Multiple weapons with different attachments
 */
export function example7_MultipleWeapons(scene: Scene, entity: Entity) {
  // Create inventory with different weapon configurations
  setupInventory(entity, [
    {
      preset: 'rifle',
      attachments: ['red_dot', 'vertical_grip', 'extended_mag'],
      ammoType: 'standard',
    },
    {
      preset: 'sniper',
      attachments: ['sniper_scope', 'long_barrel'],
      ammoType: 'armor_piercing',
    },
    {
      preset: 'smg',
      attachments: ['red_dot', 'fast_mag'],
      ammoType: 'standard',
    },
  ]);

  const inventorySystem = new InventorySystem(scene);
  const weaponSystem = new WeaponSystem(scene);

  // Switch and fire different weapons
  inventorySystem.switchWeapon(entity, 0); // Rifle
  weaponSystem.fire(entity);

  inventorySystem.switchWeapon(entity, 1); // Sniper
  weaponSystem.fire(entity);
}
