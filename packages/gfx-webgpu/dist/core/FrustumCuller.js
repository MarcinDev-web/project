/**
 * Frustum Culling System
 *
 * Extracts frustum planes from view-projection matrix and performs
 * efficient visibility tests against entity bounding boxes.
 *
 * Performance: Culls objects outside camera view to reduce draw calls.
 */
import { Octree } from '@engine/world';
/**
 * FrustumCuller manages frustum extraction and entity culling operations.
 * Enhanced with octree spatial partitioning for efficient broad-phase culling.
 */
export class FrustumCuller {
    reusableVisibleArray = [];
    octree = null;
    octreeDirty = true;
    lastEntityCount = 0;
    /**
     * Extracts a world-space frustum from a combined view-projection matrix.
     * Uses standard OpenGL/WebGPU frustum extraction.
     */
    extractFrustumFromVP(m) {
        // Matrix is column-major; indices map as:
        // [ m00, m01, m02, m03,
        //   m10, m11, m12, m13,
        //   m20, m21, m22, m23,
        //   m30, m31, m32, m33 ]
        const planes = [];
        // Left: row3 + row0
        planes.push(this.normalizePlane({
            nx: (m[3] ?? 0) + (m[0] ?? 0),
            ny: (m[7] ?? 0) + (m[4] ?? 0),
            nz: (m[11] ?? 0) + (m[8] ?? 0),
            d: (m[15] ?? 0) + (m[12] ?? 0),
        }));
        // Right: row3 - row0
        planes.push(this.normalizePlane({
            nx: (m[3] ?? 0) - (m[0] ?? 0),
            ny: (m[7] ?? 0) - (m[4] ?? 0),
            nz: (m[11] ?? 0) - (m[8] ?? 0),
            d: (m[15] ?? 0) - (m[12] ?? 0),
        }));
        // Bottom: row3 + row1
        planes.push(this.normalizePlane({
            nx: (m[3] ?? 0) + (m[1] ?? 0),
            ny: (m[7] ?? 0) + (m[5] ?? 0),
            nz: (m[11] ?? 0) + (m[9] ?? 0),
            d: (m[15] ?? 0) + (m[13] ?? 0),
        }));
        // Top: row3 - row1
        planes.push(this.normalizePlane({
            nx: (m[3] ?? 0) - (m[1] ?? 0),
            ny: (m[7] ?? 0) - (m[5] ?? 0),
            nz: (m[11] ?? 0) - (m[9] ?? 0),
            d: (m[15] ?? 0) - (m[13] ?? 0),
        }));
        // Near: row3 + row2
        planes.push(this.normalizePlane({
            nx: (m[3] ?? 0) + (m[2] ?? 0),
            ny: (m[7] ?? 0) + (m[6] ?? 0),
            nz: (m[11] ?? 0) + (m[10] ?? 0),
            d: (m[15] ?? 0) + (m[14] ?? 0),
        }));
        // Far: row3 - row2
        planes.push(this.normalizePlane({
            nx: (m[3] ?? 0) - (m[2] ?? 0),
            ny: (m[7] ?? 0) - (m[6] ?? 0),
            nz: (m[11] ?? 0) - (m[10] ?? 0),
            d: (m[15] ?? 0) - (m[14] ?? 0),
        }));
        return { planes };
    }
    /**
     * Culls entities outside frustum.
     * Reuses internal array to avoid allocations.
     * Uses octree for broad-phase culling when available.
     * @returns Array of visible entities (reused, do not store reference)
     */
    cullEntities(entities, frustum) {
        this.reusableVisibleArray.length = 0; // Clear without deallocating
        // Rebuild octree if needed (entity count changed or marked dirty)
        if (this.octreeDirty ||
            !this.octree ||
            entities.length !== this.lastEntityCount) {
            this.rebuildOctree(entities);
        }
        // Broad-phase: Get potentially visible entities from octree
        const frustumBounds = this.getFrustumBounds(frustum);
        const candidates = this.octree
            ? this.octree.query(frustumBounds)
            : entities;
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
    cullEntitiesToArray(entities, frustum, outVisible) {
        outVisible.length = 0; // Clear without deallocating
        // Rebuild octree if needed
        if (this.octreeDirty ||
            !this.octree ||
            entities.length !== this.lastEntityCount) {
            this.rebuildOctree(entities);
        }
        // Broad-phase: Get potentially visible entities from octree
        const frustumBounds = this.getFrustumBounds(frustum);
        const candidates = this.octree
            ? this.octree.query(frustumBounds)
            : entities;
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
    markDirty() {
        this.octreeDirty = true;
    }
    /**
     * Rebuilds the octree from entity list.
     */
    rebuildOctree(entities) {
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
    calculateWorldBounds(entities) {
        if (entities.length === 0) {
            return {
                min: [-100, -100, -100],
                max: [100, 100, 100],
            };
        }
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
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
    getFrustumBounds(frustum) {
        // Calculate bounds from frustum planes intersection
        // This is a conservative estimate - could be tighter
        let minX = -Infinity, minY = -Infinity, minZ = -Infinity;
        let maxX = Infinity, maxY = Infinity, maxZ = Infinity;
        // For each plane, constrain the bounds
        for (const plane of frustum.planes) {
            const absNx = Math.abs(plane.nx);
            const absNy = Math.abs(plane.ny);
            const absNz = Math.abs(plane.nz);
            // Estimate constraint based on dominant axis
            if (absNx > absNy && absNx > absNz) {
                // X-dominant plane
                const x = -plane.d / plane.nx;
                if (plane.nx > 0)
                    minX = Math.max(minX, x);
                else
                    maxX = Math.min(maxX, x);
            }
            else if (absNy > absNz) {
                // Y-dominant plane
                const y = -plane.d / plane.ny;
                if (plane.ny > 0)
                    minY = Math.max(minY, y);
                else
                    maxY = Math.min(maxY, y);
            }
            else {
                // Z-dominant plane
                const z = -plane.d / plane.nz;
                if (plane.nz > 0)
                    minZ = Math.max(minZ, z);
                else
                    maxZ = Math.min(maxZ, z);
            }
        }
        // Clamp to reasonable bounds if infinite
        const maxBound = 1000;
        if (!Number.isFinite(minX))
            minX = -maxBound;
        if (!Number.isFinite(minY))
            minY = -maxBound;
        if (!Number.isFinite(minZ))
            minZ = -maxBound;
        if (!Number.isFinite(maxX))
            maxX = maxBound;
        if (!Number.isFinite(maxY))
            maxY = maxBound;
        if (!Number.isFinite(maxZ))
            maxZ = maxBound;
        return {
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ],
        };
    }
    /**
     * Computes axis-aligned bounding box for entity in world space.
     * Handles rotation by transforming all 8 corners of the local box.
     */
    getEntityAABB(entity) {
        const worldMatrix = entity.transform.getWorldMatrix();
        const s = entity.transform.scale;
        // 8 corners of unit cube scaled by entity scale
        const localCorners = [
            [-s[0] * 0.5, -s[1] * 0.5, -s[2] * 0.5],
            [s[0] * 0.5, -s[1] * 0.5, -s[2] * 0.5],
            [-s[0] * 0.5, s[1] * 0.5, -s[2] * 0.5],
            [s[0] * 0.5, s[1] * 0.5, -s[2] * 0.5],
            [-s[0] * 0.5, -s[1] * 0.5, s[2] * 0.5],
            [s[0] * 0.5, -s[1] * 0.5, s[2] * 0.5],
            [-s[0] * 0.5, s[1] * 0.5, s[2] * 0.5],
            [s[0] * 0.5, s[1] * 0.5, s[2] * 0.5],
        ];
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        // Transform each corner to world space and expand AABB
        for (const corner of localCorners) {
            const wx = (worldMatrix[0] ?? 0) * corner[0] +
                (worldMatrix[4] ?? 0) * corner[1] +
                (worldMatrix[8] ?? 0) * corner[2] +
                (worldMatrix[12] ?? 0);
            const wy = (worldMatrix[1] ?? 0) * corner[0] +
                (worldMatrix[5] ?? 0) * corner[1] +
                (worldMatrix[9] ?? 0) * corner[2] +
                (worldMatrix[13] ?? 0);
            const wz = (worldMatrix[2] ?? 0) * corner[0] +
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
    frustumIntersectsAABB(aabb, frustum) {
        // Cull if AABB is completely outside any plane
        for (const p of frustum.planes) {
            const px = p.nx >= 0 ? aabb.max[0] : aabb.min[0];
            const py = p.ny >= 0 ? aabb.max[1] : aabb.min[1];
            const pz = p.nz >= 0 ? aabb.max[2] : aabb.min[2];
            const dist = p.nx * px + p.ny * py + p.nz * pz + p.d;
            if (dist < 0)
                return false;
        }
        return true;
    }
    /**
     * Normalizes a frustum plane.
     */
    normalizePlane(plane) {
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
export function extractFrustumFromVP(m) {
    const culler = new FrustumCuller();
    return culler.extractFrustumFromVP(m);
}
export function cullEntities(entities, frustum, outVisible) {
    const culler = new FrustumCuller();
    return culler.cullEntitiesToArray(entities, frustum, outVisible);
}
//# sourceMappingURL=FrustumCuller.js.map