/**
 * Frustum Culling System
 *
 * Extracts frustum planes from view-projection matrix and performs
 * efficient visibility tests against entity bounding boxes.
 *
 * Performance: Culls objects outside camera view to reduce draw calls.
 */
import type { Mat4 } from '@engine/core/math';
import type { Entity } from '@engine/world';
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
export declare class FrustumCuller {
    private reusableVisibleArray;
    /**
     * Extracts a world-space frustum from a combined view-projection matrix.
     * Uses standard OpenGL/WebGPU frustum extraction.
     */
    extractFrustumFromVP(m: Mat4): Frustum;
    /**
     * Culls entities outside frustum.
     * Reuses internal array to avoid allocations.
     * @returns Array of visible entities (reused, do not store reference)
     */
    cullEntities(entities: Entity[], frustum: Frustum): Entity[];
    /**
     * Culls entities and writes results to provided output array (avoids internal state).
     */
    cullEntitiesToArray(entities: Entity[], frustum: Frustum, outVisible: Entity[]): Entity[];
    /**
     * Computes axis-aligned bounding box for entity in world space.
     * Handles rotation by transforming all 8 corners of the local box.
     */
    private getEntityAABB;
    /**
     * Tests if an AABB intersects the frustum.
     * Returns false if AABB is completely outside any plane.
     */
    private frustumIntersectsAABB;
    /**
     * Normalizes a frustum plane.
     */
    private normalizePlane;
}
export declare function extractFrustumFromVP(m: Mat4): Frustum;
export declare function cullEntities(entities: Entity[], frustum: Frustum, outVisible: Entity[]): Entity[];
//# sourceMappingURL=FrustumCuller.d.ts.map