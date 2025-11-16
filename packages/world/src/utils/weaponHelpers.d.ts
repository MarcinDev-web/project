/**
 * Weapon System Helper Utilities
 *
 * Easy-to-use functions for creators to set up and manage weapons, attachments, ammo, and inventory.
 */
import type { Entity } from '../core/Entity.js';
import { WeaponComponent } from '../components/WeaponComponent.js';
import { InventoryComponent } from '../components/InventoryComponent.js';
import type { WeaponPresetType, AttachmentType, AmmoType } from '../types/weapon.js';
/**
 * Setup a weapon entity with weapon, attachments, and ammo
 * @param entity - Entity to setup
 * @param preset - Weapon preset type
 * @param options - Configuration options
 * @returns Weapon component
 */
export declare function setupWeaponEntity(entity: Entity, preset: WeaponPresetType, options?: {
    /** Attachment IDs to add */
    attachments?: string[];
    /** Ammo type to load */
    ammoType?: AmmoType;
    /** Ammo count */
    ammoCount?: number;
    /** Initial ammo in weapon */
    weaponAmmo?: number;
}): WeaponComponent;
/**
 * Setup an entity with weapon inventory
 * @param entity - Entity to setup
 * @param weapons - Array of weapon configurations
 * @returns Inventory component
 */
export declare function setupInventory(entity: Entity, weapons: Array<{
    preset: WeaponPresetType;
    attachments?: string[];
    ammoType?: AmmoType;
    weaponAmmo?: number;
}>, options?: {
    /** Maximum weapons in inventory */
    maxWeapons?: number;
    /** Weapon switch duration */
    switchDuration?: number;
}): InventoryComponent;
/**
 * Add ammo to entity's ammo component
 * @param entity - Entity with AmmoComponent
 * @param ammoType - Type of ammo to add
 * @param amount - Amount to add
 */
export declare function addAmmo(entity: Entity, ammoType: AmmoType, amount: number): void;
/**
 * Add attachment to entity's weapon
 * @param entity - Entity with AttachmentComponent or WeaponComponent
 * @param attachmentId - Attachment ID to add
 * @returns true if added successfully
 */
export declare function addAttachment(entity: Entity, attachmentId: string): boolean;
/**
 * Remove attachment from entity's weapon
 * @param entity - Entity with AttachmentComponent
 * @param attachmentType - Attachment type to remove
 * @returns Removed attachment, or undefined if not found
 */
export declare function removeAttachment(entity: Entity, attachmentType: AttachmentType): import("../types/weapon.js").AttachmentDefinition | undefined;
/**
 * Change weapon ammo type
 * @param entity - Entity with WeaponComponent or InventoryComponent
 * @param ammoType - New ammo type
 */
export declare function changeAmmoType(entity: Entity, ammoType: AmmoType): void;
/**
 * Get effective weapon stats (with attachments and ammo modifiers)
 * @param entity - Entity with WeaponComponent or InventoryComponent
 * @returns Effective stats object, or undefined if no weapon found
 */
export declare function getEffectiveWeaponStats(entity: Entity): {
    damage: number;
    fireRate: number;
    range: number;
    spread: number;
    maxAmmo: number;
    reloadDuration: number;
    projectileSpeed: number;
} | undefined;
/**
 * Get available attachment IDs by type
 * @param type - Attachment type
 * @returns Array of attachment IDs
 */
export declare function getAvailableAttachmentsByType(type: AttachmentType): string[];
/**
 * Get all available attachment IDs
 * @returns Array of all attachment IDs
 */
export declare function getAllAttachmentIds(): string[];
/**
 * Get all available ammo types
 * @returns Array of all ammo type names
 */
export declare function getAllAmmoTypeNames(): AmmoType[];
/**
 * Quick setup for common weapon loadouts (PvP examples)
 */
export declare const WeaponLoadouts: {
    /**
     * Assault Rifle loadout
     */
    assaultRifle: (entity: Entity) => WeaponComponent;
    /**
     * Sniper loadout
     */
    sniper: (entity: Entity) => WeaponComponent;
    /**
     * Pistol loadout (sidearm)
     */
    pistol: (entity: Entity) => WeaponComponent;
    /**
     * Close Quarters loadout (shotgun)
     */
    closeQuarters: (entity: Entity) => WeaponComponent;
    /**
     * SMG loadout
     */
    smg: (entity: Entity) => WeaponComponent;
};
/**
 * Quick setup for full inventory (PvP example)
 */
export declare function setupPvPLoadout(entity: Entity): InventoryComponent;
/**
 * Spawn player at spawn point and give weapon if configured
 * Use this when spawning players in multiplayer PvP games
 * @param playerEntity - Player entity to spawn
 * @param spawnPointEntity - Spawn point entity with SpawnPointComponent
 * @param weaponPickupSystem - WeaponPickupSystem instance (optional, will give weapon if spawn point configured)
 */
export declare function spawnPlayerAtSpawnPoint(playerEntity: Entity, spawnPointEntity: Entity, weaponPickupSystem?: {
    giveWeaponOnSpawn: (player: Entity, spawn: Entity) => void;
}): void;
//# sourceMappingURL=weaponHelpers.d.ts.map