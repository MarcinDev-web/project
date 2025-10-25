/**
 * TextureCache - Efficient texture caching and management system
 *
 * Features:
 * - LRU (Least Recently Used) cache eviction
 * - Memory budget management
 * - Lazy loading and unloading
 * - GPU texture handle management
 * - Reference counting
 */
const DEFAULT_CACHE_CONFIG = {
    maxMemoryBytes: 256 * 1024 * 1024, // 256MB
    maxTextures: 1000,
    enableLRU: true,
    evictionTimeout: 30000, // 30 seconds
};
export class TextureCache {
    cache = new Map();
    config;
    stats = {
        textureCount: 0,
        memoryUsed: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
        hitRate: 0,
    };
    constructor(config) {
        this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    }
    /**
     * Add texture to cache
     */
    add(id, data, width, height, mipmaps) {
        // Check if already cached
        if (this.cache.has(id)) {
            const cached = this.cache.get(id);
            cached.refCount++;
            cached.lastAccessed = Date.now();
            return cached;
        }
        // Calculate size
        const byteSize = this.calculateSize(data, mipmaps);
        // Evict if necessary
        this.ensureSpace(byteSize);
        // Create cached texture
        const cached = {
            id,
            data,
            width,
            height,
            lastAccessed: Date.now(),
            refCount: 1,
            byteSize,
            ...(mipmaps !== undefined ? { mipmaps } : {}),
        };
        this.cache.set(id, cached);
        this.stats.textureCount++;
        this.stats.memoryUsed += byteSize;
        return cached;
    }
    /**
     * Get texture from cache
     */
    get(id) {
        const cached = this.cache.get(id);
        if (cached) {
            cached.lastAccessed = Date.now();
            cached.refCount++;
            this.stats.hits++;
            this.updateHitRate();
            return cached;
        }
        this.stats.misses++;
        this.updateHitRate();
        return null;
    }
    /**
     * Release reference to texture
     */
    release(id) {
        const cached = this.cache.get(id);
        if (cached) {
            cached.refCount = Math.max(0, cached.refCount - 1);
        }
    }
    /**
     * Remove texture from cache
     */
    remove(id) {
        const cached = this.cache.get(id);
        if (!cached)
            return;
        // Clean up GPU handle if exists
        if (cached.gpuHandle) {
            // Note: Actual GPU cleanup should be done by the renderer
            cached.gpuHandle = undefined;
        }
        this.stats.memoryUsed -= cached.byteSize;
        this.stats.textureCount--;
        this.cache.delete(id);
    }
    /**
     * Check if texture is cached
     */
    has(id) {
        return this.cache.has(id);
    }
    /**
     * Clear all textures from cache
     */
    clear() {
        for (const [id] of this.cache) {
            this.remove(id);
        }
        this.cache.clear();
        this.stats = {
            textureCount: 0,
            memoryUsed: 0,
            hits: 0,
            misses: 0,
            evictions: 0,
            hitRate: 0,
        };
    }
    /**
     * Evict unused textures based on LRU
     */
    evictUnused() {
        if (!this.config.enableLRU)
            return 0;
        const now = Date.now();
        let evicted = 0;
        // Find textures that can be evicted
        const candidates = [];
        for (const [id, cached] of this.cache) {
            // Only evict if:
            // 1. No active references
            // 2. Not accessed recently
            if (cached.refCount === 0 && now - cached.lastAccessed > this.config.evictionTimeout) {
                candidates.push([id, cached]);
            }
        }
        // Sort by last accessed (oldest first)
        candidates.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        // Evict oldest textures
        for (const [id] of candidates) {
            this.remove(id);
            evicted++;
            this.stats.evictions++;
        }
        return evicted;
    }
    /**
     * Ensure there's enough space for new texture
     */
    ensureSpace(requiredBytes) {
        // Check memory budget
        while (this.stats.memoryUsed + requiredBytes > this.config.maxMemoryBytes ||
            this.stats.textureCount >= this.config.maxTextures) {
            const evicted = this.evictLRU();
            if (evicted === 0) {
                // Can't evict any more, break to avoid infinite loop
                console.warn('[TextureCache] Unable to free enough space, cache is full');
                break;
            }
        }
    }
    /**
     * Evict least recently used texture
     */
    evictLRU() {
        let oldest = null;
        for (const [id, cached] of this.cache) {
            // Skip textures with active references
            if (cached.refCount > 0)
                continue;
            if (!oldest || cached.lastAccessed < oldest[1].lastAccessed) {
                oldest = [id, cached];
            }
        }
        if (oldest) {
            this.remove(oldest[0]);
            this.stats.evictions++;
            return 1;
        }
        return 0;
    }
    /**
     * Calculate total size of texture data
     */
    calculateSize(data, mipmaps) {
        let size = data.byteLength;
        if (mipmaps) {
            for (const mipmap of mipmaps) {
                size += mipmap.byteLength;
            }
        }
        return size;
    }
    /**
     * Update hit rate statistic
     */
    updateHitRate() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Get memory usage as percentage of budget
     */
    getMemoryUsagePercent() {
        return (this.stats.memoryUsed / this.config.maxMemoryBytes) * 100;
    }
    /**
     * Get all cached texture IDs
     */
    getCachedIds() {
        return Array.from(this.cache.keys());
    }
    /**
     * Get texture info without incrementing ref count
     */
    peek(id) {
        return this.cache.get(id) ?? null;
    }
    /**
     * Defragment cache by removing textures with 0 references
     */
    defragment() {
        let removed = 0;
        for (const [id, cached] of this.cache) {
            if (cached.refCount === 0) {
                this.remove(id);
                removed++;
            }
        }
        return removed;
    }
    /**
     * Get cache configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update cache configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        // Ensure we're within new limits
        if (this.stats.memoryUsed > this.config.maxMemoryBytes) {
            this.ensureSpace(0);
        }
    }
}
/**
 * Global texture cache instance
 * Can be used across the application
 */
export const globalTextureCache = new TextureCache();
//# sourceMappingURL=TextureCache.js.map