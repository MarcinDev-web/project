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
export interface CachedTexture {
    /** Unique identifier */
    id: string;
    /** Texture data */
    data: Uint8Array;
    /** Width in pixels */
    width: number;
    /** Height in pixels */
    height: number;
    /** GPU texture handle (WebGL texture) */
    gpuHandle?: WebGLTexture;
    /** Last access timestamp */
    lastAccessed: number;
    /** Reference count (number of active users) */
    refCount: number;
    /** Size in bytes */
    byteSize: number;
    /** Mipmap levels (if any) */
    mipmaps?: Uint8Array[];
}
export interface TextureCacheConfig {
    /** Maximum memory budget in bytes (default: 256MB) */
    maxMemoryBytes: number;
    /** Maximum number of textures to cache */
    maxTextures: number;
    /** Enable LRU eviction */
    enableLRU: boolean;
    /** Time in ms before unused textures can be evicted (default: 30s) */
    evictionTimeout: number;
}
/**
 * Statistics for monitoring cache performance
 */
export interface CacheStats {
    /** Total number of cached textures */
    textureCount: number;
    /** Total memory used in bytes */
    memoryUsed: number;
    /** Cache hit count */
    hits: number;
    /** Cache miss count */
    misses: number;
    /** Number of evictions */
    evictions: number;
    /** Hit rate (0-1) */
    hitRate: number;
}
export declare class TextureCache {
    private cache;
    private config;
    private stats;
    constructor(config?: Partial<TextureCacheConfig>);
    /**
     * Add texture to cache
     */
    add(id: string, data: Uint8Array, width: number, height: number, mipmaps?: Uint8Array[]): CachedTexture;
    /**
     * Get texture from cache
     */
    get(id: string): CachedTexture | null;
    /**
     * Release reference to texture
     */
    release(id: string): void;
    /**
     * Remove texture from cache
     */
    remove(id: string): void;
    /**
     * Check if texture is cached
     */
    has(id: string): boolean;
    /**
     * Clear all textures from cache
     */
    clear(): void;
    /**
     * Evict unused textures based on LRU
     */
    evictUnused(): number;
    /**
     * Ensure there's enough space for new texture
     */
    private ensureSpace;
    /**
     * Evict least recently used texture
     */
    private evictLRU;
    /**
     * Calculate total size of texture data
     */
    private calculateSize;
    /**
     * Update hit rate statistic
     */
    private updateHitRate;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats;
    /**
     * Get memory usage as percentage of budget
     */
    getMemoryUsagePercent(): number;
    /**
     * Get all cached texture IDs
     */
    getCachedIds(): string[];
    /**
     * Get texture info without incrementing ref count
     */
    peek(id: string): CachedTexture | null;
    /**
     * Defragment cache by removing textures with 0 references
     */
    defragment(): number;
    /**
     * Get cache configuration
     */
    getConfig(): TextureCacheConfig;
    /**
     * Update cache configuration
     */
    updateConfig(config: Partial<TextureCacheConfig>): void;
}
/**
 * Global texture cache instance
 * Can be used across the application
 */
export declare const globalTextureCache: TextureCache;
//# sourceMappingURL=TextureCache.d.ts.map