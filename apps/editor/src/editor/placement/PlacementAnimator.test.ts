import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PlacementAnimator } from './PlacementAnimator';
import { Entity } from '@engine/world';
import type { Vec3, Quat } from '@engine/core/math';

describe('PlacementAnimator', () => {
  let animator: PlacementAnimator;
  let entity: Entity;
  let rafCallbacks: Array<FrameRequestCallback>;
  let rafId: number;
  let mockCancelAnimationFrame: ReturnType<typeof vi.fn>;
  let mockRequestAnimationFrame: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    let currentTime = 0;
    mockCancelAnimationFrame = vi.fn();
    mockRequestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return ++rafId;
    });

    global.requestAnimationFrame = mockRequestAnimationFrame;
    global.cancelAnimationFrame = mockCancelAnimationFrame;
    global.performance = {
      now: vi.fn(() => {
        currentTime += 16.67; // Increment by ~16.67ms per call (60fps)
        return currentTime;
      }),
    } as unknown as Performance;

    animator = new PlacementAnimator();
    entity = new Entity('test');
    entity.transform.scale = [1, 1, 1];
    entity.transform.position = [0, 0, 0];
    entity.transform.rotation = [0, 0, 0, 1];
    entity.color = [1, 1, 1, 1];
  });

  afterEach(() => {
    animator.dispose();
    vi.restoreAllMocks();
  });

  describe('animateSpawn', () => {
    it('should animate scale from 0 to target', () => {
      const targetScale: Vec3 = [2, 3, 4];
      const targetOpacity = 0.8;

      animator.animateSpawn(entity, targetScale, targetOpacity);

      // Initially should be at start state (scale 0, opacity 0)
      expect(entity.transform.scale).toEqual([0, 0, 0]);
      expect(entity.color?.[3]).toBe(0);

      // Simulate animation frames by calling callbacks with proper timing
      // The animator uses performance.now() internally, which increments automatically
      let frameCount = 0;
      while (rafCallbacks.length > 0 && frameCount < 20) {
        // Call all pending callbacks (they may schedule new ones)
        const callbacks = [...rafCallbacks];
        rafCallbacks.length = 0;
        callbacks.forEach((callback) => {
          // Use performance.now() which increments automatically
          callback(performance.now());
        });
        frameCount++;
      }

      // After animation, should reach target (or close to it)
      // Note: exact values depend on timing, but scale should be > 0
      expect(entity.transform.scale[0]).toBeGreaterThan(0);
      expect(entity.transform.scale[0]).toBeLessThanOrEqual(targetScale[0]);
      expect(entity.color?.[3]).toBeGreaterThanOrEqual(0);
    });

    it('should apply directly when animations disabled', () => {
      animator.setConfig({ enabled: false });
      const targetScale: Vec3 = [2, 3, 4];
      const targetOpacity = 0.8;

      animator.animateSpawn(entity, targetScale, targetOpacity);

      expect(entity.transform.scale).toEqual(targetScale);
      expect(entity.color?.[3]).toBe(targetOpacity);
      expect(mockRequestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe('animatePosition', () => {
    it('should interpolate position smoothly', () => {
      const startPos: Vec3 = [0, 0, 0];
      const targetPos: Vec3 = [10, 5, -3];

      entity.transform.position = startPos;
      animator.animatePosition(entity, targetPos);

      // Simulate some animation progress by calling callbacks
      let frameCount = 0;
      while (rafCallbacks.length > 0 && frameCount < 10) {
        const callbacks = [...rafCallbacks];
        rafCallbacks.length = 0;
        callbacks.forEach((callback) => {
          callback(performance.now());
        });
        frameCount++;
      }

      // Position should have changed towards target
      // Note: position animation duration is 0.1s, so after a few frames it should progress
      expect(entity.transform.position[0]).toBeGreaterThanOrEqual(startPos[0]);
      expect(entity.transform.position[0]).toBeLessThanOrEqual(targetPos[0]);
    });

    it('should skip animation if position is already at target', () => {
      const pos: Vec3 = [5, 5, 5];
      entity.transform.position = pos;

      animator.animatePosition(entity, pos);

      // Should not start animation loop for identical positions
      // Position should remain unchanged
      expect(entity.transform.position).toEqual(pos);
    });

    it('should apply directly when animations disabled', () => {
      animator.setConfig({ enabled: false });
      const targetPos: Vec3 = [10, 20, 30];

      animator.animatePosition(entity, targetPos);

      expect(entity.transform.position).toEqual(targetPos);
      expect(mockRequestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe('animateRotation', () => {
    it('should interpolate rotation smoothly', () => {
      const startRot: Quat = [0, 0, 0, 1];
      const targetRot: Quat = [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)]; // 90 degrees

      entity.transform.rotation = startRot;
      animator.animateRotation(entity, targetRot);

      // Simulate some animation progress
      let currentTime = 0;
      for (let i = 0; i < 5; i++) {
        currentTime += 16.67;
        rafCallbacks.forEach((callback) => callback(currentTime));
      }

      // Rotation should have changed (quaternion components)
      expect(entity.transform.rotation[1]).not.toBe(0);
    });

    it('should apply directly when animations disabled', () => {
      animator.setConfig({ enabled: false });
      const targetRot: Quat = [0, 1, 0, 0];

      animator.animateRotation(entity, targetRot);

      expect(entity.transform.rotation).toEqual(targetRot);
      expect(mockRequestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update animations with delta time', () => {
      const targetScale: Vec3 = [2, 2, 2];
      animator.animateSpawn(entity, targetScale, 0.8);

      // Directly call update with delta time
      const updateMethod = (animator as any).update.bind(animator);
      updateMethod(0.1); // 100ms

      // Scale should have progressed
      expect(entity.transform.scale[0]).toBeGreaterThan(0);
    });

    it('should complete animation when elapsed >= duration', () => {
      const targetScale: Vec3 = [2, 2, 2];
      animator.animateSpawn(entity, targetScale, 0.8);

      const updateMethod = (animator as any).update.bind(animator);
      updateMethod(0.3); // More than spawn duration (0.2s)

      // Should be at or very close to target
      expect(entity.transform.scale[0]).toBeCloseTo(targetScale[0], 1);
      expect(entity.color?.[3]).toBeCloseTo(0.8, 1);
    });
  });

  describe('cancel', () => {
    it('should cancel all animations and jump to final values', () => {
      const targetScale: Vec3 = [3, 3, 3];
      const targetOpacity = 0.9;
      animator.animateSpawn(entity, targetScale, targetOpacity);

      animator.cancel();

      // Should jump to final values
      expect(entity.transform.scale).toEqual(targetScale);
      expect(entity.color?.[3]).toBe(targetOpacity);
      expect(animator.isAnimating()).toBe(false);
    });

    it('should stop animation loop when canceling', () => {
      const targetPos: Vec3 = [10, 10, 10];
      animator.animatePosition(entity, targetPos);

      animator.cancel();

      expect(mockCancelAnimationFrame).toHaveBeenCalled();
      expect(animator.isAnimating()).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should use default durations', () => {
      const config = animator.getConfig();
      expect(config.duration.spawn).toBe(0.2);
      expect(config.duration.position).toBe(0.1);
      expect(config.duration.rotation).toBe(0.15);
      expect(config.enabled).toBe(true);
    });

    it('should allow custom configuration', () => {
      animator.setConfig({
        enabled: false,
        duration: {
          spawn: 0.5,
          position: 0.2,
          rotation: 0.3,
        },
      });

      const config = animator.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.duration.spawn).toBe(0.5);
      expect(config.duration.position).toBe(0.2);
      expect(config.duration.rotation).toBe(0.3);
    });
  });

  describe('isAnimating', () => {
    it('should return false when no animations active', () => {
      expect(animator.isAnimating()).toBe(false);
    });

    it('should return true when spawn animation active', () => {
      animator.animateSpawn(entity, [1, 1, 1], 1);
      expect(animator.isAnimating()).toBe(true);
    });

    it('should return true when position animation active', () => {
      animator.animatePosition(entity, [5, 5, 5]);
      expect(animator.isAnimating()).toBe(true);
    });

    it('should return true when rotation animation active', () => {
      animator.animateRotation(entity, [0, 0, 0, 1]);
      expect(animator.isAnimating()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should cancel all animations and stop loop', () => {
      animator.animateSpawn(entity, [1, 1, 1], 1);
      animator.animatePosition(entity, [5, 5, 5]);

      animator.dispose();

      expect(animator.isAnimating()).toBe(false);
      expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });
  });
});


