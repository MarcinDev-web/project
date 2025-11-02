/**
 * TerrainMeshGenerator - Generates mesh data from heightmap terrain
 *
 * Creates vertices, indices, normals, and UVs for terrain rendering.
 */
import type { HeightmapTerrainData } from '@engine/world/components/TerrainComponent';
/**
 * Generated mesh data
 */
export interface TerrainMeshData {
    vertices: Float32Array;
    indices: Uint16Array;
    normals: Float32Array;
    uvs: Float32Array;
    vertexCount: number;
    indexCount: number;
}
/**
 * Options for mesh generation
 */
export interface TerrainMeshOptions {
    /** Level of detail (1 = full detail, 2 = half, 4 = quarter, etc.) */
    lod?: number;
    /** Generate normals (required for lighting) */
    generateNormals?: boolean;
    /** Generate UVs (required for texturing) */
    generateUVs?: boolean;
}
/**
 * TerrainMeshGenerator - Generates mesh from heightmap data
 */
export declare class TerrainMeshGenerator {
    /**
     * Generates mesh data from heightmap terrain
     */
    static generate(heightmapData: HeightmapTerrainData, options?: TerrainMeshOptions): TerrainMeshData;
    /**
     * Calculates normals from vertices and indices
     */
    private static calculateNormals;
    /**
     * Updates mesh data (for incremental updates during sculpting)
     * Only updates vertices and normals in specified region
     */
    static updateRegion(meshData: TerrainMeshData, heightmapData: HeightmapTerrainData, minX: number, maxX: number, minZ: number, maxZ: number, options?: TerrainMeshOptions): void;
}
//# sourceMappingURL=TerrainMeshGenerator.d.ts.map