import { Component } from './Component';
/**
 * Terrain data type
 */
export type TerrainType = 'heightmap' | 'voxel' | 'hybrid';
/**
 * Heightmap terrain data
 */
export interface HeightmapTerrainData {
    resolution: number;
    size: number;
    heights: Float32Array;
    minHeight?: number;
    maxHeight?: number;
}
/**
 * Voxel terrain data (chunks)
 */
export interface VoxelTerrainData {
    chunkSize: number;
    chunks: Map<string, Uint8Array>;
}
/**
 * Texture layer for terrain splatting
 */
export interface TextureLayer {
    textureId: string;
    scale: number;
    blendFactor?: Float32Array;
}
/**
 * Terrain component data
 */
export interface TerrainData {
    type: TerrainType;
    heightmap?: HeightmapTerrainData;
    voxels?: VoxelTerrainData;
    textureLayers?: TextureLayer[];
    metadata?: {
        version: string;
        createdAt: number;
    };
}
/**
 * TerrainComponent - Stores terrain data (heightmap, voxels, or hybrid)
 */
export declare class TerrainComponent extends Component {
    static readonly type = "Terrain";
    terrainData: TerrainData;
    constructor(terrainData?: TerrainData);
    getType(): string;
    clone(): TerrainComponent;
    toJSON(): {
        type: TerrainType;
        heightmap?: HeightmapTerrainData;
        voxels?: {
            chunkSize: number;
            chunks: Array<[string, number[]]>;
        };
        textureLayers?: TextureLayer[];
        metadata?: {
            version: string;
            createdAt: number;
        };
    };
    fromJSON(data: {
        type?: TerrainType;
        heightmap?: HeightmapTerrainData;
        voxels?: {
            chunkSize: number;
            chunks: Array<[string, number[]]>;
        };
        textureLayers?: TextureLayer[];
        metadata?: {
            version: string;
            createdAt: number;
        };
    }): void;
}
//# sourceMappingURL=TerrainComponent.d.ts.map