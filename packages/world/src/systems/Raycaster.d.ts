import { Entity } from '../core/Entity.js';
import type { Mat4 } from '@engine/core/math';
/**
 * Represents a ray in 3D space.
 */
export interface Ray {
    /** Ray origin point */
    origin: [number, number, number];
    /** Ray direction (normalized) */
    direction: [number, number, number];
}
/**
 * Result of a raycast intersection.
 */
export interface RaycastHit {
    /** Entity that was hit */
    entity: Entity;
    /** Distance from ray origin to hit point */
    distance: number;
    /** Hit point in world space */
    point: [number, number, number];
}
/**
 * Axis-Aligned Bounding Box.
 */
export interface AABB {
    min: [number, number, number];
    max: [number, number, number];
}
/**
 * Bounding Sphere.
 */
export interface BoundingSphere {
    /** Center point in local space */
    center: [number, number, number];
    /** Radius of the sphere */
    radius: number;
}
/**
 * Oriented Bounding Box (supports rotation).
 */
export interface OBB {
    /** Center point in local space */
    center: [number, number, number];
    /** Half extents along each local axis */
    halfExtents: [number, number, number];
    /** Rotation as quaternion [x, y, z, w] */
    rotation: [number, number, number, number];
}
/**
 * Mesh bounds configuration for an entity.
 * Defines how ray intersection tests should be performed.
 */
export interface MeshBounds {
    /** Type of bounding volume */
    type: 'aabb' | 'sphere' | 'obb';
    /** AABB bounds (used when type is 'aabb') */
    aabb?: AABB;
    /** Sphere bounds (used when type is 'sphere') */
    sphere?: BoundingSphere;
    /** OBB bounds (used when type is 'obb') */
    obb?: OBB;
}
/**
 * Raycaster for mouse picking and intersection tests.
 *
 * This is an instance-based class (not static) for better performance and memory management.
 * Use object pooling for rays to reduce allocations in hot code paths.
 *
 * @example
 * ```ts
 * const raycaster = new Raycaster();
 * const ray = raycaster.createRayFromScreen(mouseX, mouseY, width, height, view, proj);
 * const hit = raycaster.raycastClosest(ray, entities);
 * raycaster.recycleRay(ray); // Recycle when done
 * ```
 */
export declare class Raycaster {
    /** Scratch buffer for matrix inversions - reused to avoid allocations */
    private readonly scratchMat;
    /** Ray object pool - reuse rays to reduce GC pressure */
    private readonly rayPool;
    /**
     * Creates a new Raycaster instance.
     */
    constructor();
    /**
     * Creates a ray from screen coordinates through the camera.
     * Uses object pooling to reduce allocations.
     *
     * @param x - Screen X coordinate (0 to canvas.width)
     * @param y - Screen Y coordinate (0 to canvas.height)
     * @param canvasWidth - Canvas width in pixels
     * @param canvasHeight - Canvas height in pixels
     * @param viewMatrix - Camera view matrix
     * @param projectionMatrix - Camera projection matrix
     * @returns Ray in world space (from pool if available)
     */
    createRayFromScreen(x: number, y: number, canvasWidth: number, canvasHeight: number, viewMatrix: Mat4, projectionMatrix: Mat4): Ray;
    /**
     * Returns a ray to the pool for reuse.
     * Call this when you're done with a ray to reduce allocations.
     *
     * @param ray - Ray to recycle
     */
    recycleRay(ray: Ray): void;
    /**
     * Tests if a ray intersects an entity's bounding volume.
     * Supports AABB, Sphere, and OBB bounds types.
     * @param ray - The ray to test
     * @param entity - The entity to test against
     * @returns RaycastHit if intersection occurs, null otherwise
     */
    raycastEntity(ray: Ray, entity: Entity): RaycastHit | null;
    /**
     * Raycasts against multiple entities and returns all hits sorted by distance.
     * @param ray - The ray to test
     * @param entities - Entities to test against
     * @returns Array of hits sorted by distance (closest first)
     */
    raycastAll(ray: Ray, entities: Entity[]): RaycastHit[];
    /**
     * Raycasts and returns the closest hit.
     * @param ray - The ray to test
     * @param entities - Entities to test against
     * @returns Closest hit or null
     */
    raycastClosest(ray: Ray, entities: Entity[]): RaycastHit | null;
    /**
     * Tests ray-AABB intersection using slab method.
     * @param ray - The ray to test
     * @param aabb - Axis-aligned bounding box
     * @returns Distance to intersection or null if no intersection
     */
    private intersectAABB;
    /**
     * Tests ray-sphere intersection using geometric method.
     * @param ray - The ray to test
     * @param center - Sphere center in world space
     * @param radius - Sphere radius
     * @returns Distance to intersection or null if no intersection
     */
    private intersectSphere;
    /**
     * Tests ray-OBB intersection using separating axis theorem.
     * This is a simplified version that transforms the ray to OBB local space.
     * @param ray - The ray to test
     * @param obb - Oriented bounding box in world space
     * @returns Distance to intersection or null if no intersection
     */
    private intersectOBB;
    /**
     * Rotates a vector by a quaternion.
     * @param v - Vector to rotate
     * @param q - Quaternion [x, y, z, w]
     * @returns Rotated vector
     */
    private rotateVectorByQuaternion;
    /**
     * Inverts a 4x4 matrix using the instance's scratch buffer.
     * @param m - Matrix to invert
     * @returns Inverted matrix (reuses scratch buffer)
     */
    private invertMatrix;
    /**
     * Transforms a 4D vector by a matrix.
     * @param v - Vector to transform
     * @param m - Transformation matrix
     * @returns Transformed vector
     */
    private transformVector4;
}
//# sourceMappingURL=Raycaster.d.ts.map