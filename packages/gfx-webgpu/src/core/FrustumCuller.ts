/**
 * Frustum Culling System
 *
 * Extracts frustum planes from view-projection matrix and performs
 * efficient visibility tests against entity bounding boxes.
 *
 * Performance: Culls objects outside camera view to reduce draw calls.
 */

import type { Mat4, Vec3 } from '@engine/core/math';
import type { Entity, AABB } from '@engine/world';
import { Octree, MeshComponent } from '@engine/world';

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
 * Enhanced with octree spatial partitioning for efficient broad-phase culling.
 */
export class FrustumCuller {
  private reusableVisibleArray: Entity[] = [];
  private octree: Octree | null = null;
  private octreeDirty = true;
  private lastEntityCount = 0;

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
   * Uses octree for broad-phase culling when available.
   * @returns Array of visible entities (reused, do not store reference)
   */
  cullEntities(entities: Entity[], frustum: Frustum): Entity[] {
    this.reusableVisibleArray.length = 0; // Clear without deallocating

    // Rebuild octree if needed (entity count changed or marked dirty)
    if (
      this.octreeDirty ||
      !this.octree ||
      entities.length !== this.lastEntityCount
    ) {
      this.rebuildOctree(entities);
    }

    // Broad-phase: Get potentially visible entities from octree
    // Note: We currently bypass the octree and force a linear scan (candidates = entities)
    // because the octree is not updated when entity transforms/bounds change (only on add/remove).
    // This caused issues with dynamic objects (like growing terrain) disappearing when their
    // bounds expanded outside the initial octree node.
    // Linear scan is O(N) which is faster than rebuilding octree O(N log N) every frame,
    // and sufficient for < 10k entities.
    const candidates = entities;
    /*
    const frustumBounds = this.getFrustumBounds(frustum);
    const candidates = this.octree
      ? this.octree.query(frustumBounds)
      : entities;
    */

    // Fine-phase: Test each candidate against frustum planes
    for (const e of candidates) {
      const aabb = this.getEntityAABB(e);
      if (this.frustumIntersectsAABB(aabb, frustum)) {
        this.reusableVisibleArray.push(e);
      }
    }

    return this.reusableVisibleArray;
  }

  /**
   * Culls entities and writes results to provided output array (avoids internal state).
   * Uses octree for broad-phase culling when available.
   */
  cullEntitiesToArray(entities: Entity[], frustum: Frustum, outVisible: Entity[]): Entity[] {
    outVisible.length = 0; // Clear without deallocating

    // Rebuild octree if needed
    if (
      this.octreeDirty ||
      !this.octree ||
      entities.length !== this.lastEntityCount
    ) {
      this.rebuildOctree(entities);
    }

    // Broad-phase: Get potentially visible entities from octree
    // Note: We currently bypass the octree and force a linear scan (candidates = entities)
    // because the octree is not updated when entity transforms/bounds change (only on add/remove).
    // This caused issues with dynamic objects (like growing terrain) disappearing when their
    // bounds expanded outside the initial octree node.
    // Linear scan is O(N) which is faster than rebuilding octree O(N log N) every frame,
    // and sufficient for < 10k entities.
    const candidates = entities;
    /*
    const frustumBounds = this.getFrustumBounds(frustum);
    const candidates = this.octree
      ? this.octree.query(frustumBounds)
      : entities;
    */

    // Fine-phase: Test each candidate against frustum planes
    for (const e of candidates) {
      const aabb = this.getEntityAABB(e);
      if (this.frustumIntersectsAABB(aabb, frustum)) {
        outVisible.push(e);
      }
    }

    return outVisible;
  }

  /**
   * Marks the octree as dirty, forcing rebuild on next cull.
   */
  markDirty(): void {
    this.octreeDirty = true;
  }

  /**
   * Rebuilds the octree from entity list.
   */
  private rebuildOctree(entities: Entity[]): void {
    // Calculate world bounds from entities
    const worldBounds = this.calculateWorldBounds(entities);

    // Create new octree
    this.octree = new Octree(worldBounds, {
      maxDepth: 6,
      maxEntitiesPerNode: 8,
      minNodeSize: 1.0,
    });

    // Insert entities into octree
    for (const entity of entities) {
      if (entity && entity.active) {
        const aabb = this.getEntityAABB(entity);
        this.octree.insert(entity, aabb);
      }
    }

    this.octreeDirty = false;
    this.lastEntityCount = entities.length;
  }

  /**
   * Calculates world bounds from entity list.
   */
  private calculateWorldBounds(entities: Entity[]): AABB {
    if (entities.length === 0) {
      return {
        min: [-100, -100, -100],
        max: [100, 100, 100],
      };
    }

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (const e of entities) {
      const aabb = this.getEntityAABB(e);
      minX = Math.min(minX, aabb.min[0]);
      minY = Math.min(minY, aabb.min[1]);
      minZ = Math.min(minZ, aabb.min[2]);
      maxX = Math.max(maxX, aabb.max[0]);
      maxY = Math.max(maxY, aabb.max[1]);
      maxZ = Math.max(maxZ, aabb.max[2]);
    }

    // Add some padding
    const padding = 10;
    return {
      min: [minX - padding, minY - padding, minZ - padding],
      max: [maxX + padding, maxY + padding, maxZ + padding],
    };
  }

  /**
   * Gets approximate AABB bounds for frustum (for broad-phase query).
   */
  private getFrustumBounds(frustum: Frustum): AABB {
    // Calculate bounds from frustum planes intersection
    // This is a conservative estimate - could be tighter
    let minX = -Infinity,
      minY = -Infinity,
      minZ = -Infinity;
    let maxX = Infinity,
      maxY = Infinity,
      maxZ = Infinity;

    // For each plane, constrain the bounds
    for (const plane of frustum.planes) {
      const absNx = Math.abs(plane.nx);
      const absNy = Math.abs(plane.ny);
      const absNz = Math.abs(plane.nz);

      // Estimate constraint based on dominant axis
      if (absNx > absNy && absNx > absNz) {
        // X-dominant plane
        const x = -plane.d / plane.nx;
        if (plane.nx > 0) minX = Math.max(minX, x);
        else maxX = Math.min(maxX, x);
      } else if (absNy > absNz) {
        // Y-dominant plane
        const y = -plane.d / plane.ny;
        if (plane.ny > 0) minY = Math.max(minY, y);
        else maxY = Math.min(maxY, y);
      } else {
        // Z-dominant plane
        const z = -plane.d / plane.nz;
        if (plane.nz > 0) minZ = Math.max(minZ, z);
        else maxZ = Math.min(maxZ, z);
      }
    }

    // Clamp to reasonable bounds if infinite
    const maxBound = 1000;
    if (!Number.isFinite(minX)) minX = -maxBound;
    if (!Number.isFinite(minY)) minY = -maxBound;
    if (!Number.isFinite(minZ)) minZ = -maxBound;
    if (!Number.isFinite(maxX)) maxX = maxBound;
    if (!Number.isFinite(maxY)) maxY = maxBound;
    if (!Number.isFinite(maxZ)) maxZ = maxBound;

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    };
  }

  /**
   * Computes axis-aligned bounding box for entity in world space.
   * Handles rotation by transforming all 8 corners of the local box.
   */
  private getEntityAABB(entity: Entity): AABB {
    const worldMatrix = entity.transform.getWorldMatrix();
    
    let minX = -0.5;
    let minY = -0.5;
    let minZ = -0.5;
    let maxX = 0.5;
    let maxY = 0.5;
    let maxZ = 0.5;

    // Check for custom local AABB in MeshComponent
    const mesh = entity.getComponent(MeshComponent);
    if (mesh && mesh.localAABB) {
      minX = mesh.localAABB.min[0];
      minY = mesh.localAABB.min[1];
      minZ = mesh.localAABB.min[2];
      maxX = mesh.localAABB.max[0];
      maxY = mesh.localAABB.max[1];
      maxZ = mesh.localAABB.max[2];
    } else if (mesh && (mesh.meshType === 'box' || mesh.meshType === 'cube') && mesh.options) {
      // Handle both 'box' and 'cube' mesh types
      // Support both size array format [w, h, d] and individual width/height/depth properties
      let w = 1, h = 1, d = 1;
      
      if (mesh.options.size && Array.isArray(mesh.options.size)) {
        // Size array format: [width, height, depth]
        w = mesh.options.size[0] ?? 1;
        h = mesh.options.size[1] ?? 1;
        d = mesh.options.size[2] ?? 1;
      } else {
        // Individual property format (legacy/plane-style)
        w = mesh.options.width ?? 1;
        h = mesh.options.height ?? 1;
        d = mesh.options.depth ?? 1;
      }
      
      // Box/cube primitives are centered at (0,0,0)
      const halfW = w / 2;
      const halfH = h / 2;
      const halfD = d / 2;
      minX = -halfW; minY = -halfH; minZ = -halfD;
      maxX = halfW; maxY = halfH; maxZ = halfD;
    } else if (mesh && mesh.meshType === 'sphere' && mesh.options?.radius) {
      // Sphere primitives
      const r = mesh.options.radius;
      minX = -r; minY = -r; minZ = -r;
      maxX = r; maxY = r; maxZ = r;
    } else if (mesh && mesh.meshType === 'cylinder' && mesh.options) {
      // Cylinder primitives
      const r = mesh.options.radius ?? 0.5;
      const halfH = (mesh.options.height ?? 1) / 2;
      minX = -r; minY = -halfH; minZ = -r;
      maxX = r; maxY = halfH; maxZ = r;
    } else if (mesh && mesh.meshType === 'plane' && mesh.options) {
      // Plane primitives (flat, thin in Y)
      const halfW = (mesh.options.width ?? 1) / 2;
      const halfD = (mesh.options.depth ?? 1) / 2;
      minX = -halfW; minY = -0.001; minZ = -halfD;
      maxX = halfW; maxY = 0.001; maxZ = halfD;
    }

    // 8 corners of the local bounding box
    // Note: We do NOT multiply by scale here because getWorldMatrix() includes scale
    const localCorners: Vec3[] = [
      [minX, minY, minZ],
      [maxX, minY, minZ],
      [minX, maxY, minZ],
      [maxX, maxY, minZ],
      [minX, minY, maxZ],
      [maxX, minY, maxZ],
      [minX, maxY, maxZ],
      [maxX, maxY, maxZ],
    ];

    let wMinX = Infinity,
      wMinY = Infinity,
      wMinZ = Infinity;
    let wMaxX = -Infinity,
      wMaxY = -Infinity,
      wMaxZ = -Infinity;

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

      wMinX = Math.min(wMinX, wx);
      wMinY = Math.min(wMinY, wy);
      wMinZ = Math.min(wMinZ, wz);
      wMaxX = Math.max(wMaxX, wx);
      wMaxY = Math.max(wMaxY, wy);
      wMaxZ = Math.max(wMaxZ, wz);
    }

    return {
      min: [wMinX, wMinY, wMinZ],
      max: [wMaxX, wMaxY, wMaxZ],
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

