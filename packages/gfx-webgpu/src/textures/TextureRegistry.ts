/**
 * TextureRegistry - Central registry for block and asset textures
 * 
 * Manages texture paths and provides easy access to texture resources
 */

export interface TextureSet {
  /** Base texture (albedo/diffuse) */
  base: string;
  /** Normal map */
  normal?: string;
  /** Roughness map */
  roughness?: string;
  /** Metallic map */
  metallic?: string;
  /** Ambient occlusion map */
  ao?: string;
  /** Height/displacement map */
  height?: string;
}

/**
 * Texture registry for common block types
 * 
 * Note: These are placeholder paths. In production:
 * - Replace with actual texture file paths
 * - Use asset bundler (Vite, Webpack) for proper asset management
 * - Consider using texture packs
 */
export const TEXTURE_REGISTRY: Record<string, TextureSet> = {
  // ===== BASIC MATERIALS =====
  
  stone: {
    base: '/textures/blocks/stone.png',
    normal: '/textures/blocks/stone_normal.png',
    roughness: '/textures/blocks/stone_roughness.png',
    ao: '/textures/blocks/stone_ao.png',
  },

  cobblestone: {
    base: '/textures/blocks/cobblestone.png',
    normal: '/textures/blocks/cobblestone_normal.png',
    roughness: '/textures/blocks/cobblestone_roughness.png',
    ao: '/textures/blocks/cobblestone_ao.png',
  },

  dirt: {
    base: '/textures/blocks/dirt.png',
    normal: '/textures/blocks/dirt_normal.png',
    roughness: '/textures/blocks/dirt_roughness.png',
  },

  grass_side: {
    base: '/textures/blocks/grass_side.png',
    normal: '/textures/blocks/grass_side_normal.png',
  },

  grass_top: {
    base: '/textures/blocks/grass_top.png',
    normal: '/textures/blocks/grass_top_normal.png',
  },

  sand: {
    base: '/textures/blocks/sand.png',
    normal: '/textures/blocks/sand_normal.png',
    roughness: '/textures/blocks/sand_roughness.png',
  },

  // ===== WOOD =====

  oak_planks: {
    base: '/textures/blocks/oak_planks.png',
    normal: '/textures/blocks/oak_planks_normal.png',
    roughness: '/textures/blocks/oak_planks_roughness.png',
  },

  oak_log_side: {
    base: '/textures/blocks/oak_log_side.png',
    normal: '/textures/blocks/oak_log_side_normal.png',
  },

  oak_log_top: {
    base: '/textures/blocks/oak_log_top.png',
    normal: '/textures/blocks/oak_log_top_normal.png',
  },

  birch_planks: {
    base: '/textures/blocks/birch_planks.png',
    normal: '/textures/blocks/birch_planks_normal.png',
  },

  // ===== STONE VARIANTS =====

  granite: {
    base: '/textures/blocks/granite.png',
    normal: '/textures/blocks/granite_normal.png',
    roughness: '/textures/blocks/granite_roughness.png',
  },

  andesite: {
    base: '/textures/blocks/andesite.png',
    normal: '/textures/blocks/andesite_normal.png',
  },

  diorite: {
    base: '/textures/blocks/diorite.png',
    normal: '/textures/blocks/diorite_normal.png',
  },

  // ===== BRICKS =====

  bricks: {
    base: '/textures/blocks/bricks.png',
    normal: '/textures/blocks/bricks_normal.png',
    roughness: '/textures/blocks/bricks_roughness.png',
    ao: '/textures/blocks/bricks_ao.png',
  },

  stone_bricks: {
    base: '/textures/blocks/stone_bricks.png',
    normal: '/textures/blocks/stone_bricks_normal.png',
    ao: '/textures/blocks/stone_bricks_ao.png',
  },

  // ===== METALS =====

  iron_block: {
    base: '/textures/blocks/iron_block.png',
    normal: '/textures/blocks/iron_block_normal.png',
    roughness: '/textures/blocks/iron_block_roughness.png',
    metallic: '/textures/blocks/iron_block_metallic.png',
  },

  gold_block: {
    base: '/textures/blocks/gold_block.png',
    normal: '/textures/blocks/gold_block_normal.png',
    roughness: '/textures/blocks/gold_block_roughness.png',
    metallic: '/textures/blocks/gold_block_metallic.png',
  },

  copper_block: {
    base: '/textures/blocks/copper_block.png',
    normal: '/textures/blocks/copper_block_normal.png',
    metallic: '/textures/blocks/copper_block_metallic.png',
  },

  // ===== GLASS =====

  glass: {
    base: '/textures/blocks/glass.png',
    normal: '/textures/blocks/glass_normal.png',
  },

  glass_white: {
    base: '/textures/blocks/glass_white.png',
  },

  glass_red: {
    base: '/textures/blocks/glass_red.png',
  },

  glass_blue: {
    base: '/textures/blocks/glass_blue.png',
  },

  // ===== DECORATIVE =====

  wool_white: {
    base: '/textures/blocks/wool_white.png',
    normal: '/textures/blocks/wool_normal.png',
  },

  wool_red: {
    base: '/textures/blocks/wool_red.png',
    normal: '/textures/blocks/wool_normal.png',
  },

  wool_blue: {
    base: '/textures/blocks/wool_blue.png',
    normal: '/textures/blocks/wool_normal.png',
  },

  concrete_white: {
    base: '/textures/blocks/concrete_white.png',
    normal: '/textures/blocks/concrete_normal.png',
    roughness: '/textures/blocks/concrete_roughness.png',
  },

  concrete_red: {
    base: '/textures/blocks/concrete_red.png',
    normal: '/textures/blocks/concrete_normal.png',
  },

  // ===== SPECIAL =====

  glowstone: {
    base: '/textures/blocks/glowstone.png',
    normal: '/textures/blocks/glowstone_normal.png',
  },

  obsidian: {
    base: '/textures/blocks/obsidian.png',
    normal: '/textures/blocks/obsidian_normal.png',
    roughness: '/textures/blocks/obsidian_roughness.png',
  },
};

/**
 * Helper to get texture path
 */
export function getTexturePath(id: string, type: keyof TextureSet = 'base'): string | undefined {
  return TEXTURE_REGISTRY[id]?.[type];
}

/**
 * Helper to check if texture exists
 */
export function hasTexture(id: string): boolean {
  return id in TEXTURE_REGISTRY;
}

/**
 * Get all texture IDs
 */
export function getAllTextureIds(): string[] {
  return Object.keys(TEXTURE_REGISTRY);
}

/**
 * Register custom texture set
 */
export function registerTexture(id: string, textureSet: TextureSet): void {
  TEXTURE_REGISTRY[id] = textureSet;
}

/**
 * Create data URL for placeholder texture
 * Useful for development when actual textures are not available
 */
export function createPlaceholderDataUrl(
  width: number = 64,
  height: number = 64,
  color1: string = '#888888',
  color2: string = '#666666'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return '';
  }

  // Create checkerboard pattern
  const checkSize = 8;
  for (let y = 0; y < height; y += checkSize) {
    for (let x = 0; x < width; x += checkSize) {
      const isEven = ((x / checkSize) + (y / checkSize)) % 2 === 0;
      ctx.fillStyle = isEven ? color1 : color2;
      ctx.fillRect(x, y, checkSize, checkSize);
    }
  }

  return canvas.toDataURL();
}

/**
 * Texture pack system
 */
export interface TexturePack {
  id: string;
  name: string;
  description: string;
  version: string;
  basePath: string;
  textures: Record<string, TextureSet>;
}

export class TexturePackManager {
  private activePack: TexturePack | null = null;
  private packs: Map<string, TexturePack> = new Map();

  /**
   * Register a texture pack
   */
  public registerPack(pack: TexturePack): void {
    this.packs.set(pack.id, pack);
  }

  /**
   * Activate a texture pack
   */
  public activatePack(packId: string): boolean {
    const pack = this.packs.get(packId);
    if (!pack) {
      return false;
    }

    this.activePack = pack;

    // Update registry with pack textures
    for (const [id, textureSet] of Object.entries(pack.textures)) {
      // Prepend base path to all texture URLs
      const processedSet: TextureSet = {
        base: pack.basePath + textureSet.base,
      };

      if (textureSet.normal) {
        processedSet.normal = pack.basePath + textureSet.normal;
      }
      if (textureSet.roughness) {
        processedSet.roughness = pack.basePath + textureSet.roughness;
      }
      if (textureSet.metallic) {
        processedSet.metallic = pack.basePath + textureSet.metallic;
      }
      if (textureSet.ao) {
        processedSet.ao = pack.basePath + textureSet.ao;
      }
      if (textureSet.height) {
        processedSet.height = pack.basePath + textureSet.height;
      }

      registerTexture(id, processedSet);
    }

    return true;
  }

  /**
   * Get active pack
   */
  public getActivePack(): TexturePack | null {
    return this.activePack;
  }

  /**
   * Get all registered packs
   */
  public getAllPacks(): TexturePack[] {
    return Array.from(this.packs.values());
  }

  /**
   * Deactivate current pack
   */
  public deactivatePack(): void {
    this.activePack = null;
  }
}

/**
 * Global texture pack manager
 */
export const globalTexturePackManager = new TexturePackManager();

