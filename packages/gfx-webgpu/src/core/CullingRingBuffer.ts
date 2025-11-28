/**
 * CullingRingBuffer - Ring buffer for async culling results
 * 
 * Manages multiple sets of GPU buffers for overlapping culling compute
 * with rendering from previous frames. This enables the GPU to perform
 * culling for frame N+1 while rendering frame N.
 * 
 * @module gfx-webgpu/core
 */

import type { Mat4 } from '@engine/core/math';
import { Logger } from '@engine/core/utils';

/**
 * State of a culling frame slot in the ring buffer
 */
export type CullingFrameState = 
  | 'free'       // Slot is available for new culling work
  | 'pending'    // CPU has prepared data, waiting for GPU dispatch
  | 'computing'  // GPU compute is in progress
  | 'ready'      // Culling complete, ready for rendering
  | 'rendering'; // Currently being used for rendering

/**
 * A single frame's culling data and buffers
 */
export interface CullingFrame {
  /** Unique frame identifier */
  frameId: number;
  /** View-projection matrix used for this culling pass */
  viewProjection: Mat4;
  /** Buffer containing visible instance indices (opaque) */
  opaqueIndicesBuffer: GPUBuffer;
  /** Buffer containing visible instance indices (transparent) */
  transparentIndicesBuffer: GPUBuffer;
  /** Buffer containing opaque/transparent counts */
  countsBuffer: GPUBuffer;
  /** Compacted interleaved instance buffer (output) */
  compactedInterleavedBuffer: GPUBuffer;
  /** Indirect draw arguments buffer */
  indirectArgsBuffer: GPUBuffer;
  /** Timestamp for performance tracking */
  timestamp: number;
  /** Current state of this frame slot */
  state: CullingFrameState;
  /** Promise that resolves when compute work is done (via onSubmittedWorkDone) */
  computePromise: Promise<void> | null;
}

/**
 * Configuration options for CullingRingBuffer
 */
export interface CullingRingBufferOptions {
  /** Number of slots in the ring buffer (default: 3) */
  slotCount?: number;
  /** Initial capacity for instance buffers */
  initialCapacity?: number;
  /** Label prefix for GPU resources */
  labelPrefix?: string;
}

/** Default number of ring buffer slots */
const DEFAULT_SLOT_COUNT = 3;

/** Default initial capacity */
const DEFAULT_INITIAL_CAPACITY = 1024;

/** Counts buffer size: opaque + transparent with padding (4 u32s) */
const COUNTS_BUFFER_SIZE = 16;

/** Indirect draw command size: 5 u32s per command, 3 commands (opaque/transparent/overlay) */
const INDIRECT_ARGS_SIZE = 5 * 4 * 3; // 60 bytes

/** Instance stride in floats (24 floats = 96 bytes per instance) */
const INSTANCE_STRIDE = 24;

/** Instance stride in bytes */
const INSTANCE_STRIDE_BYTES = INSTANCE_STRIDE * 4;

/**
 * Ring buffer managing multiple sets of culling buffers for async compute overlap.
 * 
 * Usage pattern:
 * 1. Call `acquireForCulling()` to get a free slot for the next frame's culling
 * 2. Record culling compute passes using the slot's buffers
 * 3. Call `submitCulling()` to mark the slot as computing
 * 4. Call `acquireForRendering()` to get the most recent ready slot
 * 5. Use the slot's compacted buffers for rendering
 * 6. Call `releaseRendering()` to free the slot after submit
 */
export class CullingRingBuffer {
  private readonly device: GPUDevice;
  private readonly slots: CullingFrame[];
  private readonly slotCount: number;
  private readonly labelPrefix: string;
  private capacity: number;
  private nextFrameId = 0;
  private disposed = false;

  constructor(device: GPUDevice, options: CullingRingBufferOptions = {}) {
    this.device = device;
    this.slotCount = options.slotCount ?? DEFAULT_SLOT_COUNT;
    this.labelPrefix = options.labelPrefix ?? 'cull-ring';
    this.capacity = options.initialCapacity ?? DEFAULT_INITIAL_CAPACITY;
    
    // Initialize all slots
    this.slots = [];
    for (let i = 0; i < this.slotCount; i++) {
      this.slots.push(this.createSlot(i));
    }
    
    Logger.debug(`[CullingRingBuffer] Created with ${this.slotCount} slots, capacity ${this.capacity}`);
  }

  /**
   * Creates a new slot with all required GPU buffers
   */
  private createSlot(index: number): CullingFrame {
    const label = `${this.labelPrefix}-slot${index}`;
    
    return {
      frameId: -1,
      viewProjection: new Float32Array(16) as unknown as Mat4,
      opaqueIndicesBuffer: this.device.createBuffer({
        label: `${label}-opaque-indices`,
        size: Math.max(this.capacity * 4, 16),
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      transparentIndicesBuffer: this.device.createBuffer({
        label: `${label}-transparent-indices`,
        size: Math.max(this.capacity * 4, 16),
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      countsBuffer: this.device.createBuffer({
        label: `${label}-counts`,
        size: COUNTS_BUFFER_SIZE,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      compactedInterleavedBuffer: this.device.createBuffer({
        label: `${label}-compacted-interleaved`,
        size: Math.max(this.capacity * INSTANCE_STRIDE_BYTES, 16),
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      }),
      indirectArgsBuffer: this.device.createBuffer({
        label: `${label}-indirect-args`,
        size: INDIRECT_ARGS_SIZE,
        usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      timestamp: 0,
      state: 'free',
      computePromise: null,
    };
  }

  /**
   * Resizes all buffers in a slot to accommodate more instances
   */
  private resizeSlot(slot: CullingFrame, newCapacity: number): void {
    const index = this.slots.indexOf(slot);
    const label = `${this.labelPrefix}-slot${index}`;

    // Destroy old buffers
    try {
      slot.opaqueIndicesBuffer.destroy();
      slot.transparentIndicesBuffer.destroy();
      slot.compactedInterleavedBuffer.destroy();
    } catch {
      // Ignore destruction errors
    }

    // Create new buffers with increased capacity
    slot.opaqueIndicesBuffer = this.device.createBuffer({
      label: `${label}-opaque-indices`,
      size: Math.max(newCapacity * 4, 16),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    slot.transparentIndicesBuffer = this.device.createBuffer({
      label: `${label}-transparent-indices`,
      size: Math.max(newCapacity * 4, 16),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    slot.compactedInterleavedBuffer = this.device.createBuffer({
      label: `${label}-compacted-interleaved`,
      size: Math.max(newCapacity * INSTANCE_STRIDE_BYTES, 16),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
  }

  /**
   * Ensures all slots can accommodate the given instance count
   */
  ensureCapacity(instanceCount: number): boolean {
    if (instanceCount <= this.capacity) {
      return true;
    }

    const newCapacity = Math.max(this.capacity * 2, instanceCount);
    Logger.debug(`[CullingRingBuffer] Resizing from ${this.capacity} to ${newCapacity}`);

    for (const slot of this.slots) {
      // Only resize free slots; busy slots will be resized when released
      if (slot.state === 'free') {
        this.resizeSlot(slot, newCapacity);
      }
    }

    this.capacity = newCapacity;
    return true;
  }

  /**
   * Acquires a free slot for culling the next frame.
   * Returns null if no slots are available (all busy).
   */
  acquireForCulling(viewProjection: Mat4): CullingFrame | null {
    if (this.disposed) {
      return null;
    }

    // Find a free slot
    const slot = this.slots.find(s => s.state === 'free');
    if (!slot) {
      Logger.debug('[CullingRingBuffer] No free slots available for culling');
      return null;
    }

    // Check if slot needs resizing
    if (slot.opaqueIndicesBuffer.size < this.capacity * 4) {
      this.resizeSlot(slot, this.capacity);
    }

    // Initialize the slot for this frame
    slot.frameId = this.nextFrameId++;
    slot.timestamp = performance.now();
    slot.state = 'pending';
    slot.computePromise = null;

    // Copy view projection matrix
    const vp = slot.viewProjection as unknown as Float32Array;
    for (let i = 0; i < 16; i++) {
      vp[i] = viewProjection[i]!;
    }

    // Reset counts buffer
    const zeros = new Uint32Array([0, 0, 0, 0]);
    this.device.queue.writeBuffer(slot.countsBuffer, 0, zeros);

    return slot;
  }

  /**
   * Marks a slot as computing after GPU work has been submitted.
   * Optionally tracks completion via onSubmittedWorkDone.
   */
  submitCulling(slot: CullingFrame, trackCompletion = true): void {
    if (slot.state !== 'pending') {
      Logger.warn(`[CullingRingBuffer] Unexpected state ${slot.state} when submitting culling`);
      return;
    }

    slot.state = 'computing';

    if (trackCompletion) {
      slot.computePromise = this.device.queue.onSubmittedWorkDone().then(() => {
        if (slot.state === 'computing') {
          slot.state = 'ready';
        }
      });
    } else {
      // Immediately mark as ready (caller is responsible for sync)
      slot.state = 'ready';
    }
  }

  /**
   * Marks a slot as ready after compute work has completed.
   * Used when not tracking via onSubmittedWorkDone.
   */
  markReady(slot: CullingFrame): void {
    if (slot.state === 'computing') {
      slot.state = 'ready';
    }
  }

  /**
   * Acquires the most recent ready slot for rendering.
   * Returns null if no slots are ready.
   */
  acquireForRendering(): CullingFrame | null {
    if (this.disposed) {
      return null;
    }

    // Find the most recent ready slot (highest frameId)
    let bestSlot: CullingFrame | null = null;
    let bestFrameId = -1;

    for (const slot of this.slots) {
      if (slot.state === 'ready' && slot.frameId > bestFrameId) {
        bestSlot = slot;
        bestFrameId = slot.frameId;
      }
    }

    if (bestSlot) {
      bestSlot.state = 'rendering';
    }

    return bestSlot;
  }

  /**
   * Releases a slot after rendering is complete.
   * The slot becomes available for future culling work.
   */
  releaseRendering(slot: CullingFrame): void {
    if (slot.state !== 'rendering') {
      Logger.warn(`[CullingRingBuffer] Unexpected state ${slot.state} when releasing rendering`);
    }

    slot.state = 'free';
    slot.computePromise = null;

    // Resize if capacity increased while slot was busy
    if (slot.opaqueIndicesBuffer.size < this.capacity * 4) {
      this.resizeSlot(slot, this.capacity);
    }
  }

  /**
   * Gets the current capacity of the ring buffer
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Gets the number of slots in the ring buffer
   */
  getSlotCount(): number {
    return this.slotCount;
  }

  /**
   * Gets statistics about slot states
   */
  getStats(): { free: number; pending: number; computing: number; ready: number; rendering: number } {
    const stats = { free: 0, pending: 0, computing: 0, ready: 0, rendering: 0 };
    for (const slot of this.slots) {
      stats[slot.state]++;
    }
    return stats;
  }

  /**
   * Checks if any slot is available for culling
   */
  hasFreeSot(): boolean {
    return this.slots.some(s => s.state === 'free');
  }

  /**
   * Checks if any slot is ready for rendering
   */
  hasReadySlot(): boolean {
    return this.slots.some(s => s.state === 'ready');
  }

  /**
   * Waits for all computing slots to complete
   */
  async flush(): Promise<void> {
    const promises = this.slots
      .filter(s => s.state === 'computing' && s.computePromise)
      .map(s => s.computePromise!);
    
    await Promise.all(promises);
  }

  /**
   * Disposes all GPU resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    for (const slot of this.slots) {
      try {
        slot.opaqueIndicesBuffer.destroy();
        slot.transparentIndicesBuffer.destroy();
        slot.countsBuffer.destroy();
        slot.compactedInterleavedBuffer.destroy();
        slot.indirectArgsBuffer.destroy();
      } catch {
        // Ignore destruction errors
      }
    }

    this.slots.length = 0;
    Logger.debug('[CullingRingBuffer] Disposed');
  }
}

