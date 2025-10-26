/**
 * Asset Library V2 - Comprehensive asset collection
 *
 * Inspired by:
 * - Roblox: Diverse toolbox with many categories
 * - Kogama: Simple, colorful blocks and objects
 * - Minecraft: Building blocks with variants
 * - The Sims: Detailed furniture and room categories
 */
import type { Asset, AssetCollection, BlockDefinition } from './AssetTypes';
/**
 * Convert BlockLibrary blocks to new Asset format
 * @param blockLibrary - Object mapping block IDs to BlockDefinitions (from @engine/gfx-webgpu)
 */
export declare function convertBlocksToAssets(blockLibrary: Record<string, BlockDefinition & {
    id?: string;
    name: string;
    category: string;
    material: string;
    textures: {
        top: {
            color: [number, number, number, number];
        };
    };
}>): Asset[];
export declare const ASSET_COLLECTIONS: AssetCollection[];
/**
 * Get all built-in assets (requires BlockLibrary to be passed in)
 */
export declare function getAllBuiltInAssets(blockLibrary?: Record<string, BlockDefinition & {
    id?: string;
    name: string;
    category: string;
    material: string;
    textures: {
        top: {
            color: [number, number, number, number];
        };
    };
}>): Asset[];
/**
 * Get all collections
 */
export declare function getAllCollections(): AssetCollection[];
/**
 * Initialize asset registry with built-in content
 */
export declare function initializeAssetLibrary(registry: {
    registerBatch: (assets: Asset[]) => void;
    registerCollection: (col: AssetCollection) => void;
}, blockLibrary?: Record<string, BlockDefinition & {
    id?: string;
    name: string;
    category: string;
    material: string;
    textures: {
        top: {
            color: [number, number, number, number];
        };
    };
}>): Promise<void>;
//# sourceMappingURL=AssetLibrary.d.ts.map