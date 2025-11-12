import type { CustomMeshData } from '@engine/world';
/**
 * Generates a unit capsule aligned on Y axis (centered at origin).
 * Total height = cylinderHeight + 2*radius. Defaults: radius=0.5, cylinderHeight=1.
 * Returned mesh uses interleaved format [x,y,z, nx,ny,nz, u,v] and triangle indices.
 */
export declare function generateCapsuleY(radius?: number, cylinderHeight?: number, radialSegments?: number, hemisphereSegments?: number): CustomMeshData;
//# sourceMappingURL=capsule-geometry.d.ts.map