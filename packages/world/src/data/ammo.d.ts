import type { AmmoType, AmmoTypeDefinition } from '../types/weapon';
/**
 * Ammo type definitions for PvP gameplay
 * Balanced with trade-offs
 */
export declare const AMMO_TYPES: Record<AmmoType, AmmoTypeDefinition>;
/**
 * Get ammo type definition
 * @param type - Ammo type
 * @returns Ammo type definition
 */
export declare function getAmmoType(type: AmmoType): AmmoTypeDefinition;
/**
 * Get all available ammo types
 * @returns Array of all ammo type definitions
 */
export declare function getAllAmmoTypes(): AmmoTypeDefinition[];
//# sourceMappingURL=ammo.d.ts.map