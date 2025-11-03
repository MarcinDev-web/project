import type { AmmoType, AmmoTypeDefinition } from '../types/weapon.js';

/**
 * Ammo type definitions for PvP gameplay
 * Balanced with trade-offs
 */
export const AMMO_TYPES: Record<AmmoType, AmmoTypeDefinition> = {
  standard: {
    type: 'standard',
    name: 'Standard Ammunition',
    description: 'Standard ammo with balanced stats',
    effects: {
      damageMultiplier: 1.0,
      armorPenetration: 0.0,
    },
  },
  armor_piercing: {
    type: 'armor_piercing',
    name: 'Armor Piercing',
    description: 'Ignores 50% of armor, but deals 10% less base damage',
    effects: {
      damageMultiplier: 0.9,
      armorPenetration: 0.5,
    },
  },
  hollow_point: {
    type: 'hollow_point',
    name: 'Hollow Point',
    description: 'Deals 20% more damage to unarmored targets, but less effective vs armor',
    effects: {
      damageMultiplier: 1.2,
      armorPenetration: -0.2, // Negative means LESS effective vs armor
    },
  },
  incendiary: {
    type: 'incendiary',
    name: 'Incendiary',
    description: 'Deals damage over time, but 15% less initial damage',
    effects: {
      damageMultiplier: 0.85,
      armorPenetration: 0.0,
      damageOverTime: 5, // 5 damage per second
      dotDuration: 3.0, // 3 seconds
    },
  },
  explosive: {
    type: 'explosive',
    name: 'Explosive',
    description: 'Area damage on impact, but 25% less direct damage',
    effects: {
      damageMultiplier: 0.75,
      armorPenetration: 0.0,
      explosionRadius: 5.0, // 5 world units
      explosionFalloff: 0.7, // 30% damage reduction at edge
    },
  },
} as const;

/**
 * Get ammo type definition
 * @param type - Ammo type
 * @returns Ammo type definition
 */
export function getAmmoType(type: AmmoType): AmmoTypeDefinition {
  return AMMO_TYPES[type];
}

/**
 * Get all available ammo types
 * @returns Array of all ammo type definitions
 */
export function getAllAmmoTypes(): AmmoTypeDefinition[] {
  return Object.values(AMMO_TYPES);
}
