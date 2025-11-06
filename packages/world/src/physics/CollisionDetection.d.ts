/**
 * CollisionDetection - Advanced collision detection algorithms for physics simulation
 * Supports box-box, sphere-sphere, sphere-box, and capsule collisions
 */
import type { Vec3, Quat } from '@engine/core/math';
import type { AnyCollider, ContactPoint } from '../components/PhysicsComponent.js';
/**
 * Collision pair result
 */
export interface CollisionInfo {
    /** Whether collision occurred */
    hasCollision: boolean;
    /** Contact points (may be multiple) */
    contacts: ContactPoint[];
}
/**
 * Transform info for collision detection
 */
export interface ColliderTransform {
    position: Vec3;
    rotation: Quat;
    scale: Vec3;
}
/**
 * Collision detection utilities using separating axis theorem and other algorithms
 */
export declare class CollisionDetection {
    private static readonly EPSILON;
    /**
     * Main collision detection dispatch
     */
    static detectCollision(colliderA: AnyCollider, transformA: ColliderTransform, colliderB: AnyCollider, transformB: ColliderTransform): CollisionInfo;
    /**
     * Gets world position of collider center
     */
    private static getWorldPosition;
    /**
     * Box vs Box collision using SAT (Separating Axis Theorem)
     */
    private static boxBox;
    /**
     * Sphere vs Sphere collision
     */
    private static sphereSphere;
    /**
     * Box vs Sphere collision
     */
    private static boxSphere;
    /**
     * Precise Capsule vs Box collision detection
     * Computes closest point on box to capsule segment, similar to boxSphere but for capsule segment
     */
    private static capsuleBox;
    /**
     * Find closest point on segment AB to an axis-aligned box
     * Uses iterative refinement for accuracy
     */
    private static closestPointOnSegmentToBox;
    /**
     * Capsule collision (simplified - treats as sphere + cylinder)
     */
    private static capsuleCollision;
    private static getCapsuleSegmentOrPoint;
    private static getEffectiveRadius;
    private static closestPointsBetweenSegments;
    private static addVec;
    /**
     * OBB (Oriented Bounding Box) structure
     */
    private static boxToOBB;
    /**
     * OBB intersection test using SAT
     */
    private static obbIntersect;
    /**
     * Rotates a vector by a quaternion
     */
    private static rotateVector;
    /**
     * Inverse rotate (equivalent to rotating by conjugate quaternion)
     */
    private static inverseRotateVector;
    /**
     * Dot product
     */
    private static dot;
}
//# sourceMappingURL=CollisionDetection.d.ts.map