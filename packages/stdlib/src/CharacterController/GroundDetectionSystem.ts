import type { Scene } from '@engine/world';
import { CharacterController } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { GroundDetectionCache } from './GroundDetectionCache';

/**
 * Independent system for handling ground detection for character controllers
 *
 * Uses physics raycasting with spatial hash caching to efficiently detect
 * ground for multiple characters. This system operates independently and
 * queries CharacterController components from the scene automatically.
 *
 * Must be updated before CharacterControllerSystem.update() in the game loop.
 */
export class GroundDetectionSystem {
  private readonly scene: Scene;
  private readonly physics: PhysicsWorld;
  private readonly cache: GroundDetectionCache;
  private currentTime = 0;
  private lastCleanupTime = 0;
  private readonly cleanupInterval = 1.0; // Cleanup every 1 second

  /**
   * @param scene - Scene to query CharacterController components from
   * @param physics - Physics world for raycasting
   * @param cacheCellSize - Size of spatial hash cells in meters (default: 0.5)
   * @param cacheMaxAge - Maximum age of cache entries in seconds (default: 0.1)
   */
  constructor(scene: Scene, physics: PhysicsWorld, cacheCellSize = 0.5, cacheMaxAge = 0.1) {
    this.scene = scene;
    this.physics = physics;
    this.cache = new GroundDetectionCache(cacheCellSize, cacheMaxAge);
  }

  /**
   * Update ground detection for all character controllers in the scene
   *
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    this.currentTime += deltaTime;

    // Cleanup expired cache entries periodically
    if (this.currentTime - this.lastCleanupTime >= this.cleanupInterval) {
      this.cache.cleanup(this.currentTime);
      this.lastCleanupTime = this.currentTime;
    }

    // Query all CharacterController components from the scene
    const entities = this.scene.queryEntities(CharacterController);
    for (const entity of entities) {
      const controller = entity.getComponent(CharacterController) as CharacterController;
      if (!controller) continue;
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
    this.cache.set(
      originCopy,
      {
        isGrounded,
        groundNormal: [...groundNormal] as Vec3,
      },
      this.currentTime
    );
  }

  /**
   * Clear all cache entries (useful for testing or reset scenarios)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
