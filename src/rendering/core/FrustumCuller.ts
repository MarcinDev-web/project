/**
 * Frustum Culling System
 *
 * Extracts frustum planes from view-projection matrix and performs
 * efficient visibility tests against entity bounding boxes.
 *
 * Performance: Culls objects outside camera view to reduce draw calls.
 */

import type { Mat4, Vec3 } from '../../math';
import type { Entity, AABB } from '../../scene';

export interface FrustumPlane {
  nx: number;
  ny: number;
  nz: number;
  d: number;
}

export interface Frustum {
  planes: FrustumPlane[];
}

/**
 * FrustumCuller manages frustum extraction and entity culling operations.
 */
export class FrustumCuller {
  private reusableVisibleArray: Entity[] = [];

  /**
   * Extracts a world-space frustum from a combined view-projection matrix.
   * Uses standard OpenGL/WebGPU frustum extraction.
   */
  extractFrustumFromVP(m: Mat4): Frustum {
    // Matrix is column-major; indices map as:
    // [ m00, m01, m02, m03,
    //   m10, m11, m12, m13,
    //   m20, m21, m22, m23,
    //   m30, m31, m32, m33 ]
    const planes: FrustumPlane[] = [];

    // Left: row3 + row0
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) + (m[0] ?? 0),
        ny: (m[7] ?? 0) + (m[4] ?? 0),
        nz: (m[11] ?? 0) + (m[8] ?? 0),
        d: (m[15] ?? 0) + (m[12] ?? 0),
      })
    );

    // Right: row3 - row0
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) - (m[0] ?? 0),
        ny: (m[7] ?? 0) - (m[4] ?? 0),
        nz: (m[11] ?? 0) - (m[8] ?? 0),
        d: (m[15] ?? 0) - (m[12] ?? 0),
      })
    );

    // Bottom: row3 + row1
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) + (m[1] ?? 0),
        ny: (m[7] ?? 0) + (m[5] ?? 0),
        nz: (m[11] ?? 0) + (m[9] ?? 0),
        d: (m[15] ?? 0) + (m[13] ?? 0),
      })
    );

    // Top: row3 - row1
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) - (m[1] ?? 0),
        ny: (m[7] ?? 0) - (m[5] ?? 0),
        nz: (m[11] ?? 0) - (m[9] ?? 0),
        d: (m[15] ?? 0) - (m[13] ?? 0),
      })
    );

    // Near: row3 + row2
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) + (m[2] ?? 0),
        ny: (m[7] ?? 0) + (m[6] ?? 0),
        nz: (m[11] ?? 0) + (m[10] ?? 0),
        d: (m[15] ?? 0) + (m[14] ?? 0),
      })
    );

    // Far: row3 - row2
    planes.push(
      this.normalizePlane({
        nx: (m[3] ?? 0) - (m[2] ?? 0),
        ny: (m[7] ?? 0) - (m[6] ?? 0),
        nz: (m[11] ?? 0) - (m[10] ?? 0),
        d: (m[15] ?? 0) - (m[14] ?? 0),
      })
    );

    return { planes };
  }

  /**
   * Culls entities outside frustum.
   * Reuses internal array to avoid allocations.
   * @returns Array of visible entities (reused, do not store reference)
   */
  cullEntities(entities: Entity[], frustum: Frustum): Entity[] {
    this.reusableVisibleArray.length = 0; // Clear without deallocating
    for (const e of entities) {
      const aabb = this.getEntityAABB(e);
      if (this.frustumIntersectsAABB(aabb, frustum)) {
        this.reusableVisibleArray.push(e);
      }
    }
    return this.reusableVisibleArray;
  }

  /**
   * Culls entities and writes results to provided output array (avoids internal state).
   */
  cullEntitiesToArray(entities: Entity[], frustum: Frustum, outVisible: Entity[]): Entity[] {
    outVisible.length = 0; // Clear without deallocating
    for (const e of entities) {
      const aabb = this.getEntityAABB(e);
      if (this.frustumIntersectsAABB(aabb, frustum)) {
        outVisible.push(e);
      }
    }
    return outVisible;
  }

  /**
   * Computes axis-aligned bounding box for entity in world space.
   * Handles rotation by transforming all 8 corners of the local box.
   */
  private getEntityAABB(entity: Entity): AABB {
    const worldMatrix = entity.transform.getWorldMatrix();
    const s = entity.transform.scale;

    // 8 corners of unit cube scaled by entity scale
    const localCorners: Vec3[] = [
      [-s[0] * 0.5, -s[1] * 0.5, -s[2] * 0.5],
      [s[0] * 0.5, -s[1] * 0.5, -s[2] * 0.5],
      [-s[0] * 0.5, s[1] * 0.5, -s[2] * 0.5],
      [s[0] * 0.5, s[1] * 0.5, -s[2] * 0.5],
      [-s[0] * 0.5, -s[1] * 0.5, s[2] * 0.5],
      [s[0] * 0.5, -s[1] * 0.5, s[2] * 0.5],
      [-s[0] * 0.5, s[1] * 0.5, s[2] * 0.5],
      [s[0] * 0.5, s[1] * 0.5, s[2] * 0.5],
    ];

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    // Transform each corner to world space and expand AABB
    for (const corner of localCorners) {
      const wx =
        (worldMatrix[0] ?? 0) * corner[0] +
        (worldMatrix[4] ?? 0) * corner[1] +
        (worldMatrix[8] ?? 0) * corner[2] +
        (worldMatrix[12] ?? 0);
      const wy =
        (worldMatrix[1] ?? 0) * corner[0] +
        (worldMatrix[5] ?? 0) * corner[1] +
        (worldMatrix[9] ?? 0) * corner[2] +
        (worldMatrix[13] ?? 0);
      const wz =
        (worldMatrix[2] ?? 0) * corner[0] +
        (worldMatrix[6] ?? 0) * corner[1] +
        (worldMatrix[10] ?? 0) * corner[2] +
        (worldMatrix[14] ?? 0);

      minX = Math.min(minX, wx);
      minY = Math.min(minY, wy);
      minZ = Math.min(minZ, wz);
      maxX = Math.max(maxX, wx);
      maxY = Math.max(maxY, wy);
      maxZ = Math.max(maxZ, wz);
    }

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    };
  }

  /**
   * Tests if an AABB intersects the frustum.
   * Returns false if AABB is completely outside any plane.
   */
  private frustumIntersectsAABB(aabb: AABB, frustum: Frustum): boolean {
    // Cull if AABB is completely outside any plane
    for (const p of frustum.planes) {
      const px = p.nx >= 0 ? aabb.max[0] : aabb.min[0];
      const py = p.ny >= 0 ? aabb.max[1] : aabb.min[1];
      const pz = p.nz >= 0 ? aabb.max[2] : aabb.min[2];
      const dist = p.nx * px + p.ny * py + p.nz * pz + p.d;
      if (dist < 0) return false;
    }
    return true;
  }

  /**
   * Normalizes a frustum plane.
   */
  private normalizePlane(plane: FrustumPlane): FrustumPlane {
    const len = Math.hypot(plane.nx, plane.ny, plane.nz) || 1;
    return {
      nx: plane.nx / len,
      ny: plane.ny / len,
      nz: plane.nz / len,
      d: plane.d / len,
    };
  }
}

// Export legacy functions for backward compatibility
export function extractFrustumFromVP(m: Mat4): Frustum {
  const culler = new FrustumCuller();
  return culler.extractFrustumFromVP(m);
}

export function cullEntities(entities: Entity[], frustum: Frustum, outVisible: Entity[]): Entity[] {
  const culler = new FrustumCuller();
  return culler.cullEntitiesToArray(entities, frustum, outVisible);
}

