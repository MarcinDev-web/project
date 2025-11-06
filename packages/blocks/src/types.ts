/**
 * Block types and definitions
 */

export type BlockCategory = 'basic' | 'natural' | 'gameplay';

export type BlockMaterialType =
  | 'solid' // Opaque, no transparency
  | 'glass' // Transparent, reflective
  | 'metal' // Shiny, metallic
  | 'wood' // Matte, organic
  | 'stone' // Rough, natural
  | 'plastic' // Smooth, colorful (Roblox style)
  | 'emissive'; // Light-emitting

/**
 * Connected Textures Mod (CTM) configuration
 * Allows blocks to have different textures based on neighboring blocks
 */
export type CTMPattern =
  | 'none' // No connection
  | 'horizontal' // Connect left-right only
  | 'vertical' // Connect top-bottom only
  | 'cross' // Connect all 4 directions (2D)
  | 'pillar' // Connect top-bottom with end caps
  | 'random'; // Random variation (2-4 textures)

export interface CTMConfig {
  /** Pattern type */
  pattern: CTMPattern;
  /** Should connect to same block type only? */
  matchSameType: boolean;
  /** Should connect to same category? */
  matchCategory: boolean;
  /** Number of random variants (for random pattern) */
  randomVariants?: number;
}
