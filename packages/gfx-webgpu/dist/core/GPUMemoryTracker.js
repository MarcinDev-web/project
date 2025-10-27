/**
 * GPU Memory Tracker
 *
 * Tracks GPU memory allocations for buffers and textures.
 * Detects memory leaks and provides usage statistics.
 */
import { Logger } from '@engine/core/utils';
/**
 * GPUMemoryTracker monitors GPU resource allocations.
 */
export class GPUMemoryTracker {
    allocations = new Map();
    peakMemory = 0;
    enabled = true;
    leakDetectionThreshold = 1000; // Warn if > 1000 allocations
    lastLeakCheck = 0;
    leakCheckInterval = 5000; // Check every 5 seconds
    /**
     * Tracks a buffer allocation.
     */
    trackBuffer(buffer, label) {
        if (!this.enabled)
            return;
        const id = this.getResourceId(buffer);
        const size = buffer.size ?? 0;
        this.allocations.set(id, {
            id,
            type: 'buffer',
            size,
            label,
            timestamp: Date.now(),
        });
        this.checkForLeaks();
    }
    /**
     * Tracks a texture allocation.
     */
    trackTexture(texture, label) {
        if (!this.enabled)
            return;
        const id = this.getResourceId(texture);
        const size = this.estimateTextureSize(texture);
        this.allocations.set(id, {
            id,
            type: 'texture',
            size,
            label,
            timestamp: Date.now(),
        });
        this.checkForLeaks();
    }
    /**
     * Removes a tracked allocation (when resource is destroyed).
     */
    untrack(resource) {
        if (!this.enabled)
            return;
        const id = this.getResourceId(resource);
        this.allocations.delete(id);
    }
    /**
     * Gets current memory usage statistics.
     */
    getReport() {
        let totalBufferMemory = 0;
        let totalTextureMemory = 0;
        let bufferCount = 0;
        let textureCount = 0;
        for (const alloc of this.allocations.values()) {
            if (alloc.type === 'buffer') {
                totalBufferMemory += alloc.size;
                bufferCount++;
            }
            else {
                totalTextureMemory += alloc.size;
                textureCount++;
            }
        }
        const totalMemory = totalBufferMemory + totalTextureMemory;
        if (totalMemory > this.peakMemory) {
            this.peakMemory = totalMemory;
        }
        return {
            totalBufferMemory,
            totalTextureMemory,
            totalMemory,
            peakMemory: this.peakMemory,
            allocationCount: this.allocations.size,
            bufferCount,
            textureCount,
            allocations: Array.from(this.allocations.values()),
        };
    }
    /**
     * Gets total memory usage in bytes.
     */
    getTotalMemory() {
        let total = 0;
        for (const alloc of this.allocations.values()) {
            total += alloc.size;
        }
        return total;
    }
    /**
     * Gets peak memory usage in bytes.
     */
    getPeakMemory() {
        return this.peakMemory;
    }
    /**
     * Formats memory size as human-readable string.
     */
    formatMemorySize(bytes) {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(2)} KB`;
        if (bytes < 1024 * 1024 * 1024)
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    /**
     * Logs a memory report to console.
     */
    logReport() {
        const report = this.getReport();
        Logger.info('GPU Memory Report:', {
            totalMemory: this.formatMemorySize(report.totalMemory),
            bufferMemory: this.formatMemorySize(report.totalBufferMemory),
            textureMemory: this.formatMemorySize(report.totalTextureMemory),
            peakMemory: this.formatMemorySize(report.peakMemory),
            allocations: report.allocationCount,
            buffers: report.bufferCount,
            textures: report.textureCount,
        });
    }
    /**
     * Exports memory report as JSON.
     */
    exportJSON() {
        const report = this.getReport();
        return JSON.stringify({
            timestamp: Date.now(),
            summary: {
                totalMemory: this.formatMemorySize(report.totalMemory),
                totalMemoryBytes: report.totalMemory,
                peakMemory: this.formatMemorySize(report.peakMemory),
                peakMemoryBytes: report.peakMemory,
                allocationCount: report.allocationCount,
            },
            breakdown: {
                buffers: {
                    count: report.bufferCount,
                    memory: this.formatMemorySize(report.totalBufferMemory),
                    memoryBytes: report.totalBufferMemory,
                },
                textures: {
                    count: report.textureCount,
                    memory: this.formatMemorySize(report.totalTextureMemory),
                    memoryBytes: report.totalTextureMemory,
                },
            },
            allocations: report.allocations.map((alloc) => ({
                id: alloc.id,
                type: alloc.type,
                size: this.formatMemorySize(alloc.size),
                sizeBytes: alloc.size,
                label: alloc.label ?? 'unlabeled',
                age: Date.now() - alloc.timestamp,
            })),
        }, null, 2);
    }
    /**
     * Resets peak memory tracking.
     */
    resetPeak() {
        this.peakMemory = this.getTotalMemory();
    }
    /**
     * Clears all tracked allocations (use when device is lost/reset).
     */
    clear() {
        this.allocations.clear();
        this.peakMemory = 0;
    }
    /**
     * Enables or disables tracking.
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    /**
     * Checks if tracking is enabled.
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Sets the threshold for leak detection warnings.
     */
    setLeakDetectionThreshold(count) {
        this.leakDetectionThreshold = count;
    }
    /**
     * Checks for potential memory leaks.
     */
    checkForLeaks() {
        const now = Date.now();
        if (now - this.lastLeakCheck < this.leakCheckInterval) {
            return;
        }
        this.lastLeakCheck = now;
        if (this.allocations.size > this.leakDetectionThreshold) {
            Logger.warn('Potential memory leak detected:', {
                allocationCount: this.allocations.size,
                threshold: this.leakDetectionThreshold,
                totalMemory: this.formatMemorySize(this.getTotalMemory()),
            });
        }
    }
    /**
     * Gets a unique ID for a GPU resource.
     */
    getResourceId(resource) {
        // Use WeakMap or object identity as fallback
        // Note: WebGPU resources don't have stable IDs, so we use object identity
        return resource.__uid ?? String(Math.random());
    }
    /**
     * Estimates texture memory size based on dimensions and format.
     */
    estimateTextureSize(texture) {
        // This is a best-effort estimation
        // Actual implementation would need to parse texture descriptor
        const width = texture.width ?? 1;
        const height = texture.height ?? 1;
        const depthOrArrayLayers = texture.depthOrArrayLayers ?? 1;
        const mipLevelCount = texture.mipLevelCount ?? 1;
        const format = texture.format ?? 'rgba8unorm';
        // Simplified format size estimation (bytes per pixel)
        const bytesPerPixel = this.getBytesPerPixel(format);
        // Calculate base level size
        let totalSize = width * height * depthOrArrayLayers * bytesPerPixel;
        // Add mip levels (each level is ~1/4 the size of previous)
        if (mipLevelCount > 1) {
            let mipSize = totalSize;
            for (let i = 1; i < mipLevelCount; i++) {
                mipSize /= 4;
                totalSize += mipSize;
            }
        }
        return Math.ceil(totalSize);
    }
    /**
     * Gets bytes per pixel for common texture formats.
     */
    getBytesPerPixel(format) {
        // Simplified lookup - extend as needed
        const formatSizes = {
            'rgba8unorm': 4,
            'rgba8unorm-srgb': 4,
            'bgra8unorm': 4,
            'bgra8unorm-srgb': 4,
            'rgba16float': 8,
            'rgba32float': 16,
            'depth24plus': 4,
            'depth32float': 4,
            'r8unorm': 1,
            'rg8unorm': 2,
            'r16float': 2,
            'rg16float': 4,
        };
        return formatSizes[format] ?? 4; // Default to 4 bytes if unknown
    }
}
//# sourceMappingURL=GPUMemoryTracker.js.map