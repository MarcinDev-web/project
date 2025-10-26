/**
 * Unified Asset System
 * Inspired by: Roblox, Kogama, Minecraft, The Sims
 *
 * Design principles:
 * - Unified type system for all assets (blocks, models, prefabs, materials)
 * - Hierarchical categories with subcategories
 * - Flexible tagging system for advanced filtering
 * - Collections/packages support
 * - Variant system (colors, materials, styles)
 * - Rich metadata (author, version, dependencies)
 */
import type { Vec3 } from '@engine/core/math';
export type RgbaColor = [number, number, number, number];
export type BlockDefinition = unknown;
/**
 * Asset types - what kind of content this asset represents
 * Inspired by Roblox Toolbox categories
 */
export type AssetType = 'block' | 'model' | 'prefab' | 'material' | 'collection' | 'primitive' | 'decal' | 'particle' | 'audio' | 'script';
/**
 * Main category (The Sims style - room/function based)
 */
export type AssetMainCategory = 'Building' | 'Architecture' | 'Furniture' | 'Decoration' | 'Nature' | 'Lighting' | 'Gameplay' | 'Vehicles' | 'Characters' | 'Electronics' | 'Plumbing' | 'Landscaping' | 'Effects' | 'Materials' | 'Custom';
/**
 * Subcategory - more specific classification (The Sims style)
 */
export type AssetSubcategory = 'Walls' | 'Floors' | 'Roofs' | 'Foundations' | 'Fences' | 'Doors' | 'Windows' | 'Stairs' | 'Columns' | 'Arches' | 'Seating' | 'Tables' | 'Beds' | 'Storage' | 'Surfaces' | 'WallDecor' | 'Sculptures' | 'Plants' | 'Rugs' | 'Curtains' | 'Trees' | 'Bushes' | 'Flowers' | 'Rocks' | 'Grass' | 'CeilingLights' | 'WallLights' | 'FloorLamps' | 'TableLamps' | 'Outdoor' | 'Spawns' | 'Triggers' | 'Zones' | 'Collectibles' | 'Interactive' | 'Computers' | 'TVs' | 'Audio' | 'Appliances' | 'Sinks' | 'Toilets' | 'Showers' | 'Tubs' | 'Other';
/**
 * Style tags (The Sims style system)
 */
export type AssetStyle = 'Modern' | 'Contemporary' | 'Traditional' | 'Rustic' | 'Industrial' | 'Minimalist' | 'Victorian' | 'Medieval' | 'Futuristic' | 'Fantasy' | 'Cartoon' | 'Realistic' | 'Low-Poly' | 'Voxel';
/**
 * Material type (Minecraft/Kogama inspired)
 */
export type AssetMaterial = 'Wood' | 'Stone' | 'Metal' | 'Glass' | 'Plastic' | 'Fabric' | 'Concrete' | 'Brick' | 'Ceramic' | 'Organic';
/**
 * Asset metadata - author info, versioning, etc.
 */
export interface AssetMetadata {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Detailed description */
    description: string;
    /** Author/creator name */
    author?: string;
    /** Creation date */
    createdAt?: Date;
    /** Last modified date */
    modifiedAt?: Date;
    /** Version string (e.g., "1.0.0") */
    version?: string;
    /** Is this a built-in asset or user-created? */
    isBuiltIn: boolean;
    /** Is this asset featured/promoted? */
    isFeatured?: boolean;
    /** Download/usage count (Roblox style) */
    usageCount?: number;
    /** Star rating (1-5) */
    rating?: number;
}
/**
 * Asset variant - different versions of the same base asset
 * Example: Same chair in different colors (The Sims swatches)
 */
export interface AssetVariant {
    /** Variant identifier */
    id: string;
    /** Variant name (e.g., "Red", "Oak Wood", "Large") */
    name: string;
    /** Color override */
    color?: RgbaColor;
    /** Scale override */
    scale?: Vec3;
    /** Material override */
    material?: AssetMaterial;
    /** Price/cost modifier */
    costModifier?: number;
    /** Custom thumbnail */
    thumbnail?: string;
}
/**
 * Asset collection/package (Roblox style)
 * A bundle of related assets that work together
 */
export interface AssetCollection {
    /** Collection ID */
    id: string;
    /** Collection name */
    name: string;
    /** Description */
    description: string;
    /** Asset IDs in this collection */
    assetIds: string[];
    /** Thumbnail for the collection */
    thumbnail?: string;
    /** Tags */
    tags?: string[];
    /** Author */
    author?: string;
}
/**
 * Asset dependencies
 */
export interface AssetDependency {
    /** Asset ID that this depends on */
    assetId: string;
    /** Is this dependency required? */
    required: boolean;
    /** Minimum version required */
    minVersion?: string;
}
/**
 * Complete asset definition
 * This is the unified type that represents any asset in the system
 */
export interface Asset {
    /** What type of asset is this? */
    type: AssetType;
    /** Main category */
    category: AssetMainCategory;
    /** Subcategory for finer classification */
    subcategory?: AssetSubcategory;
    metadata: AssetMetadata;
    /** Style tags */
    styles?: AssetStyle[];
    /** Material type */
    material?: AssetMaterial;
    /** Primary color */
    color: RgbaColor;
    /** Thumbnail URL or data URI */
    thumbnail?: string;
    /** Default scale */
    scale: Vec3;
    /** Rotation (euler angles) */
    rotation?: Vec3;
    /** Pivot point offset */
    pivot?: Vec3;
    /** Available variants (color swatches, sizes, etc.) */
    variants?: AssetVariant[];
    /** Default variant ID */
    defaultVariant?: string;
    /** Searchable tags */
    tags?: string[];
    /** Search keywords */
    keywords?: string[];
    /** Other assets this depends on */
    dependencies?: AssetDependency[];
    /** Collection this belongs to */
    collectionId?: string;
    /** Cost/price (for economy systems) */
    cost?: number;
    /** Is this asset placeable? */
    isPlaceable?: boolean;
    /** Can this be edited by users? */
    isEditable?: boolean;
    /** Is this locked/premium content? */
    isLocked?: boolean;
    /** Block-specific data (if type === 'block') */
    blockData?: BlockDefinition;
    /** Model file path (if type === 'model') */
    modelPath?: string;
    /** Prefab configuration (if type === 'prefab') */
    prefabData?: {
        entities: Array<{
            name: string;
            position: Vec3;
            rotation: Vec3;
            scale: Vec3;
            components: Record<string, unknown>;
        }>;
    };
    /** Material data (if type === 'material') */
    materialData?: {
        shader?: string;
        textures?: Record<string, string>;
        properties?: Record<string, unknown>;
    };
    /** Any additional custom data */
    customData?: Record<string, unknown>;
}
/**
 * Asset query filter options
 */
export interface AssetFilter {
    /** Filter by type */
    type?: AssetType | AssetType[];
    /** Filter by main category */
    category?: AssetMainCategory | AssetMainCategory[];
    /** Filter by subcategory */
    subcategory?: AssetSubcategory | AssetSubcategory[];
    /** Filter by style */
    style?: AssetStyle | AssetStyle[];
    /** Filter by material */
    material?: AssetMaterial | AssetMaterial[];
    /** Filter by tags (any match) */
    tags?: string[];
    /** Search query (name, description, keywords) */
    search?: string;
    /** Only show featured assets */
    featured?: boolean;
    /** Only show built-in assets */
    builtIn?: boolean;
    /** Only show user-created assets */
    custom?: boolean;
    /** Only show placeable assets */
    placeable?: boolean;
    /** Cost range filter */
    costRange?: {
        min: number;
        max: number;
    };
    /** Author filter */
    author?: string;
    /** Collection filter */
    collectionId?: string;
}
/**
 * Sort options for asset lists
 */
export type AssetSortBy = 'name' | 'date' | 'usage' | 'rating' | 'cost' | 'recent';
export interface AssetSortOptions {
    sortBy: AssetSortBy;
    ascending?: boolean;
}
/**
 * Asset placement hint (for editor)
 */
export interface AssetPlacementHint {
    /** Suggested placement mode */
    mode: 'ground' | 'wall' | 'ceiling' | 'floating' | 'surface';
    /** Snap to grid? */
    snapToGrid?: boolean;
    /** Grid size override */
    gridSize?: number;
    /** Align to surface normal? */
    alignToSurface?: boolean;
    /** Offset from surface */
    surfaceOffset?: number;
}
/**
 * Asset preview configuration
 */
export interface AssetPreview {
    /** Camera distance */
    cameraDistance?: number;
    /** Camera angle (degrees) */
    cameraAngle?: Vec3;
    /** Background color */
    backgroundColor?: RgbaColor;
    /** Show grid? */
    showGrid?: boolean;
    /** Show shadow? */
    showShadow?: boolean;
}
/** Legacy Asset categories from V1 AssetLibrary */
export type AssetCategory = 'Blocks' | 'Primitives' | 'Architecture' | 'Furniture' | 'Nature' | 'Decoration' | 'Gameplay';
/** Legacy AssetPreset from V1 AssetLibrary */
export interface AssetPreset {
    name: string;
    description: string;
    scale: Vec3;
    color: RgbaColor;
    category: AssetCategory;
    /** Optional block id for textured blocks */
    blockId?: string;
}
//# sourceMappingURL=AssetTypes.d.ts.map