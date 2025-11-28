/**
 * MaterialLibrary - Pre-defined materials synchronized with atlas PRESETS
 * 
 * This library defines all built-in materials with their atlas indices
 * matching exactly the order in defaultAtlasMaterials.ts PRESETS array.
 * 
 * IMPORTANT: Atlas indices must match PRESETS order:
 * 0: debug, 1: stone, 2: grass, 3: oak_planks, 4: oak_log,
 * 5: sand, 6: brick, 7: iron, 8: dirt, 9: cobblestone,
 * 10: copper_block, 11: gold_block, 12: glass, 13: wool_white,
 * 14: wool_red, 15: obsidian
 */

import { MaterialRegistry, type MaterialDefinition, type MaterialCategory } from './MaterialRegistry';

// ============================================================================
// Material Definitions (synchronized with defaultAtlasMaterials.ts PRESETS)
// ============================================================================

/**
 * Built-in material definitions.
 * Atlas indices MUST match the PRESETS array in defaultAtlasMaterials.ts
 */
export const BUILTIN_MATERIALS: MaterialDefinition[] = [
  // Index 0: debug
  {
    id: 'debug',
    displayName: 'Debug',
    category: 'special',
    atlasIndex: 0,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.7 },
    status: 'ready',
    isProcedural: true,
    tags: ['debug', 'system'],
  },
  // Index 1: stone
  {
    id: 'stone',
    displayName: 'Stone',
    category: 'stone',
    atlasIndex: 1,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.8 },
    status: 'ready',
    isProcedural: true,
    tags: ['natural', 'building'],
  },
  // Index 2: grass
  {
    id: 'grass',
    displayName: 'Grass',
    category: 'organic',
    atlasIndex: 2,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.9 },
    status: 'ready',
    isProcedural: true,
    tags: ['natural', 'terrain'],
  },
  // Index 3: oak_planks
  {
    id: 'oak_planks',
    displayName: 'Oak Planks',
    category: 'wood',
    atlasIndex: 3,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.6 },
    status: 'ready',
    isProcedural: true,
    tags: ['natural', 'building', 'wood'],
  },
  // Index 4: oak_log
  {
    id: 'oak_log',
    displayName: 'Oak Log',
    category: 'wood',
    atlasIndex: 4,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.65 },
    status: 'ready',
    isProcedural: true,
    tags: ['natural', 'wood'],
  },
  // Index 5: sand
  {
    id: 'sand',
    displayName: 'Sand',
    category: 'organic',
    atlasIndex: 5,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.5 },
    status: 'ready',
    isProcedural: true,
    tags: ['natural', 'terrain'],
  },
  // Index 6: brick
  {
    id: 'brick',
    displayName: 'Brick',
    category: 'decorative',
    atlasIndex: 6,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.55 },
    status: 'ready',
    isProcedural: true,
    tags: ['building', 'decorative'],
  },
  // Index 7: iron
  {
    id: 'iron',
    displayName: 'Iron Block',
    category: 'metal',
    atlasIndex: 7,
    textures: { albedo: null },
    properties: { metallic: 0.6, roughness: 0.25 },
    status: 'ready',
    isProcedural: true,
    tags: ['metal', 'building'],
  },
  // Index 8: dirt
  {
    id: 'dirt',
    displayName: 'Dirt',
    category: 'organic',
    atlasIndex: 8,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.85 },
    status: 'ready',
    isProcedural: true,
    tags: ['natural', 'terrain'],
  },
  // Index 9: cobblestone
  {
    id: 'cobblestone',
    displayName: 'Cobblestone',
    category: 'stone',
    atlasIndex: 9,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.7 },
    status: 'ready',
    isProcedural: true,
    tags: ['natural', 'building', 'stone'],
  },
  // Index 10: copper_block
  {
    id: 'copper_block',
    displayName: 'Copper Block',
    category: 'metal',
    atlasIndex: 10,
    textures: { albedo: null },
    properties: { metallic: 0.7, roughness: 0.35 },
    status: 'ready',
    isProcedural: true,
    tags: ['metal', 'building'],
  },
  // Index 11: gold_block
  {
    id: 'gold_block',
    displayName: 'Gold Block',
    category: 'metal',
    atlasIndex: 11,
    textures: { albedo: null },
    properties: { metallic: 0.85, roughness: 0.25 },
    status: 'ready',
    isProcedural: true,
    tags: ['metal', 'precious'],
  },
  // Index 12: glass
  {
    id: 'glass',
    displayName: 'Glass',
    category: 'glass',
    atlasIndex: 12,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.1, alphaMode: 'blend' },
    status: 'ready',
    isProcedural: true,
    tags: ['transparent', 'building'],
  },
  // Index 13: wool_white
  {
    id: 'wool_white',
    displayName: 'White Wool',
    category: 'fabric',
    atlasIndex: 13,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.95 },
    status: 'ready',
    isProcedural: true,
    tags: ['fabric', 'decorative'],
  },
  // Index 14: wool_red
  {
    id: 'wool_red',
    displayName: 'Red Wool',
    category: 'fabric',
    atlasIndex: 14,
    textures: { albedo: null },
    properties: { metallic: 0, roughness: 0.9 },
    status: 'ready',
    isProcedural: true,
    tags: ['fabric', 'decorative', 'colored'],
  },
  // Index 15: obsidian
  {
    id: 'obsidian',
    displayName: 'Obsidian',
    category: 'special',
    atlasIndex: 15,
    textures: { albedo: null },
    properties: { metallic: 0.1, roughness: 0.4 },
    status: 'ready',
    isProcedural: true,
    tags: ['stone', 'special'],
  },
  // Index 16: glowstone (NEW - emissive)
  {
    id: 'glowstone',
    displayName: 'Glowstone',
    category: 'special',
    atlasIndex: 16,
    textures: { albedo: null },
    properties: { 
      metallic: 0, 
      roughness: 0.7,
      emissive: [1.0, 0.9, 0.7],
      emissiveIntensity: 2.0,
    },
    status: 'ready',
    isProcedural: true,
    tags: ['emissive', 'light', 'special'],
  },
  // Index 17: lava (NEW - emissive)
  {
    id: 'lava',
    displayName: 'Lava',
    category: 'special',
    atlasIndex: 17,
    textures: { albedo: null },
    properties: { 
      metallic: 0, 
      roughness: 0.3,
      emissive: [1.0, 0.3, 0.0],
      emissiveIntensity: 3.0,
    },
    status: 'ready',
    isProcedural: true,
    tags: ['emissive', 'liquid', 'hazard', 'special'],
  },
];

// ============================================================================
// Material Name → Index Lookup (for fast resolution)
// ============================================================================

/**
 * Quick lookup map: material name → atlas index
 * Used by resolveAtlasIndex for O(1) lookups.
 */
export const MATERIAL_ATLAS_MAP: ReadonlyMap<string, number> = new Map(
  BUILTIN_MATERIALS.map(m => [m.id, m.atlasIndex])
);

/**
 * Quick lookup map: atlas index → material name
 */
export const ATLAS_MATERIAL_MAP: ReadonlyMap<number, string> = new Map(
  BUILTIN_MATERIALS.map(m => [m.atlasIndex, m.id])
);

// ============================================================================
// Initialization Function
// ============================================================================

/**
 * Initialize material library with all built-in materials.
 * 
 * @param registry - The MaterialRegistry to populate
 * @returns Number of materials registered
 * 
 * @example
 * ```typescript
 * const resources = new ResourceManager();
 * initializeMaterialLibrary(resources.materials);
 * ```
 */
export function initializeMaterialLibrary(registry: MaterialRegistry): number {
  let count = 0;
  
  for (const material of BUILTIN_MATERIALS) {
    try {
      registry.register(material);
      count++;
    } catch (error) {
      // Material might already be registered - skip
      console.warn(`[MaterialLibrary] Could not register "${material.id}":`, error);
    }
  }
  
  return count;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all materials in a specific category.
 */
export function getMaterialsByCategory(category: MaterialCategory): MaterialDefinition[] {
  return BUILTIN_MATERIALS.filter(m => m.category === category);
}

/**
 * Get all materials with a specific tag.
 */
export function getMaterialsByTag(tag: string): MaterialDefinition[] {
  return BUILTIN_MATERIALS.filter(m => m.tags?.includes(tag));
}

/**
 * Get a material by its ID.
 */
export function getBuiltinMaterial(id: string): MaterialDefinition | undefined {
  return BUILTIN_MATERIALS.find(m => m.id === id);
}

/**
 * Check if a material ID is a built-in material.
 */
export function isBuiltinMaterial(id: string): boolean {
  return MATERIAL_ATLAS_MAP.has(id);
}

/**
 * Resolve material name to atlas index.
 * Returns fallback (0 = debug) if not found.
 */
export function resolveAtlasIndex(materialRef: string, fallback: number = 0): number {
  return MATERIAL_ATLAS_MAP.get(materialRef) ?? fallback;
}

/**
 * Resolve atlas index to material name.
 * Returns undefined if not found.
 */
export function resolveMaterialName(atlasIndex: number): string | undefined {
  return ATLAS_MATERIAL_MAP.get(atlasIndex);
}

// ============================================================================
// Constants
// ============================================================================

/** Default material ID (used as fallback) */
export const DEFAULT_MATERIAL_ID = 'debug';

/** Default atlas index (used as fallback) */
export const DEFAULT_ATLAS_INDEX = 0;

/** Total number of built-in materials */
export const BUILTIN_MATERIAL_COUNT = BUILTIN_MATERIALS.length;
