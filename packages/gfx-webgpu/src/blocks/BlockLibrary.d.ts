/**
 * Block Library - Kogama/Roblox/Minecraft style blocks
 *
 * Design principles:
 * - Simple, colorful aesthetic (Kogama/Roblox)
 * - Block-based voxel style (Minecraft)
 * - Support for both procedural and real textures
 * - Material-based rendering
 */
import type { RgbaColor } from '../utils/colors';
import type { CTMConfig } from '../textures/ConnectedTextures';
export type BlockCategory = 'basic' | 'natural' | 'gameplay';
export type BlockMaterialType = 'solid' | 'glass' | 'metal' | 'wood' | 'stone' | 'plastic' | 'emissive';
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
 * Reduced to 10 essential blocks across 3 categories
 */
export declare const BLOCK_LIBRARY: Record<string, BlockDefinition>;
/**
 * Get all blocks in a category
 */
export declare function getBlocksByCategory(category: BlockCategory): BlockDefinition[];
/**
 * Get block by ID
 */
export declare function getBlock(id: string): BlockDefinition | undefined;
/**
 * Get all block categories
 */
export declare function getAllCategories(): BlockCategory[];
//# sourceMappingURL=BlockLibrary.d.ts.map