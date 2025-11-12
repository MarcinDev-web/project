import type { Vec3 } from '../math';
/**
 * Object pool for Vec3 arrays to reduce allocations in hot paths
 *
 * Reuses Vec3 arrays instead of creating new ones, improving performance
 * in code that frequently creates temporary vectors (e.g., movement calculations).
 */
export declare class Vec3Pool {
    private readonly pool;
    private readonly maxSize;
    /**
     * @param maxSize - Maximum number of Vec3 arrays to keep in pool (default: 100)
     */
    constructor(maxSize?: number);
    /**
     * Acquire a Vec3 from the pool, or create a new one if pool is empty
     *
     * @returns Vec3 array (may contain old values - caller should initialize)
     */
    acquire(): Vec3;
    /**
     * Release a Vec3 back to the pool for reuse
     *
     * @param vec - Vec3 array to return to pool
     */
    release(vec: Vec3): void;
    /**
     * Clear all Vec3 arrays from the pool
     */
    clear(): void;
    /**
     * Get current pool size
     */
    size(): number;
}
/**
 * Get the global Vec3Pool instance
 *
 * @returns Global Vec3Pool singleton
 */
export declare function getVec3Pool(): Vec3Pool;
//# sourceMappingURL=Vec3Pool.d.ts.map