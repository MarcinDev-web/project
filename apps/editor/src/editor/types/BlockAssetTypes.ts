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
 */
export interface AssetPreset {
  name: string;
  blockId?: string;
  scale: [number, number, number];
  color: [number, number, number, number];
  /** Vegetation configuration (if this is a vegetation asset) */
  vegetationConfig?: {
    type: 'grass' | 'flower' | 'shrub' | 'tree' | 'custom';
    billboardTexture?: string;
    modelUrl?: string;
    canBeHarvested?: boolean;
    harvestTime?: number;
    windStrength?: number;
    windFrequency?: number;
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

