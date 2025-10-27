/**
 * GPU Memory Tracker
 *
 * Tracks GPU memory allocations for buffers and textures.
 * Detects memory leaks and provides usage statistics.
 */

import { Logger } from '@engine/core/utils';

export interface MemoryAllocation {
  id: string;
  type: 'buffer' | 'texture';
  size: number; // bytes
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
export class GPUMemoryTracker {
  private allocations = new Map<string, MemoryAllocation>();
  private peakMemory = 0;
  private enabled = true;
  private leakDetectionThreshold = 1000; // Warn if > 1000 allocations
  private lastLeakCheck = 0;
  private leakCheckInterval = 5000; // Check every 5 seconds

  /**
   * Tracks a buffer allocation.
   */
  trackBuffer(buffer: GPUBuffer, label?: string): void {
    if (!this.enabled) return;

    const id = this.getResourceId(buffer);
    const size = (buffer as { size?: number }).size ?? 0;

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
  trackTexture(texture: GPUTexture, label?: string): void {
    if (!this.enabled) return;

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
  untrack(resource: GPUBuffer | GPUTexture): void {
    if (!this.enabled) return;

    const id = this.getResourceId(resource);
    this.allocations.delete(id);
  }

  /**
   * Gets current memory usage statistics.
   */
  getReport(): MemoryReport {
    let totalBufferMemory = 0;
    let totalTextureMemory = 0;
    let bufferCount = 0;
    let textureCount = 0;

    for (const alloc of this.allocations.values()) {
      if (alloc.type === 'buffer') {
        totalBufferMemory += alloc.size;
        bufferCount++;
      } else {
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
  getTotalMemory(): number {
    let total = 0;
    for (const alloc of this.allocations.values()) {
      total += alloc.size;
    }
    return total;
  }

  /**
   * Gets peak memory usage in bytes.
   */
  getPeakMemory(): number {
    return this.peakMemory;
  }

  /**
   * Formats memory size as human-readable string.
   */
  formatMemorySize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Logs a memory report to console.
   */
  logReport(): void {
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
  exportJSON(): string {
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
  resetPeak(): void {
    this.peakMemory = this.getTotalMemory();
  }

  /**
   * Clears all tracked allocations (use when device is lost/reset).
   */
  clear(): void {
    this.allocations.clear();
    this.peakMemory = 0;
  }

  /**
   * Enables or disables tracking.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Checks if tracking is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Sets the threshold for leak detection warnings.
   */
  setLeakDetectionThreshold(count: number): void {
    this.leakDetectionThreshold = count;
  }

  /**
   * Checks for potential memory leaks.
   */
  private checkForLeaks(): void {
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
  private getResourceId(resource: GPUBuffer | GPUTexture): string {
    // Use WeakMap or object identity as fallback
    // Note: WebGPU resources don't have stable IDs, so we use object identity
    return (resource as { __uid?: string }).__uid ?? String(Math.random());
  }

  /**
   * Estimates texture memory size based on dimensions and format.
   */
  private estimateTextureSize(texture: GPUTexture): number {
    // This is a best-effort estimation
    // Actual implementation would need to parse texture descriptor
    const width = (texture as { width?: number }).width ?? 1;
    const height = (texture as { height?: number }).height ?? 1;
    const depthOrArrayLayers = (texture as { depthOrArrayLayers?: number }).depthOrArrayLayers ?? 1;
    const mipLevelCount = (texture as { mipLevelCount?: number }).mipLevelCount ?? 1;
    const format = (texture as { format?: string }).format ?? 'rgba8unorm';

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
  private getBytesPerPixel(format: string): number {
    // Simplified lookup - extend as needed
    const formatSizes: Record<string, number> = {
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

