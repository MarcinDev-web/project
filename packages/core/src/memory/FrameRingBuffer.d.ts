/**
 * Frame Ring Buffer
 *
 * Per-frame allocator for uniform buffers and storage buffers.
 * Reuses memory across frames to avoid allocations in hot paths.
 */
/**
 * Frame ring buffer for per-frame allocations.
 *
 * Uses a ring buffer pattern to recycle memory across frames.
 * Each frame gets its own allocation that's reused after N frames.
 */
export declare class FrameRingBuffer {
    private device;
    private buffers;
    private bufferSizes;
    private frameCount;
    private readonly ringSize;
    /**
     * @param device - GPU device
     * @param ringSize - Number of frames to keep in the ring (default 3 for triple buffering)
     */
    constructor(device: GPUDevice, ringSize?: number);
    /**
     * Gets or creates a buffer for the current frame.
     *
     * @param size - Required buffer size in bytes
     * @param usage - Buffer usage flags
     * @returns Buffer for current frame
     */
    getBuffer(size: number, usage: GPUBufferUsageFlags): GPUBuffer;
    /**
     * Advances to the next frame.
     * Should be called once per frame.
     */
    advanceFrame(): void;
    /**
     * Gets the current frame index.
     */
    getCurrentFrameIndex(): number;
    /**
     * Disposes all buffers.
     */
    dispose(): void;
}
//# sourceMappingURL=FrameRingBuffer.d.ts.map