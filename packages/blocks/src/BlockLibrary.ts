/**
 * Block Library - Kogama/Roblox/Minecraft style blocks
 *
 * Design principles:
 * - Simple, colorful aesthetic (Kogama/Roblox)
 * - Block-based voxel style (Minecraft)
 * - Support for both procedural and real textures
 * - Material-based rendering
 */

import type { BlockCategory, BlockMaterialType, CTMConfig } from './types';

// Local type definition to avoid circular dependency with @engine/world
export type RgbaColor = [number, number, number, number];

// Re-export types
export type { BlockCategory, BlockMaterialType, CTMConfig, CTMPattern } from './types';

export interface BlockFaceTexture {
  /** Base color for this face */
  color: RgbaColor;
  /** Optional texture pattern (for procedural generation) */
  pattern?: 'solid' | 'grid' | 'noise' | 'bricks' | 'planks' | 'cobble' | 'smooth';
  /** Brightness multiplier (for shading) */
  brightness?: number;
  /** URL or path to texture image file */
  textureUrl?: string;
  /** Normal map URL */
  normalMapUrl?: string;
  /** Roughness map URL */
  roughnessMapUrl?: string;
  /** Metallic map URL */
  metallicMapUrl?: string;
  /** Ambient occlusion map URL */
  aoMapUrl?: string;
  /** Use procedural generation even if texture URL exists */
  forceProcedural?: boolean;
}

export interface BlockTextures {
  /** Top face texture */
  top: BlockFaceTexture;
  /** Bottom face texture */
  bottom: BlockFaceTexture;
  /** Side faces texture (front/back/left/right) */
  sides: BlockFaceTexture;
  /** Optional: different texture for each side */
  front?: BlockFaceTexture;
  back?: BlockFaceTexture;
  left?: BlockFaceTexture;
  right?: BlockFaceTexture;
}

export interface BlockDefinition {
  id: string;
  name: string;
  category: BlockCategory;
  material: BlockMaterialType;
  textures: BlockTextures;
  /** Physical properties */
  properties: {
    /** Is this block solid (for collision)? */
    solid: boolean;
    /** Can light pass through? */
    transparent: boolean;
    /** Light emission level (0-1) */
    emissive: number;
    /** Shininess/roughness (0-1) */
    roughness: number;
    /** Metallic property (0-1) */
    metallic: number;
  };
  /** Connected textures configuration (optional) */
  ctm?: CTMConfig;
  /** Behavior properties (gameplay effects) */
  behavior?: {
    /** Friction multiplier applied to PhysicsComponent.material.friction (ice: 0.1, slime: 2.0) */
    frictionMultiplier?: number;
    /** Movement speed multiplier applied to CharacterController.config.moveSpeed (ice: 1.5, slime: 0.5) */
    movementSpeedMultiplier?: number;
    /** Restitution/bounce multiplier applied to PhysicsComponent.material.restitution (bouncy: 2.0) */
    restitutionMultiplier?: number;
    /** Damage per second applied to HealthComponent (lava: 20, poison: 5) */
    damagePerSecond?: number;
  };
}

/**
 * Built-in block library with Kogama/Roblox/Minecraft inspired blocks
 * Reduced to 10 essential blocks across 3 categories
 */
export const BLOCK_LIBRARY: Record<string, BlockDefinition> = {
  // ===== BASIC BLOCKS (5) - Colorful building blocks =====
  plastic_red: {
    id: 'plastic_red',
    name: 'Red Block',
    category: 'basic',
    material: 'plastic',
    textures: {
      top: { color: [0.9, 0.15, 0.15, 1], pattern: 'smooth', brightness: 1.1 },
      bottom: { color: [0.9, 0.15, 0.15, 1], pattern: 'smooth', brightness: 0.7 },
      sides: { color: [0.9, 0.15, 0.15, 1], pattern: 'smooth', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.3,
      metallic: 0,
    },
  },

  plastic_blue: {
    id: 'plastic_blue',
    name: 'Blue Block',
    category: 'basic',
    material: 'plastic',
    textures: {
      top: { color: [0.15, 0.45, 0.95, 1], pattern: 'smooth', brightness: 1.1 },
      bottom: { color: [0.15, 0.45, 0.95, 1], pattern: 'smooth', brightness: 0.7 },
      sides: { color: [0.15, 0.45, 0.95, 1], pattern: 'smooth', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.3,
      metallic: 0,
    },
  },

  plastic_green: {
    id: 'plastic_green',
    name: 'Green Block',
    category: 'basic',
    material: 'plastic',
    textures: {
      top: { color: [0.15, 0.85, 0.25, 1], pattern: 'smooth', brightness: 1.1 },
      bottom: { color: [0.15, 0.85, 0.25, 1], pattern: 'smooth', brightness: 0.7 },
      sides: { color: [0.15, 0.85, 0.25, 1], pattern: 'smooth', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.3,
      metallic: 0,
    },
  },

  plastic_yellow: {
    id: 'plastic_yellow',
    name: 'Yellow Block',
    category: 'basic',
    material: 'plastic',
    textures: {
      top: { color: [0.95, 0.85, 0.15, 1], pattern: 'smooth', brightness: 1.1 },
      bottom: { color: [0.95, 0.85, 0.15, 1], pattern: 'smooth', brightness: 0.7 },
      sides: { color: [0.95, 0.85, 0.15, 1], pattern: 'smooth', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.3,
      metallic: 0,
    },
  },

  concrete_white: {
    id: 'concrete_white',
    name: 'White Concrete',
    category: 'basic',
    material: 'stone',
    textures: {
      top: { color: [0.9, 0.9, 0.9, 1], pattern: 'smooth', brightness: 1.0 },
      bottom: { color: [0.9, 0.9, 0.9, 1], pattern: 'smooth', brightness: 0.8 },
      sides: { color: [0.9, 0.9, 0.9, 1], pattern: 'smooth', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.4,
      metallic: 0,
    },
  },

  // ===== NATURAL BLOCKS (3) - Terrain blocks =====
  grass: {
    id: 'grass',
    name: 'Grass Block',
    category: 'natural',
    material: 'stone',
    textures: {
      top: { color: [0.35, 0.7, 0.25, 1], pattern: 'noise', brightness: 1.0 },
      bottom: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 0.8 },
      sides: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.9,
      metallic: 0,
    },
  },

  dirt: {
    id: 'dirt',
    name: 'Dirt Block',
    category: 'natural',
    material: 'stone',
    textures: {
      top: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 1.0 },
      bottom: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 0.8 },
      sides: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.95,
      metallic: 0,
    },
  },

  stone: {
    id: 'stone',
    name: 'Stone Block',
    category: 'natural',
    material: 'stone',
    textures: {
      top: { color: [0.5, 0.5, 0.5, 1], pattern: 'cobble', brightness: 1.0 },
      bottom: { color: [0.5, 0.5, 0.5, 1], pattern: 'cobble', brightness: 0.8 },
      sides: { color: [0.5, 0.5, 0.5, 1], pattern: 'cobble', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.85,
      metallic: 0,
    },
  },

  // ===== GAMEPLAY BLOCKS (2) - Interactive/special blocks =====
  light_white: {
    id: 'light_white',
    name: 'White Light',
    category: 'gameplay',
    material: 'emissive',
    textures: {
      top: { color: [1.0, 1.0, 1.0, 1], pattern: 'smooth', brightness: 2.0 },
      bottom: { color: [1.0, 1.0, 1.0, 1], pattern: 'smooth', brightness: 2.0 },
      sides: { color: [1.0, 1.0, 1.0, 1], pattern: 'smooth', brightness: 2.0 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 1.0,
      roughness: 0.5,
      metallic: 0,
    },
  },

  glass_clear: {
    id: 'glass_clear',
    name: 'Clear Glass',
    category: 'gameplay',
    material: 'glass',
    textures: {
      top: { color: [0.85, 0.95, 1.0, 0.3], pattern: 'smooth', brightness: 1.2 },
      bottom: { color: [0.85, 0.95, 1.0, 0.3], pattern: 'smooth', brightness: 1.0 },
      sides: { color: [0.85, 0.95, 1.0, 0.3], pattern: 'smooth', brightness: 1.1 },
    },
    properties: {
      solid: true,
      transparent: true,
      emissive: 0,
      roughness: 0.1,
      metallic: 0.2,
    },
    ctm: {
      pattern: 'cross',
      matchSameType: true,
      matchCategory: false,
    },
  },

  ice: {
    id: 'ice',
    name: 'Ice Block',
    category: 'gameplay',
    material: 'plastic',
    textures: {
      top: { color: [0.7, 0.9, 1.0, 1], pattern: 'smooth', brightness: 1.2 },
      bottom: { color: [0.7, 0.9, 1.0, 1], pattern: 'smooth', brightness: 0.9 },
      sides: { color: [0.7, 0.9, 1.0, 1], pattern: 'smooth', brightness: 1.05 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.1,
      metallic: 0,
    },
    behavior: {
      frictionMultiplier: 0.1,
      movementSpeedMultiplier: 1.5,
    },
  },

  slime: {
    id: 'slime',
    name: 'Slime Block',
    category: 'gameplay',
    material: 'plastic',
    textures: {
      top: { color: [0.2, 0.8, 0.3, 1], pattern: 'smooth', brightness: 1.1 },
      bottom: { color: [0.2, 0.8, 0.3, 1], pattern: 'smooth', brightness: 0.8 },
      sides: { color: [0.2, 0.8, 0.3, 1], pattern: 'smooth', brightness: 0.95 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.3,
      metallic: 0,
    },
    behavior: {
      frictionMultiplier: 2.0,
      movementSpeedMultiplier: 0.5,
    },
  },

  lava: {
    id: 'lava',
    name: 'Lava Block',
    category: 'gameplay',
    material: 'emissive',
    textures: {
      top: { color: [0.9, 0.2, 0.1, 1], pattern: 'smooth', brightness: 1.5 },
      bottom: { color: [0.9, 0.2, 0.1, 1], pattern: 'smooth', brightness: 1.2 },
      sides: { color: [0.9, 0.2, 0.1, 1], pattern: 'smooth', brightness: 1.35 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0.8,
      roughness: 0.2,
      metallic: 0.1,
    },
    behavior: {
      damagePerSecond: 20,
    },
  },

  poison: {
    id: 'poison',
    name: 'Poison Block',
    category: 'gameplay',
    material: 'plastic',
    textures: {
      top: { color: [0.5, 0.3, 0.7, 1], pattern: 'smooth', brightness: 1.1 },
      bottom: { color: [0.5, 0.3, 0.7, 1], pattern: 'smooth', brightness: 0.8 },
      sides: { color: [0.5, 0.3, 0.7, 1], pattern: 'smooth', brightness: 0.95 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.3,
      metallic: 0,
    },
    behavior: {
      damagePerSecond: 5,
    },
  },

  bouncy: {
    id: 'bouncy',
    name: 'Bouncy Block',
    category: 'gameplay',
    material: 'plastic',
    textures: {
      top: { color: [1.0, 0.4, 0.7, 1], pattern: 'smooth', brightness: 1.2 },
      bottom: { color: [1.0, 0.4, 0.7, 1], pattern: 'smooth', brightness: 0.9 },
      sides: { color: [1.0, 0.4, 0.7, 1], pattern: 'smooth', brightness: 1.05 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.2,
      metallic: 0,
    },
    behavior: {
      restitutionMultiplier: 2.0,
    },
  },
};

/**
 * Get all blocks in a category
 */
export function getBlocksByCategory(category: BlockCategory): BlockDefinition[] {
  return Object.values(BLOCK_LIBRARY).filter((block) => block.category === category);
}

/**
 * Get block by ID
 */
export function getBlock(id: string): BlockDefinition | undefined {
  return BLOCK_LIBRARY[id];
}

/**
 * Get all block categories
 */
export function getAllCategories(): BlockCategory[] {
  return ['basic', 'natural', 'gameplay'];
}
