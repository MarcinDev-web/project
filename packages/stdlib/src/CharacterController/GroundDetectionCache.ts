import type { Vec3 } from '@engine/core/math';

/**
 * Result of ground detection raycast
 */
export interface GroundDetectionResult {
  readonly isGrounded: boolean;
  readonly groundNormal: Vec3;
  readonly timestamp: number;
}

/**
 * Spatial hash-based cache for ground detection results
 *
 * Uses spatial hashing to cache ground detection results by position,
 * reducing raycast calls when multiple characters are in the same area.
 */
export class GroundDetectionCache {
  private readonly spatialHash = new Map<string, GroundDetectionResult>();
  private readonly cellSize: number;
  private readonly maxAge: number;

  /**
   * @param cellSize - Size of spatial hash cells in meters (default: 0.5)
   * @param maxAge - Maximum age of cache entries in seconds (default: 0.1)
   */
  constructor(cellSize = 0.5, maxAge = 0.1) {
    this.cellSize = cellSize;
    this.maxAge = maxAge;
  }

  /**
   * Get cache key for a position (spatial hash cell)
   */
  private getCellKey(position: Vec3): string {
    const x = Math.floor(position[0] / this.cellSize);
    const z = Math.floor(position[2] / this.cellSize);
    return `${x},${z}`;
  }

  /**
   * Get cached ground detection result for a position
   *
   * @param position - Character position
   * @param currentTime - Current time in seconds (for age checking)
   * @returns Cached result or null if not found or expired
   */
  get(position: Vec3, currentTime: number): GroundDetectionResult | null {
    const key = this.getCellKey(position);
    const cached = this.spatialHash.get(key);

    if (!cached) {
      return null;
    }

    // Check if cache entry is expired
    const age = currentTime - cached.timestamp;
    if (age > this.maxAge) {
      this.spatialHash.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Store ground detection result in cache
   *
   * @param position - Character position
   * @param result - Ground detection result
   * @param currentTime - Current time in seconds
   */
  set(position: Vec3, result: Omit<GroundDetectionResult, 'timestamp'>, currentTime: number): void {
    const key = this.getCellKey(position);
    this.spatialHash.set(key, {
      ...result,
      timestamp: currentTime,
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.spatialHash.clear();
  }

  /**
   * Remove expired cache entries
   *
   * @param currentTime - Current time in seconds
   */
  cleanup(currentTime: number): void {
    for (const [key, result] of this.spatialHash.entries()) {
      const age = currentTime - result.timestamp;
      if (age > this.maxAge) {
        this.spatialHash.delete(key);
      }
    }
  }

  /**
   * Get number of cached entries
   */
  size(): number {
    return this.spatialHash.size;
  }
}
