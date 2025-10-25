/**
 * Connected Textures System (CTM)
 *
 * Inspired by Minecraft's Connected Textures Mod
 * Allows blocks to have different textures based on neighboring blocks
 *
 * Features:
 * - Horizontal connection (left-right)
 * - Vertical connection (top-bottom)
 * - Full cross connection (all 4 sides)
 * - Pillar connection (top-bottom with caps)
 * - Random variation
 */
import type { Vec3 } from '@engine/core/math';
export type CTMPattern = 'none' | 'horizontal' | 'vertical' | 'cross' | 'pillar' | 'random';
export type CTMFace = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';
export interface CTMConfig {
    /** Pattern type */
    pattern: CTMPattern;
    /** Should connect to same block type only? */
    matchSameType: boolean;
    /** Should connect to same category? */
    matchCategory: boolean;
    /** Number of random variants (for random pattern) */
    randomVariants?: number;
}
export interface CTMNeighbors {
    top: boolean;
    bottom: boolean;
    north: boolean;
    south: boolean;
    east: boolean;
    west: boolean;
}
export interface CTMTextureIndex {
    /** Texture variant index (0-based) */
    index: number;
    /** Rotation in degrees (0, 90, 180, 270) */
    rotation: number;
    /** Should flip horizontally? */
    flipX: boolean;
    /** Should flip vertically? */
    flipY: boolean;
}
/**
 * Connected Texture Manager
 *
 * Determines which texture variant to use based on neighbors
 */
export declare class ConnectedTextureSystem {
    /**
     * Get texture index for a block face based on neighbors
     */
    static getTextureIndex(face: CTMFace, neighbors: CTMNeighbors, config: CTMConfig): CTMTextureIndex;
    /**
     * Horizontal connection (3 textures: left, middle, right)
     */
    private static getHorizontalIndex;
    /**
     * Vertical connection (3 textures: bottom, middle, top)
     */
    private static getVerticalIndex;
    /**
     * Cross connection (16 textures for all combinations)
     * Uses Minecraft CTM format
     */
    private static getCrossIndex;
    /**
     * Pillar connection (top cap, middle, bottom cap)
     */
    private static getPillarIndex;
    /**
     * Random variation (for natural blocks like stone, dirt)
     */
    private static getRandomIndex;
    /**
     * Get deterministic random index based on position
     */
    static getRandomIndexByPosition(position: Vec3, variants: number): CTMTextureIndex;
    /**
     * Check if there's a neighbor to the left (relative to face direction)
     */
    private static hasNeighborLeft;
    /**
     * Check if there's a neighbor to the right (relative to face direction)
     */
    private static hasNeighborRight;
    /**
     * Get neighbor blocks from scene
     */
    static getNeighbors(position: Vec3, scene: {
        getBlockAt: (pos: Vec3) => {
            type: string;
            category?: string;
        } | null;
    }): CTMNeighbors;
    /**
     * Check if two blocks should connect
     */
    static shouldConnect(blockA: {
        type: string;
        category?: string;
    }, blockB: {
        type: string;
        category?: string;
    }, config: CTMConfig): boolean;
}
/**
 * CTM Texture Set
 * Defines multiple texture variants for connected textures
 */
export interface CTMTextureSet {
    /** Pattern type */
    pattern: CTMPattern;
    /** Texture URLs or data for each variant */
    textures: string[];
    /** Configuration */
    config: CTMConfig;
}
/**
 * Example CTM configurations
 */
export declare const CTM_PRESETS: Record<string, CTMConfig>;
/**
 * Helper to generate CTM texture coordinates
 */
export declare class CTMTextureMapper {
    /**
     * Get UV coordinates for a CTM texture index
     * Assumes textures are in a grid (e.g., 4x4 for cross pattern)
     */
    static getUVs(textureIndex: CTMTextureIndex, gridWidth: number, gridHeight: number): {
        u: number;
        v: number;
        uWidth: number;
        vHeight: number;
    };
    /**
     * Get texture atlas index for cross pattern (4x4 grid)
     */
    static getCrossAtlasIndex(neighbors: CTMNeighbors): number;
}
/**
 * CTM Debug Visualizer
 */
export declare class CTMDebugger {
    /**
     * Get visual representation of neighbor state
     */
    static visualizeNeighbors(neighbors: CTMNeighbors): string;
    /**
     * Get description of texture index
     */
    static describeTextureIndex(index: CTMTextureIndex, pattern: CTMPattern): string;
}
//# sourceMappingURL=ConnectedTextures.d.ts.map