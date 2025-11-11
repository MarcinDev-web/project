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
import { CARTOON_PALETTE, getCartoonFaceTexture } from './palette';

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
 * Built-in block library with cartoon-style blocks
 * Uses unified palette for consistent, bright, stylized appearance
 */
export const BLOCK_LIBRARY: Record<string, BlockDefinition> = {
  // ===== BASIC BLOCKS (5) - Colorful building blocks =====
  plastic_red: {
    id: 'plastic_red',
    name: 'Red Block',
    category: 'basic',
    material: 'plastic',
    textures: getCartoonFaceTexture(CARTOON_PALETTE.basic.red, 'standard'),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.basic.blue, 'standard'),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.basic.green, 'standard'),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.basic.yellow, 'standard'),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.basic.white, 'standard'),
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
    textures: (() => {
      const base = getCartoonFaceTexture(CARTOON_PALETTE.natural.grass, 'natural');
      // Grass has different color for sides (dirt-like)
      return {
        ...base,
        sides: {
          color: CARTOON_PALETTE.natural.dirt.color,
          pattern: CARTOON_PALETTE.natural.dirt.pattern,
          brightness: base.sides.brightness,
        },
        bottom: {
          color: CARTOON_PALETTE.natural.dirt.color,
          pattern: CARTOON_PALETTE.natural.dirt.pattern,
          brightness: base.bottom.brightness,
        },
      };
    })(),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.natural.dirt, 'natural'),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.natural.stone, 'natural'),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.gameplay.light, 'emissive'),
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
    textures: (() => {
      const base = getCartoonFaceTexture(CARTOON_PALETTE.gameplay.glass, 'standard');
      // Glass maintains transparency
      return {
        top: { ...base.top, color: CARTOON_PALETTE.gameplay.glass.color },
        sides: { ...base.sides, color: CARTOON_PALETTE.gameplay.glass.color },
        bottom: { ...base.bottom, color: CARTOON_PALETTE.gameplay.glass.color },
      };
    })(),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.gameplay.ice, 'standard'),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.gameplay.slime, 'standard'),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.gameplay.lava, 'emissive'),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.gameplay.poison, 'standard'),
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
    textures: getCartoonFaceTexture(CARTOON_PALETTE.gameplay.bouncy, 'standard'),
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
