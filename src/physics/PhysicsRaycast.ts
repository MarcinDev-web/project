import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import {
  addVec3Out,
  subVec3Out,
  scaleVec3Out,
  dotVec3,
  transformVec3ByQuatOut,
} from '@engine/core/math';
import { PhysicsComponent, type BoxCollider, type SphereCollider, type CapsuleCollider } from '@engine/world';

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
export class PhysicsRaycast {
  private static readonly EPSILON = 1e-6;

  /**
   * Tests if a ray intersects a box collider
   */
  static rayBoxIntersection(
    ray: PhysicsRay,
    boxCollider: BoxCollider,
    entityPosition: Vec3,
    entityRotation: [number, number, number, number],
    entityScale: Vec3
  ): { hit: boolean; distance: number; point: Vec3; normal: Vec3 } | null {
    // Transform ray to local space of the box
    const localOrigin = this.worldToLocal(ray.origin, entityPosition, entityRotation);
    const localDir: Vec3 = [0, 0, 0];
    transformVec3ByQuatOut(localDir, ray.direction, this.invertQuat(entityRotation));

    // Get box half-extents (scaled)
    const halfSize: Vec3 = [
      boxCollider.size[0] * entityScale[0] * 0.5,
      boxCollider.size[1] * entityScale[1] * 0.5,
      boxCollider.size[2] * entityScale[2] * 0.5,
    ];

    // AABB ray intersection test (slab method)
    let tMin = -Infinity;
    let tMax = Infinity;
    let hitNormal: Vec3 = [0, 0, 0];

    for (let i = 0; i < 3; i++) {
      if (Math.abs(localDir[i]!) < this.EPSILON) {
        // Ray is parallel to slab
        if (localOrigin[i]! < -halfSize[i]! || localOrigin[i]! > halfSize[i]!) {
          return null;
        }
      } else {
        const ood = 1.0 / localDir[i]!;
        let t1 = (-halfSize[i]! - localOrigin[i]!) * ood;
        let t2 = (halfSize[i]! - localOrigin[i]!) * ood;

        let normal1: Vec3 = i === 0 ? [-1, 0, 0] : i === 1 ? [0, -1, 0] : [0, 0, -1];
        let normal2: Vec3 = i === 0 ? [1, 0, 0] : i === 1 ? [0, 1, 0] : [0, 0, 1];

        if (t1 > t2) {
          [t1, t2] = [t2, t1];
          [normal1, normal2] = [normal2, normal1];
        }

        if (t1 > tMin) {
          tMin = t1;
          hitNormal = normal1;
        }
        if (t2 < tMax) {
          tMax = t2;
        }

        if (tMin > tMax || tMax < 0) {
          return null;
        }
      }
    }

    const distance = tMin >= 0 ? tMin : tMax;
    if (distance < 0 || (ray.maxDistance !== undefined && distance > ray.maxDistance)) {
      return null;
    }

    // Transform back to world space
    const localPointTMP: Vec3 = [0, 0, 0];
    const localPoint: Vec3 = addVec3Out(localPointTMP, localOrigin, scaleVec3Out([0,0,0], localDir, distance));
    const worldPoint = this.localToWorld(localPoint, entityPosition, entityRotation);
    const worldNormal: Vec3 = [0, 0, 0];
    transformVec3ByQuatOut(worldNormal, hitNormal, entityRotation);
    // normalize worldNormal in-place
    {
      const len = Math.hypot(worldNormal[0], worldNormal[1], worldNormal[2]);
      if (len > this.EPSILON) {
        worldNormal[0] /= len; worldNormal[1] /= len; worldNormal[2] /= len;
      }
    }

    return {
      hit: true,
      distance,
      point: worldPoint,
      normal: worldNormal,
    };
  }

  /**
   * Tests if a ray intersects a sphere collider
   */
  static raySphereIntersection(
    ray: PhysicsRay,
    sphereCollider: SphereCollider,
    entityPosition: Vec3,
    entityScale: Vec3
  ): { hit: boolean; distance: number; point: Vec3; normal: Vec3 } | null {
    // Get effective radius (use max scale component)
    const radius = sphereCollider.radius * Math.max(entityScale[0], entityScale[1], entityScale[2]);

    // Vector from ray origin to sphere center
    const oc: Vec3 = [0, 0, 0];
    subVec3Out(oc, ray.origin, entityPosition);

    // Quadratic equation coefficients for ray-sphere intersection
    const a = dotVec3(ray.direction, ray.direction);
    const b = 2.0 * dotVec3(oc, ray.direction);
    const c = dotVec3(oc, oc) - radius * radius;

    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
      return null; // No intersection
    }

    // Calculate both intersection points
    const sqrtD = Math.sqrt(discriminant);
    const t1 = (-b - sqrtD) / (2.0 * a);
    const t2 = (-b + sqrtD) / (2.0 * a);

    // Use the closest positive intersection
    let t = t1 >= 0 ? t1 : t2;

    if (t < 0 || (ray.maxDistance !== undefined && t > ray.maxDistance)) {
      return null;
    }

    const point = addVec3Out([0,0,0], ray.origin, scaleVec3Out([0,0,0], ray.direction, t));
    const normal = subVec3Out([0,0,0], point, entityPosition);
    {
      const len = Math.hypot(normal[0], normal[1], normal[2]);
      if (len > this.EPSILON) { normal[0]/=len; normal[1]/=len; normal[2]/=len; }
    }

    return {
      hit: true,
      distance: t,
      point,
      normal,
    };
  }

  /**
   * Tests if a ray intersects a capsule collider
   */
  static rayCapsuleIntersection(
    ray: PhysicsRay,
    capsuleCollider: CapsuleCollider,
    entityPosition: Vec3,
    entityRotation: [number, number, number, number],
    entityScale: Vec3
  ): { hit: boolean; distance: number; point: Vec3; normal: Vec3 } | null {
    // Transform ray to local space
    const localOrigin = this.worldToLocal(ray.origin, entityPosition, entityRotation);
    const localDir: Vec3 = [0, 0, 0];
    transformVec3ByQuatOut(localDir, ray.direction, this.invertQuat(entityRotation));

    const radius = capsuleCollider.radius * Math.max(entityScale[0], entityScale[2]);
    const halfHeight = (capsuleCollider.height * entityScale[1]) * 0.5 - radius;

    // Capsule endpoints (along Y axis in local space)
    const p1: Vec3 = [0, -halfHeight, 0];
    const p2: Vec3 = [0, halfHeight, 0];

    // Ray-capsule intersection
    const pa = localOrigin;
    const ba = subVec3Out([0,0,0], p2, p1);
    const oa = subVec3Out([0,0,0], pa, p1);

    const baba = dotVec3(ba, ba);
    const bard = dotVec3(ba, localDir);
    const baoa = dotVec3(ba, oa);
    const rdoa = dotVec3(localDir, oa);
    const oaoa = dotVec3(oa, oa);

    const a = baba - bard * bard;
    const b = baba * rdoa - baoa * bard;
    const c = baba * oaoa - baoa * baoa - radius * radius * baba;
    const h = b * b - a * c;

    if (h >= 0.0) {
      const t = (-b - Math.sqrt(h)) / a;
      const y = baoa + t * bard;

      // Body of capsule
      if (y > 0.0 && y < baba && t >= 0) {
        if (ray.maxDistance !== undefined && t > ray.maxDistance) {
          return null;
        }

        const localPoint = addVec3Out([0,0,0], localOrigin, scaleVec3Out([0,0,0], localDir, t));
        const worldPoint = this.localToWorld(localPoint, entityPosition, entityRotation);

        // Calculate normal
        const capsulePoint = addVec3Out([0,0,0], p1, scaleVec3Out([0,0,0], ba, y / baba));
        const localNormal = subVec3Out([0,0,0], localPoint, capsulePoint);
        {
          const len = Math.hypot(localNormal[0], localNormal[1], localNormal[2]);
          if (len > this.EPSILON) { localNormal[0]/=len; localNormal[1]/=len; localNormal[2]/=len; }
        }
        const worldNormal = transformVec3ByQuatOut([0,0,0], localNormal, entityRotation);
        {
          const len = Math.hypot(worldNormal[0], worldNormal[1], worldNormal[2]);
          if (len > this.EPSILON) { worldNormal[0]/=len; worldNormal[1]/=len; worldNormal[2]/=len; }
        }

        return {
          hit: true,
          distance: t,
          point: worldPoint,
          normal: worldNormal,
        };
      }

      // Caps (spheres at endpoints)
      const caps = [p1, p2];
      let closestHit: { hit: boolean; distance: number; point: Vec3; normal: Vec3 } | null = null;

      for (const cap of caps) {
        const oc = subVec3Out([0,0,0], localOrigin, cap);
        const a2 = dotVec3(localDir, localDir);
        const b2 = 2.0 * dotVec3(oc, localDir);
        const c2 = dotVec3(oc, oc) - radius * radius;
        const discriminant = b2 * b2 - 4 * a2 * c2;

        if (discriminant >= 0) {
          const sqrtD = Math.sqrt(discriminant);
          const t1 = (-b2 - sqrtD) / (2.0 * a2);

          if (t1 >= 0 && (ray.maxDistance === undefined || t1 <= ray.maxDistance)) {
            if (!closestHit || t1 < closestHit.distance) {
              const localPoint = addVec3Out([0,0,0], localOrigin, scaleVec3Out([0,0,0], localDir, t1));
              const worldPoint = this.localToWorld(localPoint, entityPosition, entityRotation);
              const localNormal = subVec3Out([0,0,0], localPoint, cap);
              {
                const len = Math.hypot(localNormal[0], localNormal[1], localNormal[2]);
                if (len > this.EPSILON) { localNormal[0]/=len; localNormal[1]/=len; localNormal[2]/=len; }
              }
              const worldNormal = transformVec3ByQuatOut([0,0,0], localNormal, entityRotation);
              {
                const len = Math.hypot(worldNormal[0], worldNormal[1], worldNormal[2]);
                if (len > this.EPSILON) { worldNormal[0]/=len; worldNormal[1]/=len; worldNormal[2]/=len; }
              }

              closestHit = {
                hit: true,
                distance: t1,
                point: worldPoint,
                normal: worldNormal,
              };
            }
          }
        }
      }

      return closestHit;
    }

    return null;
  }

  /**
   * Performs a raycast against a single entity
   */
  static raycastEntity(
    ray: PhysicsRay,
    entity: Entity,
    hitTriggers: boolean = false
  ): RaycastHit | null {
    const physics = entity.getComponent(PhysicsComponent);
    if (!physics || physics.colliders.length === 0) {
      return null;
    }

    let closestHit: RaycastHit | null = null;

    for (let i = 0; i < physics.colliders.length; i++) {
      const collider = physics.colliders[i];
      if (!collider) {
        continue;
      }

      // Skip triggers if not requested
      if (collider.isTrigger && !hitTriggers) {
        continue;
      }

      let result: { hit: boolean; distance: number; point: Vec3; normal: Vec3 } | null = null;

      switch (collider.shape) {
        case 'box':
          result = this.rayBoxIntersection(
            ray,
            collider as BoxCollider,
            entity.transform.position,
            entity.transform.rotation,
            entity.transform.scale
          );
          break;
        case 'sphere':
          result = this.raySphereIntersection(
            ray,
            collider as SphereCollider,
            entity.transform.position,
            entity.transform.scale
          );
          break;
        case 'capsule':
          result = this.rayCapsuleIntersection(
            ray,
            collider as CapsuleCollider,
            entity.transform.position,
            entity.transform.rotation,
            entity.transform.scale
          );
          break;
      }

      if (result && result.hit) {
        if (!closestHit || result.distance < closestHit.distance) {
          closestHit = {
            entity,
            physics,
            colliderIndex: i,
            point: result.point,
            normal: result.normal,
            distance: result.distance,
          };
        }
      }
    }

    return closestHit;
  }

  /**
   * Helper: Transform point from world to local space
   */
  private static worldToLocal(point: Vec3, position: Vec3, rotation: [number, number, number, number]): Vec3 {
    const translated: Vec3 = [0, 0, 0];
    subVec3Out(translated, point, position);
    return transformVec3ByQuatOut([0,0,0], translated, this.invertQuat(rotation));
  }

  /**
   * Helper: Transform point from local to world space
   */
  private static localToWorld(point: Vec3, position: Vec3, rotation: [number, number, number, number]): Vec3 {
    const rotated = transformVec3ByQuatOut([0,0,0], point, rotation);
    return addVec3Out([0,0,0], rotated, position);
  }

  /**
   * Helper: Invert a quaternion
   */
  private static invertQuat(q: [number, number, number, number]): [number, number, number, number] {
    return [-q[0], -q[1], -q[2], q[3]];
  }
}

