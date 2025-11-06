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
export declare class BoundingVolume {
    private static readonly EPSILON;
    /**
     * Creates an AABB from center and half extents
     */
    static fromCenterSize(center: Vec3, halfSize: Vec3): AABB;
    /**
     * Creates an AABB from an entity with physics component
     */
    static fromEntity(entity: Entity, physics: PhysicsComponent): AABB;
    /**
     * Checks if two AABBs intersect
     */
    static intersects(a: AABB, b: AABB): boolean;
    /**
     * Checks if AABB 'a' completely contains AABB 'b'
     */
    static contains(a: AABB, b: AABB): boolean;
    /**
     * Gets the center of an AABB
     */
    static getCenter(aabb: AABB): Vec3;
    /**
     * Gets the size (dimensions) of an AABB
     */
    static getSize(aabb: AABB): Vec3;
    /**
     * Expands an AABB by a margin on all sides
     */
    static expand(aabb: AABB, margin: number): AABB;
    /**
     * Merges two AABBs into one that contains both
     */
    static merge(a: AABB, b: AABB): AABB;
    /**
     * Calculates the volume of an AABB
     */
    static getVolume(aabb: AABB): number;
    /**
     * Calculates the surface area of an AABB
     */
    static getSurfaceArea(aabb: AABB): number;
}
//# sourceMappingURL=BoundingVolume.d.ts.map