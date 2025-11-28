/**
 * AsyncTextureQueue - Background texture generation with priority queue
 * 
 * Enables non-blocking procedural texture generation by:
 * - Queuing texture generation requests with priorities
 * - Processing requests in background compute passes
 * - Supporting callbacks for completion notification
 * - Batching multiple requests for efficiency
 * 
 * @module gfx-webgpu/textures
 */

import { Logger } from '@engine/core/utils';
import type { BlockFaceTexture } from '@engine/blocks';

/**
 * Priority levels for texture generation requests
 */
export enum TexturePriority {
  /** Critical - needed immediately for visible content */
  CRITICAL = 0,
  /** High - needed soon, within a few frames */
  HIGH = 1,
  /** Normal - standard priority for preloading */
  NORMAL = 2,
  /** Low - background preloading, can wait */
  LOW = 3,
  /** Idle - process only when GPU is idle */
  IDLE = 4,
}

/**
 * Request for async texture generation
 */
export interface TextureRequest {
  /** Unique identifier for this request */
  id: string;
  /** Texture face configuration */
  face: BlockFaceTexture;
  /** Priority level */
  priority: TexturePriority;
  /** Optional seed for procedural generation */
  seed?: number;
  /** Timestamp when request was created */
  createdAt: number;
  /** Callback when texture is ready */
  onComplete?: (result: TextureResult) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Result of texture generation
 */
export interface TextureResult {
  /** Request ID */
  id: string;
  /** Generated image data */
  imageData: ImageData;
  /** Time taken to generate (ms) */
  generationTimeMs: number;
  /** Whether GPU was used */
  usedGPU: boolean;
}

/**
 * Batch of texture requests being processed
 */
interface ProcessingBatch {
  /** Requests in this batch */
  requests: TextureRequest[];
  /** Start timestamp */
  startTime: number;
  /** Promise for batch completion */
  promise: Promise<void>;
}

/**
 * Configuration for AsyncTextureQueue
 */
export interface AsyncTextureQueueOptions {
  /** Maximum concurrent requests (default: 4) */
  maxConcurrent?: number;
  /** Maximum batch size for single dispatch (default: 8) */
  maxBatchSize?: number;
  /** Timeout for individual requests in ms (default: 5000) */
  requestTimeoutMs?: number;
  /** Whether to use GPU compute (default: true) */
  useGPU?: boolean;
}

/**
 * Statistics about queue processing
 */
export interface QueueStats {
  /** Total requests processed */
  totalProcessed: number;
  /** Total requests failed */
  totalFailed: number;
  /** Currently pending requests */
  pendingCount: number;
  /** Currently processing count */
  processingCount: number;
  /** Average generation time (ms) */
  averageTimeMs: number;
  /** GPU utilization ratio */
  gpuUtilization: number;
}

/** Default configuration values */
const DEFAULT_MAX_CONCURRENT = 4;
const DEFAULT_MAX_BATCH_SIZE = 8;
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Async texture generation queue with priority scheduling.
 * 
 * Usage:
 * ```typescript
 * const queue = new AsyncTextureQueue(device, generator);
 * 
 * // Queue a high-priority texture
 * queue.enqueue({
 *   id: 'grass-side',
 *   face: { type: 'grass', side: 'side' },
 *   priority: TexturePriority.HIGH,
 *   onComplete: (result) => {
 *     atlas.updateTexture(result.id, result.imageData);
 *   }
 * });
 * 
 * // Process queue each frame
 * queue.processQueue();
 * ```
 */
export class AsyncTextureQueue {
  private readonly device: GPUDevice;
  private readonly maxConcurrent: number;
  private readonly maxBatchSize: number;
  private readonly requestTimeoutMs: number;
  private readonly useGPU: boolean;

  // Request queues by priority
  private readonly queues: Map<TexturePriority, TextureRequest[]> = new Map();
  
  // Currently processing batches
  private readonly processing: Map<string, ProcessingBatch> = new Map();
  
  // Completed results awaiting callback
  private readonly completed: Map<string, TextureResult> = new Map();
  
  // Statistics tracking
  private stats: QueueStats = {
    totalProcessed: 0,
    totalFailed: 0,
    pendingCount: 0,
    processingCount: 0,
    averageTimeMs: 0,
    gpuUtilization: 0,
  };
  private timeSamples: number[] = [];
  private gpuUsageCount = 0;
  
  private disposed = false;

  // Optional generator reference (can be set later)
  private generator: {
    generateTexture(face: BlockFaceTexture, seed?: number): Promise<ImageData | null>;
    generateTextureGPU?(face: BlockFaceTexture, seed?: number): Promise<ImageData | null>;
  } | null = null;

  constructor(device: GPUDevice, options: AsyncTextureQueueOptions = {}) {
    this.device = device;
    this.maxConcurrent = options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.useGPU = options.useGPU ?? true;

    // Initialize priority queues
    for (const priority of Object.values(TexturePriority)) {
      if (typeof priority === 'number') {
        this.queues.set(priority, []);
      }
    }

    Logger.debug(`[AsyncTextureQueue] Created (maxConcurrent: ${this.maxConcurrent}, useGPU: ${this.useGPU})`);
  }

  /**
   * Sets the texture generator to use for processing
   */
  setGenerator(generator: {
    generateTexture(face: BlockFaceTexture, seed?: number): Promise<ImageData | null>;
    generateTextureGPU?(face: BlockFaceTexture, seed?: number): Promise<ImageData | null>;
  }): void {
    this.generator = generator;
  }

  /**
   * Enqueues a texture generation request.
   * Returns the request ID for tracking.
   */
  enqueue(request: Omit<TextureRequest, 'createdAt'>): string {
    if (this.disposed) {
      throw new Error('AsyncTextureQueue is disposed');
    }

    const fullRequest: TextureRequest = {
      ...request,
      createdAt: performance.now(),
    };

    const queue = this.queues.get(request.priority);
    if (!queue) {
      throw new Error(`Invalid priority: ${request.priority}`);
    }

    queue.push(fullRequest);
    this.stats.pendingCount++;

    Logger.debug(`[AsyncTextureQueue] Enqueued ${request.id} with priority ${request.priority}`);

    return request.id;
  }

  /**
   * Cancels a pending request by ID.
   * Returns true if the request was found and cancelled.
   */
  cancel(id: string): boolean {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(r => r.id === id);
      if (index >= 0) {
        const removed = queue.splice(index, 1)[0];
        this.stats.pendingCount--;
        
        if (removed?.onError) {
          removed.onError(new Error('Request cancelled'));
        }
        
        Logger.debug(`[AsyncTextureQueue] Cancelled ${id}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Processes pending requests up to the concurrency limit.
   * Should be called once per frame.
   * Returns the number of requests started this tick.
   */
  processQueue(): number {
    if (this.disposed || !this.generator) {
      return 0;
    }

    // Count current processing
    let currentProcessing = 0;
    for (const batch of this.processing.values()) {
      currentProcessing += batch.requests.length;
    }

    // Calculate how many we can start
    const available = this.maxConcurrent - currentProcessing;
    if (available <= 0) {
      return 0;
    }

    // Collect requests to process (priority order)
    const toProcess: TextureRequest[] = [];
    
    for (const priority of [
      TexturePriority.CRITICAL,
      TexturePriority.HIGH,
      TexturePriority.NORMAL,
      TexturePriority.LOW,
      TexturePriority.IDLE,
    ]) {
      const queue = this.queues.get(priority)!;
      while (toProcess.length < available && queue.length > 0) {
        const request = queue.shift()!;
        toProcess.push(request);
        this.stats.pendingCount--;
      }
      
      if (toProcess.length >= available) {
        break;
      }
    }

    if (toProcess.length === 0) {
      return 0;
    }

    // Create a batch and start processing
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const batch: ProcessingBatch = {
      requests: toProcess,
      startTime: performance.now(),
      promise: this.processBatch(toProcess, batchId),
    };

    this.processing.set(batchId, batch);
    this.stats.processingCount += toProcess.length;

    return toProcess.length;
  }

  /**
   * Processes a batch of texture requests
   */
  private async processBatch(requests: TextureRequest[], batchId: string): Promise<void> {
    const results: Array<{ request: TextureRequest; result?: TextureResult; error?: Error }> = [];

    for (const request of requests) {
      try {
        const startTime = performance.now();
        
        // Try GPU first if available and enabled
        let imageData: ImageData | null = null;
        let usedGPU = false;

        if (this.useGPU && this.generator?.generateTextureGPU) {
          try {
            imageData = await Promise.race([
              this.generator.generateTextureGPU(request.face, request.seed),
              this.timeout(this.requestTimeoutMs),
            ]) as ImageData | null;
            usedGPU = true;
            this.gpuUsageCount++;
          } catch {
            // GPU failed, fall back to CPU
            imageData = null;
          }
        }

        // Fall back to CPU if GPU failed or unavailable
        if (!imageData) {
          imageData = await Promise.race([
            this.generator!.generateTexture(request.face, request.seed),
            this.timeout(this.requestTimeoutMs),
          ]) as ImageData | null;
          usedGPU = false;
        }

        if (!imageData) {
          throw new Error('Texture generation returned null');
        }

        const generationTime = performance.now() - startTime;
        this.timeSamples.push(generationTime);
        if (this.timeSamples.length > 100) {
          this.timeSamples.shift();
        }

        results.push({
          request,
          result: {
            id: request.id,
            imageData,
            generationTimeMs: generationTime,
            usedGPU,
          },
        });

        this.stats.totalProcessed++;
      } catch (error) {
        results.push({
          request,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        this.stats.totalFailed++;
      }
    }

    // Invoke callbacks
    for (const { request, result, error } of results) {
      if (result && request.onComplete) {
        try {
          request.onComplete(result);
        } catch (callbackError) {
          Logger.warn(`[AsyncTextureQueue] Callback error for ${request.id}:`, callbackError);
        }
      } else if (error && request.onError) {
        try {
          request.onError(error);
        } catch (callbackError) {
          Logger.warn(`[AsyncTextureQueue] Error callback failed for ${request.id}:`, callbackError);
        }
      }
    }

    // Cleanup batch
    this.processing.delete(batchId);
    this.stats.processingCount -= requests.length;

    // Update statistics
    if (this.timeSamples.length > 0) {
      this.stats.averageTimeMs = 
        this.timeSamples.reduce((a, b) => a + b, 0) / this.timeSamples.length;
    }
    this.stats.gpuUtilization = 
      this.stats.totalProcessed > 0 
        ? this.gpuUsageCount / this.stats.totalProcessed 
        : 0;
  }

  /**
   * Creates a timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), ms);
    });
  }

  /**
   * Gets the current queue statistics
   */
  getStats(): Readonly<QueueStats> {
    return { ...this.stats };
  }

  /**
   * Gets the total pending request count
   */
  getPendingCount(): number {
    let count = 0;
    for (const queue of this.queues.values()) {
      count += queue.length;
    }
    return count;
  }

  /**
   * Gets the pending count for a specific priority
   */
  getPendingCountByPriority(priority: TexturePriority): number {
    return this.queues.get(priority)?.length ?? 0;
  }

  /**
   * Checks if the queue is idle (no pending or processing requests)
   */
  isIdle(): boolean {
    return this.getPendingCount() === 0 && this.processing.size === 0;
  }

  /**
   * Waits for all pending requests to complete
   */
  async flush(): Promise<void> {
    // Wait for all current processing to complete
    const batches = Array.from(this.processing.values());
    await Promise.all(batches.map(b => b.promise));

    // Process remaining queue items
    while (this.getPendingCount() > 0) {
      this.processQueue();
      await this.device.queue.onSubmittedWorkDone();
      
      // Wait for current batches
      const currentBatches = Array.from(this.processing.values());
      await Promise.all(currentBatches.map(b => b.promise));
    }
  }

  /**
   * Clears all pending requests without processing them.
   * Does not affect currently processing requests.
   */
  clearPending(): void {
    for (const queue of this.queues.values()) {
      for (const request of queue) {
        if (request.onError) {
          request.onError(new Error('Queue cleared'));
        }
      }
      queue.length = 0;
    }
    this.stats.pendingCount = 0;
  }

  /**
   * Resets statistics
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      pendingCount: this.getPendingCount(),
      processingCount: this.stats.processingCount,
      averageTimeMs: 0,
      gpuUtilization: 0,
    };
    this.timeSamples = [];
    this.gpuUsageCount = 0;
  }

  /**
   * Disposes the queue and cancels all pending requests
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Cancel all pending requests
    this.clearPending();

    // Clear completed results
    this.completed.clear();

    Logger.debug('[AsyncTextureQueue] Disposed');
  }
}

