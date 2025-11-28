/**
 * GPUMaterialDefinitions - Material definitions for GPU procedural generation
 * 
 * These definitions replace the ASCII art patterns in defaultAtlasMaterials.ts
 * with GPU compute shader parameters.
 * 
 * IMPORTANT: Atlas indices must match the order of materials here:
 * 0: debug, 1: stone, 2: grass, 3: oak_planks, 4: oak_log,
 * 5: sand, 6: brick, 7: iron, 8: dirt, 9: cobblestone,
 * 10: copper_block, 11: gold_block, 12: glass, 13: wool_white,
 * 14: wool_red, 15: obsidian, 16: glowstone, 17: lava
 */

import type { GPUMaterialDefinition } from './GPUAtlasMaterialBuilder';

// ============================================================================
// Color Helpers
// ============================================================================

/** Convert RGB (0-255) to RGBA (0-1) with alpha=1 */
function rgb(r: number, g: number, b: number): [number, number, number, number] {
  return [r / 255, g / 255, b / 255, 1.0];
}

/** Convert RGBA (0-255) to RGBA (0-1) */
function rgba(r: number, g: number, b: number, a: number): [number, number, number, number] {
  return [r / 255, g / 255, b / 255, a / 255];
}

// ============================================================================
// Material Definitions (18 materials)
// ============================================================================

export const GPU_MATERIAL_DEFINITIONS: GPUMaterialDefinition[] = [
  // Index 0: debug
  {
    name: 'debug',
    pattern: 'solid',
    color: rgb(180, 160, 140),
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.7,
    saturation: 0.95,
  },

  // Index 1: stone
  {
    name: 'stone',
    pattern: 'cobble',
    color: rgb(138, 138, 138),
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.8,
    saturation: 0.9,
  },

  // Index 2: grass
  {
    name: 'grass',
    pattern: 'noise',
    color: rgb(108, 166, 74), // Green grass color
    topColor: rgb(94, 150, 64), // Slightly different top
    topPattern: 'noise',
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.9,
    saturation: 1.1,
  },

  // Index 3: oak_planks
  {
    name: 'oak_planks',
    pattern: 'planks',
    color: rgb(155, 107, 60),
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.6,
    saturation: 1.05,
  },

  // Index 4: oak_log
  {
    name: 'oak_log',
    pattern: 'planks',
    color: rgb(133, 94, 56),
    topColor: rgb(148, 110, 68), // Tree rings on top
    topPattern: 'grid',
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.65,
    saturation: 1.05,
  },

  // Index 5: sand
  {
    name: 'sand',
    pattern: 'noise',
    color: rgb(226, 208, 170),
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.5,
    saturation: 1.0,
  },

  // Index 6: brick
  {
    name: 'brick',
    pattern: 'bricks',
    color: rgb(178, 70, 58),
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.55,
    saturation: 1.1,
  },

  // Index 7: iron
  {
    name: 'iron',
    pattern: 'smooth',
    color: rgb(210, 214, 222),
    brightness: 1.0,
    metallic: 0.6,
    roughness: 0.25,
    saturation: 0.95,
  },

  // Index 8: dirt
  {
    name: 'dirt',
    pattern: 'noise',
    color: rgb(118, 78, 44),
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.85,
    saturation: 0.95,
  },

  // Index 9: cobblestone
  {
    name: 'cobblestone',
    pattern: 'cobble',
    color: rgb(156, 156, 156),
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.7,
    saturation: 0.9,
  },

  // Index 10: copper_block
  {
    name: 'copper_block',
    pattern: 'smooth',
    color: rgb(194, 148, 102),
    brightness: 1.0,
    metallic: 0.7,
    roughness: 0.35,
    saturation: 1.0,
  },

  // Index 11: gold_block
  {
    name: 'gold_block',
    pattern: 'smooth',
    color: rgb(246, 198, 92),
    brightness: 1.0,
    metallic: 0.85,
    roughness: 0.25,
    saturation: 1.05,
  },

  // Index 12: glass
  {
    name: 'glass',
    pattern: 'smooth',
    color: rgba(182, 214, 232, 180), // Semi-transparent
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.1,
    saturation: 1.1,
  },

  // Index 13: wool_white
  {
    name: 'wool_white',
    pattern: 'noise',
    color: rgb(226, 226, 226),
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.95,
    saturation: 1.0,
  },

  // Index 14: wool_red
  {
    name: 'wool_red',
    pattern: 'noise',
    color: rgb(178, 34, 40),
    brightness: 1.0,
    metallic: 0.0,
    roughness: 0.9,
    saturation: 1.1,
  },

  // Index 15: obsidian
  {
    name: 'obsidian',
    pattern: 'cobble',
    color: rgb(28, 18, 48),
    brightness: 1.0,
    metallic: 0.1,
    roughness: 0.4,
    saturation: 0.85,
  },

  // Index 16: glowstone (NEW - with emission)
  {
    name: 'glowstone',
    pattern: 'noise',
    color: rgb(255, 230, 180), // Warm yellow-orange
    brightness: 1.2,
    metallic: 0.0,
    roughness: 0.7,
    saturation: 1.1,
    emission: [1.0, 0.9, 0.7], // Warm glow
    emissionIntensity: 2.0,
  },

  // Index 17: lava (NEW - with emission)
  {
    name: 'lava',
    pattern: 'cobble',
    color: rgb(255, 100, 20), // Bright orange-red
    brightness: 1.5,
    metallic: 0.0,
    roughness: 0.3,
    saturation: 1.2,
    emission: [1.0, 0.3, 0.0], // Hot red-orange glow
    emissionIntensity: 3.0,
  },
];

// ============================================================================
// Lookup Maps
// ============================================================================

/**
 * Quick lookup: material name → atlas index
 */
export const GPU_MATERIAL_INDEX_MAP: ReadonlyMap<string, number> = new Map(
  GPU_MATERIAL_DEFINITIONS.map((def, index) => [def.name, index])
);

/**
 * Quick lookup: atlas index → material name
 */
export const GPU_INDEX_MATERIAL_MAP: ReadonlyMap<number, string> = new Map(
  GPU_MATERIAL_DEFINITIONS.map((def, index) => [index, def.name])
);

/**
 * Get material definition by name
 */
export function getGPUMaterialDefinition(name: string): GPUMaterialDefinition | undefined {
  const index = GPU_MATERIAL_INDEX_MAP.get(name);
  if (index === undefined) return undefined;
  return GPU_MATERIAL_DEFINITIONS[index];
}

/**
 * Get material definition by atlas index
 */
export function getGPUMaterialByIndex(index: number): GPUMaterialDefinition | undefined {
  return GPU_MATERIAL_DEFINITIONS[index];
}

/**
 * Check if a material has emission
 */
export function hasEmission(name: string): boolean {
  const def = getGPUMaterialDefinition(name);
  return def?.emission !== undefined && (def?.emissionIntensity ?? 0) > 0;
}

/**
 * Get all emissive materials
 */
export function getEmissiveMaterials(): GPUMaterialDefinition[] {
  return GPU_MATERIAL_DEFINITIONS.filter(
    def => def.emission !== undefined && (def.emissionIntensity ?? 0) > 0
  );
}

// ============================================================================
// Constants
// ============================================================================

/** Total number of GPU material definitions */
export const GPU_MATERIAL_COUNT = GPU_MATERIAL_DEFINITIONS.length;

/** Default texture size for GPU generation */
export const GPU_TEXTURE_SIZE = 128;

