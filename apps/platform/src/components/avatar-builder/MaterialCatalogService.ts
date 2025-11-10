/**
 * MaterialCatalogService - Central source of truth for avatar materials
 * Maps material string IDs to texture atlas material IDs and provides metadata
 */

import type { AvatarMaterialBinding } from '@engine/avatar';

export interface MaterialMetadata {
  readonly id: string;
  readonly name: string;
  readonly category: 'basic' | 'metal' | 'fabric' | 'stone' | 'wood' | 'special';
  readonly description?: string;
  readonly metallic: number;
  readonly roughness: number;
  readonly saturation?: number;
}

/**
 * Material catalog service providing material information and resolution
 */
export class MaterialCatalogService {
  private readonly materials: Map<string, MaterialMetadata>;
  private readonly materialIdMap: Map<string, number>;

  constructor() {
    this.materials = new Map();
    this.materialIdMap = new Map();
    this.initializeDefaultMaterials();
  }

  /**
   * Initialize default materials matching texture atlas
   * Material IDs correspond to atlas indices (0-15)
   */
  private initializeDefaultMaterials(): void {
    const defaultMaterials: MaterialMetadata[] = [
      {
        id: 'mat_default',
        name: 'Default',
        category: 'basic',
        description: 'Default solid color material',
        metallic: 0.0,
        roughness: 0.7,
      },
      {
        id: 'mat_stone',
        name: 'Stone',
        category: 'stone',
        description: 'Rough stone texture',
        metallic: 0.0,
        roughness: 0.8,
      },
      {
        id: 'mat_wood',
        name: 'Wood',
        category: 'wood',
        description: 'Oak wood planks',
        metallic: 0.0,
        roughness: 0.6,
      },
      {
        id: 'mat_metal',
        name: 'Metal',
        category: 'metal',
        description: 'Iron/metallic material',
        metallic: 0.6,
        roughness: 0.25,
      },
      {
        id: 'mat_grass',
        name: 'Grass',
        category: 'basic',
        description: 'Grass texture',
        metallic: 0.0,
        roughness: 0.9,
      },
      {
        id: 'mat_brick',
        name: 'Brick',
        category: 'stone',
        description: 'Brick texture',
        metallic: 0.0,
        roughness: 0.55,
      },
      {
        id: 'mat_sand',
        name: 'Sand',
        category: 'basic',
        description: 'Sand texture',
        metallic: 0.0,
        roughness: 0.5,
      },
      {
        id: 'mat_dirt',
        name: 'Dirt',
        category: 'basic',
        description: 'Dirt texture',
        metallic: 0.0,
        roughness: 0.85,
      },
      {
        id: 'mat_cobblestone',
        name: 'Cobblestone',
        category: 'stone',
        description: 'Cobblestone texture',
        metallic: 0.0,
        roughness: 0.7,
      },
      {
        id: 'mat_copper',
        name: 'Copper',
        category: 'metal',
        description: 'Copper block',
        metallic: 0.7,
        roughness: 0.35,
      },
      {
        id: 'mat_gold',
        name: 'Gold',
        category: 'metal',
        description: 'Gold block',
        metallic: 0.85,
        roughness: 0.25,
      },
      {
        id: 'mat_glass',
        name: 'Glass',
        category: 'special',
        description: 'Transparent glass',
        metallic: 0.0,
        roughness: 0.1,
      },
      {
        id: 'mat_wool',
        name: 'Wool',
        category: 'fabric',
        description: 'Wool fabric',
        metallic: 0.0,
        roughness: 0.95,
      },
      {
        id: 'mat_obsidian',
        name: 'Obsidian',
        category: 'stone',
        description: 'Dark obsidian',
        metallic: 0.1,
        roughness: 0.4,
      },
      {
        id: 'mat_glossy',
        name: 'Glossy',
        category: 'special',
        description: 'Glossy reflective surface',
        metallic: 0.3,
        roughness: 0.1,
      },
      {
        id: 'mat_matte',
        name: 'Matte',
        category: 'special',
        description: 'Matte non-reflective surface',
        metallic: 0.0,
        roughness: 0.95,
      },
    ];

    // Map materials to their IDs
    for (const material of defaultMaterials) {
      this.materials.set(material.id, material);
    }

    // Map string IDs to atlas material IDs (0-15)
    // This mapping aligns with texture atlas order where possible
    const idMapping: Record<string, number> = {
      'mat_default': 0,      // debug/default
      'mat_stone': 1,         // stone
      'mat_wood': 2,          // oak_planks
      'mat_metal': 3,         // iron
      'mat_grass': 4,         // grass
      'mat_brick': 5,         // brick
      'mat_sand': 6,          // sand
      'mat_dirt': 7,          // dirt
      'mat_cobblestone': 8,   // cobblestone
      'mat_copper': 9,        // copper_block
      'mat_gold': 10,         // gold_block
      'mat_glass': 11,        // glass
      'mat_wool': 12,         // wool_white
      'mat_obsidian': 13,     // obsidian
      'mat_glossy': 14,       // custom glossy
      'mat_matte': 15,        // custom matte
    };

    for (const [stringId, materialId] of Object.entries(idMapping)) {
      this.materialIdMap.set(stringId, materialId);
    }
  }

  /**
   * Get all available materials
   */
  getAllMaterials(): MaterialMetadata[] {
    return Array.from(this.materials.values());
  }

  /**
   * Get materials filtered by category
   */
  getMaterialsByCategory(category: MaterialMetadata['category']): MaterialMetadata[] {
    return this.getAllMaterials().filter((m) => m.category === category);
  }

  /**
   * Get material metadata by ID
   */
  getMaterial(id: string): MaterialMetadata | undefined {
    return this.materials.get(id);
  }

  /**
   * Resolve material string ID to AvatarMaterialBinding
   */
  resolveMaterial(id: string): AvatarMaterialBinding | null {
    const metadata = this.materials.get(id);
    if (!metadata) {
      return null;
    }

    const materialId = this.materialIdMap.get(id);
    if (materialId === undefined) {
      return null;
    }

    return {
      materialId,
      metallic: metadata.metallic,
      roughness: metadata.roughness,
    };
  }

  /**
   * Search materials by name or description
   */
  searchMaterials(query: string): MaterialMetadata[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllMaterials().filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.description?.toLowerCase().includes(lowerQuery) ||
        m.id.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get material resolver function compatible with AvatarMaterialResolver
   */
  getResolver(): (id: string) => AvatarMaterialBinding | null | undefined {
    return (id: string) => this.resolveMaterial(id);
  }
}

/**
 * Singleton instance of Material Catalog Service
 */
export const materialCatalogService = new MaterialCatalogService();

