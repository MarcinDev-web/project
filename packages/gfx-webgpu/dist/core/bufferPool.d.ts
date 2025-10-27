export interface BufferRecord {
    buffer: GPUBuffer;
    capacity: number;
    usage: GPUBufferUsageFlags;
    lastUsed: number;
    label?: string;
}
/**
 * Enhanced GPU Buffer Pool with size-based buckets and LRU eviction.
 *
 * Features:
 * - Size-based buckets for efficient reuse
 * - LRU eviction policy to manage memory
 * - Automatic cleanup of unused buffers
 * - Memory tracking and statistics
 */
export declare class GPUBufferPool {
    private readonly device;
    private readonly buffers;
    private readonly sizeBuckets;
    private maxPoolSize;
    private maxAge;
    private lastCleanup;
    private cleanupInterval;
    constructor(device: GPUDevice, options?: {
        maxPoolSize?: number;
        maxAge?: number;
        cleanupInterval?: number;
    });
    /**
     * Gets or creates a buffer with specified size and usage.
     * Returns existing buffer if compatible, otherwise creates new one.
     */
    getOrCreate(name: string, size: number, usage: GPUBufferUsageFlags, label?: string): GPUBuffer;
    /**
     * Gets a buffer by name (if it exists).
     */
    get(name: string): GPUBuffer | null;
    /**
     * Releases a buffer back to the pool for reuse.
     * Buffer can be reused for other allocations with compatible size/usage.
     */
    release(name: string): void;
    /**
     * Destroys a specific buffer and removes it from the pool.
     */
    destroy(name: string): void;
    /**
     * Disposes all buffers in the pool.
     */
    disposeAll(): void;
    /**
     * Gets pool statistics for monitoring.
     */
    getStats(): {
        activeBuffers: number;
        pooledBuffers: number;
        totalBuffers: number;
        totalMemory: number;
        bucketCount: number;
    };
    /**
     * Performs manual cleanup of old unused buffers.
     */
    cleanup(): void;
    /**
     * Finds a compatible buffer in size buckets.
     */
    private findInBucket;
    /**
     * Adds a buffer to the appropriate size bucket for reuse.
     */
    private addToBucket;
    /**
     * Enforces the maximum pool size by evicting least recently used buffers.
     */
    private enforceSizeLimit;
    /**
     * Removes a buffer from its size bucket.
     */
    private removeFromBucket;
    /**
     * Safely destroys a buffer.
     */
    private destroyBuffer;
    /**
     * Performs periodic cleanup if needed.
     */
    private maybeCleanup;
    /**
     * Gets current timestamp.
     */
    private now;
}
//# sourceMappingURL=bufferPool.d.ts.map