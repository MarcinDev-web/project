/**
 * Asset Library V2 - Comprehensive asset collection
 * 
 * Inspired by:
 * - Roblox: Diverse toolbox with many categories
 * - Kogama: Simple, colorful blocks and objects
 * - Minecraft: Building blocks with variants
 * - The Sims: Detailed furniture and room categories
 */

import type { Asset, AssetCollection, AssetVariant, AssetSubcategory, AssetMaterial, AssetStyle } from './AssetTypes';
import { BLOCK_LIBRARY } from '../../rendering/blocks/BlockLibrary';
import { Logger } from '../../logger';

/**
 * Convert old BlockLibrary blocks to new Asset format
 */
export function convertBlocksToAssets(): Asset[] {
  const assets: Asset[] = [];

  for (const [blockId, block] of Object.entries(BLOCK_LIBRARY)) {
    const asset: Asset = {
      type: 'block',
      category: mapBlockCategoryToAssetCategory(block.category),
      subcategory: mapBlockCategoryToSubcategory(block.category),
      metadata: {
        id: `block_${blockId}`,
        name: block.name,
        description: `${block.category} block made of ${block.material}`,
        isBuiltIn: true,
        createdAt: new Date('2024-01-01'),
      },
      styles: [mapMaterialToStyle(block.material)],
      material: mapBlockMaterialToAssetMaterial(block.material),
      color: block.textures.top.color,
      scale: [1, 1, 1],
      blockData: block,
      isPlaceable: true,
      isEditable: false,
      tags: [block.category, block.material, 'block'],
      keywords: [block.name.toLowerCase(), block.category, block.material],
    };

    assets.push(asset);
  }

  return assets;
}

// Helper mapping functions
function mapBlockCategoryToAssetCategory(
  category: string
): Asset['category'] {
  const mapping: Record<string, Asset['category']> = {
    basic: 'Building',
    natural: 'Nature',
    decorative: 'Decoration',
    mechanical: 'Building',
    glass: 'Building',
    light: 'Lighting',
  };
  return mapping[category] || 'Building';
}

function mapBlockCategoryToSubcategory(category: string): AssetSubcategory {
  const mapping: Record<string, Asset['subcategory']> = {
    basic: 'Walls',
    natural: 'Rocks',
    decorative: 'WallDecor',
    mechanical: 'Other',
    glass: 'Windows',
    light: 'CeilingLights',
  };
  return mapping[category] || 'Other';
}

function mapMaterialToStyle(material: string): AssetStyle {
  const mapping: Record<string, AssetStyle> = {
    plastic: 'Cartoon',
    stone: 'Rustic',
    wood: 'Rustic',
    metal: 'Industrial',
    glass: 'Modern',
    emissive: 'Futuristic',
  };
  return mapping[material] || 'Contemporary';
}

function mapBlockMaterialToAssetMaterial(material: string): AssetMaterial {
  const mapping: Record<string, Asset['material']> = {
    plastic: 'Plastic',
    stone: 'Stone',
    wood: 'Wood',
    metal: 'Metal',
    glass: 'Glass',
    emissive: 'Plastic',
  };
  return mapping[material] || 'Plastic';
}

/**
 * Generate color variants for an asset
 */
function createColorVariants(
  assetId: string,
  baseColors: Array<{ name: string; color: [number, number, number, number] }>
): AssetVariant[] {
  const assetSlug = assetId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';

  const usedIds = new Set<string>();

  return baseColors.map((c, index) => {
    const variantSlug = c.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `variant-${index + 1}`;

    let id = `${assetSlug}__variant_${variantSlug}`;
    let collisionCounter = 1;
    while (usedIds.has(id)) {
      collisionCounter += 1;
      id = `${assetSlug}__variant_${variantSlug}-${collisionCounter}`;
    }

    usedIds.add(id);

    return {
      id,
      name: c.name,
      color: c.color,
    };
  });
}

// ============================================================================
// FURNITURE COLLECTION (The Sims inspired)
// ============================================================================

const FURNITURE_ASSETS: Asset[] = [
  // ===== SEATING =====
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Seating',
    metadata: {
      id: 'furniture_chair_dining',
      name: 'Dining Chair',
      description: 'Classic dining room chair',
      author: 'Built-in',
      isBuiltIn: true,
      isFeatured: true,
    },
    styles: ['Contemporary', 'Traditional'],
    material: 'Wood',
    color: [0.55, 0.4, 0.25, 1],
    scale: [0.6, 1.0, 0.6],
    cost: 100,
    isPlaceable: true,
    tags: ['seating', 'dining', 'chair'],
    keywords: ['chair', 'seat', 'dining room'],
    variants: createColorVariants('furniture_chair_dining', [
      { name: 'Oak', color: [0.55, 0.4, 0.25, 1] },
      { name: 'Walnut', color: [0.35, 0.25, 0.18, 1] },
      { name: 'White', color: [0.9, 0.9, 0.9, 1] },
      { name: 'Black', color: [0.15, 0.15, 0.15, 1] },
    ]),
  },
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Seating',
    metadata: {
      id: 'furniture_sofa_modern',
      name: 'Modern Sofa',
      description: 'Contemporary 3-seater sofa',
      author: 'Built-in',
      isBuiltIn: true,
      isFeatured: true,
    },
    styles: ['Modern', 'Contemporary'],
    material: 'Fabric',
    color: [0.35, 0.45, 0.55, 1],
    scale: [2.2, 0.9, 1.0],
    cost: 500,
    isPlaceable: true,
    tags: ['seating', 'living room', 'sofa', 'couch'],
    keywords: ['sofa', 'couch', 'living room', 'seating'],
    variants: createColorVariants('furniture_sofa_modern', [
      { name: 'Gray', color: [0.35, 0.45, 0.55, 1] },
      { name: 'Navy', color: [0.15, 0.25, 0.45, 1] },
      { name: 'Beige', color: [0.8, 0.75, 0.65, 1] },
      { name: 'Charcoal', color: [0.25, 0.25, 0.28, 1] },
    ]),
  },
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Seating',
    metadata: {
      id: 'furniture_armchair',
      name: 'Armchair',
      description: 'Comfortable accent chair',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Contemporary', 'Modern'],
    material: 'Fabric',
    color: [0.7, 0.3, 0.3, 1],
    scale: [0.9, 0.95, 0.9],
    cost: 250,
    isPlaceable: true,
    tags: ['seating', 'living room', 'chair', 'accent'],
    keywords: ['armchair', 'chair', 'accent', 'living room'],
  },

  // ===== TABLES =====
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Tables',
    metadata: {
      id: 'furniture_dining_table',
      name: 'Dining Table',
      description: 'Wooden dining table for 6',
      author: 'Built-in',
      isBuiltIn: true,
      isFeatured: true,
    },
    styles: ['Traditional', 'Rustic'],
    material: 'Wood',
    color: [0.5, 0.35, 0.22, 1],
    scale: [2.0, 0.8, 1.0],
    cost: 400,
    isPlaceable: true,
    tags: ['table', 'dining', 'surface'],
    keywords: ['table', 'dining table', 'dining room'],
    variants: createColorVariants('furniture_dining_table', [
      { name: 'Oak', color: [0.5, 0.35, 0.22, 1] },
      { name: 'Pine', color: [0.7, 0.55, 0.35, 1] },
      { name: 'Mahogany', color: [0.4, 0.2, 0.15, 1] },
    ]),
  },
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Tables',
    metadata: {
      id: 'furniture_coffee_table',
      name: 'Coffee Table',
      description: 'Low table for living room',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Modern', 'Contemporary'],
    material: 'Wood',
    color: [0.45, 0.3, 0.2, 1],
    scale: [1.2, 0.4, 0.7],
    cost: 200,
    isPlaceable: true,
    tags: ['table', 'living room', 'coffee table'],
    keywords: ['coffee table', 'table', 'living room'],
  },
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Tables',
    metadata: {
      id: 'furniture_desk',
      name: 'Work Desk',
      description: 'Simple office desk',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Modern', 'Minimalist'],
    material: 'Wood',
    color: [0.9, 0.9, 0.9, 1],
    scale: [1.4, 0.75, 0.7],
    cost: 300,
    isPlaceable: true,
    tags: ['table', 'desk', 'office', 'work'],
    keywords: ['desk', 'table', 'office', 'work'],
  },

  // ===== BEDS =====
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Beds',
    metadata: {
      id: 'furniture_bed_single',
      name: 'Single Bed',
      description: 'Comfortable single bed',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Contemporary'],
    material: 'Fabric',
    color: [0.85, 0.2, 0.25, 1],
    scale: [2.0, 0.6, 1.0],
    cost: 400,
    isPlaceable: true,
    tags: ['bed', 'bedroom', 'sleep'],
    keywords: ['bed', 'single', 'bedroom'],
    variants: createColorVariants('furniture_bed_single', [
      { name: 'Red', color: [0.85, 0.2, 0.25, 1] },
      { name: 'Blue', color: [0.2, 0.4, 0.8, 1] },
      { name: 'White', color: [0.95, 0.95, 0.95, 1] },
      { name: 'Gray', color: [0.5, 0.5, 0.55, 1] },
    ]),
  },
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Beds',
    metadata: {
      id: 'furniture_bed_double',
      name: 'Double Bed',
      description: 'Spacious double bed',
      author: 'Built-in',
      isBuiltIn: true,
      isFeatured: true,
    },
    styles: ['Contemporary', 'Modern'],
    material: 'Fabric',
    color: [0.3, 0.4, 0.6, 1],
    scale: [2.0, 0.6, 1.6],
    cost: 800,
    isPlaceable: true,
    tags: ['bed', 'bedroom', 'sleep', 'double'],
    keywords: ['bed', 'double', 'queen', 'bedroom'],
  },

  // ===== STORAGE =====
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Storage',
    metadata: {
      id: 'furniture_bookshelf',
      name: 'Bookshelf',
      description: 'Tall wooden bookshelf',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Traditional', 'Contemporary'],
    material: 'Wood',
    color: [0.5, 0.35, 0.2, 1],
    scale: [1.2, 2.0, 0.4],
    cost: 300,
    isPlaceable: true,
    tags: ['storage', 'shelf', 'bookshelf', 'books'],
    keywords: ['bookshelf', 'shelf', 'storage', 'books'],
  },
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Storage',
    metadata: {
      id: 'furniture_dresser',
      name: 'Dresser',
      description: 'Bedroom dresser with drawers',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Traditional'],
    material: 'Wood',
    color: [0.45, 0.3, 0.2, 1],
    scale: [1.2, 1.0, 0.5],
    cost: 350,
    isPlaceable: true,
    tags: ['storage', 'dresser', 'bedroom', 'drawers'],
    keywords: ['dresser', 'storage', 'bedroom', 'drawers'],
  },
  {
    type: 'primitive',
    category: 'Furniture',
    subcategory: 'Storage',
    metadata: {
      id: 'furniture_wardrobe',
      name: 'Wardrobe',
      description: 'Large clothing wardrobe',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Traditional'],
    material: 'Wood',
    color: [0.4, 0.28, 0.18, 1],
    scale: [1.5, 2.2, 0.6],
    cost: 600,
    isPlaceable: true,
    tags: ['storage', 'wardrobe', 'bedroom', 'closet'],
    keywords: ['wardrobe', 'closet', 'storage', 'bedroom', 'clothes'],
  },
];

// ============================================================================
// ARCHITECTURE (Building elements)
// ============================================================================

const ARCHITECTURE_ASSETS: Asset[] = [
  {
    type: 'primitive',
    category: 'Architecture',
    subcategory: 'Walls',
    metadata: {
      id: 'arch_wall_basic',
      name: 'Wall Section',
      description: 'Basic wall segment',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Contemporary'],
    material: 'Concrete',
    color: [0.85, 0.85, 0.88, 1],
    scale: [3, 2.5, 0.2],
    cost: 50,
    isPlaceable: true,
    tags: ['wall', 'building', 'structure'],
    keywords: ['wall', 'building', 'structure'],
  },
  {
    type: 'primitive',
    category: 'Architecture',
    subcategory: 'Doors',
    metadata: {
      id: 'arch_door_standard',
      name: 'Standard Door',
      description: 'Wooden door with frame',
      author: 'Built-in',
      isBuiltIn: true,
      isFeatured: true,
    },
    styles: ['Contemporary'],
    material: 'Wood',
    color: [0.45, 0.3, 0.2, 1],
    scale: [1.0, 2.1, 0.15],
    cost: 150,
    isPlaceable: true,
    tags: ['door', 'entrance', 'building'],
    keywords: ['door', 'entrance', 'building'],
    variants: createColorVariants('arch_door_standard', [
      { name: 'Natural Wood', color: [0.45, 0.3, 0.2, 1] },
      { name: 'White', color: [0.95, 0.95, 0.95, 1] },
      { name: 'Black', color: [0.1, 0.1, 0.1, 1] },
    ]),
  },
  {
    type: 'primitive',
    category: 'Architecture',
    subcategory: 'Windows',
    metadata: {
      id: 'arch_window_standard',
      name: 'Standard Window',
      description: 'Glass window with frame',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Contemporary'],
    material: 'Glass',
    color: [0.82, 0.87, 0.95, 0.5],
    scale: [1.2, 1.2, 0.1],
    cost: 120,
    isPlaceable: true,
    tags: ['window', 'glass', 'building'],
    keywords: ['window', 'glass', 'building'],
  },
  {
    type: 'primitive',
    category: 'Architecture',
    subcategory: 'Stairs',
    metadata: {
      id: 'arch_stairs_straight',
      name: 'Straight Stairs',
      description: 'Straight staircase',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Contemporary'],
    material: 'Concrete',
    color: [0.65, 0.65, 0.68, 1],
    scale: [2, 1, 2],
    cost: 300,
    isPlaceable: true,
    tags: ['stairs', 'staircase', 'building'],
    keywords: ['stairs', 'staircase', 'building', 'vertical'],
  },
  {
    type: 'primitive',
    category: 'Architecture',
    subcategory: 'Columns',
    metadata: {
      id: 'arch_column_classic',
      name: 'Classical Column',
      description: 'Decorative support column',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Traditional', 'Victorian'],
    material: 'Stone',
    color: [0.9, 0.88, 0.85, 1],
    scale: [0.4, 3.0, 0.4],
    cost: 200,
    isPlaceable: true,
    tags: ['column', 'pillar', 'support', 'decorative'],
    keywords: ['column', 'pillar', 'support', 'classical'],
  },
];

// ============================================================================
// LIGHTING (The Sims + modern design)
// ============================================================================

const LIGHTING_ASSETS: Asset[] = [
  {
    type: 'primitive',
    category: 'Lighting',
    subcategory: 'CeilingLights',
    metadata: {
      id: 'light_ceiling_modern',
      name: 'Modern Ceiling Light',
      description: 'Contemporary flush mount light',
      author: 'Built-in',
      isBuiltIn: true,
      isFeatured: true,
    },
    styles: ['Modern', 'Minimalist'],
    material: 'Metal',
    color: [0.95, 0.95, 0.98, 1],
    scale: [0.5, 0.15, 0.5],
    cost: 150,
    isPlaceable: true,
    tags: ['light', 'ceiling', 'illumination'],
    keywords: ['light', 'ceiling', 'lamp', 'fixture'],
  },
  {
    type: 'primitive',
    category: 'Lighting',
    subcategory: 'FloorLamps',
    metadata: {
      id: 'light_floor_standing',
      name: 'Standing Floor Lamp',
      description: 'Tall standing lamp',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Contemporary', 'Modern'],
    material: 'Metal',
    color: [0.9, 0.85, 0.6, 1],
    scale: [0.4, 1.8, 0.4],
    cost: 180,
    isPlaceable: true,
    tags: ['light', 'floor', 'standing', 'lamp'],
    keywords: ['lamp', 'floor lamp', 'standing', 'light'],
  },
  {
    type: 'primitive',
    category: 'Lighting',
    subcategory: 'TableLamps',
    metadata: {
      id: 'light_table_lamp',
      name: 'Table Lamp',
      description: 'Small decorative table lamp',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Contemporary'],
    material: 'Ceramic',
    color: [0.85, 0.8, 0.75, 1],
    scale: [0.25, 0.5, 0.25],
    cost: 80,
    isPlaceable: true,
    tags: ['light', 'table', 'lamp', 'desk'],
    keywords: ['lamp', 'table lamp', 'desk lamp', 'light'],
  },
];

// ============================================================================
// DECORATION (Kogama style + Sims detail)
// ============================================================================

const DECORATION_ASSETS: Asset[] = [
  {
    type: 'primitive',
    category: 'Decoration',
    subcategory: 'Plants',
    metadata: {
      id: 'deco_plant_pot',
      name: 'Potted Plant',
      description: 'Decorative plant in pot',
      author: 'Built-in',
      isBuiltIn: true,
      isFeatured: true,
    },
    styles: ['Contemporary', 'Modern'],
    material: 'Organic',
    color: [0.25, 0.7, 0.35, 1],
    scale: [0.4, 0.6, 0.4],
    cost: 50,
    isPlaceable: true,
    tags: ['decoration', 'plant', 'nature', 'pot'],
    keywords: ['plant', 'pot', 'decoration', 'indoor'],
  },
  {
    type: 'primitive',
    category: 'Decoration',
    subcategory: 'WallDecor',
    metadata: {
      id: 'deco_picture_frame',
      name: 'Picture Frame',
      description: 'Wall-mounted picture frame',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Contemporary'],
    material: 'Wood',
    color: [0.8, 0.75, 0.7, 1],
    scale: [1.0, 0.8, 0.05],
    cost: 60,
    isPlaceable: true,
    tags: ['decoration', 'wall', 'picture', 'art'],
    keywords: ['picture', 'frame', 'art', 'wall decor'],
  },
  {
    type: 'primitive',
    category: 'Decoration',
    subcategory: 'Rugs',
    metadata: {
      id: 'deco_rug_area',
      name: 'Area Rug',
      description: 'Decorative floor rug',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Contemporary', 'Traditional'],
    material: 'Fabric',
    color: [0.7, 0.3, 0.3, 1],
    scale: [2.0, 0.02, 1.5],
    cost: 120,
    isPlaceable: true,
    tags: ['decoration', 'rug', 'floor', 'carpet'],
    keywords: ['rug', 'carpet', 'floor', 'decoration'],
    variants: createColorVariants('deco_rug_area', [
      { name: 'Red', color: [0.7, 0.3, 0.3, 1] },
      { name: 'Blue', color: [0.3, 0.4, 0.7, 1] },
      { name: 'Beige', color: [0.8, 0.75, 0.65, 1] },
      { name: 'Gray', color: [0.5, 0.5, 0.55, 1] },
    ]),
  },
  {
    type: 'primitive',
    category: 'Decoration',
    subcategory: 'Sculptures',
    metadata: {
      id: 'deco_vase',
      name: 'Decorative Vase',
      description: 'Elegant ceramic vase',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Modern', 'Contemporary'],
    material: 'Ceramic',
    color: [0.9, 0.85, 0.8, 1],
    scale: [0.25, 0.5, 0.25],
    cost: 80,
    isPlaceable: true,
    tags: ['decoration', 'vase', 'ceramic'],
    keywords: ['vase', 'decoration', 'ceramic', 'ornament'],
  },
];

// ============================================================================
// NATURE (Minecraft + Kogama inspired)
// ============================================================================

const NATURE_ASSETS: Asset[] = [
  {
    type: 'model',
    category: 'Nature',
    subcategory: 'Trees',
    metadata: {
      id: 'nature_tree_oak',
      name: 'Oak Tree',
      description: 'Large oak tree',
      author: 'Built-in',
      isBuiltIn: true,
      isFeatured: true,
    },
    styles: ['Realistic', 'Low-Poly'],
    material: 'Organic',
    color: [0.25, 0.6, 0.25, 1],
    scale: [2.0, 5.0, 2.0],
    cost: 100,
    isPlaceable: true,
    tags: ['nature', 'tree', 'vegetation', 'outdoor'],
    keywords: ['tree', 'oak', 'nature', 'outdoor'],
  },
  {
    type: 'model',
    category: 'Nature',
    subcategory: 'Bushes',
    metadata: {
      id: 'nature_bush_generic',
      name: 'Bush',
      description: 'Generic decorative bush',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Low-Poly'],
    material: 'Organic',
    color: [0.3, 0.7, 0.35, 1],
    scale: [1.2, 0.8, 1.2],
    cost: 30,
    isPlaceable: true,
    tags: ['nature', 'bush', 'vegetation', 'outdoor'],
    keywords: ['bush', 'shrub', 'nature', 'outdoor'],
  },
  {
    type: 'model',
    category: 'Nature',
    subcategory: 'Rocks',
    metadata: {
      id: 'nature_rock_boulder',
      name: 'Boulder',
      description: 'Large stone boulder',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Realistic'],
    material: 'Stone',
    color: [0.5, 0.5, 0.52, 1],
    scale: [1.5, 1.2, 1.5],
    cost: 20,
    isPlaceable: true,
    tags: ['nature', 'rock', 'stone', 'outdoor'],
    keywords: ['rock', 'boulder', 'stone', 'nature'],
  },
  {
    type: 'model',
    category: 'Nature',
    subcategory: 'Flowers',
    metadata: {
      id: 'nature_flowers_patch',
      name: 'Flower Patch',
      description: 'Colorful flower patch',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Cartoon', 'Low-Poly'],
    material: 'Organic',
    color: [0.9, 0.6, 0.7, 1],
    scale: [1.0, 0.3, 1.0],
    cost: 40,
    isPlaceable: true,
    tags: ['nature', 'flowers', 'vegetation', 'outdoor', 'colorful'],
    keywords: ['flowers', 'garden', 'nature', 'outdoor'],
  },
];

// ============================================================================
// GAMEPLAY (Roblox inspired)
// ============================================================================

const GAMEPLAY_ASSETS: Asset[] = [
  {
    type: 'primitive',
    category: 'Gameplay',
    subcategory: 'Spawns',
    metadata: {
      id: 'gameplay_spawn_point',
      name: 'Spawn Point',
      description: 'Player spawn location marker',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Futuristic'],
    material: 'Plastic',
    color: [0.2, 0.8, 1.0, 1],
    scale: [0.8, 0.8, 0.8],
    cost: 0,
    isPlaceable: true,
    isEditable: false,
    tags: ['gameplay', 'spawn', 'player', 'marker'],
    keywords: ['spawn', 'player', 'start', 'respawn'],
  },
  {
    type: 'primitive',
    category: 'Gameplay',
    subcategory: 'Triggers',
    metadata: {
      id: 'gameplay_trigger_zone',
      name: 'Trigger Zone',
      description: 'Invisible trigger volume',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Futuristic'],
    material: 'Plastic',
    color: [0.9, 0.2, 0.9, 0.3],
    scale: [2.0, 2.0, 2.0],
    cost: 0,
    isPlaceable: true,
    isEditable: true,
    tags: ['gameplay', 'trigger', 'zone', 'interactive'],
    keywords: ['trigger', 'zone', 'event', 'interactive'],
  },
  {
    type: 'primitive',
    category: 'Gameplay',
    subcategory: 'Collectibles',
    metadata: {
      id: 'gameplay_checkpoint',
      name: 'Checkpoint',
      description: 'Checkpoint marker',
      author: 'Built-in',
      isBuiltIn: true,
    },
    styles: ['Futuristic', 'Cartoon'],
    material: 'Plastic',
    color: [1.0, 0.8, 0.2, 1],
    scale: [0.8, 1.5, 0.8],
    cost: 0,
    isPlaceable: true,
    tags: ['gameplay', 'checkpoint', 'marker', 'save'],
    keywords: ['checkpoint', 'save', 'marker', 'progress'],
  },
];

// ============================================================================
// COLLECTIONS (Roblox style packages)
// ============================================================================

export const ASSET_COLLECTIONS: AssetCollection[] = [
  {
    id: 'collection_living_room_modern',
    name: 'Modern Living Room Set',
    description: 'Complete modern living room furniture collection',
    assetIds: [
      'furniture_sofa_modern',
      'furniture_coffee_table',
      'furniture_armchair',
      'light_floor_standing',
      'deco_rug_area',
      'deco_plant_pot',
    ],
    tags: ['collection', 'living room', 'modern', 'furniture'],
    author: 'Built-in',
  },
  {
    id: 'collection_dining_traditional',
    name: 'Traditional Dining Set',
    description: 'Classic dining room furniture',
    assetIds: [
      'furniture_dining_table',
      'furniture_chair_dining',
      'light_ceiling_modern',
      'deco_picture_frame',
    ],
    tags: ['collection', 'dining room', 'traditional', 'furniture'],
    author: 'Built-in',
  },
  {
    id: 'collection_bedroom_essential',
    name: 'Bedroom Essentials',
    description: 'Everything you need for a complete bedroom',
    assetIds: [
      'furniture_bed_double',
      'furniture_dresser',
      'furniture_wardrobe',
      'light_table_lamp',
      'deco_rug_area',
    ],
    tags: ['collection', 'bedroom', 'furniture'],
    author: 'Built-in',
  },
  {
    id: 'collection_garden_outdoor',
    name: 'Garden & Outdoor',
    description: 'Nature elements for outdoor scenes',
    assetIds: [
      'nature_tree_oak',
      'nature_bush_generic',
      'nature_rock_boulder',
      'nature_flowers_patch',
    ],
    tags: ['collection', 'nature', 'outdoor', 'garden'],
    author: 'Built-in',
  },
  {
    id: 'collection_building_basics',
    name: 'Building Basics',
    description: 'Essential architectural elements',
    assetIds: [
      'arch_wall_basic',
      'arch_door_standard',
      'arch_window_standard',
      'arch_stairs_straight',
    ],
    tags: ['collection', 'architecture', 'building'],
    author: 'Built-in',
  },
];

// ============================================================================
// COMBINED LIBRARY
// ============================================================================

/**
 * Get all built-in assets
 */
export function getAllBuiltInAssets(): Asset[] {
  return [
    ...convertBlocksToAssets(),
    ...FURNITURE_ASSETS,
    ...ARCHITECTURE_ASSETS,
    ...LIGHTING_ASSETS,
    ...DECORATION_ASSETS,
    ...NATURE_ASSETS,
    ...GAMEPLAY_ASSETS,
  ];
}

/**
 * Get all collections
 */
export function getAllCollections(): AssetCollection[] {
  return ASSET_COLLECTIONS;
}

/**
 * Initialize asset registry with built-in content
 */
export async function initializeAssetLibrary(
  registry: { registerBatch: (assets: Asset[]) => void; registerCollection: (col: AssetCollection) => void }
): Promise<void> {
  Logger.debug('Initializing Asset Library V2...');

  // Register all assets
  const assets = getAllBuiltInAssets();
  registry.registerBatch(assets);

  // Register collections
  const collections = getAllCollections();
  collections.forEach((col) => registry.registerCollection(col));

  Logger.debug(`Initialized ${assets.length} assets and ${collections.length} collections`);
}

