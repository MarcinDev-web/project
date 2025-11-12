/**
 * MicroBlockMesher - Generates mesh geometry from micro block chunks
 *
 * Uses greedy meshing algorithm to merge adjacent faces with the same material,
 * significantly reducing vertex count for better performance.
 */
import type { CustomMeshData } from '@engine/world';
import type { MicroBlockChunk } from './types';
/**
 * Generates mesh geometry for micro block chunks using greedy meshing
 */
export declare class MicroBlockMesher {
    private readonly blockSize;
    private readonly chunkSize;
    private readonly disposables;
    constructor(blockSize?: number, chunkSize?: number);
    /**
     * Generates mesh data for a chunk
     */
    generateMesh(chunk: MicroBlockChunk): CustomMeshData;
    /**
     * Generates faces for a specific direction using greedy meshing
     */
    private generateFacesForDirection;
    /**
     * Generates vertices for a single face
     */
    private generateFaceVertices;
    /**
     * Converts local position to flat index
     */
    private localToIndex;
    /**
     * Disposes resources
     */
    dispose(): void;
}
//# sourceMappingURL=MicroBlockMesher.d.ts.map