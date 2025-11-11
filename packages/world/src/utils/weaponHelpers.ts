/**
 * Weapon System Helper Utilities
 *
 * Easy-to-use functions for creators to set up and manage weapons, attachments, ammo, and inventory.
 */

import type { Entity } from '../core/Entity.js';
import { WeaponComponent } from '../components/WeaponComponent.js';
import { AttachmentComponent } from '../components/AttachmentComponent.js';
import { AmmoComponent } from '../components/AmmoComponent.js';
import {
  InventoryComponent,
  type InventoryComponentData,
} from '../components/InventoryComponent.js';
import { SpawnPointComponent } from '../components/SpawnPointComponent.js';
import { createWeapon } from '../factories/WeaponFactory.js';
import { getAttachment, getAllAttachments, getAttachmentsByType } from '../data/attachments.js';
import { getAmmoType, getAllAmmoTypes } from '../data/ammo.js';
import type { WeaponPresetType, AttachmentType, AmmoType } from '../types/weapon.js';

/**
 * Setup a weapon entity with weapon, attachments, and ammo
 * @param entity - Entity to setup
 * @param preset - Weapon preset type
 * @param options - Configuration options
 * @returns Weapon component
 */
export function setupWeaponEntity(
  entity: Entity,
  preset: WeaponPresetType,
  options?: {
    /** Attachment IDs to add */
    attachments?: string[];
    /** Ammo type to load */
    ammoType?: AmmoType;
    /** Ammo count */
    ammoCount?: number;
    /** Initial ammo in weapon */
    weaponAmmo?: number;
  }
): WeaponComponent {
  // Create weapon
  const weapon = createWeapon(preset);
  if (options?.weaponAmmo !== undefined) {
    weapon.ammo = options.weaponAmmo;
  } else {
    weapon.ammo = weapon.maxAmmo;
  }

  // Set ammo type
  if (options?.ammoType) {
    weapon.currentAmmoType = options.ammoType;
  }

  // Add weapon to entity
  entity.addComponent(weapon);

  // Setup attachments if provided
  if (options?.attachments && options.attachments.length > 0) {
    let attachmentComp = entity.getComponent(AttachmentComponent);
    if (!attachmentComp) {
      attachmentComp = new AttachmentComponent();
      entity.addComponent(attachmentComp);
    }

    for (const attachmentId of options.attachments) {
      const attachment = getAttachment(attachmentId);
      if (attachment) {
        attachmentComp.addAttachment(attachment);
      }
    }
  }

  // Setup ammo if provided
  if (options?.ammoType && options?.ammoCount !== undefined) {
    let ammoComp = entity.getComponent(AmmoComponent);
    if (!ammoComp) {
      ammoComp = new AmmoComponent();
      entity.addComponent(ammoComp);
    }
    ammoComp.addAmmo(options.ammoType, options.ammoCount);
  }

  return weapon;
}

/**
 * Setup an entity with weapon inventory
 * @param entity - Entity to setup
 * @param weapons - Array of weapon configurations
 * @returns Inventory component
 */
export function setupInventory(
  entity: Entity,
  weapons: Array<{
    preset: WeaponPresetType;
    attachments?: string[];
    ammoType?: AmmoType;
    weaponAmmo?: number;
  }>,
  options?: {
    /** Maximum weapons in inventory */
    maxWeapons?: number;
    /** Weapon switch duration */
    switchDuration?: number;
  }
): InventoryComponent {
  const inventoryData: InventoryComponentData = {};
  if (options?.maxWeapons !== undefined) {
    inventoryData.maxWeapons = options.maxWeapons;
  }
  const inventory = new InventoryComponent(inventoryData);
  if (options?.switchDuration !== undefined) {
    inventory.switchDuration = options.switchDuration;
  }

  entity.addComponent(inventory);

  // Add each weapon
  for (const weaponConfig of weapons) {
    const weapon = createWeapon(weaponConfig.preset);
    if (weaponConfig.weaponAmmo !== undefined) {
      weapon.ammo = weaponConfig.weaponAmmo;
    } else {
      weapon.ammo = weapon.maxAmmo;
    }

    if (weaponConfig.ammoType) {
      weapon.currentAmmoType = weaponConfig.ammoType;
    }

    inventory.addWeapon(weapon);
  }

  // Setup attachments for each weapon slot (stored on entity, applied globally)
  const hasAttachments = weapons.some((w) => w.attachments && w.attachments.length > 0);
  if (hasAttachments) {
    // Note: In current implementation, attachments are on entity, not per-weapon
    // For per-weapon attachments, you'd need to attach AttachmentComponent to weapon entities
    // This is a design decision - for now, attachments are entity-level
    let attachmentComp = entity.getComponent(AttachmentComponent);
    if (!attachmentComp) {
      attachmentComp = new AttachmentComponent();
      entity.addComponent(attachmentComp);
    }

    // Apply attachments from first weapon (or combine all)
    const allAttachmentIds = new Set<string>();
    for (const weaponConfig of weapons) {
      if (weaponConfig.attachments) {
        for (const id of weaponConfig.attachments) {
          allAttachmentIds.add(id);
        }
      }
    }

    for (const attachmentId of allAttachmentIds) {
      const attachment = getAttachment(attachmentId);
      if (attachment) {
        attachmentComp.addAttachment(attachment);
      }
    }
  }

  return inventory;
}

/**
 * Add ammo to entity's ammo component
 * @param entity - Entity with AmmoComponent
 * @param ammoType - Type of ammo to add
 * @param amount - Amount to add
 */
export function addAmmo(entity: Entity, ammoType: AmmoType, amount: number): void {
  let ammoComp = entity.getComponent(AmmoComponent);
  if (!ammoComp) {
    ammoComp = new AmmoComponent();
    entity.addComponent(ammoComp);
  }
  ammoComp.addAmmo(ammoType, amount);
}

/**
 * Add attachment to entity's weapon
 * @param entity - Entity with AttachmentComponent or WeaponComponent
 * @param attachmentId - Attachment ID to add
 * @returns true if added successfully
 */
export function addAttachment(entity: Entity, attachmentId: string): boolean {
  let attachmentComp = entity.getComponent(AttachmentComponent);
  if (!attachmentComp) {
    attachmentComp = new AttachmentComponent();
    entity.addComponent(attachmentComp);
  }

  const attachment = getAttachment(attachmentId);
  if (!attachment) {
    return false;
  }

  return attachmentComp.addAttachment(attachment);
}

/**
 * Remove attachment from entity's weapon
 * @param entity - Entity with AttachmentComponent
 * @param attachmentType - Attachment type to remove
 * @returns Removed attachment, or undefined if not found
 */
export function removeAttachment(entity: Entity, attachmentType: AttachmentType) {
  const attachmentComp = entity.getComponent(AttachmentComponent);
  if (!attachmentComp) {
    return undefined;
  }

  return attachmentComp.removeAttachment(attachmentType);
}

/**
 * Change weapon ammo type
 * @param entity - Entity with WeaponComponent or InventoryComponent
 * @param ammoType - New ammo type
 */
export function changeAmmoType(entity: Entity, ammoType: AmmoType): void {
  const inventory = entity.getComponent(InventoryComponent);
  if (inventory) {
    const weapon = inventory.getActiveWeapon();
    if (weapon) {
      weapon.currentAmmoType = ammoType;
    }
    return;
  }

  const weapon = entity.getComponent(WeaponComponent);
  if (weapon) {
    weapon.currentAmmoType = ammoType;
  }
}

/**
 * Get effective weapon stats (with attachments and ammo modifiers)
 * @param entity - Entity with WeaponComponent or InventoryComponent
 * @returns Effective stats object, or undefined if no weapon found
 */
export function getEffectiveWeaponStats(entity: Entity) {
  const inventory = entity.getComponent(InventoryComponent);
  const weapon = inventory ? inventory.getActiveWeapon() : entity.getComponent(WeaponComponent);

  if (!weapon) {
    return undefined;
  }

  const attachmentModifiers = entity.getComponent(AttachmentComponent)?.getEffectiveStats();
  const ammoTypeDef = getAmmoType(weapon.currentAmmoType);

  return {
    damage: weapon.getEffectiveDamage(attachmentModifiers, ammoTypeDef.effects.damageMultiplier),
    fireRate: weapon.getEffectiveFireRate(attachmentModifiers),
    range: weapon.getEffectiveRange(attachmentModifiers),
    spread: weapon.getEffectiveSpread(attachmentModifiers),
    maxAmmo: weapon.getEffectiveMaxAmmo(attachmentModifiers),
    reloadDuration: weapon.getEffectiveReloadDuration(attachmentModifiers),
    projectileSpeed: weapon.getEffectiveProjectileSpeed(attachmentModifiers),
  };
}

/**
 * Get available attachment IDs by type
 * @param type - Attachment type
 * @returns Array of attachment IDs
 */
export function getAvailableAttachmentsByType(type: AttachmentType): string[] {
  return getAttachmentsByType(type).map((att) => att.id);
}

/**
 * Get all available attachment IDs
 * @returns Array of all attachment IDs
 */
export function getAllAttachmentIds(): string[] {
  return getAllAttachments().map((att) => att.id);
}

/**
 * Get all available ammo types
 * @returns Array of all ammo type names
 */
export function getAllAmmoTypeNames(): AmmoType[] {
  return getAllAmmoTypes().map((ammo) => ammo.type);
}

/**
 * Quick setup for common weapon loadouts (PvP examples)
 */
export const WeaponLoadouts = {
  /**
   * Assault Rifle loadout
   */
  assaultRifle: (entity: Entity) => {
    return setupWeaponEntity(entity, 'rifle', {
      attachments: ['red_dot', 'vertical_grip', 'extended_mag'],
      ammoType: 'standard',
      ammoCount: 90,
    });
  },

  /**
   * Sniper loadout
   */
  sniper: (entity: Entity) => {
    return setupWeaponEntity(entity, 'sniper', {
      attachments: ['sniper_scope', 'long_barrel'],
      ammoType: 'armor_piercing',
      ammoCount: 20,
    });
  },

  /**
   * Close Quarters loadout (shotgun)
   */
  closeQuarters: (entity: Entity) => {
    return setupWeaponEntity(entity, 'shotgun', {
      attachments: ['short_barrel'],
      ammoType: 'hollow_point',
      ammoCount: 16,
    });
  },

  /**
   * SMG loadout
   */
  smg: (entity: Entity) => {
    return setupWeaponEntity(entity, 'smg', {
      attachments: ['red_dot', 'fast_mag'],
      ammoType: 'standard',
      ammoCount: 75,
    });
  },
};

/**
 * Quick setup for full inventory (PvP example)
 */
export function setupPvPLoadout(entity: Entity) {
  return setupInventory(
    entity,
    [
      {
        preset: 'rifle',
        attachments: ['red_dot', 'vertical_grip'],
        ammoType: 'standard',
        weaponAmmo: 30,
      },
      { preset: 'pistol', attachments: [], ammoType: 'standard', weaponAmmo: 12 },
      {
        preset: 'sniper',
        attachments: ['sniper_scope'],
        ammoType: 'armor_piercing',
        weaponAmmo: 5,
      },
    ],
    {
      maxWeapons: 9,
      switchDuration: 0.5,
    }
  );
}

/**
 * Spawn player at spawn point and give weapon if configured
 * Use this when spawning players in multiplayer PvP games
 * @param playerEntity - Player entity to spawn
 * @param spawnPointEntity - Spawn point entity with SpawnPointComponent
 * @param weaponPickupSystem - WeaponPickupSystem instance (optional, will give weapon if spawn point configured)
 */
export function spawnPlayerAtSpawnPoint(
  playerEntity: Entity,
  spawnPointEntity: Entity,
  weaponPickupSystem?: { giveWeaponOnSpawn: (player: Entity, spawn: Entity) => void }
): void {
  const spawnPoint = spawnPointEntity.getComponent(SpawnPointComponent);
  if (!spawnPoint) return;

  // Set player position and rotation
  const spawnPos = spawnPointEntity.transform.getWorldPosition();
  playerEntity.transform.position = [spawnPos[0], spawnPos[1], spawnPos[2]];
  
  if (spawnPoint.rotation !== 0) {
    // Apply rotation (yaw only for now)
    playerEntity.transform.rotation = [0, Math.sin(spawnPoint.rotation / 2), 0, Math.cos(spawnPoint.rotation / 2)];
  } else {
    // Use spawn point rotation
    playerEntity.transform.rotation = [...spawnPointEntity.transform.rotation];
  }

  // Give weapon if spawn point configured and system provided
  if (weaponPickupSystem) {
    weaponPickupSystem.giveWeaponOnSpawn(playerEntity, spawnPointEntity);
  }
}
