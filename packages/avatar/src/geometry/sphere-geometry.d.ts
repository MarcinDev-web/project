import type { CustomMeshData } from '@engine/world';
/**
 * Generates a sphere mesh with UV sphere topology.
 *
 * The sphere is generated procedurally with configurable segments for smoothness.
 * This creates proper normals and UV coordinates for texturing.
 *
 * @param segments - Number of horizontal and vertical segments (default: 16)
 * @returns CustomMeshData with vertices, normals, and indices
 */
export declare function generateSphereMesh(segments?: number): CustomMeshData;
//# sourceMappingURL=sphere-geometry.d.ts.map