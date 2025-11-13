import type { CustomMeshData } from '@engine/world';
/**
 * Options for generating a capsule mesh
 */
export interface CapsuleOptions {
    /** Radius of the capsule hemispheres and cylinder (default: 0.5) */
    radius?: number;
    /** Height of the cylinder section (default: 1.0) */
    cylinderHeight?: number;
    /** Number of radial segments around the capsule (default: 16) */
    radialSegments?: number;
    /** Number of segments for each hemisphere (default: 8) */
    hemisphereSegments?: number;
    /** If true, reverses normals to face inward (default: false) */
    insideOut?: boolean;
}
/**
 * Generates a unit capsule aligned on Y axis (centered at origin).
 * Total height = cylinderHeight + 2*radius. Defaults: radius=0.5, cylinderHeight=1.
 * Returned mesh uses interleaved format [x,y,z, nx,ny,nz, u,v] and triangle indices.
 * 
 * UV coordinates: U ranges [0, 1) creating a seam along the length.
 * This mesh requires addressModeU = 'repeat' for correct texture wrapping (seam disappears).
 * 
 * @param options - Optional geometry parameters (uses defaults if not provided)
 * @returns CustomMeshData with vertices, normals, and indices
 */
export declare function generateCapsuleY(options?: CapsuleOptions): CustomMeshData;
//# sourceMappingURL=capsule-geometry.d.ts.map