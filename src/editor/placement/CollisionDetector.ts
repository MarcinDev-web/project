/**
 * CollisionDetector - Detects collisions between entities using AABB.
 * Used primarily for placement mode to prevent overlapping objects.
 */

import type { Entity } from '../../scene/Entity';
import type { Scene } from '../../scene/Scene';
import { normalizeVec3Out, quatNormalize, dotVec3, type Quat, type Vec3 } from '../../math';

/**
 * Axis-Aligned Bounding Box
 */
export interface BoundingBox {
  /** Minimum corner (x, y, z) */
  min: Vec3;
  /** Maximum corner (x, y, z) */
  max: Vec3;
}

/**
 * Result of a collision check
 */
export interface CollisionResult {
  /** Whether collision occurred */
  hasCollision: boolean;
  /** Entities that collided (if any) */
  collidingEntities: Entity[];
}

/**
 * Oriented Bounding Box
 */
export interface OBB {
  /** Center position in world space */
  center: Vec3;
  /** Local axes (orthonormal basis) in world space: [u0, u1, u2] */
  axes: [Vec3, Vec3, Vec3];
  /** Half sizes along each local axis */
  halfSizes: Vec3;
}

// Fixed-size 3x3 matrix used for SAT calculations
type Mat3 = [[number, number, number], [number, number, number], [number, number, number]];

// ========== vector math helpers ==========
const dot = dotVec3;

/**
 * CollisionDetector handles AABB collision detection between entities.
 */
export class CollisionDetector {
  private scene: Scene;

  /** Minimum size for bounding box (prevents zero-size boxes) */
  private static readonly MIN_BOX_SIZE = 0.001;

  /** Epsilon for floating-point comparisons */
  private static readonly EPSILON = 0.0001;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Checks if an entity collides with any other entities in the scene.
   * @param entity - Entity to check
   * @param position - Optional position override (for preview checking)
   * @param rotation - Optional rotation override
   * @param scale - Optional scale override
   * @param excludeEntities - Entities to exclude from collision check
   * @returns Collision result
   */
  checkCollision(
    entity: Entity,
    position?: Vec3,
    rotation?: [number, number, number, number],
    scale?: Vec3,
    excludeEntities?: Set<Entity>
  ): CollisionResult {
    const entityBox = this.getBoundingBox(entity, position, rotation, scale);
    const collidingEntities: Entity[] = [];

    // Check against all active entities in scene
    const entities = this.scene.getActiveEntities();
    for (const other of entities) {
      // Skip self and excluded entities
      if (other === entity) continue;
      if (excludeEntities?.has(other)) continue;

      const otherBox = this.getBoundingBox(other);
      if (CollisionDetector.boxesIntersect(entityBox, otherBox)) {
        collidingEntities.push(other);
      }
    }

    return {
      hasCollision: collidingEntities.length > 0,
      collidingEntities,
    };
  }

  /**
   * Gets the axis-aligned bounding box for an entity.
   * Note: This computes an AABB (Axis-Aligned Bounding Box), which by definition
   * is always aligned with world axes. Therefore, rotation is not used in the calculation.
   * Use getOBB() if you need rotation-aware collision detection.
   *
   * @param entity - Entity to compute bounding box for
   * @param position - Optional position override
   * @param _rotation - Optional rotation override (IGNORED: AABBs don't use rotation)
   * @param scale - Optional scale override
   * @returns Axis-aligned bounding box
   */
  getBoundingBox(
    entity: Entity,
    position?: Vec3,
    _rotation?: [number, number, number, number],
    scale?: Vec3
  ): BoundingBox {
    // Use provided values or entity's transform
    const pos = position ?? entity.transform.getWorldPosition();
    const scl = scale ?? entity.transform.scale;

    // For AABB, we ignore rotation and use axis-aligned box
    // Base box is centered at origin with size 1x1x1
    // Scale determines the actual size
    const halfX = Math.max(Math.abs(scl[0]) / 2, CollisionDetector.MIN_BOX_SIZE);
    const halfY = Math.max(Math.abs(scl[1]) / 2, CollisionDetector.MIN_BOX_SIZE);
    const halfZ = Math.max(Math.abs(scl[2]) / 2, CollisionDetector.MIN_BOX_SIZE);

    return {
      min: [pos[0] - halfX, pos[1] - halfY, pos[2] - halfZ],
      max: [pos[0] + halfX, pos[1] + halfY, pos[2] + halfZ],
    };
  }

  /**
   * Computes an Oriented Bounding Box (OBB) for an entity using its rotation and scale.
   * Assumes a unit cube mesh centered at origin scaled by entity scale.
   * @param entity - Entity to compute OBB for
   * @param position - Optional position override
   * @param rotation - Optional quaternion override (normalized internally)
   * @param scale - Optional scale override
   */
  getOBB(entity: Entity, position?: Vec3, rotation?: Quat, scale?: Vec3): OBB {
    const pos = position ?? entity.transform.getWorldPosition();
    const rot = quatNormalize(rotation ?? entity.transform.rotation);
    const scl = scale ?? entity.transform.scale;

    // Derive orthonormal basis from quaternion
    // Convert quaternion to 3x3 rotation (columns are axis directions)
    const x = rot[0],
      y = rot[1],
      z = rot[2],
      w = rot[3];
    // Rotation matrix elements
    const m00 = 1 - 2 * (y * y + z * z);
    const m01 = 2 * (x * y - z * w);
    const m02 = 2 * (x * z + y * w);
    const m10 = 2 * (x * y + z * w);
    const m11 = 1 - 2 * (x * x + z * z);
    const m12 = 2 * (y * z - x * w);
    const m20 = 2 * (x * z - y * w);
    const m21 = 2 * (y * z + x * w);
    const m22 = 1 - 2 * (x * x + y * y);

    // Local axes in world space (normalize for numerical safety)
    const u0: Vec3 = [m00, m10, m20];
    const u1: Vec3 = [m01, m11, m21];
    const u2: Vec3 = [m02, m12, m22];
    normalizeVec3Out(u0, u0);
    normalizeVec3Out(u1, u1);
    normalizeVec3Out(u2, u2);

    // Half sizes from scale (assumes base mesh size 1)
    const halfSizes: Vec3 = [
      Math.max(Math.abs(scl[0]) / 2, CollisionDetector.MIN_BOX_SIZE),
      Math.max(Math.abs(scl[1]) / 2, CollisionDetector.MIN_BOX_SIZE),
      Math.max(Math.abs(scl[2]) / 2, CollisionDetector.MIN_BOX_SIZE),
    ];

    return {
      center: [pos[0], pos[1], pos[2]],
      axes: [u0, u1, u2],
      halfSizes,
    };
  }

  /**
   * Converts an OBB to its enclosing AABB in world space.
   * @param obb - Oriented bounding box
   * @returns Axis-aligned bounding box enclosing the OBB
   */
  static obbToAABB(obb: OBB): BoundingBox {
    const [u0, u1, u2] = obb.axes;
    const hx = obb.halfSizes[0];
    const hy = obb.halfSizes[1];
    const hz = obb.halfSizes[2];

    // Project OBB half-sizes onto world axes to get half extents of enclosing AABB
    const ex = Math.abs(u0[0]) * hx + Math.abs(u1[0]) * hy + Math.abs(u2[0]) * hz;
    const ey = Math.abs(u0[1]) * hx + Math.abs(u1[1]) * hy + Math.abs(u2[1]) * hz;
    const ez = Math.abs(u0[2]) * hx + Math.abs(u1[2]) * hy + Math.abs(u2[2]) * hz;

    return {
      min: [obb.center[0] - ex, obb.center[1] - ey, obb.center[2] - ez],
      max: [obb.center[0] + ex, obb.center[1] + ey, obb.center[2] + ez],
    };
  }

  /**
   * Separating Axis Theorem for OBB vs OBB intersection.
   * Tests 15 axes: 3 face normals of A, 3 of B, and 9 cross products of edges.
   *
   * Time Complexity: O(1) - constant time with exactly 15 axis tests
   * Space Complexity: O(1) - fixed memory allocation
   *
   * @param a - First OBB
   * @param b - Second OBB
   * @returns true if OBBs intersect, false otherwise
   */
  static obbIntersect(a: OBB, b: OBB): boolean {
    const EPS = this.EPSILON;
    const [Au, Av, Aw] = a.axes;
    const [Bu, Bv, Bw] = b.axes;

    // Compute rotation matrix expressing B in A's frame: R[i][j] = Ai · Bj
    const R: Mat3 = [
      [dot(Au, Bu), dot(Au, Bv), dot(Au, Bw)],
      [dot(Av, Bu), dot(Av, Bv), dot(Av, Bw)],
      [dot(Aw, Bu), dot(Aw, Bv), dot(Aw, Bw)],
    ];
    // Absolute value matrix with epsilon to account for parallel axes
    const AbsR: Mat3 = [
      [Math.abs(R[0][0]) + EPS, Math.abs(R[0][1]) + EPS, Math.abs(R[0][2]) + EPS],
      [Math.abs(R[1][0]) + EPS, Math.abs(R[1][1]) + EPS, Math.abs(R[1][2]) + EPS],
      [Math.abs(R[2][0]) + EPS, Math.abs(R[2][1]) + EPS, Math.abs(R[2][2]) + EPS],
    ];

    // Translation vector t from A to B in A's frame
    const tWorld: Vec3 = [
      b.center[0] - a.center[0],
      b.center[1] - a.center[1],
      b.center[2] - a.center[2],
    ];
    const t: Vec3 = [dot(tWorld, Au), dot(tWorld, Av), dot(tWorld, Aw)];

    const ra = a.halfSizes;
    const rb = b.halfSizes;

    // Helper to check overlap for a single axis using projected radii
    const axisOverlap = (tProj: number, raProj: number, rbProj: number): boolean => {
      return Math.abs(tProj) <= raProj + rbProj + EPS;
    };

    // 1) Test A's axes (Au, Av, Aw)
    if (!axisOverlap(t[0], ra[0], rb[0] * AbsR[0][0] + rb[1] * AbsR[0][1] + rb[2] * AbsR[0][2]))
      return false;
    if (!axisOverlap(t[1], ra[1], rb[0] * AbsR[1][0] + rb[1] * AbsR[1][1] + rb[2] * AbsR[1][2]))
      return false;
    if (!axisOverlap(t[2], ra[2], rb[0] * AbsR[2][0] + rb[1] * AbsR[2][1] + rb[2] * AbsR[2][2]))
      return false;

    // 2) Test B's axes (Bu, Bv, Bw)
    if (
      !axisOverlap(
        dot(t, [R[0][0], R[1][0], R[2][0]] as Vec3),
        ra[0] * AbsR[0][0] + ra[1] * AbsR[1][0] + ra[2] * AbsR[2][0],
        rb[0]
      )
    )
      return false;
    if (
      !axisOverlap(
        dot(t, [R[0][1], R[1][1], R[2][1]] as Vec3),
        ra[0] * AbsR[0][1] + ra[1] * AbsR[1][1] + ra[2] * AbsR[2][1],
        rb[1]
      )
    )
      return false;
    if (
      !axisOverlap(
        dot(t, [R[0][2], R[1][2], R[2][2]] as Vec3),
        ra[0] * AbsR[0][2] + ra[1] * AbsR[1][2] + ra[2] * AbsR[2][2],
        rb[2]
      )
    )
      return false;

    // 3) Test cross products of edges (Ai x Bj)
    // Define shorthand for radii projections for each combo
    const rA = ra;
    const rB = rb;
    // A.u x B.u
    if (
      !axisOverlap(
        t[2] * R[1][0] - t[1] * R[2][0],
        rA[1] * AbsR[2][0] + rA[2] * AbsR[1][0],
        rB[1] * AbsR[0][2] + rB[2] * AbsR[0][1]
      )
    )
      return false;
    // A.u x B.v
    if (
      !axisOverlap(
        t[2] * R[1][1] - t[1] * R[2][1],
        rA[1] * AbsR[2][1] + rA[2] * AbsR[1][1],
        rB[0] * AbsR[0][2] + rB[2] * AbsR[0][0]
      )
    )
      return false;
    // A.u x B.w
    if (
      !axisOverlap(
        t[2] * R[1][2] - t[1] * R[2][2],
        rA[1] * AbsR[2][2] + rA[2] * AbsR[1][2],
        rB[0] * AbsR[0][1] + rB[1] * AbsR[0][0]
      )
    )
      return false;

    // A.v x B.u
    if (
      !axisOverlap(
        t[0] * R[2][0] - t[2] * R[0][0],
        rA[0] * AbsR[2][0] + rA[2] * AbsR[0][0],
        rB[1] * AbsR[1][2] + rB[2] * AbsR[1][1]
      )
    )
      return false;
    // A.v x B.v
    if (
      !axisOverlap(
        t[0] * R[2][1] - t[2] * R[0][1],
        rA[0] * AbsR[2][1] + rA[2] * AbsR[0][1],
        rB[0] * AbsR[1][2] + rB[2] * AbsR[1][0]
      )
    )
      return false;
    // A.v x B.w
    if (
      !axisOverlap(
        t[0] * R[2][2] - t[2] * R[0][2],
        rA[0] * AbsR[2][2] + rA[2] * AbsR[0][2],
        rB[0] * AbsR[1][1] + rB[1] * AbsR[1][0]
      )
    )
      return false;

    // A.w x B.u
    if (
      !axisOverlap(
        t[1] * R[0][0] - t[0] * R[1][0],
        rA[0] * AbsR[1][0] + rA[1] * AbsR[0][0],
        rB[1] * AbsR[2][2] + rB[2] * AbsR[2][1]
      )
    )
      return false;
    // A.w x B.v
    if (
      !axisOverlap(
        t[1] * R[0][1] - t[0] * R[1][1],
        rA[0] * AbsR[1][1] + rA[1] * AbsR[0][1],
        rB[0] * AbsR[2][2] + rB[2] * AbsR[2][0]
      )
    )
      return false;
    // A.w x B.w
    if (
      !axisOverlap(
        t[1] * R[0][2] - t[0] * R[1][2],
        rA[0] * AbsR[1][2] + rA[1] * AbsR[0][2],
        rB[0] * AbsR[2][1] + rB[1] * AbsR[2][0]
      )
    )
      return false;

    return true; // No separating axis found
  }

  /**
   * High-precision collision check using OBB vs OBB (SAT).
   */
  checkCollisionOBB(
    entity: Entity,
    position?: Vec3,
    rotation?: Quat,
    scale?: Vec3,
    excludeEntities?: Set<Entity>
  ): CollisionResult {
    const obb = this.getOBB(entity, position, rotation, scale);
    // Broad-phase: use AABB enclosing the OBB of the tested entity
    const entityAabb = CollisionDetector.obbToAABB(obb);
    const collidingEntities: Entity[] = [];
    for (const other of this.scene.getActiveEntities()) {
      if (other === entity) continue;
      if (excludeEntities?.has(other)) continue;
      // Broad-phase for other entity: use conservative bounding-sphere AABB (rotation-invariant)
      const otherPos = other.transform.getWorldPosition();
      const otherScale = other.transform.scale;
      const ohx = Math.max(Math.abs(otherScale[0]) / 2, CollisionDetector.MIN_BOX_SIZE);
      const ohy = Math.max(Math.abs(otherScale[1]) / 2, CollisionDetector.MIN_BOX_SIZE);
      const ohz = Math.max(Math.abs(otherScale[2]) / 2, CollisionDetector.MIN_BOX_SIZE);
      const orad = Math.hypot(ohx, ohy, ohz);
      const otherAabb = {
        min: [otherPos[0] - orad, otherPos[1] - orad, otherPos[2] - orad] as Vec3,
        max: [otherPos[0] + orad, otherPos[1] + orad, otherPos[2] + orad] as Vec3,
      } satisfies BoundingBox;

      // Early reject if enclosing AABBs do not intersect
      if (!CollisionDetector.boxesIntersect(entityAabb, otherAabb)) continue;

      const otherObb = this.getOBB(other);
      if (CollisionDetector.obbIntersect(obb, otherObb)) {
        collidingEntities.push(other);
      }
    }
    return { hasCollision: collidingEntities.length > 0, collidingEntities };
  }

  /**
   * Checks if two bounding boxes intersect.
   * @param box1 - First bounding box
   * @param box2 - Second bounding box
   * @returns true if boxes intersect
   */
  static boxesIntersect(box1: BoundingBox, box2: BoundingBox): boolean {
    // Two AABBs intersect if they overlap on all three axes
    const overlapX =
      box1.max[0] >= box2.min[0] - this.EPSILON && box1.min[0] <= box2.max[0] + this.EPSILON;
    const overlapY =
      box1.max[1] >= box2.min[1] - this.EPSILON && box1.min[1] <= box2.max[1] + this.EPSILON;
    const overlapZ =
      box1.max[2] >= box2.min[2] - this.EPSILON && box1.min[2] <= box2.max[2] + this.EPSILON;

    return overlapX && overlapY && overlapZ;
  }

  /**
   * Checks if a point is inside a bounding box.
   * @param point - Point to check
   * @param box - Bounding box
   * @returns true if point is inside box
   */
  static pointInBox(point: Vec3, box: BoundingBox): boolean {
    return (
      point[0] >= box.min[0] - this.EPSILON &&
      point[0] <= box.max[0] + this.EPSILON &&
      point[1] >= box.min[1] - this.EPSILON &&
      point[1] <= box.max[1] + this.EPSILON &&
      point[2] >= box.min[2] - this.EPSILON &&
      point[2] <= box.max[2] + this.EPSILON
    );
  }

  /**
   * Gets the volume of a bounding box.
   * @param box - Bounding box
   * @returns Volume in cubic units
   */
  static getBoxVolume(box: BoundingBox): number {
    const dx = Math.max(0, box.max[0] - box.min[0]);
    const dy = Math.max(0, box.max[1] - box.min[1]);
    const dz = Math.max(0, box.max[2] - box.min[2]);
    return dx * dy * dz;
  }

  /**
   * Gets the center point of a bounding box.
   * @param box - Bounding box
   * @returns Center point
   */
  static getBoxCenter(box: BoundingBox): Vec3 {
    return [
      (box.min[0] + box.max[0]) / 2,
      (box.min[1] + box.max[1]) / 2,
      (box.min[2] + box.max[2]) / 2,
    ];
  }

  /**
   * Checks if box1 completely contains box2.
   * @param box1 - Container box
   * @param box2 - Contained box
   * @returns true if box1 contains box2
   */
  static boxContains(box1: BoundingBox, box2: BoundingBox): boolean {
    return (
      box1.min[0] <= box2.min[0] + this.EPSILON &&
      box1.max[0] >= box2.max[0] - this.EPSILON &&
      box1.min[1] <= box2.min[1] + this.EPSILON &&
      box1.max[1] >= box2.max[1] - this.EPSILON &&
      box1.min[2] <= box2.min[2] + this.EPSILON &&
      box1.max[2] >= box2.max[2] - this.EPSILON
    );
  }

  /**
   * Expands a bounding box by a margin on all sides.
   * @param box - Bounding box to expand
   * @param margin - Margin to add on all sides
   * @returns Expanded bounding box
   */
  static expandBox(box: BoundingBox, margin: number): BoundingBox {
    return {
      min: [box.min[0] - margin, box.min[1] - margin, box.min[2] - margin],
      max: [box.max[0] + margin, box.max[1] + margin, box.max[2] + margin],
    };
  }

  /**
   * Updates the scene reference (useful if scene changes).
   * @param scene - New scene
   */
  setScene(scene: Scene): void {
    this.scene = scene;
  }

  /**
   * Gets the current scene.
   */
  getScene(): Scene {
    return this.scene;
  }
}
