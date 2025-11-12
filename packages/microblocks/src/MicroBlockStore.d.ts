/**
 * MicroBlockStore - Sparse chunk-based storage for micro blocks
 *
 * Stores micro blocks in chunks (16×16×16 blocks per chunk) for efficient
 * spatial queries and incremental mesh updates.
 */
import type { Vec3 } from '@engine/core/math';
import type { MicroBlock, MicroBlockChunk, ChunkCoord, LocalPos, MicroBlockStoreData } from './types';
/**
 * Micro block size: 1/8 of standard block (0.125 units)
 */
export declare const MICRO_BLOCK_SIZE = 0.125;
/**
 * Default chunk size: 16×16×16 micro blocks per chunk
 */
export declare const DEFAULT_CHUNK_SIZE = 16;
/**
 * Stores micro blocks in a sparse chunk-based structure
 */
export declare class MicroBlockStore {
    /** Block size in world units */
    readonly blockSize: number;
    /** Chunk size (blocks per axis) */
    private readonly _chunkSize;
    /** Sparse chunk storage: chunkKey -> chunk */
    private readonly chunks;
    /** Disposable group for cleanup */
    private readonly disposables;
    constructor(chunkSize?: number);
    get chunkSize(): number;
    /**
     * Converts world position to chunk coordinate
     */
    worldToChunk(worldPos: Vec3): ChunkCoord;
    /**
     * Converts world position to local position within chunk
     */
    worldToLocal(worldPos: Vec3): {
        chunk: ChunkCoord;
        local: LocalPos;
    };
    /**
     * Generates a string key for a chunk coordinate
     */
    private chunkKey;
    /**
     * Converts local position to flat index within chunk
     */
    private localToIndex;
    /**
     * Gets or creates a chunk
     */
    private getOrCreateChunk;
    /**
     * Gets a chunk by coordinate (returns undefined if doesn't exist)
     */
    getChunk(coord: ChunkCoord): MicroBlockChunk | undefined;
    /**
     * Gets all chunks
     */
    getAllChunks(): MicroBlockChunk[];
    /**
     * Gets a block at world position
     */
    getBlock(worldPos: Vec3): MicroBlock | null;
    /**
     * Sets a block at world position (null to remove)
     */
    setBlock(worldPos: Vec3, block: MicroBlock | null): void;
    /**
     * Marks chunk as dirty
     */
    markChunkDirty(coord: ChunkCoord): void;
    /**
     * Clears dirty flag for a chunk
     */
    clearChunkDirty(coord: ChunkCoord): void;
    /**
     * Gets all dirty chunks
     */
    getDirtyChunks(): MicroBlockChunk[];
    /**
     * Serializes store to JSON-compatible format
     */
    toJSON(): MicroBlockStoreData;
    /**
     * Deserializes store from JSON-compatible format
     */
    fromJSON(data: MicroBlockStoreData): void;
    /**
     * Clears all blocks
     */
    clear(): void;
    /**
     * Gets total number of blocks
     */
    getBlockCount(): number;
    /**
     * Gets total number of chunks
     */
    getChunkCount(): number;
    /**
     * Disposes all resources
     */
    dispose(): void;
}
//# sourceMappingURL=MicroBlockStore.d.ts.map