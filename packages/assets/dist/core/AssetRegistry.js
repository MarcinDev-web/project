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
export class AssetRegistry {
    assets = new Map();
    collections = new Map();
    initialized = false;
    // Performance optimizations
    queryCache = new Map();
    categoryCacheMap = new Map();
    typeCacheMap = new Map();
    CACHE_TTL = 5000; // 5 seconds cache
    lastModified = Date.now();
    /**
     * Initialize the registry with built-in assets
     */
    async initialize() {
        if (this.initialized) {
            console.warn('AssetRegistry already initialized');
            return;
        }
        // Load built-in assets
        await this.loadBuiltInAssets();
        // Load custom assets from storage
        await this.loadCustomAssets();
        this.initialized = true;
        console.debug(`AssetRegistry initialized with ${this.assets.size} assets`);
    }
    /**
     * Register a new asset
     */
    register(asset) {
        // Validate asset
        if (!this.validateAsset(asset)) {
            throw new Error(`Invalid asset: ${asset.metadata.name}`);
        }
        // Check for duplicates
        if (this.assets.has(asset.metadata.id)) {
            console.warn(`Asset with id ${asset.metadata.id} already exists, overwriting`);
        }
        this.assets.set(asset.metadata.id, asset);
        this.invalidateCache();
        console.debug(`Registered asset: ${asset.metadata.name} (${asset.metadata.id})`);
    }
    /**
     * Register a custom block definition as an asset
     */
    registerBlockAsset(block, options) {
        const existing = this.assets.get(block.id);
        const asset = {
            type: 'block',
            category: this.mapBlockCategoryToMainCategory(block.category),
            subcategory: this.mapBlockCategoryToSubcategory(block.category),
            metadata: {
                id: block.id,
                name: block.name,
                description: `${block.category} block`,
                isBuiltIn: options?.origin !== 'custom',
                createdAt: existing?.metadata.createdAt ?? new Date(),
                modifiedAt: new Date(),
            },
            styles: [this.mapBlockMaterialToStyle(block.material)],
            material: this.mapBlockMaterial(block.material),
            color: block.textures.top.color,
            scale: [1, 1, 1],
            blockData: block,
            isPlaceable: true,
            isEditable: true,
            tags: ['block', block.category, block.material],
            keywords: [block.name.toLowerCase(), block.category],
        };
        this.register(asset);
        return asset;
    }
    /**
     * Register multiple assets at once
     */
    registerBatch(assets) {
        assets.forEach((asset) => this.register(asset));
    }
    /**
     * Get asset by ID
     */
    get(id) {
        return this.assets.get(id);
    }
    /**
     * Get all assets
     */
    getAll() {
        return Array.from(this.assets.values());
    }
    /**
     * Query assets with filters
     */
    query(filter = {}, sort) {
        // Generate cache key
        const cacheKey = this.generateCacheKey(filter, sort);
        // Check cache
        const cached = this.queryCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL && cached.timestamp >= this.lastModified) {
            return cached.result;
        }
        let results = Array.from(this.assets.values());
        // Apply filters
        results = this.applyFilters(results, filter);
        // Apply sorting
        if (sort) {
            results = this.applySorting(results, sort);
        }
        // Cache result
        this.queryCache.set(cacheKey, {
            result: results,
            timestamp: Date.now()
        });
        return results;
    }
    /**
     * Search assets by text query
     */
    search(query, options) {
        const filter = {
            ...options,
            search: query,
        };
        return this.query(filter);
    }
    /**
     * Get assets by category (with caching)
     */
    getByCategory(category) {
        // Check category cache
        const cached = this.categoryCacheMap.get(category);
        if (cached && this.lastModified <= Date.now()) {
            return cached;
        }
        const results = this.query({ category });
        this.categoryCacheMap.set(category, results);
        return results;
    }
    /**
     * Get assets by type (with caching)
     */
    getByType(type) {
        // Check type cache
        const cached = this.typeCacheMap.get(type);
        if (cached && this.lastModified <= Date.now()) {
            return cached;
        }
        const results = this.query({ type });
        this.typeCacheMap.set(type, results);
        return results;
    }
    /**
     * Get assets by subcategory
     */
    getBySubcategory(category, subcategory) {
        return this.query({ category, subcategory: subcategory });
    }
    /**
     * Get featured assets
     */
    getFeatured() {
        return this.query({ featured: true });
    }
    /**
     * Increment usage count for an asset
     */
    incrementUsageCount(id) {
        const asset = this.assets.get(id);
        if (asset) {
            const currentCount = asset.metadata.usageCount || 0;
            asset.metadata.usageCount = currentCount + 1;
            this.assets.set(id, asset);
        }
    }
    /**
     * Remove an asset
     */
    remove(id) {
        const deleted = this.assets.delete(id);
        if (deleted) {
            this.invalidateCache();
            console.debug(`Removed asset: ${id}`);
        }
        return deleted;
    }
    /**
     * Update an existing asset
     */
    update(id, updates) {
        const asset = this.assets.get(id);
        if (!asset) {
            console.warn(`Cannot update asset ${id}: not found`);
            return false;
        }
        // Merge updates
        const updated = { ...asset, ...updates };
        // Validate
        if (!this.validateAsset(updated)) {
            console.error('Updated asset failed validation');
            return false;
        }
        this.assets.set(id, updated);
        this.invalidateCache();
        console.debug(`Updated asset: ${id}`);
        return true;
    }
    // ============================================================================
    // COLLECTIONS
    // ============================================================================
    /**
     * Register a collection
     */
    registerCollection(collection) {
        this.collections.set(collection.id, collection);
        console.debug(`Registered collection: ${collection.name}`);
    }
    /**
     * Get collection by ID
     */
    getCollection(id) {
        return this.collections.get(id);
    }
    /**
     * Get all collections
     */
    getAllCollections() {
        return Array.from(this.collections.values());
    }
    /**
     * Get assets in a collection
     */
    getCollectionAssets(collectionId) {
        const collection = this.collections.get(collectionId);
        if (!collection)
            return [];
        return collection.assetIds
            .map((id) => this.assets.get(id))
            .filter((asset) => asset !== undefined);
    }
    // ============================================================================
    // PERSISTENCE
    // ============================================================================
    /**
     * Save custom assets to localStorage
     */
    async saveCustomAssets() {
        const customAssets = Array.from(this.assets.values()).filter((asset) => !asset.metadata.isBuiltIn);
        try {
            const data = JSON.stringify(customAssets);
            localStorage.setItem('customAssets', data);
            console.debug(`Saved ${customAssets.length} custom assets`);
        }
        catch (error) {
            console.error('Failed to save custom assets:', error);
        }
    }
    /**
     * Load custom assets from localStorage
     */
    async loadCustomAssets() {
        try {
            const data = localStorage.getItem('customAssets');
            if (!data)
                return;
            const assets = JSON.parse(data);
            assets.forEach((asset) => {
                // Restore dates
                if (asset.metadata.createdAt) {
                    asset.metadata.createdAt = new Date(asset.metadata.createdAt);
                }
                if (asset.metadata.modifiedAt) {
                    asset.metadata.modifiedAt = new Date(asset.metadata.modifiedAt);
                }
                this.register(asset);
            });
            console.debug(`Loaded ${assets.length} custom assets`);
        }
        catch (error) {
            console.error('Failed to load custom assets:', error);
        }
    }
    /**
     * Export assets to JSON
     */
    exportAssets(assetIds) {
        const assets = assetIds
            ? assetIds.map((id) => this.assets.get(id)).filter((a) => a !== undefined)
            : this.getAll();
        return JSON.stringify(assets, null, 2);
    }
    /**
     * Import assets from JSON
     */
    importAssets(json) {
        try {
            const assets = JSON.parse(json);
            if (!Array.isArray(assets)) {
                throw new Error('Invalid JSON: expected array of assets');
            }
            let imported = 0;
            for (const asset of assets) {
                try {
                    this.register(asset);
                    imported++;
                }
                catch (error) {
                    console.warn(`Failed to import asset ${asset.metadata.name}:`, error);
                }
            }
            console.debug(`Imported ${imported}/${assets.length} assets`);
            return imported;
        }
        catch (error) {
            console.error('Failed to import assets:', error);
            return 0;
        }
    }
    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================
    /**
     * Load built-in assets
     */
    async loadBuiltInAssets() {
        // This will be populated by the AssetLibrary conversion
        // For now, just a placeholder
        console.debug('Loading built-in assets...');
    }
    /**
     * Validate an asset
     */
    validateAsset(asset) {
        // Basic validation
        if (!asset.metadata?.id || !asset.metadata?.name) {
            console.error('Asset missing required metadata');
            return false;
        }
        if (!asset.type || !asset.category) {
            console.error('Asset missing type or category');
            return false;
        }
        if (!asset.scale || asset.scale.length !== 3) {
            console.error('Asset has invalid scale');
            return false;
        }
        if (!asset.color || asset.color.length !== 4) {
            console.error('Asset has invalid color');
            return false;
        }
        return true;
    }
    /**
     * Apply filters to asset list
     */
    applyFilters(assets, filter) {
        let filtered = assets;
        // Type filter
        if (filter.type) {
            const types = Array.isArray(filter.type) ? filter.type : [filter.type];
            filtered = filtered.filter((a) => types.includes(a.type));
        }
        // Category filter
        if (filter.category) {
            const categories = Array.isArray(filter.category) ? filter.category : [filter.category];
            filtered = filtered.filter((a) => categories.includes(a.category));
        }
        // Subcategory filter
        if (filter.subcategory) {
            const subcategories = Array.isArray(filter.subcategory)
                ? filter.subcategory
                : [filter.subcategory];
            filtered = filtered.filter((a) => a.subcategory && subcategories.includes(a.subcategory));
        }
        // Style filter
        if (filter.style) {
            const styles = Array.isArray(filter.style) ? filter.style : [filter.style];
            filtered = filtered.filter((a) => a.styles && a.styles.some((s) => styles.includes(s)));
        }
        // Material filter
        if (filter.material) {
            const materials = Array.isArray(filter.material) ? filter.material : [filter.material];
            filtered = filtered.filter((a) => a.material && materials.includes(a.material));
        }
        // Tags filter
        if (filter.tags && filter.tags.length > 0) {
            filtered = filtered.filter((a) => a.tags && a.tags.some((t) => filter.tags.includes(t)));
        }
        // Search query
        if (filter.search && filter.search.trim()) {
            const query = filter.search.toLowerCase().trim();
            filtered = filtered.filter((a) => {
                const name = a.metadata.name.toLowerCase();
                const desc = a.metadata.description?.toLowerCase() || '';
                const keywords = (a.keywords || []).join(' ').toLowerCase();
                const tags = (a.tags || []).join(' ').toLowerCase();
                return (name.includes(query) ||
                    desc.includes(query) ||
                    keywords.includes(query) ||
                    tags.includes(query));
            });
        }
        // Featured filter
        if (filter.featured !== undefined) {
            filtered = filtered.filter((a) => a.metadata.isFeatured === filter.featured);
        }
        // Built-in filter
        if (filter.builtIn !== undefined) {
            filtered = filtered.filter((a) => a.metadata.isBuiltIn === filter.builtIn);
        }
        // Custom filter
        if (filter.custom !== undefined) {
            filtered = filtered.filter((a) => !a.metadata.isBuiltIn === filter.custom);
        }
        // Placeable filter
        if (filter.placeable !== undefined) {
            filtered = filtered.filter((a) => a.isPlaceable === filter.placeable);
        }
        // Cost range filter
        if (filter.costRange) {
            filtered = filtered.filter((a) => {
                if (a.cost === undefined)
                    return false;
                return a.cost >= filter.costRange.min && a.cost <= filter.costRange.max;
            });
        }
        // Author filter
        if (filter.author) {
            filtered = filtered.filter((a) => a.metadata.author === filter.author);
        }
        // Collection filter
        if (filter.collectionId) {
            filtered = filtered.filter((a) => a.collectionId === filter.collectionId);
        }
        return filtered;
    }
    /**
     * Apply sorting to asset list
     */
    applySorting(assets, sort) {
        const { sortBy, ascending = true } = sort;
        const multiplier = ascending ? 1 : -1;
        return assets.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'name':
                    comparison = a.metadata.name.localeCompare(b.metadata.name);
                    break;
                case 'date':
                    const dateA = a.metadata.modifiedAt || a.metadata.createdAt || new Date(0);
                    const dateB = b.metadata.modifiedAt || b.metadata.createdAt || new Date(0);
                    comparison = dateA.getTime() - dateB.getTime();
                    break;
                case 'usage':
                    comparison = (a.metadata.usageCount || 0) - (b.metadata.usageCount || 0);
                    break;
                case 'rating':
                    comparison = (a.metadata.rating || 0) - (b.metadata.rating || 0);
                    break;
                case 'cost':
                    comparison = (a.cost || 0) - (b.cost || 0);
                    break;
                case 'recent':
                    const recentA = a.metadata.createdAt || new Date(0);
                    const recentB = b.metadata.createdAt || new Date(0);
                    comparison = recentB.getTime() - recentA.getTime(); // Most recent first
                    break;
            }
            return comparison * multiplier;
        });
    }
    /**
     * Clear all assets (mainly for testing)
     */
    clear() {
        this.assets.clear();
        this.collections.clear();
        this.initialized = false;
        this.invalidateCache();
    }
    /**
     * Invalidate all caches
     */
    invalidateCache() {
        this.queryCache.clear();
        this.categoryCacheMap.clear();
        this.typeCacheMap.clear();
        this.lastModified = Date.now();
    }
    /**
     * Generate cache key from filter and sort options
     */
    generateCacheKey(filter, sort) {
        return JSON.stringify({ filter, sort });
    }
    /**
     * Get statistics
     */
    getStats() {
        const assets = this.getAll();
        const stats = {
            totalAssets: assets.length,
            builtInAssets: assets.filter((a) => a.metadata.isBuiltIn).length,
            customAssets: assets.filter((a) => !a.metadata.isBuiltIn).length,
            collections: this.collections.size,
            byType: {},
            byCategory: {},
        };
        // Count by type
        assets.forEach((asset) => {
            stats.byType[asset.type] = (stats.byType[asset.type] || 0) + 1;
            stats.byCategory[asset.category] = (stats.byCategory[asset.category] || 0) + 1;
        });
        return stats;
    }
    mapBlockCategoryToMainCategory(category) {
        const mapping = {
            basic: 'Building',
            natural: 'Nature',
            decorative: 'Decoration',
            mechanical: 'Building',
            glass: 'Building',
            light: 'Lighting',
        };
        return mapping[category] || 'Building';
    }
    mapBlockCategoryToSubcategory(category) {
        const mapping = {
            basic: 'Walls',
            natural: 'Rocks',
            decorative: 'WallDecor',
            mechanical: 'Other',
            glass: 'Windows',
            light: 'CeilingLights',
        };
        return mapping[category] || 'Other';
    }
    mapBlockMaterialToStyle(material) {
        const mapping = {
            plastic: 'Cartoon',
            stone: 'Rustic',
            wood: 'Rustic',
            metal: 'Industrial',
            glass: 'Modern',
            emissive: 'Futuristic',
        };
        return mapping[material] || 'Contemporary';
    }
    mapBlockMaterial(material) {
        const mapping = {
            plastic: 'Plastic',
            stone: 'Stone',
            wood: 'Wood',
            metal: 'Metal',
            glass: 'Glass',
            emissive: 'Plastic',
        };
        return mapping[material] || 'Plastic';
    }
}
// Singleton instance
export const assetRegistry = new AssetRegistry();
//# sourceMappingURL=AssetRegistry.js.map