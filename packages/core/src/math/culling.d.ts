import type { FrustumPlane } from './index';
/**
 * Batch culls a set of AABBs against a frustum using WASM.
 * This is significantly faster than checking each AABB individually in JS for large sets.
 *
 * @param planes - The 6 frustum planes.
 * @param aabbs - Float32Array containing AABBs as [minX, minY, minZ, maxX, maxY, maxZ, ...].
 * @returns Uint8Array where 1 means visible, 0 means culled.
 */
export declare function cullAABBBatch(planes: FrustumPlane[], aabbs: Float32Array): Uint8Array;
//# sourceMappingURL=culling.d.ts.map