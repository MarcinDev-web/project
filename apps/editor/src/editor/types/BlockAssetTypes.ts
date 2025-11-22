/**
 * Simplified Block Asset Types - replaces @engine/assets
 * 
 * Only supports blocks from BlockLibrary (10 blocks total)
 */

import type { BlockDefinition } from '@engine/blocks';
import type { RgbaColor } from '../../utils/colors';

/**
 * Simplified Asset type - represents a placeable block
 */
export interface BlockAsset {
  id: string;
  name: string;
  category: 'basic' | 'natural' | 'gameplay';
  color: RgbaColor;
  blockData: BlockDefinition;
}

// Type aliases for compatibility
export type Asset = BlockAsset;
export type AssetMainCategory = 'basic' | 'natural' | 'gameplay';
export type AssetCategory = AssetMainCategory;
export type AssetVariant = never; // No variants in simplified system

/**
 * Asset preset for placement
 * 
 * Represents a configurable asset that can be placed in the scene.
 * Supports blocks, vegetation, and NPCs through optional configuration objects.
 */
export interface AssetPreset {
  /** Display name of the asset (required, must be non-empty) */
  name: string;
  /** Optional block ID for block-based assets (e.g., 'grass', 'stone', 'light_white') */
  blockId?: string;
  /** Scale of the asset [x, y, z] - must be positive finite numbers */
  scale: [number, number, number];
  /** RGBA color [r, g, b, a] - values must be in range [0, 1] */
  color: [number, number, number, number];
  /** Vegetation configuration (if this is a vegetation asset) */
  vegetationConfig?: {
    type: 'grass' | 'flower' | 'shrub' | 'tree' | 'custom';
    billboardTexture?: string;
    modelUrl?: string;
    canBeHarvested?: boolean;
    /** Harvest time in seconds (must be non-negative if provided) */
    harvestTime?: number;
    /** Wind strength multiplier (must be non-negative if provided) */
    windStrength?: number;
    /** Wind frequency multiplier (must be non-negative if provided) */
    windFrequency?: number;
  };
  /** NPC configuration (if this is an NPC asset) */
  npcConfig?: {
    unitType: 'soldier' | 'guard' | 'civilian' | 'custom';
    faction: 'ally' | 'enemy' | 'neutral';
    behavior: 'idle' | 'patrol' | 'shoot-player' | 'follow-player' | 'guard-position';
    armyId?: string;
    /** Array of waypoints for patrol behavior (each waypoint is [x, y, z]) */
    patrolWaypoints?: Array<[number, number, number]>;
    /** Patrol speed in units per second (must be non-negative if provided) */
    patrolSpeed?: number;
    /** Guard position [x, y, z] for guard-position behavior */
    guardPosition?: [number, number, number];
    /** Guard radius in world units (must be non-negative if provided) */
    guardRadius?: number;
    /** Detection range in world units (must be non-negative if provided) */
    detectionRange?: number;
    /** Override default health (must be positive) */
    health?: number;
    /** Override default speed (must be positive) */
    speed?: number;
    /** Equipped weapon/item ID */
    equipment?: string;
  };
}

/**
 * Type guard: Checks if AssetPreset is a block asset preset
 */
export function isBlockAssetPreset(preset: AssetPreset): preset is AssetPreset & { blockId: string } {
  return preset.blockId !== undefined && preset.blockId !== '';
}

/**
 * Type guard: Checks if AssetPreset is a vegetation asset preset
 */
export function isVegetationAssetPreset(preset: AssetPreset): preset is AssetPreset & { vegetationConfig: NonNullable<AssetPreset['vegetationConfig']> } {
  return preset.vegetationConfig !== undefined;
}

/**
 * Type guard: Checks if AssetPreset is an NPC asset preset
 */
export function isNpcAssetPreset(preset: AssetPreset): preset is AssetPreset & { npcConfig: NonNullable<AssetPreset['npcConfig']> } {
  return preset.npcConfig !== undefined;
}

/**
 * Validates an AssetPreset and returns normalized version.
 * 
 * @param preset - The preset to validate
 * @returns Normalized preset with validated values
 * @throws Error if preset is invalid
 * 
 * @example
 * ```typescript
 * try {
 *   const validPreset = validateAssetPreset(userInput);
 *   placementMode.startPlacement(validPreset);
 * } catch (error) {
 *   console.error('Invalid preset:', error.message);
 * }
 * ```
 */
export function validateAssetPreset(preset: AssetPreset): AssetPreset {
  // Validate name
  if (!preset.name || typeof preset.name !== 'string' || preset.name.trim().length === 0) {
    throw new Error('AssetPreset.name is required and must be a non-empty string');
  }

  // Validate scale
  const scale = preset.scale ?? [1, 1, 1];
  if (!Array.isArray(scale) || scale.length !== 3) {
    throw new Error('AssetPreset.scale must be a tuple of 3 numbers');
  }
  const validScale = scale.every(s => Number.isFinite(s) && s > 0);
  if (!validScale) {
    throw new Error(`AssetPreset.scale values must be finite positive numbers, got: [${scale.join(', ')}]`);
  }

  // Validate color
  const color = preset.color ?? [0.5, 0.5, 0.5, 1];
  if (!Array.isArray(color) || color.length !== 4) {
    throw new Error('AssetPreset.color must be a tuple of 4 numbers');
  }
  const validColor = color.every(c => Number.isFinite(c) && c >= 0 && c <= 1);
  if (!validColor) {
    throw new Error(`AssetPreset.color values must be in range [0, 1], got: [${color.join(', ')}]`);
  }

  // Validate vegetationConfig if present
  if (preset.vegetationConfig) {
    const veg = preset.vegetationConfig;
    if (veg.harvestTime !== undefined && (veg.harvestTime < 0 || !Number.isFinite(veg.harvestTime))) {
      throw new Error(`vegetationConfig.harvestTime must be a non-negative number, got: ${veg.harvestTime}`);
    }
    if (veg.windStrength !== undefined && (veg.windStrength < 0 || !Number.isFinite(veg.windStrength))) {
      throw new Error(`vegetationConfig.windStrength must be a non-negative number, got: ${veg.windStrength}`);
    }
    if (veg.windFrequency !== undefined && (veg.windFrequency < 0 || !Number.isFinite(veg.windFrequency))) {
      throw new Error(`vegetationConfig.windFrequency must be a non-negative number, got: ${veg.windFrequency}`);
    }
  }

  // Validate npcConfig if present
  if (preset.npcConfig) {
    const npc = preset.npcConfig;
    if (npc.patrolSpeed !== undefined && (npc.patrolSpeed < 0 || !Number.isFinite(npc.patrolSpeed))) {
      throw new Error(`npcConfig.patrolSpeed must be a non-negative number, got: ${npc.patrolSpeed}`);
    }
    if (npc.guardRadius !== undefined && (npc.guardRadius < 0 || !Number.isFinite(npc.guardRadius))) {
      throw new Error(`npcConfig.guardRadius must be a non-negative number, got: ${npc.guardRadius}`);
    }
    if (npc.detectionRange !== undefined && (npc.detectionRange < 0 || !Number.isFinite(npc.detectionRange))) {
      throw new Error(`npcConfig.detectionRange must be a non-negative number, got: ${npc.detectionRange}`);
    }
    if (npc.health !== undefined && (npc.health <= 0 || !Number.isFinite(npc.health))) {
      throw new Error(`npcConfig.health must be a positive number, got: ${npc.health}`);
    }
    if (npc.speed !== undefined && (npc.speed <= 0 || !Number.isFinite(npc.speed))) {
      throw new Error(`npcConfig.speed must be a positive number, got: ${npc.speed}`);
    }
    // Validate patrolWaypoints structure
    if (npc.patrolWaypoints !== undefined) {
      if (!Array.isArray(npc.patrolWaypoints)) {
        throw new Error('npcConfig.patrolWaypoints must be an array');
      }
      for (let i = 0; i < npc.patrolWaypoints.length; i++) {
        const waypoint = npc.patrolWaypoints[i];
        if (!Array.isArray(waypoint) || waypoint.length !== 3) {
          throw new Error(`patrolWaypoints[${i}] must be a tuple of 3 numbers`);
        }
        if (!waypoint.every(w => Number.isFinite(w))) {
          throw new Error(`All values in patrolWaypoints[${i}] must be finite numbers`);
        }
      }
    }
    // Validate guardPosition structure
    if (npc.guardPosition !== undefined) {
      if (!Array.isArray(npc.guardPosition) || npc.guardPosition.length !== 3) {
        throw new Error('npcConfig.guardPosition must be a tuple of 3 numbers');
      }
      if (!npc.guardPosition.every(p => Number.isFinite(p))) {
        throw new Error('All values in npcConfig.guardPosition must be finite numbers');
      }
    }
  }

  // Return normalized preset with validated values
  return {
    ...preset,
    name: preset.name.trim(),
    scale: [...scale] as [number, number, number],
    color: [...color] as [number, number, number, number],
  };
}

/**
 * Convert BlockDefinition to BlockAsset
 */
export function blockToAsset(block: BlockDefinition): BlockAsset {
  return {
    id: block.id,
    name: block.name,
    category: block.category,
    color: block.textures.top.color,
    blockData: block,
  };
}

