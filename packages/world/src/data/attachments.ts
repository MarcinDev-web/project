import type { AttachmentDefinition, AttachmentType } from '../types/weapon';

/**
 * Predefined attachment definitions for PvP gameplay
 * Balanced with trade-offs
 */
export const ATTACHMENTS: Record<string, AttachmentDefinition> = {
  // Scopes
  red_dot: {
    id: 'red_dot',
    name: 'Red Dot Sight',
    type: 'scope',
    description: 'Improves accuracy for close to medium range',
    modifiers: {
      spreadMultiplier: 0.7, // -30% spread
      fireRateMultiplier: 1.0,
      damageMultiplier: 1.0,
    },
  },
  acog: {
    id: 'acog',
    name: 'ACOG Scope',
    type: 'scope',
    description: 'High magnification scope, reduces spread significantly',
    modifiers: {
      spreadMultiplier: 0.5, // -50% spread
      rangeMultiplier: 1.2, // +20% range
      fireRateMultiplier: 0.9, // -10% fire rate (slower ADS)
    },
  },
  sniper_scope: {
    id: 'sniper_scope',
    name: 'Sniper Scope',
    type: 'scope',
    description: 'Maximum magnification for long range',
    modifiers: {
      spreadMultiplier: 0.3, // -70% spread
      rangeMultiplier: 1.5, // +50% range
      fireRateMultiplier: 0.85, // -15% fire rate
    },
  },

  // Suppressors
  light_suppressor: {
    id: 'light_suppressor',
    name: 'Light Suppressor',
    type: 'suppressor',
    description: 'Reduces sound signature, slight damage reduction',
    modifiers: {
      damageMultiplier: 0.95, // -5% damage
      rangeMultiplier: 0.9, // -10% range
      spreadMultiplier: 1.0,
    },
  },
  heavy_suppressor: {
    id: 'heavy_suppressor',
    name: 'Heavy Suppressor',
    type: 'suppressor',
    description: 'Maximum sound reduction, noticeable damage reduction',
    modifiers: {
      damageMultiplier: 0.85, // -15% damage
      rangeMultiplier: 0.8, // -20% range
      spreadMultiplier: 0.95, // Slight accuracy improvement
    },
  },

  // Grips
  vertical_grip: {
    id: 'vertical_grip',
    name: 'Vertical Grip',
    type: 'grip',
    description: 'Reduces recoil and improves accuracy',
    modifiers: {
      spreadMultiplier: 0.85, // -15% spread
      reloadDurationMultiplier: 1.1, // +10% reload time (slightly slower)
    },
  },
  angled_grip: {
    id: 'angled_grip',
    name: 'Angled Grip',
    type: 'grip',
    description: 'Improves fire rate and handling',
    modifiers: {
      fireRateMultiplier: 1.1, // +10% fire rate
      spreadMultiplier: 0.95, // Slight accuracy improvement
      reloadDurationMultiplier: 0.95, // -5% reload time
    },
  },

  // Magazines
  extended_mag: {
    id: 'extended_mag',
    name: 'Extended Magazine',
    type: 'magazine',
    description: 'Increases ammo capacity',
    modifiers: {
      maxAmmoMultiplier: 1.5, // +50% ammo
      reloadDurationMultiplier: 1.2, // +20% reload time
    },
  },
  fast_mag: {
    id: 'fast_mag',
    name: 'Fast Magazine',
    type: 'magazine',
    description: 'Faster reload speed',
    modifiers: {
      reloadDurationMultiplier: 0.7, // -30% reload time
    },
  },

  // Barrels
  long_barrel: {
    id: 'long_barrel',
    name: 'Long Barrel',
    type: 'barrel',
    description: 'Increases range and damage',
    modifiers: {
      damageMultiplier: 1.1, // +10% damage
      rangeMultiplier: 1.3, // +30% range
      spreadMultiplier: 0.9, // Slight accuracy improvement
      reloadDurationMultiplier: 1.1, // +10% reload time (longer to handle)
    },
  },
  short_barrel: {
    id: 'short_barrel',
    name: 'Short Barrel',
    type: 'barrel',
    description: 'Reduces range but improves handling',
    modifiers: {
      damageMultiplier: 0.9, // -10% damage
      rangeMultiplier: 0.8, // -20% range
      fireRateMultiplier: 1.15, // +15% fire rate
      reloadDurationMultiplier: 0.9, // -10% reload time
    },
  },
} as const;

/**
 * Get attachment definition by ID
 * @param id - Attachment ID
 * @returns Attachment definition or undefined
 */
export function getAttachment(id: string): AttachmentDefinition | undefined {
  return ATTACHMENTS[id];
}

/**
 * Get all attachments of a specific type
 * @param type - Attachment type
 * @returns Array of attachment definitions
 */
export function getAttachmentsByType(type: AttachmentType): AttachmentDefinition[] {
  return Object.values(ATTACHMENTS).filter((att) => att.type === type);
}

/**
 * Get all available attachments
 * @returns Array of all attachment definitions
 */
export function getAllAttachments(): AttachmentDefinition[] {
  return Object.values(ATTACHMENTS);
}
