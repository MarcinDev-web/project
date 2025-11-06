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
export class FrameRingBuffer {
  private device: GPUDevice;
  private buffers: GPUBuffer[] = [];
  private bufferSizes: number[] = [];
  private frameCount = 0;
  private readonly ringSize: number;

  /**
   * @param device - GPU device
   * @param ringSize - Number of frames to keep in the ring (default 3 for triple buffering)
   */
  constructor(device: GPUDevice, ringSize = 3) {
    this.device = device;
    this.ringSize = ringSize;
  }

  /**
   * Gets or creates a buffer for the current frame.
   *
   * @param size - Required buffer size in bytes
   * @param usage - Buffer usage flags
   * @returns Buffer for current frame
   */
  getBuffer(size: number, usage: GPUBufferUsageFlags): GPUBuffer {
    const frameIndex = this.frameCount % this.ringSize;

    // Ensure ring has enough buffers
    while (this.buffers.length <= frameIndex) {
      this.buffers.push(null as unknown as GPUBuffer);
      this.bufferSizes.push(0);
    }

    const existing = this.buffers[frameIndex];
    const existingSize = this.bufferSizes[frameIndex]!;

    // Reuse if size is sufficient
    if (existing && existingSize >= size) {
      return existing;
    }

    // Destroy old buffer if it exists
    if (existing) {
      existing.destroy();
    }

    // Create new buffer
    const buffer = this.device.createBuffer({
      label: `frame-ring-buffer-${frameIndex}`,
      size,
      usage,
      mappedAtCreation: false,
    });

    this.buffers[frameIndex] = buffer;
    this.bufferSizes[frameIndex] = size;

    return buffer;
  }

  /**
   * Advances to the next frame.
   * Should be called once per frame.
   */
  advanceFrame(): void {
    this.frameCount++;
  }

  /**
   * Gets the current frame index.
   */
  getCurrentFrameIndex(): number {
    return this.frameCount % this.ringSize;
  }

  /**
   * Disposes all buffers.
   */
  dispose(): void {
    for (const buffer of this.buffers) {
      if (buffer) {
        buffer.destroy();
      }
    }
    this.buffers = [];
    this.bufferSizes = [];
    this.frameCount = 0;
  }
}
