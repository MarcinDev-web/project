/**
 * Voxel data store - chunk-based storage for voxel world
 */
import type { VoxelPos, ChunkPos } from './VoxelPosition.js';
import type { BlockType, BlockMetadata } from './VoxelOperations.js';
/**
 * Single voxel data
 */
export interface VoxelData {
    blockType: BlockType;
    metadata?: BlockMetadata;
}
/**
 * Chunk data - stores voxels in a 3D grid within a chunk
 */
export interface ChunkData {
    position: ChunkPos;
    size: number;
    /** Linear array: data[x + y * size + z * size * size] */
    data: (VoxelData | null)[];
    /** Last modified timestamp */
    modifiedAt: number;
}
/**
 * Chunk-based voxel store
 */
export declare class VoxelStore {
    private readonly chunks;
    private readonly chunkSize;
    constructor(chunkSize?: number);
    /**
     * Get or create chunk for position
     */
    private getOrCreateChunk;
    /**
     * Get chunk if exists
     */
    private getChunk;
    /**
     * Get local index within chunk
     */
    private getLocalIndex;
    /**
     * Get voxel at position
     */
    getVoxel(pos: VoxelPos): VoxelData | null;
    /**
     * Set voxel at position
     */
    setVoxel(pos: VoxelPos, data: VoxelData | null): void;
    /**
     * Get all modified chunks since timestamp
     */
    getModifiedChunks(since: number): ChunkData[];
    /**
     * Get all chunks
     */
    getAllChunks(): ChunkData[];
    /**
     * Get chunk count
     */
    getChunkCount(): number;
    /**
     * Clear all chunks
     */
    clear(): void;
    /**
     * Dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=VoxelStore.d.ts.map