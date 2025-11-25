/**
 * Frame Loop
 *
 * Manages the animation frame lifecycle including:
 * - requestAnimationFrame scheduling
 * - Delta time calculation with clamping
 * - ResizeObserver for canvas size updates
 * - Graceful shutdown via AbortController
 * - Pause/resume functionality
 */

import { Logger } from '@engine/core/utils';
import { updateCanvasSize } from './helpers';
import { MAX_DELTA_TIME_SEC } from '../config';
import type { FrameCallback, FrameLoopConfig } from './RendererTypes';

/**
 * Frame state information passed to listeners.
 */
export interface FrameState {
  /** Time since last frame in seconds */
  deltaTime: number;
  /** Current time in seconds (from performance.now) */
  currentTime: number;
  /** Canvas aspect ratio (width/height) */
  aspect: number;
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
}

/**
 * FrameLoop manages the render loop lifecycle.
 *
 * Features:
 * - Automatic delta time calculation with spike clamping
 * - Canvas resize observation
 * - Graceful shutdown via AbortController
 * - Pause/resume without losing state
 *
 * @example
 * ```typescript
 * const loop = new FrameLoop({ canvas });
 * loop.start((deltaTime) => {
 *   // Update and render
 * });
 *
 * // Later...
 * loop.stop();
 * ```
 */
export class FrameLoop {
  private readonly canvas: HTMLCanvasElement;
  private readonly abortController: AbortController;
  private readonly resizeObserver: ResizeObserver;

  private animationFrameHandle: number | null = null;
  private lastFrameTimeMs: number | null = null;
  private currentDeltaTime = 0;
  private currentTime = 0;
  private resolutionScale: number;
  private frameCallback: FrameCallback | null = null;
  private running = false;
  private paused = false;
  private disposed = false;

  /**
   * Creates a new FrameLoop instance.
   *
   * @param config - Configuration options
   */
  constructor(config: FrameLoopConfig) {
    this.canvas = config.canvas;
    this.resolutionScale = config.resolutionScale ?? 1.0;
    this.abortController = new AbortController();

    // Setup resize observer
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.disposed) {
        updateCanvasSize(this.canvas, this.resolutionScale);
      }
    });
    this.resizeObserver.observe(this.canvas);

    // Handle abort signal
    this.abortController.signal.addEventListener(
      'abort',
      () => {
        this.stopInternal();
      },
      { once: true }
    );
  }

  /**
   * Starts the frame loop with the given callback.
   * The callback will be invoked once per animation frame.
   *
   * @param callback - Function to call each frame with delta time in seconds
   */
  start(callback: FrameCallback): void {
    if (this.disposed) {
      Logger.warn('FrameLoop: Cannot start disposed loop');
      return;
    }

    if (this.running) {
      Logger.warn('FrameLoop: Already running, updating callback');
    }

    this.frameCallback = callback;
    this.running = true;
    this.paused = false;
    this.lastFrameTimeMs = null;
    this.scheduleNextFrame();
  }

  /**
   * Stops the frame loop and cleans up resources.
   * After stopping, the loop can be restarted with a new callback.
   */
  stop(): void {
    this.stopInternal();
    this.lastFrameTimeMs = null;
  }

  /**
   * Pauses the frame loop without resetting state.
   * The loop can be resumed with resume().
   */
  pause(): void {
    if (!this.running || this.paused) {
      return;
    }

    this.paused = true;
    this.cancelCurrentFrame();
    this.lastFrameTimeMs = null; // Reset timing to avoid large delta on resume
  }

  /**
   * Resumes a paused frame loop.
   */
  resume(): void {
    if (!this.running || !this.paused) {
      return;
    }

    this.paused = false;
    this.scheduleNextFrame();
  }

  /**
   * Aborts the frame loop immediately.
   * This triggers the abort signal and cannot be undone.
   */
  abort(): void {
    if (!this.abortController.signal.aborted) {
      this.abortController.abort();
    }
  }

  /**
   * Disposes all resources and stops the loop permanently.
   * After disposal, the loop cannot be restarted.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.stopInternal();

    try {
      this.resizeObserver.disconnect();
    } catch (e) {
      Logger.debug('FrameLoop: ResizeObserver disconnect failed', e);
    }

    if (!this.abortController.signal.aborted) {
      this.abortController.abort();
    }
  }

  /**
   * Updates the resolution scale factor.
   * Takes effect on the next frame.
   *
   * @param scale - New resolution scale (default: 1.0)
   */
  setResolutionScale(scale: number): void {
    this.resolutionScale = Math.max(0.1, Math.min(2.0, scale));
  }

  /**
   * Gets the current resolution scale factor.
   */
  getResolutionScale(): number {
    return this.resolutionScale;
  }

  /**
   * Whether the loop is currently running (may be paused).
   */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Whether the loop is currently paused.
   */
  get isPaused(): boolean {
    return this.paused;
  }

  /**
   * Whether the loop has been disposed.
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * The delta time from the last frame in seconds.
   */
  get deltaTime(): number {
    return this.currentDeltaTime;
  }

  /**
   * The current time in seconds (from performance.now).
   */
  get time(): number {
    return this.currentTime;
  }

  /**
   * The abort signal that can be used to detect loop termination.
   */
  get abortSignal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Gets the current frame state.
   */
  getFrameState(): FrameState {
    return {
      deltaTime: this.currentDeltaTime,
      currentTime: this.currentTime,
      aspect: this.canvas.width / Math.max(1, this.canvas.height),
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  // ========== Private Methods ==========

  private stopInternal(): void {
    this.running = false;
    this.paused = false;
    this.cancelCurrentFrame();
    this.frameCallback = null;
  }

  private cancelCurrentFrame(): void {
    if (this.animationFrameHandle !== null) {
      try {
        cancelAnimationFrame(this.animationFrameHandle);
      } catch (e) {
        Logger.debug('FrameLoop: cancelAnimationFrame failed', e);
      }
      this.animationFrameHandle = null;
    }
  }

  private scheduleNextFrame(): void {
    if (this.disposed || this.paused || this.abortController.signal.aborted) {
      return;
    }

    if (this.animationFrameHandle === null) {
      this.animationFrameHandle = requestAnimationFrame(this.frame);
    }
  }

  private frame = (): void => {
    // Clear the handle first
    this.animationFrameHandle = null;

    // Check termination conditions
    if (this.disposed || !this.running || this.paused || this.abortController.signal.aborted) {
      return;
    }

    // Update canvas size
    updateCanvasSize(this.canvas, this.resolutionScale);

    // Skip frame if canvas has zero dimensions
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      Logger.debug('FrameLoop: Skipping frame - canvas has zero dimensions', {
        width: this.canvas.width,
        height: this.canvas.height,
      });
      this.scheduleNextFrame();
      return;
    }

    // Calculate delta time
    const deltaTime = this.calculateDeltaTime();
    this.currentDeltaTime = deltaTime;
    this.currentTime = this.getCurrentTimeSeconds();

    // Invoke callback
    if (this.frameCallback) {
      try {
        this.frameCallback(deltaTime);
      } catch (err) {
        Logger.error('FrameLoop: Frame callback threw', err instanceof Error ? err : new Error(String(err)));
      }
    }

    // Schedule next frame
    this.scheduleNextFrame();
  };

  private calculateDeltaTime(): number {
    let deltaTime = 0;

    try {
      const nowMs = this.getCurrentTimeMs();

      if (this.lastFrameTimeMs !== null) {
        deltaTime = Math.max(0, (nowMs - this.lastFrameTimeMs) / 1000);

        // Clamp to avoid huge spikes (e.g., after tab switch)
        if (!Number.isFinite(deltaTime) || deltaTime > MAX_DELTA_TIME_SEC) {
          deltaTime = MAX_DELTA_TIME_SEC;
        }
      }

      this.lastFrameTimeMs = nowMs;
    } catch {
      deltaTime = 0;
    }

    return deltaTime;
  }

  private getCurrentTimeMs(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  private getCurrentTimeSeconds(): number {
    return this.getCurrentTimeMs() / 1000;
  }
}

