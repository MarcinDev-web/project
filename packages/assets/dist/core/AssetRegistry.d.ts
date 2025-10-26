/**
 * Asset Registry - Central asset management system
 *
 * Responsibilities:
 * - Store and manage all assets
 * - Query and filter assets
 * - Handle collections
 * - Manage custom user assets
 * - Asset validation
 * - Import/export assets
 */
import type { Asset, AssetFilter, AssetSortOptions, AssetCollection, AssetType, AssetMainCategory, BlockDefinition } from './AssetTypes';
export interface RegisterBlockAssetOptions {
    origin?: 'custom' | 'session';
}
export declare class AssetRegistry {
    private assets;
    private collections;
    private initialized;
    private queryCache;
    private categoryCacheMap;
    private typeCacheMap;
    private readonly CACHE_TTL;
    private lastModified;
    /**
     * Initialize the registry with built-in assets
     */
    initialize(): Promise<void>;
    /**
     * Register a new asset
     */
    register(asset: Asset): void;
    /**
     * Register a custom block definition as an asset
     */
    registerBlockAsset(block: BlockDefinition & {
        id: string;
        name: string;
        category: string;
        material: string;
        textures: {
            top: {
                color: [number, number, number, number];
            };
        };
    }, options?: RegisterBlockAssetOptions): Asset;
    /**
     * Register multiple assets at once
     */
    registerBatch(assets: Asset[]): void;
    /**
     * Get asset by ID
     */
    get(id: string): Asset | undefined;
    /**
     * Get all assets
     */
    getAll(): Asset[];
    /**
     * Query assets with filters
     */
    query(filter?: AssetFilter, sort?: AssetSortOptions): Asset[];
    /**
     * Search assets by text query
     */
    search(query: string, options?: Partial<AssetFilter>): Asset[];
    /**
     * Get assets by category (with caching)
     */
    getByCategory(category: AssetMainCategory): Asset[];
    /**
     * Get assets by type (with caching)
     */
    getByType(type: AssetType): Asset[];
    /**
     * Get assets by subcategory
     */
    getBySubcategory(category: AssetMainCategory, subcategory: string): Asset[];
    /**
     * Get featured assets
     */
    getFeatured(): Asset[];
    /**
     * Increment usage count for an asset
     */
    incrementUsageCount(id: string): void;
    /**
     * Remove an asset
     */
    remove(id: string): boolean;
    /**
     * Update an existing asset
     */
    update(id: string, updates: Partial<Asset>): boolean;
    /**
     * Register a collection
     */
    registerCollection(collection: AssetCollection): void;
    /**
     * Get collection by ID
     */
    getCollection(id: string): AssetCollection | undefined;
    /**
     * Get all collections
     */
    getAllCollections(): AssetCollection[];
    /**
     * Get assets in a collection
     */
    getCollectionAssets(collectionId: string): Asset[];
    /**
     * Save custom assets to localStorage
     */
    saveCustomAssets(): Promise<void>;
    /**
     * Load custom assets from localStorage
     */
    private loadCustomAssets;
    /**
     * Export assets to JSON
     */
    exportAssets(assetIds?: string[]): string;
    /**
     * Import assets from JSON
     */
    importAssets(json: string): number;
    /**
     * Load built-in assets
     */
    private loadBuiltInAssets;
    /**
     * Validate an asset
     */
    private validateAsset;
    /**
     * Apply filters to asset list
     */
    private applyFilters;
    /**
     * Apply sorting to asset list
     */
    private applySorting;
    /**
     * Clear all assets (mainly for testing)
     */
    clear(): void;
    /**
     * Invalidate all caches
     */
    private invalidateCache;
    /**
     * Generate cache key from filter and sort options
     */
    private generateCacheKey;
    /**
     * Get statistics
     */
    getStats(): {
        totalAssets: number;
        builtInAssets: number;
        customAssets: number;
        collections: number;
        byType: Record<AssetType, number>;
        byCategory: Record<AssetMainCategory, number>;
    };
    private mapBlockCategoryToMainCategory;
    private mapBlockCategoryToSubcategory;
    private mapBlockMaterialToStyle;
    private mapBlockMaterial;
}
export declare const assetRegistry: AssetRegistry;
//# sourceMappingURL=AssetRegistry.d.ts.map