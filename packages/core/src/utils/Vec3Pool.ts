import type { Vec3 } from '../math';

/**
 * Object pool for Vec3 arrays to reduce allocations in hot paths
 * 
 * Reuses Vec3 arrays instead of creating new ones, improving performance
 * in code that frequently creates temporary vectors (e.g., movement calculations).
 */
export class Vec3Pool {
  private readonly pool: Vec3[] = [];
  private readonly maxSize: number;

  /**
   * @param maxSize - Maximum number of Vec3 arrays to keep in pool (default: 100)
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Acquire a Vec3 from the pool, or create a new one if pool is empty
   * 
   * @returns Vec3 array (may contain old values - caller should initialize)
   */
  acquire(): Vec3 {
    const vec = this.pool.pop();
    if (vec) {
      return vec;
    }
    return [0, 0, 0];
  }

  /**
   * Release a Vec3 back to the pool for reuse
   * 
   * @param vec - Vec3 array to return to pool
   */
  release(vec: Vec3): void {
    if (this.pool.length < this.maxSize) {
      // Reset values to zero
      vec[0] = 0;
      vec[1] = 0;
      vec[2] = 0;
      this.pool.push(vec);
    }
  }

  /**
   * Clear all Vec3 arrays from the pool
   */
  clear(): void {
    this.pool.length = 0;
  }

  /**
   * Get current pool size
   */
  size(): number {
    return this.pool.length;
  }
}

/**
 * Global singleton Vec3Pool instance
 */
let globalPool: Vec3Pool | null = null;

/**
 * Get the global Vec3Pool instance
 * 
 * @returns Global Vec3Pool singleton
 */
export function getVec3Pool(): Vec3Pool {
  if (!globalPool) {
    globalPool = new Vec3Pool();
  }
  return globalPool;
}

