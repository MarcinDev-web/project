import { cull_aabb_batch } from '@engine/wasm-render-logic';
import type { FrustumPlane } from './index';

/**
 * Batch culls a set of AABBs against a frustum using WASM.
 * This is significantly faster than checking each AABB individually in JS for large sets.
 * 
 * @param planes - The 6 frustum planes.
 * @param aabbs - Float32Array containing AABBs as [minX, minY, minZ, maxX, maxY, maxZ, ...].
 * @returns Uint8Array where 1 means visible, 0 means culled.
 */
export function cullAABBBatch(planes: FrustumPlane[], aabbs: Float32Array): Uint8Array {
    // Flatten planes into Float32Array [nx, ny, nz, d, ...]
    // We use a static buffer to avoid allocation if possible, but for now we'll alloc
    // (Optimization: pass a reused buffer)
    const planeData = new Float32Array(24);
    for (let i = 0; i < 6; i++) {
        const p = planes[i];
        if (p) {
            planeData[i * 4] = p.normal[0];
            planeData[i * 4 + 1] = p.normal[1];
            planeData[i * 4 + 2] = p.normal[2];
            planeData[i * 4 + 3] = p.d;
        }
    }

    return cull_aabb_batch(planeData, aabbs);
}

