/**
 * GPU Memory Tracker
 *
 * Tracks GPU memory allocations for buffers and textures.
 * Detects memory leaks and provides usage statistics.
 */
export interface MemoryAllocation {
    id: string;
    type: 'buffer' | 'texture';
    size: number;
    label?: string;
    timestamp: number;
}
export interface MemoryReport {
    totalBufferMemory: number;
    totalTextureMemory: number;
    totalMemory: number;
    peakMemory: number;
    allocationCount: number;
    bufferCount: number;
    textureCount: number;
    allocations: MemoryAllocation[];
}
/**
 * GPUMemoryTracker monitors GPU resource allocations.
 */
export declare class GPUMemoryTracker {
    private allocations;
    private peakMemory;
    private enabled;
    private leakDetectionThreshold;
    private lastLeakCheck;
    private leakCheckInterval;
    /**
     * Tracks a buffer allocation.
     */
    trackBuffer(buffer: GPUBuffer, label?: string): void;
    /**
     * Tracks a texture allocation.
     */
    trackTexture(texture: GPUTexture, label?: string): void;
    /**
     * Removes a tracked allocation (when resource is destroyed).
     */
    untrack(resource: GPUBuffer | GPUTexture): void;
    /**
     * Gets current memory usage statistics.
     */
    getReport(): MemoryReport;
    /**
     * Gets total memory usage in bytes.
     */
    getTotalMemory(): number;
    /**
     * Gets peak memory usage in bytes.
     */
    getPeakMemory(): number;
    /**
     * Formats memory size as human-readable string.
     */
    formatMemorySize(bytes: number): string;
    /**
     * Logs a memory report to console.
     */
    logReport(): void;
    /**
     * Exports memory report as JSON.
     */
    exportJSON(): string;
    /**
     * Resets peak memory tracking.
     */
    resetPeak(): void;
    /**
     * Clears all tracked allocations (use when device is lost/reset).
     */
    clear(): void;
    /**
     * Enables or disables tracking.
     */
    setEnabled(enabled: boolean): void;
    /**
     * Checks if tracking is enabled.
     */
    isEnabled(): boolean;
    /**
     * Sets the threshold for leak detection warnings.
     */
    setLeakDetectionThreshold(count: number): void;
    /**
     * Checks for potential memory leaks.
     */
    private checkForLeaks;
    /**
     * Gets a unique ID for a GPU resource.
     */
    private getResourceId;
    /**
     * Estimates texture memory size based on dimensions and format.
     */
    private estimateTextureSize;
    /**
     * Gets bytes per pixel for common texture formats.
     */
    private getBytesPerPixel;
}
//# sourceMappingURL=GPUMemoryTracker.d.ts.map