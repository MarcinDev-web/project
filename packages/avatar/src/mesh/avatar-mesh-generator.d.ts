import type { CustomMeshData } from '@engine/world';
export interface AvatarMeshGeneratorOptions {
    sphereSegments?: number;
}
/**
 * Generates procedural meshes for avatar parts.
 * Handles 'avatar_torso' and 'sphere' mesh types.
 */
export declare class AvatarMeshGenerator {
    private readonly sphereSegments;
    constructor(options?: AvatarMeshGeneratorOptions);
    /**
     * Generate mesh data for a procedural mesh type.
     *
     * @param meshType - Type of mesh to generate ('avatar_torso' | 'sphere' | 'capsule_y')
     * @param partId - ID of the part (for error messages)
     * @returns Mesh data or null if the mesh type is not procedural or generation failed
     */
    generateMesh(meshType: string, partId: string): CustomMeshData | null;
    private generateTorsoMesh;
    private generateSphereMesh;
    private generateCapsuleY;
}
//# sourceMappingURL=avatar-mesh-generator.d.ts.map