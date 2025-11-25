import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FrameLoop } from '../FrameLoop';
import type { FrameLoopConfig } from '../RendererTypes';

describe('FrameLoop', () => {
  let canvas: HTMLCanvasElement;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;
  let mockResizeObserver: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Reset RAF tracking
    rafCallbacks = new Map();
    rafId = 0;

    // Mock canvas
    canvas = {
      clientWidth: 800,
      clientHeight: 600,
      width: 800,
      height: 600,
    } as HTMLCanvasElement;

    // Mock requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++rafId;
      rafCallbacks.set(id, callback);
      return id;
    });

    // Mock cancelAnimationFrame
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });

    // Mock performance.now
    let currentTime = 0;
    vi.stubGlobal('performance', {
      now: vi.fn(() => {
        currentTime += 16.67; // ~60fps
        return currentTime;
      }),
    });

    // Mock window.devicePixelRatio
    vi.stubGlobal('window', {
      devicePixelRatio: 1,
    });

    // Mock ResizeObserver
    mockResizeObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };
    vi.stubGlobal('ResizeObserver', vi.fn(() => mockResizeObserver));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Helper to trigger RAF callbacks
  function triggerFrame(): void {
    const callbacks = Array.from(rafCallbacks.entries());
    rafCallbacks.clear();
    for (const [, callback] of callbacks) {
      callback(performance.now());
    }
  }

  describe('constructor', () => {
    it('creates a FrameLoop with default config', () => {
      const loop = new FrameLoop({ canvas });
      expect(loop.isRunning).toBe(false);
      expect(loop.isPaused).toBe(false);
      expect(loop.isDisposed).toBe(false);
      expect(loop.getResolutionScale()).toBe(1.0);
      loop.dispose();
    });

    it('creates a FrameLoop with custom resolution scale', () => {
      const loop = new FrameLoop({ canvas, resolutionScale: 0.5 });
      expect(loop.getResolutionScale()).toBe(0.5);
      loop.dispose();
    });

    it('observes canvas resize', () => {
      const loop = new FrameLoop({ canvas });
      expect(mockResizeObserver.observe).toHaveBeenCalledWith(canvas);
      loop.dispose();
    });
  });

  describe('start/stop', () => {
    it('starts the frame loop', () => {
      const loop = new FrameLoop({ canvas });
      const callback = vi.fn();

      loop.start(callback);
      expect(loop.isRunning).toBe(true);
      expect(rafCallbacks.size).toBe(1);

      loop.dispose();
    });

    it('invokes callback on each frame', () => {
      const loop = new FrameLoop({ canvas });
      const callback = vi.fn();

      loop.start(callback);
      triggerFrame();
      triggerFrame();
      triggerFrame();

      expect(callback).toHaveBeenCalledTimes(3);
      loop.dispose();
    });

    it('passes delta time to callback', () => {
      const loop = new FrameLoop({ canvas });
      const callback = vi.fn();

      loop.start(callback);
      triggerFrame(); // First frame has 0 delta (no previous frame)
      triggerFrame(); // Second frame has delta

      expect(callback).toHaveBeenCalledTimes(2);
      const secondCallDelta = callback.mock.calls[1][0];
      expect(secondCallDelta).toBeGreaterThan(0);

      loop.dispose();
    });

    it('stops the frame loop', () => {
      const loop = new FrameLoop({ canvas });
      const callback = vi.fn();

      loop.start(callback);
      expect(loop.isRunning).toBe(true);

      loop.stop();
      expect(loop.isRunning).toBe(false);
      expect(rafCallbacks.size).toBe(0);

      loop.dispose();
    });

    it('can be restarted after stop', () => {
      const loop = new FrameLoop({ canvas });
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      loop.start(callback1);
      triggerFrame();
      loop.stop();

      loop.start(callback2);
      triggerFrame();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);

      loop.dispose();
    });
  });

  describe('pause/resume', () => {
    it('pauses the frame loop', () => {
      const loop = new FrameLoop({ canvas });
      const callback = vi.fn();

      loop.start(callback);
      triggerFrame();
      loop.pause();

      expect(loop.isRunning).toBe(true);
      expect(loop.isPaused).toBe(true);
      expect(rafCallbacks.size).toBe(0);

      loop.dispose();
    });

    it('resumes the frame loop', () => {
      const loop = new FrameLoop({ canvas });
      const callback = vi.fn();

      loop.start(callback);
      triggerFrame();
      loop.pause();
      loop.resume();

      expect(loop.isRunning).toBe(true);
      expect(loop.isPaused).toBe(false);
      expect(rafCallbacks.size).toBe(1);

      triggerFrame();
      expect(callback).toHaveBeenCalledTimes(2);

      loop.dispose();
    });

    it('resets delta time after pause/resume', () => {
      const loop = new FrameLoop({ canvas });
      const deltas: number[] = [];
      const callback = (dt: number) => deltas.push(dt);

      loop.start(callback);
      triggerFrame(); // dt = 0
      triggerFrame(); // dt > 0

      loop.pause();
      // Simulate time passing while paused
      vi.mocked(performance.now).mockReturnValueOnce(10000);
      loop.resume();

      triggerFrame(); // Should reset, dt = 0

      // First frame after resume should have 0 delta (timing reset)
      expect(deltas[2]).toBe(0);

      loop.dispose();
    });
  });

  describe('abort', () => {
    it('aborts the frame loop', () => {
      const loop = new FrameLoop({ canvas });
      const callback = vi.fn();

      loop.start(callback);
      loop.abort();

      expect(loop.isRunning).toBe(false);
      expect(loop.abortSignal.aborted).toBe(true);

      loop.dispose();
    });

    it('prevents new frames after abort', () => {
      const loop = new FrameLoop({ canvas });
      const callback = vi.fn();

      loop.start(callback);
      triggerFrame();
      loop.abort();
      triggerFrame();

      expect(callback).toHaveBeenCalledTimes(1);

      loop.dispose();
    });
  });

  describe('dispose', () => {
    it('disposes all resources', () => {
      const loop = new FrameLoop({ canvas });
      loop.start(vi.fn());

      loop.dispose();

      expect(loop.isDisposed).toBe(true);
      expect(loop.isRunning).toBe(false);
      expect(mockResizeObserver.disconnect).toHaveBeenCalled();
      expect(loop.abortSignal.aborted).toBe(true);
    });

    it('prevents starting after dispose', () => {
      const loop = new FrameLoop({ canvas });
      loop.dispose();

      const callback = vi.fn();
      loop.start(callback);

      expect(loop.isRunning).toBe(false);
      triggerFrame();
      expect(callback).not.toHaveBeenCalled();
    });

    it('is idempotent', () => {
      const loop = new FrameLoop({ canvas });
      loop.dispose();
      loop.dispose();
      loop.dispose();

      expect(mockResizeObserver.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('delta time clamping', () => {
    it('clamps large delta times', () => {
      const loop = new FrameLoop({ canvas });
      const deltas: number[] = [];
      const callback = (dt: number) => deltas.push(dt);

      loop.start(callback);
      triggerFrame(); // First frame

      // Simulate a 1 second gap (e.g., tab switch)
      vi.mocked(performance.now).mockReturnValueOnce(1000);
      triggerFrame();

      // Delta should be clamped to MAX_DELTA_TIME_SEC (0.1)
      expect(deltas[1]).toBeLessThanOrEqual(0.1);

      loop.dispose();
    });
  });

  describe('getFrameState', () => {
    it('returns current frame state', () => {
      const loop = new FrameLoop({ canvas });
      loop.start(vi.fn());
      triggerFrame();

      const state = loop.getFrameState();
      expect(state.width).toBe(canvas.width);
      expect(state.height).toBe(canvas.height);
      expect(state.aspect).toBe(canvas.width / canvas.height);
      expect(typeof state.deltaTime).toBe('number');
      expect(typeof state.currentTime).toBe('number');

      loop.dispose();
    });
  });

  describe('resolution scale', () => {
    it('updates resolution scale', () => {
      const loop = new FrameLoop({ canvas });
      loop.setResolutionScale(0.75);
      expect(loop.getResolutionScale()).toBe(0.75);
      loop.dispose();
    });

    it('clamps resolution scale to valid range', () => {
      const loop = new FrameLoop({ canvas });

      loop.setResolutionScale(0.01);
      expect(loop.getResolutionScale()).toBe(0.1);

      loop.setResolutionScale(5.0);
      expect(loop.getResolutionScale()).toBe(2.0);

      loop.dispose();
    });
  });

  describe('small canvas handling', () => {
    it('processes frame even with initially zero-size canvas (updateCanvasSize ensures min 1x1)', () => {
      // Set both width/height and clientWidth/clientHeight to 0
      // Note: updateCanvasSize will resize to at least 1x1, so the callback still runs
      canvas.width = 0;
      canvas.height = 0;
      Object.defineProperty(canvas, 'clientWidth', { value: 0, configurable: true });
      Object.defineProperty(canvas, 'clientHeight', { value: 0, configurable: true });

      const loop = new FrameLoop({ canvas });
      const callback = vi.fn();

      loop.start(callback);
      triggerFrame();

      // updateCanvasSize ensures minimum 1x1, so callback still gets called
      expect(callback).toHaveBeenCalledTimes(1);
      expect(rafCallbacks.size).toBe(1); // Next frame scheduled

      loop.dispose();
    });
  });

  describe('error handling', () => {
    it('continues loop even if callback throws', () => {
      const loop = new FrameLoop({ canvas });
      const callback = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      loop.start(callback);
      triggerFrame();
      triggerFrame();

      // Loop should continue despite errors
      expect(callback).toHaveBeenCalledTimes(2);
      expect(rafCallbacks.size).toBe(1);

      loop.dispose();
    });
  });
});

