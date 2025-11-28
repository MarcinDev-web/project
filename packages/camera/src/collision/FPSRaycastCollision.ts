import type { Vec3 } from '@engine/core/math';
import type { Entity, PhysicsWorld } from '@engine/world';
import type { IFPSCameraCollisionProvider } from '../types';

/**
 * Options for FPS raycast-based collision detection
 */
export interface FPSRaycastCollisionOptions {
  /** Physics world to raycast against */
  physics: PhysicsWorld;
  /** Eye sphere radius (default: 0.2) */
  radius?: number;
  /** Desired clearance from walls (default: 0.03) */
  backoff?: number;
  /** Maximum iterations for collision resolution (default: 2) */
  maxIters?: number;
  /** Number of sample directions (6 for ±X/Y/Z, 12 for including diagonals, default: 6) */
  sampleCount?: number;
  /** Optional physics mask/layer filter */
  mask?: number;
  /** Entities to ignore during raycast (e.g. player's own collider) */
  ignoreEntities?: Entity[];
}

/**
 * Default collision provider for FPSCamera using PhysicsWorld raycasting.
 * Uses multi-ray sampling to approximate sphere collision around the eye.
 */
export class FPSRaycastCollision implements IFPSCameraCollisionProvider {
  private readonly physics: PhysicsWorld;
  private readonly radius: number;
  private readonly backoff: number;
  private readonly maxIters: number;
  private readonly sampleCount: number;
  private readonly maxDistance: number;
  private ignoreEntities: Entity[];

  // Preallocated vectors for performance
  private readonly tempDirection: Vec3 = [0, 0, 0];
  private readonly tempAccumulated: Vec3 = [0, 0, 0];
  private readonly sampleDirections: Vec3[];

  constructor(options: FPSRaycastCollisionOptions) {
    this.physics = options.physics;
    this.radius = options.radius ?? 0.2;
    this.backoff = options.backoff ?? 0.03;
    this.maxIters = options.maxIters ?? 2;
    this.sampleCount = options.sampleCount ?? 6;
    this.maxDistance = this.radius + this.backoff;
    this.ignoreEntities = options.ignoreEntities ?? [];

    // Initialize sample directions
    if (this.sampleCount === 6) {
      // ±X, ±Y, ±Z
      this.sampleDirections = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];
    } else if (this.sampleCount === 12) {
      // Include diagonals for better coverage
      const sqrt3 = 1 / Math.sqrt(3);
      this.sampleDirections = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
        [sqrt3, sqrt3, sqrt3],
        [-sqrt3, sqrt3, sqrt3],
        [sqrt3, -sqrt3, sqrt3],
        [sqrt3, sqrt3, -sqrt3],
        [-sqrt3, -sqrt3, sqrt3],
        [-sqrt3, sqrt3, -sqrt3],
      ];
    } else {
      // Fallback to 6 directions
      this.sampleDirections = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];
    }
  }

  resolveEye(out: Vec3, desiredEye: Readonly<Vec3>, _forward: Readonly<Vec3>): Vec3 {
    // Copy desired eye to output
    out[0] = desiredEye[0];
    out[1] = desiredEye[1];
    out[2] = desiredEye[2];

    // Iterate to resolve collisions
    for (let iter = 0; iter < this.maxIters; iter++) {
      // Reset accumulated correction
      this.tempAccumulated[0] = 0;
      this.tempAccumulated[1] = 0;
      this.tempAccumulated[2] = 0;

      // Sample in all directions
      for (const dir of this.sampleDirections) {
        this.tempDirection[0] = dir[0];
        this.tempDirection[1] = dir[1];
        this.tempDirection[2] = dir[2];

        const hit = this.physics.raycast(out, this.tempDirection, 
          this.ignoreEntities.length > 0 
            ? { maxDistance: this.maxDistance, ignoreEntities: this.ignoreEntities }
            : { maxDistance: this.maxDistance }
        );

        if (hit && hit.distance < this.maxDistance) {
          // Calculate penetration
          const penetration = this.maxDistance - hit.distance;
          
          // Use hit normal if available, otherwise use opposite of direction
          let correctionDir: Vec3;
          if (hit.normal && (hit.normal[0] !== 0 || hit.normal[1] !== 0 || hit.normal[2] !== 0)) {
            correctionDir = hit.normal;
          } else {
            // Fallback: push back along ray direction
            correctionDir = [-dir[0], -dir[1], -dir[2]];
          }

          // Accumulate correction
          this.tempAccumulated[0] += correctionDir[0] * penetration;
          this.tempAccumulated[1] += correctionDir[1] * penetration;
          this.tempAccumulated[2] += correctionDir[2] * penetration;
        }
      }

      // Clamp correction magnitude to prevent overshooting
      const correctionMag = Math.sqrt(
        this.tempAccumulated[0] ** 2 +
        this.tempAccumulated[1] ** 2 +
        this.tempAccumulated[2] ** 2
      );
      
      if (correctionMag > this.maxDistance) {
        const scale = this.maxDistance / correctionMag;
        this.tempAccumulated[0] *= scale;
        this.tempAccumulated[1] *= scale;
        this.tempAccumulated[2] *= scale;
      }

      // Apply correction
      out[0] += this.tempAccumulated[0];
      out[1] += this.tempAccumulated[1];
      out[2] += this.tempAccumulated[2];

      // Early exit if correction is negligible
      if (correctionMag < 0.001) {
        break;
      }
    }

    return out;
  }

  /**
   * Set entities to ignore during collision detection
   * @param entities Array of entities to ignore (e.g. player's own collider)
   */
  setIgnoreEntities(entities: Entity[]): void {
    this.ignoreEntities = entities;
  }

  /**
   * Get the current list of ignored entities
   */
  getIgnoreEntities(): Entity[] {
    return this.ignoreEntities;
  }

  /**
   * Add an entity to ignore list
   */
  addIgnoreEntity(entity: Entity): void {
    if (!this.ignoreEntities.includes(entity)) {
      this.ignoreEntities.push(entity);
    }
  }

  /**
   * Remove an entity from ignore list
   */
  removeIgnoreEntity(entity: Entity): void {
    const index = this.ignoreEntities.indexOf(entity);
    if (index !== -1) {
      this.ignoreEntities.splice(index, 1);
    }
  }

  /**
   * Clear all ignored entities
   */
  clearIgnoreEntities(): void {
    this.ignoreEntities = [];
  }

  dispose(): void {
    // Clear ignore list
    this.ignoreEntities = [];
  }
}

