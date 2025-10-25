import { describe, it, expect, beforeEach } from 'vitest';
import { TextureCache } from './TextureCache';
describe('TextureCache', () => {
    let cache;
    beforeEach(() => {
        cache = new TextureCache({
            maxMemoryBytes: 1024 * 1024, // 1MB for testing
            maxTextures: 10,
            enableLRU: true,
            evictionTimeout: 100, // Short timeout for testing
        });
    });
    const createTextureData = (size) => {
        return new Uint8Array(size * size * 4);
    };
    describe('add', () => {
        it('should add texture to cache', () => {
            const data = createTextureData(64);
            const cached = cache.add('test1', data, 64, 64);
            expect(cached).toBeDefined();
            expect(cached.id).toBe('test1');
            expect(cached.width).toBe(64);
            expect(cached.height).toBe(64);
            expect(cached.refCount).toBe(1);
        });
        it('should increment ref count if texture already exists', () => {
            const data = createTextureData(64);
            const cached1 = cache.add('test1', data, 64, 64);
            expect(cached1.refCount).toBe(1);
            const cached2 = cache.add('test1', data, 64, 64);
            expect(cached2.refCount).toBe(2);
            expect(cached2).toBe(cached1); // Same object
        });
        it('should update stats', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            const stats = cache.getStats();
            expect(stats.textureCount).toBe(1);
            expect(stats.memoryUsed).toBeGreaterThan(0);
        });
        it('should store mipmaps', () => {
            const data = createTextureData(64);
            const mip1 = createTextureData(32);
            const mip2 = createTextureData(16);
            const mipmaps = [data, mip1, mip2];
            const cached = cache.add('test1', data, 64, 64, mipmaps);
            expect(cached.mipmaps).toBe(mipmaps);
        });
    });
    describe('get', () => {
        it('should return cached texture', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            const cached = cache.get('test1');
            expect(cached).not.toBeNull();
            expect(cached.id).toBe('test1');
        });
        it('should return null for non-existent texture', () => {
            const cached = cache.get('nonexistent');
            expect(cached).toBeNull();
        });
        it('should increment ref count', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            const cached1 = cache.get('test1');
            expect(cached1.refCount).toBe(2); // add=1, get=1
            const cached2 = cache.get('test1');
            expect(cached2.refCount).toBe(3);
        });
        it('should update hit/miss stats', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            cache.get('test1'); // hit
            cache.get('test2'); // miss
            const stats = cache.getStats();
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(1);
            expect(stats.hitRate).toBe(0.5);
        });
    });
    describe('release', () => {
        it('should decrement ref count', () => {
            const data = createTextureData(64);
            const cached = cache.add('test1', data, 64, 64);
            expect(cached.refCount).toBe(1);
            cache.release('test1');
            expect(cached.refCount).toBe(0);
        });
        it('should not go below 0', () => {
            const data = createTextureData(64);
            const cached = cache.add('test1', data, 64, 64);
            cache.release('test1');
            cache.release('test1');
            cache.release('test1');
            expect(cached.refCount).toBe(0);
        });
        it('should do nothing for non-existent texture', () => {
            expect(() => cache.release('nonexistent')).not.toThrow();
        });
    });
    describe('remove', () => {
        it('should remove texture from cache', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            expect(cache.has('test1')).toBe(true);
            cache.remove('test1');
            expect(cache.has('test1')).toBe(false);
        });
        it('should update stats', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            const statsBefore = cache.getStats();
            expect(statsBefore.textureCount).toBe(1);
            cache.remove('test1');
            const statsAfter = cache.getStats();
            expect(statsAfter.textureCount).toBe(0);
            expect(statsAfter.memoryUsed).toBe(0);
        });
    });
    describe('has', () => {
        it('should return true for cached texture', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            expect(cache.has('test1')).toBe(true);
        });
        it('should return false for non-existent texture', () => {
            expect(cache.has('nonexistent')).toBe(false);
        });
    });
    describe('clear', () => {
        it('should remove all textures', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            cache.add('test2', data, 64, 64);
            cache.add('test3', data, 64, 64);
            expect(cache.getStats().textureCount).toBe(3);
            cache.clear();
            expect(cache.getStats().textureCount).toBe(0);
            expect(cache.has('test1')).toBe(false);
            expect(cache.has('test2')).toBe(false);
            expect(cache.has('test3')).toBe(false);
        });
        it('should reset stats', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            cache.get('test1');
            cache.get('nonexistent');
            cache.clear();
            const stats = cache.getStats();
            expect(stats.textureCount).toBe(0);
            expect(stats.memoryUsed).toBe(0);
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(stats.evictions).toBe(0);
        });
    });
    describe('evictUnused', () => {
        it('should evict textures with 0 ref count', async () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            cache.release('test1');
            // Wait for eviction timeout
            await new Promise(resolve => setTimeout(resolve, 150));
            const evicted = cache.evictUnused();
            expect(evicted).toBe(1);
            expect(cache.has('test1')).toBe(false);
        });
        it('should not evict textures with active references', async () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64); // refCount = 1
            // Wait for eviction timeout
            await new Promise(resolve => setTimeout(resolve, 150));
            const evicted = cache.evictUnused();
            expect(evicted).toBe(0);
            expect(cache.has('test1')).toBe(true);
        });
        it('should evict oldest first', async () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            cache.release('test1');
            await new Promise(resolve => setTimeout(resolve, 50));
            cache.add('test2', data, 64, 64);
            cache.release('test2');
            await new Promise(resolve => setTimeout(resolve, 100));
            const evicted = cache.evictUnused();
            // test1 should be evicted (older)
            expect(evicted).toBeGreaterThan(0);
            expect(cache.has('test1')).toBe(false);
        });
    });
    describe('LRU eviction', () => {
        it('should evict LRU when memory budget exceeded', () => {
            const largeData = createTextureData(512); // Large texture
            // Fill cache
            for (let i = 0; i < 5; i++) {
                cache.add(`test${i}`, largeData, 512, 512);
                cache.release(`test${i}`); // Make available for eviction
            }
            // This should trigger eviction
            cache.add('testNew', largeData, 512, 512);
            // Some old textures should have been evicted
            const stats = cache.getStats();
            expect(stats.evictions).toBeGreaterThan(0);
        });
        it('should evict when max textures exceeded', () => {
            const data = createTextureData(16); // Small texture
            // Fill cache to max
            for (let i = 0; i < 12; i++) {
                cache.add(`test${i}`, data, 16, 16);
                if (i < 10) {
                    cache.release(`test${i}`); // Release first 10
                }
            }
            const stats = cache.getStats();
            expect(stats.evictions).toBeGreaterThan(0);
            expect(stats.textureCount).toBeLessThanOrEqual(10);
        });
    });
    describe('peek', () => {
        it('should return texture without incrementing ref count', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            const peeked = cache.peek('test1');
            expect(peeked).not.toBeNull();
            expect(peeked.id).toBe('test1');
            expect(peeked.refCount).toBe(1); // Should still be 1
        });
        it('should return null for non-existent texture', () => {
            const peeked = cache.peek('nonexistent');
            expect(peeked).toBeNull();
        });
    });
    describe('defragment', () => {
        it('should remove textures with 0 references', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            cache.release('test1'); // refCount = 0
            cache.add('test2', data, 64, 64); // refCount = 1
            cache.add('test3', data, 64, 64);
            cache.release('test3'); // refCount = 0
            const removed = cache.defragment();
            expect(removed).toBe(2);
            expect(cache.has('test1')).toBe(false);
            expect(cache.has('test2')).toBe(true);
            expect(cache.has('test3')).toBe(false);
        });
    });
    describe('getMemoryUsagePercent', () => {
        it('should calculate memory usage percentage', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            const percent = cache.getMemoryUsagePercent();
            expect(percent).toBeGreaterThan(0);
            expect(percent).toBeLessThan(100);
        });
    });
    describe('getCachedIds', () => {
        it('should return all cached texture IDs', () => {
            const data = createTextureData(64);
            cache.add('test1', data, 64, 64);
            cache.add('test2', data, 64, 64);
            cache.add('test3', data, 64, 64);
            const ids = cache.getCachedIds();
            expect(ids).toHaveLength(3);
            expect(ids).toContain('test1');
            expect(ids).toContain('test2');
            expect(ids).toContain('test3');
        });
        it('should return empty array for empty cache', () => {
            const ids = cache.getCachedIds();
            expect(ids).toEqual([]);
        });
    });
    describe('updateConfig', () => {
        it('should update cache configuration', () => {
            cache.updateConfig({ maxTextures: 5 });
            const config = cache.getConfig();
            expect(config.maxTextures).toBe(5);
        });
        it('should trigger eviction if new limits exceeded', () => {
            const data = createTextureData(256);
            // Add large textures
            for (let i = 0; i < 3; i++) {
                cache.add(`test${i}`, data, 256, 256);
                cache.release(`test${i}`);
            }
            // Reduce memory limit significantly
            cache.updateConfig({ maxMemoryBytes: 1024 }); // Very small
            const stats = cache.getStats();
            expect(stats.memoryUsed).toBeLessThanOrEqual(1024);
        });
    });
});
//# sourceMappingURL=TextureCache.test.js.map