import type { Entity } from '../core/Entity.js';
import type { Vec3 } from '@engine/core/math';

/**
 * Weapon fire event data
 */
export interface WeaponFireEvent {
  /** Entity that fired the weapon */
  entity: Entity;
  /** Weapon type ('hitscan' | 'projectile') */
  weaponType: 'hitscan' | 'projectile';
  /** Fire direction in world space */
  direction: Vec3;
  /** Fire origin in world space */
  origin: Vec3;
  /** Spread applied to direction (radians) */
  spread: number;
  /** Damage dealt (for hitscan) */
  damage: number;
}

/**
 * Weapon reload event data
 */
export interface WeaponReloadEvent {
  /** Entity with the weapon */
  entity: Entity;
  /** Old ammo count */
  oldAmmo: number;
  /** New ammo count */
  newAmmo: number;
  /** Reload duration in seconds */
  reloadDuration: number;
}

/**
 * Weapon out of ammo event data
 */
export interface WeaponOutOfAmmoEvent {
  /** Entity with the weapon */
  entity: Entity;
}

/**
 * Projectile hit event data
 */
export interface ProjectileHitEvent {
  /** Projectile entity */
  projectile: Entity;
  /** Hit entity (if any) */
  hitEntity: Entity | null;
  /** Hit point in world space */
  hitPoint: Vec3;
  /** Hit normal (surface normal) */
  hitNormal: Vec3;
  /** Damage to apply */
  damage: number;
  /** Owner entity ID that fired the projectile */
  ownerId: string;
}

/**
 * Weapon preset type (category of weapon)
 */
export type WeaponPresetType = 'rifle' | 'shotgun' | 'sniper' | 'pistol' | 'smg' | 'custom';

/**
 * Attachment type (slot type)
 */
export type AttachmentType = 'scope' | 'suppressor' | 'grip' | 'magazine' | 'barrel';

/**
 * Attachment slot definition
 */
export interface AttachmentSlot {
  /** Slot type */
  type: AttachmentType;
  /** Maximum attachments of this type (usually 1, but can be more for some slots) */
  maxCount?: number;
}

/**
 * Stat modifiers for attachments
 */
export interface StatModifiers {
  /** Damage multiplier (e.g., 1.1 = +10%) */
  damageMultiplier?: number;
  /** Fire rate multiplier (e.g., 0.9 = -10%) */
  fireRateMultiplier?: number;
  /** Range multiplier */
  rangeMultiplier?: number;
  /** Spread multiplier (e.g., 0.8 = -20% spread = better accuracy) */
  spreadMultiplier?: number;
  /** Max ammo multiplier */
  maxAmmoMultiplier?: number;
  /** Reload duration multiplier (e.g., 1.2 = +20% reload time) */
  reloadDurationMultiplier?: number;
  /** Projectile speed multiplier */
  projectileSpeedMultiplier?: number;
  /** Additive damage (added after multipliers) */
  damageAdditive?: number;
  /** Additive range */
  rangeAdditive?: number;
  /** Additive max ammo */
  maxAmmoAdditive?: number;
}

/**
 * Attachment definition
 */
export interface AttachmentDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Attachment type */
  type: AttachmentType;
  /** Stat modifiers */
  modifiers: StatModifiers;
  /** Description (for UI) */
  description?: string;
}

/**
 * Ammo type
 */
export type AmmoType = 'standard' | 'armor_piercing' | 'hollow_point' | 'incendiary' | 'explosive';

/**
 * Ammo type effects
 */
export interface AmmoTypeEffects {
  /** Damage multiplier for this ammo type */
  damageMultiplier: number;
  /** Armor penetration (0-1, where 1 = ignores all armor) */
  armorPenetration?: number;
  /** Damage over time per second (for incendiary) */
  damageOverTime?: number;
  /** Damage over time duration in seconds */
  dotDuration?: number;
  /** Explosion radius (for explosive ammo, in world units) */
  explosionRadius?: number;
  /** Explosion damage falloff (0-1, where 1 = no falloff) */
  explosionFalloff?: number;
}

/**
 * Ammo type definition
 */
export interface AmmoTypeDefinition {
  /** Ammo type */
  type: AmmoType;
  /** Display name */
  name: string;
  /** Effects */
  effects: AmmoTypeEffects;
  /** Description (for UI) */
  description?: string;
}

/**
 * Weapon switched event data
 */
export interface WeaponSwitchedEvent {
  /** Entity with inventory */
  entity: Entity;
  /** Old weapon index */
  oldWeaponIndex: number;
  /** New weapon index */
  newWeaponIndex: number;
  /** Switch duration in seconds */
  switchDuration: number;
}

/**
 * Attachment added event data
 */
export interface AttachmentAddedEvent {
  /** Entity with weapon */
  entity: Entity;
  /** Attachment definition */
  attachment: AttachmentDefinition;
  /** Attachment slot type */
  slotType: AttachmentType;
}

/**
 * Attachment removed event data
 */
export interface AttachmentRemovedEvent {
  /** Entity with weapon */
  entity: Entity;
  /** Attachment definition */
  attachment: AttachmentDefinition;
  /** Attachment slot type */
  slotType: AttachmentType;
}

/**
 * Ammo type changed event data
 */
export interface AmmoTypeChangedEvent {
  /** Entity with weapon */
  entity: Entity;
  /** Old ammo type */
  oldAmmoType: AmmoType;
  /** New ammo type */
  newAmmoType: AmmoType;
}

/**
 * Inventory updated event data
 */
export interface InventoryUpdatedEvent {
  /** Entity with inventory */
  entity: Entity;
  /** Action type */
  action: 'weapon_added' | 'weapon_removed' | 'weapon_switched';
  /** Weapon index (if applicable) */
  weaponIndex?: number;
}
