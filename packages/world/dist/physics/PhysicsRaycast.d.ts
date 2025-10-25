import type { Entity } from '../core/Entity';
import type { Vec3 } from '@engine/core/math';
import { PhysicsComponent, type BoxCollider, type SphereCollider, type CapsuleCollider } from '../components/PhysicsComponent';
/**
 * Represents a ray for physics queries
 */
export interface PhysicsRay {
    /** Ray origin point in world space */
    origin: Vec3;
    /** Ray direction (should be normalized) */
    direction: Vec3;
    /** Maximum distance to check (Infinity for unlimited) */
    maxDistance?: number;
}
/**
 * Result of a physics raycast
 */
export interface RaycastHit {
    /** Entity that was hit */
    entity: Entity;
    /** PhysicsComponent of the hit entity */
    physics: PhysicsComponent;
    /** Index of the collider that was hit */
    colliderIndex: number;
    /** Hit point in world space */
    point: Vec3;
    /** Surface normal at hit point */
    normal: Vec3;
    /** Distance from ray origin to hit point */
    distance: number;
}
/**
 * Options for raycasting
 */
export interface RaycastOptions {
    /** Maximum distance to check */
    maxDistance?: number;
    /** Entities to ignore */
    ignoreEntities?: Entity[];
    /** Whether to hit triggers */
    hitTriggers?: boolean;
}
/**
 * Physics raycasting utility for detecting intersections with physics colliders
 */
export declare class PhysicsRaycast {
    private static readonly EPSILON;
    /**
     * Tests if a ray intersects a box collider
     */
    static rayBoxIntersection(ray: PhysicsRay, boxCollider: BoxCollider, entityPosition: Vec3, entityRotation: [number, number, number, number], entityScale: Vec3): {
        hit: boolean;
        distance: number;
        point: Vec3;
        normal: Vec3;
    } | null;
    /**
     * Tests if a ray intersects a sphere collider
     */
    static raySphereIntersection(ray: PhysicsRay, sphereCollider: SphereCollider, entityPosition: Vec3, entityScale: Vec3): {
        hit: boolean;
        distance: number;
        point: Vec3;
        normal: Vec3;
    } | null;
    /**
     * Tests if a ray intersects a capsule collider
     */
    static rayCapsuleIntersection(ray: PhysicsRay, capsuleCollider: CapsuleCollider, entityPosition: Vec3, entityRotation: [number, number, number, number], entityScale: Vec3): {
        hit: boolean;
        distance: number;
        point: Vec3;
        normal: Vec3;
    } | null;
    /**
     * Performs a raycast against a single entity
     */
    static raycastEntity(ray: PhysicsRay, entity: Entity, hitTriggers?: boolean): RaycastHit | null;
    /**
     * Helper: Transform point from world to local space
     */
    private static worldToLocal;
    /**
     * Helper: Transform point from local to world space
     */
    private static localToWorld;
    /**
     * Helper: Invert a quaternion
     */
    private static invertQuat;
}
//# sourceMappingURL=PhysicsRaycast.d.ts.map