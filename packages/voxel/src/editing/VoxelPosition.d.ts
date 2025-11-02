/**
 * Voxel coordinate and position utilities
 */
export interface VoxelPos {
    x: number;
    y: number;
    z: number;
}
export interface ChunkPos {
    x: number;
    y: number;
    z: number;
}
/**
 * Convert world position to chunk coordinates
 */
export declare function worldToChunk(worldPos: VoxelPos, chunkSize: number): ChunkPos;
/**
 * Convert chunk coordinates to world position (chunk origin)
 */
export declare function chunkToWorld(chunkPos: ChunkPos, chunkSize: number): VoxelPos;
/**
 * Get local position within chunk
 */
export declare function getLocalPos(worldPos: VoxelPos, chunkPos: ChunkPos, chunkSize: number): VoxelPos;
/**
 * Hash chunk position for use as Map key
 */
export declare function hashChunkPos(pos: ChunkPos): string;
//# sourceMappingURL=VoxelPosition.d.ts.map