/**
 * Block Library - Kogama/Roblox/Minecraft style blocks
 *
 * Design principles:
 * - Simple, colorful aesthetic (Kogama/Roblox)
 * - Block-based voxel style (Minecraft)
 * - Support for both procedural and real textures
 * - Material-based rendering
 */

import type { RgbaColor } from '../../utils/colors';
import type { CTMConfig } from '../textures/ConnectedTextures';

export type BlockCategory = 'basic' | 'natural' | 'decorative' | 'mechanical' | 'glass' | 'light';

export type BlockMaterialType =
  | 'solid' // Opaque, no transparency
  | 'glass' // Transparent, reflective
  | 'metal' // Shiny, metallic
  | 'wood' // Matte, organic
  | 'stone' // Rough, natural
  | 'plastic' // Smooth, colorful (Roblox style)
  | 'emissive'; // Light-emitting

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
}

/**
 * Built-in block library with Kogama/Roblox/Minecraft inspired blocks
 */
export const BLOCK_LIBRARY: Record<string, BlockDefinition> = {
  // ===== BASIC BLOCKS (Roblox style - colorful plastic) =====
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

  // ===== NATURAL BLOCKS (Minecraft style) =====
  grass: {
    id: 'grass',
    name: 'Grass Block',
    category: 'natural',
    material: 'stone',
    textures: {
      top: { color: [0.35, 0.7, 0.25, 1], pattern: 'noise', brightness: 1.0 },
      bottom: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 0.8 },
      sides: { color: [0.45, 0.35, 0.25, 1], pattern: 'noise', brightness: 0.9 },
      // Grass on top part of sides
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

  wood_oak: {
    id: 'wood_oak',
    name: 'Oak Wood',
    category: 'natural',
    material: 'wood',
    textures: {
      top: { color: [0.65, 0.45, 0.25, 1], pattern: 'grid', brightness: 1.0 },
      bottom: { color: [0.65, 0.45, 0.25, 1], pattern: 'grid', brightness: 0.8 },
      sides: { color: [0.55, 0.38, 0.2, 1], pattern: 'planks', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.7,
      metallic: 0,
    },
  },

  wood_planks: {
    id: 'wood_planks',
    name: 'Wood Planks',
    category: 'natural',
    material: 'wood',
    textures: {
      top: { color: [0.6, 0.4, 0.22, 1], pattern: 'planks', brightness: 1.0 },
      bottom: { color: [0.6, 0.4, 0.22, 1], pattern: 'planks', brightness: 0.8 },
      sides: { color: [0.6, 0.4, 0.22, 1], pattern: 'planks', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.75,
      metallic: 0,
    },
    ctm: {
      pattern: 'horizontal',
      matchSameType: false,
      matchCategory: true, // All wood types connect
    },
  },

  // ===== DECORATIVE BLOCKS =====
  bricks_red: {
    id: 'bricks_red',
    name: 'Red Bricks',
    category: 'decorative',
    material: 'stone',
    textures: {
      top: { color: [0.7, 0.25, 0.2, 1], pattern: 'bricks', brightness: 1.0 },
      bottom: { color: [0.7, 0.25, 0.2, 1], pattern: 'bricks', brightness: 0.8 },
      sides: { color: [0.7, 0.25, 0.2, 1], pattern: 'bricks', brightness: 0.9 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.8,
      metallic: 0,
    },
    ctm: {
      pattern: 'horizontal',
      matchSameType: true,
      matchCategory: false,
    },
  },

  concrete_white: {
    id: 'concrete_white',
    name: 'White Concrete',
    category: 'decorative',
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

  // ===== GLASS BLOCKS =====
  glass_clear: {
    id: 'glass_clear',
    name: 'Clear Glass',
    category: 'glass',
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

  glass_red: {
    id: 'glass_red',
    name: 'Red Glass',
    category: 'glass',
    material: 'glass',
    textures: {
      top: { color: [0.9, 0.2, 0.2, 0.5], pattern: 'smooth', brightness: 1.2 },
      bottom: { color: [0.9, 0.2, 0.2, 0.5], pattern: 'smooth', brightness: 1.0 },
      sides: { color: [0.9, 0.2, 0.2, 0.5], pattern: 'smooth', brightness: 1.1 },
    },
    properties: {
      solid: true,
      transparent: true,
      emissive: 0,
      roughness: 0.1,
      metallic: 0.2,
    },
  },

  // ===== METAL BLOCKS =====
  metal_iron: {
    id: 'metal_iron',
    name: 'Iron Block',
    category: 'mechanical',
    material: 'metal',
    textures: {
      top: { color: [0.75, 0.75, 0.75, 1], pattern: 'smooth', brightness: 1.3 },
      bottom: { color: [0.75, 0.75, 0.75, 1], pattern: 'smooth', brightness: 0.9 },
      sides: { color: [0.75, 0.75, 0.75, 1], pattern: 'smooth', brightness: 1.1 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.2,
      metallic: 0.9,
    },
  },

  metal_gold: {
    id: 'metal_gold',
    name: 'Gold Block',
    category: 'mechanical',
    material: 'metal',
    textures: {
      top: { color: [1.0, 0.85, 0.2, 1], pattern: 'smooth', brightness: 1.4 },
      bottom: { color: [1.0, 0.85, 0.2, 1], pattern: 'smooth', brightness: 0.9 },
      sides: { color: [1.0, 0.85, 0.2, 1], pattern: 'smooth', brightness: 1.2 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.15,
      metallic: 0.95,
    },
  },

  // ===== LIGHT BLOCKS (Kogama style) =====
  light_white: {
    id: 'light_white',
    name: 'White Light',
    category: 'light',
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

  light_red: {
    id: 'light_red',
    name: 'Red Light',
    category: 'light',
    material: 'emissive',
    textures: {
      top: { color: [1.0, 0.2, 0.2, 1], pattern: 'smooth', brightness: 1.8 },
      bottom: { color: [1.0, 0.2, 0.2, 1], pattern: 'smooth', brightness: 1.8 },
      sides: { color: [1.0, 0.2, 0.2, 1], pattern: 'smooth', brightness: 1.8 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0.9,
      roughness: 0.5,
      metallic: 0,
    },
  },

  light_blue: {
    id: 'light_blue',
    name: 'Blue Light',
    category: 'light',
    material: 'emissive',
    textures: {
      top: { color: [0.2, 0.5, 1.0, 1], pattern: 'smooth', brightness: 1.8 },
      bottom: { color: [0.2, 0.5, 1.0, 1], pattern: 'smooth', brightness: 1.8 },
      sides: { color: [0.2, 0.5, 1.0, 1], pattern: 'smooth', brightness: 1.8 },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0.9,
      roughness: 0.5,
      metallic: 0,
    },
  },

  // ===== TEXTURED BLOCKS (with real texture files) =====
  
  stone_textured: {
    id: 'stone_textured',
    name: 'Stone',
    category: 'natural',
    material: 'stone',
    textures: {
      top: {
        color: [0.5, 0.5, 0.5, 1],
        pattern: 'cobble',
        // Texture URLs would be populated at runtime via TextureManager
        // Example: textureUrl: '/textures/stone.png'
      },
      bottom: {
        color: [0.5, 0.5, 0.5, 1],
        pattern: 'cobble',
      },
      sides: {
        color: [0.5, 0.5, 0.5, 1],
        pattern: 'cobble',
      },
    },
    properties: {
      solid: true,
      transparent: false,
      emissive: 0,
      roughness: 0.8,
      metallic: 0,
    },
  },

  // Note: Texture URLs removed to avoid type errors.
  // In production, textures would be loaded from actual files or texture packs.
  // Use TextureManager to load textures dynamically based on textureUrl properties.
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
  return ['basic', 'natural', 'decorative', 'mechanical', 'glass', 'light'];
}
