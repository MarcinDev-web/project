/**
 * BoundingVolume - Axis-Aligned Bounding Box utilities for spatial partitioning
 */

import type { Vec3 } from '@engine/core/math';
import type { Entity } from '../core/Entity.js';
import type { PhysicsComponent } from '../components/PhysicsComponent.js';

/**
 * Axis-Aligned Bounding Box
 */
export interface AABB {
  /** Minimum corner (x, y, z) */
  min: Vec3;
  /** Maximum corner (x, y, z) */
  max: Vec3;
}

/**
 * Bounding volume utilities
 */
export class BoundingVolume {
  private static readonly EPSILON = 0.0001;

  /**
   * Creates an AABB from center and half extents
   */
  static fromCenterSize(center: Vec3, halfSize: Vec3): AABB {
    return {
      min: [center[0] - halfSize[0], center[1] - halfSize[1], center[2] - halfSize[2]],
      max: [center[0] + halfSize[0], center[1] + halfSize[1], center[2] + halfSize[2]],
    };
  }

  /**
   * Creates an AABB from an entity with physics component
   */
  static fromEntity(entity: Entity, physics: PhysicsComponent): AABB {
    const position = entity.transform.getWorldPosition();
    const scale = entity.transform.scale;

    // Calculate AABB based on all colliders
    if (physics.colliders.length === 0) {
      // No colliders, use entity scale as fallback
      return this.fromCenterSize(position, [scale[0] / 2, scale[1] / 2, scale[2] / 2]);
    }

    // Initialize with extreme values
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    // Compute AABB that encompasses all colliders
    for (const collider of physics.colliders) {
      const center = [
        position[0] + collider.center[0],
        position[1] + collider.center[1],
        position[2] + collider.center[2],
      ] as Vec3;

      let halfExtents: Vec3;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (collider.shape === 'box') {
        halfExtents = [
          (collider.size[0] * scale[0]) / 2,
          (collider.size[1] * scale[1]) / 2,
          (collider.size[2] * scale[2]) / 2,
        ];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      } else if (collider.shape === 'sphere') {
        const radius = collider.radius * ((scale[0] + scale[1] + scale[2]) / 3);
        halfExtents = [radius, radius, radius];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      } else if (collider.shape === 'capsule') {
        const radius = collider.radius * ((scale[0] + scale[2]) / 2);
        const height = collider.height * scale[1];
        halfExtents = [radius, height / 2, radius];
      } else {
        // Fallback
        halfExtents = [0.5, 0.5, 0.5];
      }

      minX = Math.min(minX, center[0] - halfExtents[0]);
      minY = Math.min(minY, center[1] - halfExtents[1]);
      minZ = Math.min(minZ, center[2] - halfExtents[2]);
      maxX = Math.max(maxX, center[0] + halfExtents[0]);
      maxY = Math.max(maxY, center[1] + halfExtents[1]);
      maxZ = Math.max(maxZ, center[2] + halfExtents[2]);
    }

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    };
  }

  /**
   * Checks if two AABBs intersect
   */
  static intersects(a: AABB, b: AABB): boolean {
    const eps = this.EPSILON;
    return (
      a.max[0] >= b.min[0] - eps &&
      a.min[0] <= b.max[0] + eps &&
      a.max[1] >= b.min[1] - eps &&
      a.min[1] <= b.max[1] + eps &&
      a.max[2] >= b.min[2] - eps &&
      a.min[2] <= b.max[2] + eps
    );
  }

  /**
   * Checks if AABB 'a' completely contains AABB 'b'
   */
  static contains(a: AABB, b: AABB): boolean {
    const eps = this.EPSILON;
    return (
      a.min[0] <= b.min[0] + eps &&
      a.max[0] >= b.max[0] - eps &&
      a.min[1] <= b.min[1] + eps &&
      a.max[1] >= b.max[1] - eps &&
      a.min[2] <= b.min[2] + eps &&
      a.max[2] >= b.max[2] - eps
    );
  }

  /**
   * Gets the center of an AABB
   */
  static getCenter(aabb: AABB): Vec3 {
    return [
      (aabb.min[0] + aabb.max[0]) / 2,
      (aabb.min[1] + aabb.max[1]) / 2,
      (aabb.min[2] + aabb.max[2]) / 2,
    ];
  }

  /**
   * Gets the size (dimensions) of an AABB
   */
  static getSize(aabb: AABB): Vec3 {
    return [aabb.max[0] - aabb.min[0], aabb.max[1] - aabb.min[1], aabb.max[2] - aabb.min[2]];
  }

  /**
   * Expands an AABB by a margin on all sides
   */
  static expand(aabb: AABB, margin: number): AABB {
    return {
      min: [aabb.min[0] - margin, aabb.min[1] - margin, aabb.min[2] - margin],
      max: [aabb.max[0] + margin, aabb.max[1] + margin, aabb.max[2] + margin],
    };
  }

  /**
   * Merges two AABBs into one that contains both
   */
  static merge(a: AABB, b: AABB): AABB {
    return {
      min: [
        Math.min(a.min[0], b.min[0]),
        Math.min(a.min[1], b.min[1]),
        Math.min(a.min[2], b.min[2]),
      ],
      max: [
        Math.max(a.max[0], b.max[0]),
        Math.max(a.max[1], b.max[1]),
        Math.max(a.max[2], b.max[2]),
      ],
    };
  }

  /**
   * Calculates the volume of an AABB
   */
  static getVolume(aabb: AABB): number {
    const size = this.getSize(aabb);
    return size[0] * size[1] * size[2];
  }

  /**
   * Calculates the surface area of an AABB
   */
  static getSurfaceArea(aabb: AABB): number {
    const size = this.getSize(aabb);
    return 2 * (size[0] * size[1] + size[1] * size[2] + size[2] * size[0]);
  }
}
