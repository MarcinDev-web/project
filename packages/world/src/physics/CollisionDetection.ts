/**
 * CollisionDetection - Advanced collision detection algorithms for physics simulation
 * Supports box-box, sphere-sphere, sphere-box, and capsule collisions
 */

import type { Vec3, Quat } from '@engine/core/math';
import type {
  AnyCollider,
  BoxCollider,
  SphereCollider,
  CapsuleCollider,
  ContactPoint,
} from '../components/PhysicsComponent.js';
import { normalizeVec3Out, quatToMatrix3 } from '@engine/core/math';

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
export class CollisionDetection {
  private static readonly EPSILON = 0.0001;

  /**
   * Main collision detection dispatch
   */
  static detectCollision(
    colliderA: AnyCollider,
    transformA: ColliderTransform,
    colliderB: AnyCollider,
    transformB: ColliderTransform
  ): CollisionInfo {
    // Get world positions including collider offsets
    const posA = this.getWorldPosition(colliderA.center, transformA);
    const posB = this.getWorldPosition(colliderB.center, transformB);

    // Dispatch to specific collision function
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (colliderA.shape === 'box' && colliderB.shape === 'box') {
      return this.boxBox(
        colliderA,
        posA,
        transformA.rotation,
        transformA.scale,
        colliderB,
        posB,
        transformB.rotation,
        transformB.scale
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    } else if (colliderA.shape === 'sphere' && colliderB.shape === 'sphere') {
      return this.sphereSphere(
        colliderA,
        posA,
        transformA.scale,
        colliderB,
        posB,
        transformB.scale
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    } else if (colliderA.shape === 'box' && colliderB.shape === 'sphere') {
      return this.boxSphere(
        colliderA,
        posA,
        transformA.rotation,
        transformA.scale,
        colliderB,
        posB,
        transformB.scale
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    } else if (colliderA.shape === 'sphere' && colliderB.shape === 'box') {
      const result = this.boxSphere(
        colliderB,
        posB,
        transformB.rotation,
        transformB.scale,
        colliderA,
        posA,
        transformA.scale
      );
      // Flip normal direction
      for (let i = 0; i < result.contacts.length; i++) {
        const c = result.contacts[i]!;
        c.normal[0] = -c.normal[0];
        c.normal[1] = -c.normal[1];
        c.normal[2] = -c.normal[2];
      }
      return result;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    } else if (colliderA.shape === 'capsule' && colliderB.shape === 'box') {
      // Precise capsule-box collision
      return this.capsuleBox(colliderA, transformA, colliderB, transformB);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    } else if (colliderA.shape === 'box' && colliderB.shape === 'capsule') {
      // Precise box-capsule collision (swap order)
      const result = this.capsuleBox(colliderB, transformB, colliderA, transformA);
      // Flip normal direction
      for (let i = 0; i < result.contacts.length; i++) {
        const c = result.contacts[i]!;
        c.normal[0] = -c.normal[0];
        c.normal[1] = -c.normal[1];
        c.normal[2] = -c.normal[2];
      }
      return result;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    } else if (colliderA.shape === 'capsule' || colliderB.shape === 'capsule') {
      // Other capsule collisions (capsule-sphere, capsule-capsule)
      return this.capsuleCollision(colliderA, transformA, colliderB, transformB);
    }

    return { hasCollision: false, contacts: [] };
  }

  /**
   * Gets world position of collider center
   */
  private static getWorldPosition(center: Vec3, transform: ColliderTransform): Vec3 {
    // Apply rotation and position, scale affects collider size not center
    const rotated = this.rotateVector(center, transform.rotation);
    return [
      transform.position[0] + rotated[0],
      transform.position[1] + rotated[1],
      transform.position[2] + rotated[2],
    ];
  }

  /**
   * Box vs Box collision using SAT (Separating Axis Theorem)
   */
  private static boxBox(
    boxA: BoxCollider,
    posA: Vec3,
    rotA: Quat,
    scaleA: Vec3,
    boxB: BoxCollider,
    posB: Vec3,
    rotB: Quat,
    scaleB: Vec3
  ): CollisionInfo {
    // Convert to OBB representation
    const obbA = this.boxToOBB(boxA, posA, rotA, scaleA);
    const obbB = this.boxToOBB(boxB, posB, rotB, scaleB);

    // Use SAT to detect collision
    const collision = this.obbIntersect(obbA, obbB);
    if (!collision.hasCollision) {
      return { hasCollision: false, contacts: [] };
    }

    // Generate contact point (simplified: use center between boxes)
    // Calculate normal from A to B
    const dx = posB[0] - posA[0];
    const dy = posB[1] - posA[1];
    const dz = posB[2] - posA[2];
    const distSq = dx * dx + dy * dy + dz * dz;

    let normal: Vec3;
    if (distSq > this.EPSILON * this.EPSILON) {
      const dist = Math.sqrt(distSq);
      normal = [dx / dist, dy / dist, dz / dist];
    } else {
      // Boxes are at exactly the same position, use arbitrary normal
      normal = [1, 0, 0];
    }

    const contact: ContactPoint = {
      position: [(posA[0] + posB[0]) / 2, (posA[1] + posB[1]) / 2, (posA[2] + posB[2]) / 2],
      normal,
      depth: collision.depth,
    };

    return {
      hasCollision: true,
      contacts: [contact],
    };
  }

  /**
   * Sphere vs Sphere collision
   */
  private static sphereSphere(
    sphereA: SphereCollider,
    posA: Vec3,
    scaleA: Vec3,
    sphereB: SphereCollider,
    posB: Vec3,
    scaleB: Vec3
  ): CollisionInfo {
    // Apply scale to radii (use average scale)
    const radiusA = sphereA.radius * ((scaleA[0] + scaleA[1] + scaleA[2]) / 3);
    const radiusB = sphereB.radius * ((scaleB[0] + scaleB[1] + scaleB[2]) / 3);

    const dx = posB[0] - posA[0];
    const dy = posB[1] - posA[1];
    const dz = posB[2] - posA[2];
    const distanceSq = dx * dx + dy * dy + dz * dz;
    const radiusSum = radiusA + radiusB;
    const radiusSumSq = radiusSum * radiusSum;

    if (distanceSq >= radiusSumSq) {
      return { hasCollision: false, contacts: [] };
    }

    const distance = Math.sqrt(distanceSq);
    const depth = radiusSum - distance;

    // Normal from A to B
    let normal: Vec3;
    if (distance > this.EPSILON) {
      normal = [dx / distance, dy / distance, dz / distance];
    } else {
      // Spheres are at same position, use arbitrary normal
      normal = [0, 1, 0];
    }

    // Contact point is on the surface between spheres
    const contact: ContactPoint = {
      position: [
        posA[0] + normal[0] * radiusA,
        posA[1] + normal[1] * radiusA,
        posA[2] + normal[2] * radiusA,
      ],
      normal,
      depth,
    };

    return {
      hasCollision: true,
      contacts: [contact],
    };
  }

  /**
   * Box vs Sphere collision
   */
  private static boxSphere(
    box: BoxCollider,
    boxPos: Vec3,
    boxRot: Quat,
    boxScale: Vec3,
    sphere: SphereCollider,
    spherePos: Vec3,
    sphereScale: Vec3
  ): CollisionInfo {
    const radius = sphere.radius * ((sphereScale[0] + sphereScale[1] + sphereScale[2]) / 3);

    // Transform sphere center to box's local space
    const relPos: Vec3 = [
      spherePos[0] - boxPos[0],
      spherePos[1] - boxPos[1],
      spherePos[2] - boxPos[2],
    ];
    const localSpherePos = this.inverseRotateVector(relPos, boxRot);

    // Box half extents in local space
    const halfX = (box.size[0] * boxScale[0]) / 2;
    const halfY = (box.size[1] * boxScale[1]) / 2;
    const halfZ = (box.size[2] * boxScale[2]) / 2;

    // Find closest point on box to sphere center
    const closestX = Math.max(-halfX, Math.min(halfX, localSpherePos[0]));
    const closestY = Math.max(-halfY, Math.min(halfY, localSpherePos[1]));
    const closestZ = Math.max(-halfZ, Math.min(halfZ, localSpherePos[2]));

    // Distance from sphere center to closest point
    const dx = localSpherePos[0] - closestX;
    const dy = localSpherePos[1] - closestY;
    const dz = localSpherePos[2] - closestZ;
    const distanceSq = dx * dx + dy * dy + dz * dz;

    if (distanceSq >= radius * radius) {
      return { hasCollision: false, contacts: [] };
    }

    const distance = Math.sqrt(distanceSq);
    const depth = radius - distance;

    // Normal in local space
    let localNormal: Vec3;
    if (distance > this.EPSILON) {
      localNormal = [dx / distance, dy / distance, dz / distance];
    } else {
      // Sphere center is inside box, use closest axis
      localNormal = [0, 1, 0];
    }

    // Transform normal back to world space
    const worldNormal = this.rotateVector(localNormal, boxRot);

    // Contact point in world space
    const closestWorld = this.rotateVector([closestX, closestY, closestZ], boxRot);
    const contact: ContactPoint = {
      position: [
        boxPos[0] + closestWorld[0],
        boxPos[1] + closestWorld[1],
        boxPos[2] + closestWorld[2],
      ],
      normal: worldNormal,
      depth,
    };

    return {
      hasCollision: true,
      contacts: [contact],
    };
  }

  /**
   * Precise Capsule vs Box collision detection
   * Computes closest point on box to capsule segment, similar to boxSphere but for capsule segment
   */
  private static capsuleBox(
    capsule: CapsuleCollider,
    capsuleTransform: ColliderTransform,
    box: BoxCollider,
    boxTransform: ColliderTransform
  ): CollisionInfo {
    const boxPos = this.getWorldPosition(box.center, boxTransform);
    const capsulePos = this.getWorldPosition(capsule.center, capsuleTransform);

    // Get capsule segment endpoints in world space
    const scaledRadius =
      capsule.radius * Math.max(capsuleTransform.scale[0], capsuleTransform.scale[2]);
    const half = Math.max(0, (capsule.height * capsuleTransform.scale[1] - 2 * scaledRadius) / 2);
    const localA: Vec3 = [0, -half, 0];
    const localB: Vec3 = [0, half, 0];
    const capsuleSegA = this.addVec(
      this.rotateVector(localA, capsuleTransform.rotation),
      capsulePos
    );
    const capsuleSegB = this.addVec(
      this.rotateVector(localB, capsuleTransform.rotation),
      capsulePos
    );

    // Transform capsule segment to box's local space
    const relA: Vec3 = [
      capsuleSegA[0] - boxPos[0],
      capsuleSegA[1] - boxPos[1],
      capsuleSegA[2] - boxPos[2],
    ];
    const relB: Vec3 = [
      capsuleSegB[0] - boxPos[0],
      capsuleSegB[1] - boxPos[1],
      capsuleSegB[2] - boxPos[2],
    ];
    const localSegA = this.inverseRotateVector(relA, boxTransform.rotation);
    const localSegB = this.inverseRotateVector(relB, boxTransform.rotation);

    // Box half extents in local space
    const halfX = (box.size[0] * boxTransform.scale[0]) / 2;
    const halfY = (box.size[1] * boxTransform.scale[1]) / 2;
    const halfZ = (box.size[2] * boxTransform.scale[2]) / 2;

    // Find closest point on capsule segment to box
    // For each point on the segment, clamp to box bounds and find minimum distance
    const boxMin: Vec3 = [-halfX, -halfY, -halfZ];
    const boxMax: Vec3 = [halfX, halfY, halfZ];

    // Find closest point on capsule segment to box
    // Use iterative approach: sample points along segment or use closest point algorithm
    const closestOnSegment = this.closestPointOnSegmentToBox(localSegA, localSegB, boxMin, boxMax);

    // Clamp closest point to box surface
    const closestOnBox: Vec3 = [
      Math.max(boxMin[0], Math.min(boxMax[0], closestOnSegment[0])),
      Math.max(boxMin[1], Math.min(boxMax[1], closestOnSegment[1])),
      Math.max(boxMin[2], Math.min(boxMax[2], closestOnSegment[2])),
    ];

    // Distance from closest point on capsule to closest point on box
    const dx = closestOnSegment[0] - closestOnBox[0];
    const dy = closestOnSegment[1] - closestOnBox[1];
    const dz = closestOnSegment[2] - closestOnBox[2];
    const distanceSq = dx * dx + dy * dy + dz * dz;

    // Check collision with capsule radius
    if (distanceSq >= scaledRadius * scaledRadius) {
      return { hasCollision: false, contacts: [] };
    }

    const distance = Math.sqrt(distanceSq);
    const depth = scaledRadius - distance;

    // Normal in local space (from box to capsule)
    let localNormal: Vec3;
    if (distance > this.EPSILON) {
      localNormal = [dx / distance, dy / distance, dz / distance];
    } else {
      // Capsule is inside or touching box, find exit direction
      // Find which box face is closest
      const distToMinX = closestOnBox[0] - boxMin[0];
      const distToMaxX = boxMax[0] - closestOnBox[0];
      const distToMinY = closestOnBox[1] - boxMin[1];
      const distToMaxY = boxMax[1] - closestOnBox[1];
      const distToMinZ = closestOnBox[2] - boxMin[2];
      const distToMaxZ = boxMax[2] - closestOnBox[2];

      const minDist = Math.min(
        distToMinX,
        distToMaxX,
        distToMinY,
        distToMaxY,
        distToMinZ,
        distToMaxZ
      );
      if (minDist === distToMinX) localNormal = [-1, 0, 0];
      else if (minDist === distToMaxX) localNormal = [1, 0, 0];
      else if (minDist === distToMinY) localNormal = [0, -1, 0];
      else if (minDist === distToMaxY) localNormal = [0, 1, 0];
      else if (minDist === distToMinZ) localNormal = [0, 0, -1];
      else localNormal = [0, 0, 1];
    }

    // Transform back to world space
    const worldNormal = this.rotateVector(localNormal, boxTransform.rotation);
    const worldClosestOnBox = this.addVec(
      this.rotateVector(closestOnBox, boxTransform.rotation),
      boxPos
    );

    // Contact point on box surface
    const contact: ContactPoint = {
      position: worldClosestOnBox,
      normal: worldNormal,
      depth,
    };

    return {
      hasCollision: true,
      contacts: [contact],
    };
  }

  /**
   * Find closest point on segment AB to an axis-aligned box
   * Uses iterative refinement for accuracy
   */
  private static closestPointOnSegmentToBox(
    segA: Vec3,
    segB: Vec3,
    boxMin: Vec3,
    boxMax: Vec3
  ): Vec3 {
    // Vector along segment
    const segDir: Vec3 = [segB[0] - segA[0], segB[1] - segA[1], segB[2] - segA[2]];
    const segLenSq = segDir[0] ** 2 + segDir[1] ** 2 + segDir[2] ** 2;

    // If segment is degenerate (point), return the point
    if (segLenSq < this.EPSILON * this.EPSILON) {
      return [segA[0], segA[1], segA[2]];
    }

    // Project box center onto segment line
    const boxCenter: Vec3 = [
      (boxMin[0] + boxMax[0]) / 2,
      (boxMin[1] + boxMax[1]) / 2,
      (boxMin[2] + boxMax[2]) / 2,
    ];

    const toCenter: Vec3 = [boxCenter[0] - segA[0], boxCenter[1] - segA[1], boxCenter[2] - segA[2]];

    const segDirNorm: Vec3 = [
      segDir[0] / Math.sqrt(segLenSq),
      segDir[1] / Math.sqrt(segLenSq),
      segDir[2] / Math.sqrt(segLenSq),
    ];

    const t = this.dot(toCenter, segDirNorm);
    const tClamped = Math.max(0, Math.min(1, t)); // Clamp to segment range

    // Point on segment
    const pointOnSeg: Vec3 = [
      segA[0] + tClamped * segDir[0],
      segA[1] + tClamped * segDir[1],
      segA[2] + tClamped * segDir[2],
    ];

    // Refine: check if any box corner is closer
    // For simplicity, use iterative approach checking segment endpoints and midpoint
    let bestPoint = pointOnSeg;
    let bestDistSq = Infinity;

    const samples = [
      [segA[0], segA[1], segA[2]],
      [segB[0], segB[1], segB[2]],
      pointOnSeg,
      // Midpoints
      [(segA[0] + pointOnSeg[0]) / 2, (segA[1] + pointOnSeg[1]) / 2, (segA[2] + pointOnSeg[2]) / 2],
      [(pointOnSeg[0] + segB[0]) / 2, (pointOnSeg[1] + segB[1]) / 2, (pointOnSeg[2] + segB[2]) / 2],
    ];

    for (const sample of samples) {
      // Clamp to box and compute distance
      const clamped: Vec3 = [
        Math.max(boxMin[0], Math.min(boxMax[0], sample[0]!)),
        Math.max(boxMin[1], Math.min(boxMax[1], sample[1]!)),
        Math.max(boxMin[2], Math.min(boxMax[2], sample[2]!)),
      ];
      const dx = sample[0]! - clamped[0];
      const dy = sample[1]! - clamped[1];
      const dz = sample[2]! - clamped[2];
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestPoint = [sample[0]!, sample[1]!, sample[2]!];
      }
    }

    return bestPoint;
  }

  /**
   * Capsule collision (simplified - treats as sphere + cylinder)
   */
  private static capsuleCollision(
    colliderA: AnyCollider,
    transformA: ColliderTransform,
    colliderB: AnyCollider,
    transformB: ColliderTransform
  ): CollisionInfo {
    // Build segment representations for capsule(s)
    const segA = this.getCapsuleSegmentOrPoint(colliderA, transformA);
    const segB = this.getCapsuleSegmentOrPoint(colliderB, transformB);

    // Effective radii
    const radA = this.getEffectiveRadius(colliderA, transformA);
    const radB = this.getEffectiveRadius(colliderB, transformB);

    // Compute closest points between two segments (or points)
    const { pA, pB } = this.closestPointsBetweenSegments(segA.a, segA.b, segB.a, segB.b);

    const dx = pB[0] - pA[0];
    const dy = pB[1] - pA[1];
    const dz = pB[2] - pA[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    const limit = radA + radB;
    if (distSq >= limit * limit) {
      return { hasCollision: false, contacts: [] };
    }

    const dist = Math.sqrt(Math.max(distSq, this.EPSILON * this.EPSILON));
    const normal: Vec3 = dist > this.EPSILON ? [dx / dist, dy / dist, dz / dist] : [0, 1, 0];
    const depth = limit - dist;

    // Contact point at surface of A along normal
    const contactPoint: Vec3 = [
      pA[0] + normal[0] * radA,
      pA[1] + normal[1] * radA,
      pA[2] + normal[2] * radA,
    ];

    return {
      hasCollision: true,
      contacts: [
        {
          position: contactPoint,
          normal,
          depth,
        },
      ],
    };
  }

  private static getCapsuleSegmentOrPoint(
    collider: AnyCollider,
    t: ColliderTransform
  ): { a: Vec3; b: Vec3 } {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (collider.shape === 'capsule') {
      // Capsule is aligned with local Y; apply scale and rotation
      const cap = collider;
      const scaledRadius = cap.radius * Math.max(t.scale[0], t.scale[2]);
      const half = Math.max(0, (cap.height * t.scale[1] - 2 * scaledRadius) / 2);
      const localA: Vec3 = [0, -half, 0];
      const localB: Vec3 = [0, half, 0];
      const worldA = this.addVec(this.rotateVector(localA, t.rotation), t.position);
      const worldB = this.addVec(this.rotateVector(localB, t.rotation), t.position);
      return { a: worldA, b: worldB };
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (collider.shape === 'sphere') {
      const pos = this.getWorldPosition(collider.center, t);
      return { a: pos, b: pos };
    }
    // Treat box as a point at its center for segment-segment proximity; real narrow-phase happens in boxBox/boxSphere
    const pos = this.getWorldPosition(collider.center, t);
    return { a: pos, b: pos };
  }

  private static getEffectiveRadius(collider: AnyCollider, t: ColliderTransform): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (collider.shape === 'capsule') {
      return collider.radius * Math.max(t.scale[0], t.scale[2]);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (collider.shape === 'sphere') {
      const s = t.scale;
      return collider.radius * ((s[0] + s[1] + s[2]) / 3);
    }
    // Box: approximate by inscribed sphere radius along smallest half-extent (for interaction with capsule)
    const b = collider;
    const rx = (b.size[0] * t.scale[0]) / 2;
    const ry = (b.size[1] * t.scale[1]) / 2;
    const rz = (b.size[2] * t.scale[2]) / 2;
    return Math.min(rx, ry, rz);
  }

  // Compute closest points between two segments AB and CD
  private static closestPointsBetweenSegments(
    A: Vec3,
    B: Vec3,
    C: Vec3,
    D: Vec3
  ): { pA: Vec3; pB: Vec3 } {
    const EPS = this.EPSILON;
    const u: Vec3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v: Vec3 = [D[0] - C[0], D[1] - C[1], D[2] - C[2]];
    const w0: Vec3 = [A[0] - C[0], A[1] - C[1], A[2] - C[2]];

    const a = this.dot(u, u);
    const b = this.dot(u, v);
    const c = this.dot(v, v);
    const d = this.dot(u, w0);
    const e = this.dot(v, w0);

    let sN = 0,
      sD = a;
    let tN = 0,
      tD = c;

    const DDen = a * c - b * b;

    if (DDen > EPS) {
      sN = b * e - c * d;
      tN = a * e - b * d;
      if (sN < 0) {
        sN = 0;
        tN = e;
        tD = c;
      } else if (sN > sD) {
        sN = sD;
        tN = e + b;
        tD = c;
      }
    } else {
      // Parallel
      sN = 0;
      sD = 1;
      tN = e;
      tD = c;
    }

    if (tN < 0) {
      tN = 0;
      if (-d < 0) sN = 0;
      else if (-d > a) sN = sD;
      else {
        sN = -d;
        sD = a;
      }
    } else if (tN > tD) {
      tN = tD;
      const tmp = -d + b;
      if (tmp < 0) sN = 0;
      else if (tmp > a) sN = sD;
      else {
        sN = tmp;
        sD = a;
      }
    }

    const sc = Math.abs(sN) < EPS ? 0 : sN / sD;
    const tc = Math.abs(tN) < EPS ? 0 : tN / tD;

    const pA: Vec3 = [A[0] + sc * u[0], A[1] + sc * u[1], A[2] + sc * u[2]];
    const pB: Vec3 = [C[0] + tc * v[0], C[1] + tc * v[1], C[2] + tc * v[2]];
    return { pA, pB };
  }

  private static addVec(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  /**
   * OBB (Oriented Bounding Box) structure
   */
  private static boxToOBB(box: BoxCollider, position: Vec3, rotation: Quat, scale: Vec3): OBB {
    const matrix = quatToMatrix3(rotation);
    const a0: Vec3 = [matrix[0]!, matrix[3]!, matrix[6]!];
    const a1: Vec3 = [matrix[1]!, matrix[4]!, matrix[7]!];
    const a2: Vec3 = [matrix[2]!, matrix[5]!, matrix[8]!];
    normalizeVec3Out(a0, a0);
    normalizeVec3Out(a1, a1);
    normalizeVec3Out(a2, a2);
    return {
      center: position,
      axes: [a0, a1, a2],
      halfSizes: [
        (box.size[0] * scale[0]) / 2,
        (box.size[1] * scale[1]) / 2,
        (box.size[2] * scale[2]) / 2,
      ],
    };
  }

  /**
   * OBB intersection test using SAT
   */
  private static obbIntersect(a: OBB, b: OBB): { hasCollision: boolean; depth: number } {
    const EPS = this.EPSILON;
    const [Au, Av, Aw] = a.axes;
    const [Bu, Bv, Bw] = b.axes;

    // Compute rotation matrix (typed as fixed 3x3 to avoid undefined index types)
    const R: [[number, number, number], [number, number, number], [number, number, number]] = [
      [this.dot(Au, Bu), this.dot(Au, Bv), this.dot(Au, Bw)],
      [this.dot(Av, Bu), this.dot(Av, Bv), this.dot(Av, Bw)],
      [this.dot(Aw, Bu), this.dot(Aw, Bv), this.dot(Aw, Bw)],
    ];

    const AbsR: [[number, number, number], [number, number, number], [number, number, number]] = [
      [Math.abs(R[0][0]) + EPS, Math.abs(R[0][1]) + EPS, Math.abs(R[0][2]) + EPS],
      [Math.abs(R[1][0]) + EPS, Math.abs(R[1][1]) + EPS, Math.abs(R[1][2]) + EPS],
      [Math.abs(R[2][0]) + EPS, Math.abs(R[2][1]) + EPS, Math.abs(R[2][2]) + EPS],
    ];

    const tWorld: Vec3 = [
      b.center[0] - a.center[0],
      b.center[1] - a.center[1],
      b.center[2] - a.center[2],
    ];
    const t: Vec3 = [this.dot(tWorld, Au), this.dot(tWorld, Av), this.dot(tWorld, Aw)];

    const ra = a.halfSizes;
    const rb = b.halfSizes;

    let minPenetration = Infinity;

    // Test 15 separating axes
    const tests = [
      // A's axes
      {
        proj: Math.abs(t[0]),
        sum: ra[0] + rb[0] * AbsR[0][0] + rb[1] * AbsR[0][1] + rb[2] * AbsR[0][2],
      },
      {
        proj: Math.abs(t[1]),
        sum: ra[1] + rb[0] * AbsR[1][0] + rb[1] * AbsR[1][1] + rb[2] * AbsR[1][2],
      },
      {
        proj: Math.abs(t[2]),
        sum: ra[2] + rb[0] * AbsR[2][0] + rb[1] * AbsR[2][1] + rb[2] * AbsR[2][2],
      },
      // B's axes
      {
        proj: Math.abs(t[0] * R[0][0] + t[1] * R[1][0] + t[2] * R[2][0]),
        sum: ra[0] * AbsR[0][0] + ra[1] * AbsR[1][0] + ra[2] * AbsR[2][0] + rb[0],
      },
      {
        proj: Math.abs(t[0] * R[0][1] + t[1] * R[1][1] + t[2] * R[2][1]),
        sum: ra[0] * AbsR[0][1] + ra[1] * AbsR[1][1] + ra[2] * AbsR[2][1] + rb[1],
      },
      {
        proj: Math.abs(t[0] * R[0][2] + t[1] * R[1][2] + t[2] * R[2][2]),
        sum: ra[0] * AbsR[0][2] + ra[1] * AbsR[1][2] + ra[2] * AbsR[2][2] + rb[2],
      },
    ];

    for (const test of tests) {
      if (test.proj > test.sum + EPS) {
        return { hasCollision: false, depth: 0 };
      }
      const penetration = test.sum - test.proj;
      minPenetration = Math.min(minPenetration, penetration);
    }

    // Simplified: skip edge-edge tests for performance
    return { hasCollision: true, depth: minPenetration };
  }

  /**
   * Rotates a vector by a quaternion
   */
  private static rotateVector(v: Vec3, q: Quat): Vec3 {
    const [qx, qy, qz, qw] = q;
    const [vx, vy, vz] = v;

    // v' = v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v)
    const t0 = qy * vz - qz * vy + qw * vx;
    const t1 = qz * vx - qx * vz + qw * vy;
    const t2 = qx * vy - qy * vx + qw * vz;

    return [
      vx + 2 * (qy * t2 - qz * t1),
      vy + 2 * (qz * t0 - qx * t2),
      vz + 2 * (qx * t1 - qy * t0),
    ];
  }

  /**
   * Inverse rotate (equivalent to rotating by conjugate quaternion)
   */
  private static inverseRotateVector(v: Vec3, q: Quat): Vec3 {
    // Use conjugate quaternion (-x, -y, -z, w)
    const conjugate: Quat = [-q[0], -q[1], -q[2], q[3]];
    return this.rotateVector(v, conjugate);
  }

  /**
   * Dot product
   */
  private static dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
}

interface OBB {
  center: Vec3;
  axes: [Vec3, Vec3, Vec3];
  halfSizes: Vec3;
}
