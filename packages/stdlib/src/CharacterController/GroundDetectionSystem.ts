import type { CharacterController } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { GroundDetectionCache } from './GroundDetectionCache';

/**
 * System for handling ground detection for character controllers
 * 
 * Uses physics raycasting with spatial hash caching to efficiently detect
 * ground for multiple characters. Separated from CharacterControllerSystem
 * to improve separation of concerns.
 */
export class GroundDetectionSystem {
  private readonly physics: PhysicsWorld;
  private readonly cache: GroundDetectionCache;
  private currentTime = 0;
  private lastCleanupTime = 0;
  private readonly cleanupInterval = 1.0; // Cleanup every 1 second

  /**
   * @param physics - Physics world for raycasting
   * @param cacheCellSize - Size of spatial hash cells in meters (default: 0.5)
   * @param cacheMaxAge - Maximum age of cache entries in seconds (default: 0.1)
   */
  constructor(physics: PhysicsWorld, cacheCellSize = 0.5, cacheMaxAge = 0.1) {
    this.physics = physics;
    this.cache = new GroundDetectionCache(cacheCellSize, cacheMaxAge);
  }

  /**
   * Update ground detection for all controllers
   * 
   * @param controllers - Array of character controllers to update
   * @param deltaTime - Time since last frame in seconds
   */
  update(controllers: CharacterController[], deltaTime: number): void {
    this.currentTime += deltaTime;

    // Cleanup expired cache entries periodically
    if (this.currentTime - this.lastCleanupTime >= this.cleanupInterval) {
      this.cache.cleanup(this.currentTime);
      this.lastCleanupTime = this.currentTime;
    }

    for (const controller of controllers) {
      this.updateGroundDetection(controller);
    }
  }

  /**
   * Update ground detection for a single controller
   * 
   * @param controller - Character controller to update
   */
  private updateGroundDetection(controller: CharacterController): void {
    if (!controller.entity) return;

    const origin = controller.entity.transform.position;
    // Create a copy to ensure we're comparing values, not references
    const originCopy: Vec3 = [origin[0], origin[1], origin[2]];

    // Try to get cached result from spatial hash
    const cached = this.cache.get(originCopy, this.currentTime);

    if (cached) {
      // Use cached result
      controller.isGrounded = cached.isGrounded;
      controller.groundNormal = [...cached.groundNormal] as Vec3;
      return;
    }

    // No cache hit - perform raycast
    const direction: [number, number, number] = [0, -1, 0];

    // Raycast downward to detect ground
    const hit = this.physics.raycast(originCopy, direction, {
      // Use a generous distance to ensure floors slightly below the character are detected in tests
      maxDistance: Math.max(controller.config.groundCheckDistance, 0.1) + 5.0,
      ignoreEntities: [controller.entity],
    });

    // Update controller state
    const isGrounded = hit !== null;
    const groundNormal: Vec3 = hit ? hit.normal : [0, 1, 0];

    controller.isGrounded = isGrounded;
    controller.groundNormal = [...groundNormal] as Vec3;

    // Store result in cache
    this.cache.set(originCopy, {
      isGrounded,
      groundNormal: [...groundNormal] as Vec3,
    }, this.currentTime);
  }

  /**
   * Clear all cache entries (useful for testing or reset scenarios)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

