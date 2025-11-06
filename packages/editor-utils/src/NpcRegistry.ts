/**
 * NpcRegistry - Shared definitions for NPC types, behaviors, and factions
 * Used by both editor and runtime to ensure consistency
 */

import type { NpcUnitType, NpcFaction, NpcBehaviorType } from '@engine/world/components/NpcComponent';

/**
 * NPC unit type definition
 */
export interface NpcUnitTypeDefinition {
  id: NpcUnitType;
  name: string;
  description: string;
  defaultHealth?: number;
  defaultSpeed?: number;
  defaultWeapon?: string;
}

/**
 * NPC behavior definition
 */
export interface NpcBehaviorDefinition {
  id: NpcBehaviorType;
  name: string;
  description: string;
}

/**
 * NPC faction definition
 */
export interface NpcFactionDefinition {
  id: NpcFaction;
  name: string;
  description: string;
  color?: [number, number, number]; // RGB color for UI
}

/**
 * Registry of available NPC unit types
 */
export const NPC_UNIT_TYPES: Record<NpcUnitType, NpcUnitTypeDefinition> = {
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    description: 'Standard combat unit with weapon',
    defaultHealth: 100,
    defaultSpeed: 5.0,
    defaultWeapon: 'rifle',
  },
  guard: {
    id: 'guard',
    name: 'Guard',
    description: 'Defensive unit for patrol and guard duties',
    defaultHealth: 80,
    defaultSpeed: 4.0,
    defaultWeapon: 'pistol',
  },
  civilian: {
    id: 'civilian',
    name: 'Civilian',
    description: 'Non-combat NPC',
    defaultHealth: 50,
    defaultSpeed: 3.0,
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    description: 'Custom NPC type',
    defaultHealth: 100,
    defaultSpeed: 5.0,
  },
};

/**
 * Registry of available NPC behaviors
 */
export const NPC_BEHAVIORS: Record<NpcBehaviorType, NpcBehaviorDefinition> = {
  idle: {
    id: 'idle',
    name: 'Idle',
    description: 'Stand still and do nothing',
  },
  patrol: {
    id: 'patrol',
    name: 'Patrol',
    description: 'Move between waypoints in a loop',
  },
  'shoot-player': {
    id: 'shoot-player',
    name: 'Shoot Player',
    description: 'Aim and fire at the player when in range',
  },
  'follow-player': {
    id: 'follow-player',
    name: 'Follow Player',
    description: 'Move towards the player',
  },
  'guard-position': {
    id: 'guard-position',
    name: 'Guard Position',
    description: 'Patrol around a specific position',
  },
};

/**
 * Registry of available NPC factions
 */
export const NPC_FACTIONS: Record<NpcFaction, NpcFactionDefinition> = {
  ally: {
    id: 'ally',
    name: 'Ally',
    description: 'Friendly to player',
    color: [0.2, 0.8, 0.2], // Green
  },
  enemy: {
    id: 'enemy',
    name: 'Enemy',
    description: 'Hostile to player',
    color: [0.8, 0.2, 0.2], // Red
  },
  neutral: {
    id: 'neutral',
    name: 'Neutral',
    description: 'Neither friendly nor hostile',
    color: [0.6, 0.6, 0.6], // Gray
  },
};

/**
 * Get NPC unit type definition
 */
export function getNpcUnitType(type: NpcUnitType): NpcUnitTypeDefinition {
  return NPC_UNIT_TYPES[type] ?? NPC_UNIT_TYPES.soldier;
}

/**
 * Get NPC behavior definition
 */
export function getNpcBehavior(behavior: NpcBehaviorType): NpcBehaviorDefinition {
  return NPC_BEHAVIORS[behavior] ?? NPC_BEHAVIORS.idle;
}

/**
 * Get NPC faction definition
 */
export function getNpcFaction(faction: NpcFaction): NpcFactionDefinition {
  return NPC_FACTIONS[faction] ?? NPC_FACTIONS.neutral;
}

/**
 * Get all available NPC unit types
 */
export function getAllNpcUnitTypes(): NpcUnitTypeDefinition[] {
  return Object.values(NPC_UNIT_TYPES);
}

/**
 * Get all available NPC behaviors
 */
export function getAllNpcBehaviors(): NpcBehaviorDefinition[] {
  return Object.values(NPC_BEHAVIORS);
}

/**
 * Get all available NPC factions
 */
export function getAllNpcFactions(): NpcFactionDefinition[] {
  return Object.values(NPC_FACTIONS);
}

