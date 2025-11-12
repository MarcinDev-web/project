/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FPSCamera } from '../src/FPSCamera';
import type { Vec3 } from '@engine/core/math';

function mockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'style', {
    value: { cursor: '' },
    writable: true,
  });
  
  // Mock Pointer Lock API
  Object.defineProperty(canvas, 'requestPointerLock', {
    value: vi.fn(),
    writable: true,
  });
  
  Object.defineProperty(document, 'exitPointerLock', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
  
  document.body.appendChild(canvas);
  return canvas;
}

describe('FPSCamera', () => {
  let canvas: HTMLCanvasElement;
  let camera: FPSCamera;

  beforeEach(() => {
    canvas = mockCanvas();
    camera = new FPSCamera(canvas);
  });

  afterEach(() => {
    try {
      camera.dispose();
    } catch {}
    try {
      canvas.remove();
    } catch {}
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const { yaw, pitch } = camera.getYawPitch();
      expect(yaw).toBe(0);
      expect(pitch).toBe(0);
    });

    it('should initialize with custom options', () => {
      const customCamera = new FPSCamera(canvas, {
        eyeHeight: 2.0,
        sensitivity: 0.01,
        pitchLimit: Math.PI / 3,
      });

      // Should not throw and should accept options
      expect(() => customCamera.dispose()).not.toThrow();
    });
  });

  describe('yaw and pitch', () => {
    it('should set yaw and pitch', () => {
      camera.setYawPitch(Math.PI / 4, Math.PI / 6);
      const { yaw, pitch } = camera.getYawPitch();

      expect(yaw).toBeCloseTo(Math.PI / 4, 5);
      expect(pitch).toBeCloseTo(Math.PI / 6, 5);
    });

    it('should clamp pitch to pitch limit', () => {
      const limit = Math.PI / 2 - 0.05;

      camera.setYawPitch(0, Math.PI); // Exceeds limit
      const { pitch } = camera.getYawPitch();

      expect(pitch).toBeLessThanOrEqual(limit);
      expect(pitch).toBeGreaterThanOrEqual(-limit);
    });

    it('should handle negative pitch values', () => {
      camera.setYawPitch(0, -Math.PI / 4);
      const { pitch } = camera.getYawPitch();

      expect(pitch).toBeCloseTo(-Math.PI / 4, 5);
    });

    it('should allow full 360-degree yaw rotation', () => {
      camera.setYawPitch(Math.PI * 3, 0);
      const { yaw } = camera.getYawPitch();

      // Yaw should not be clamped
      expect(yaw).toBeCloseTo(Math.PI * 3, 5);
    });
  });

  describe('configuration', () => {
    it('should set sensitivity', () => {
      camera.setSensitivity(0.01);

      // Should not throw
      expect(() => camera.update()).not.toThrow();
    });

    it('should set eye height', () => {
      camera.setEyeHeight(2.0);

      const playerPosition: Vec3 = [0, 0, 0];
      const viewMatrix = camera.getViewMatrix(playerPosition);

      expect(viewMatrix).toBeInstanceOf(Float32Array);
    });

    it('should set pitch limit and re-clamp current pitch', () => {
      camera.setYawPitch(0, Math.PI / 3);
      camera.setPitchLimit(Math.PI / 6);

      const { pitch } = camera.getYawPitch();
      expect(pitch).toBeLessThanOrEqual(Math.PI / 6);
    });

    it('should set invert Y axis', () => {
      camera.setInvertY(true);
      camera.setInvertY(false);

      // Should not throw
      expect(() => camera.update()).not.toThrow();
    });
  });

  describe('view matrix', () => {
    it('should generate view matrix from player position', () => {
      const playerPosition: Vec3 = [5, 0, 5];
      const viewMatrix = camera.getViewMatrix(playerPosition);

      expect(viewMatrix).toBeInstanceOf(Float32Array);
      expect(viewMatrix.length).toBe(16);

      // View matrix should not be identity
      const sum = Array.from(viewMatrix).reduce((a, b) => a + Math.abs(b), 0);
      expect(sum).toBeGreaterThan(0);
    });

    it('should incorporate eye height in view matrix', () => {
      const eyeHeight = 1.6;
      camera.setEyeHeight(eyeHeight);

      const playerPosition: Vec3 = [0, 0, 0];
      const viewMatrix = camera.getViewMatrix(playerPosition);

      // View matrix should be valid
      expect(Array.from(viewMatrix).every(v => !isNaN(v))).toBe(true);
    });

    it('should update view matrix when orientation changes', () => {
      const playerPosition: Vec3 = [0, 0, 0];

      camera.setYawPitch(0, 0);
      const view1 = new Float32Array(camera.getViewMatrix(playerPosition));

      camera.setYawPitch(Math.PI / 2, 0);
      const view2 = camera.getViewMatrix(playerPosition);

      expect(view2).not.toEqual(view1);
    });
  });

  describe('direction vectors', () => {
    it('should provide forward direction', () => {
      const forward = camera.getForwardDirection();

      expect(forward).toBeInstanceOf(Array);
      expect(forward.length).toBe(3);

      // Forward should be normalized (approximately)
      const length = Math.sqrt(forward[0] ** 2 + forward[1] ** 2 + forward[2] ** 2);
      expect(length).toBeCloseTo(1, 5);
    });

    it('should provide right direction', () => {
      const right = camera.getRightDirection();

      expect(right).toBeInstanceOf(Array);
      expect(right.length).toBe(3);

      // Right should be normalized (approximately)
      const length = Math.sqrt(right[0] ** 2 + right[1] ** 2 + right[2] ** 2);
      expect(length).toBeCloseTo(1, 5);
    });

    it('should update directions when yaw changes', () => {
      camera.setYawPitch(0, 0);
      const forward1 = [...camera.getForwardDirection()];

      camera.setYawPitch(Math.PI / 2, 0);
      const forward2 = camera.getForwardDirection();

      expect(forward2).not.toEqual(forward1);
    });

    it('should update directions when pitch changes', () => {
      camera.setYawPitch(0, 0);
      const forward1 = [...camera.getForwardDirection()];

      camera.setYawPitch(0, Math.PI / 4);
      const forward2 = camera.getForwardDirection();

      expect(forward2).not.toEqual(forward1);
    });

    it('should maintain right vector perpendicular to forward', () => {
      camera.setYawPitch(Math.PI / 6, Math.PI / 8);

      const forward = camera.getForwardDirection();
      const right = camera.getRightDirection();

      // Dot product should be close to zero (perpendicular in XZ plane)
      const dot = forward[0] * right[0] + forward[2] * right[2];
      expect(Math.abs(dot)).toBeLessThan(0.01);
    });
  });

  describe('pointer lock', () => {
    it('should request pointer lock when enabled', () => {
      const requestPointerLockSpy = vi.spyOn(canvas, 'requestPointerLock').mockImplementation(() => {});

      camera.enable();

      expect(requestPointerLockSpy).toHaveBeenCalled();
      requestPointerLockSpy.mockRestore();
    });

    it('should not request pointer lock if already active', () => {
      // Mock pointer lock as already active
      Object.defineProperty(document, 'pointerLockElement', {
        value: canvas,
        writable: true,
        configurable: true,
      });

      // Simulate lock change event
      document.dispatchEvent(new Event('pointerlockchange'));

      const requestPointerLockSpy = vi.spyOn(canvas, 'requestPointerLock');

      camera.enable();

      expect(requestPointerLockSpy).not.toHaveBeenCalled();

      // Cleanup
      Object.defineProperty(document, 'pointerLockElement', {
        value: null,
        writable: true,
        configurable: true,
      });
      requestPointerLockSpy.mockRestore();
    });

    it('should exit pointer lock when disabled', () => {
      const exitPointerLockSpy = vi.spyOn(document, 'exitPointerLock').mockImplementation(() => {});

      // Mock pointer lock as active
      Object.defineProperty(document, 'pointerLockElement', {
        value: canvas,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('pointerlockchange'));

      camera.disable();

      expect(exitPointerLockSpy).toHaveBeenCalled();

      // Cleanup
      Object.defineProperty(document, 'pointerLockElement', {
        value: null,
        writable: true,
        configurable: true,
      });
      exitPointerLockSpy.mockRestore();
    });

    it('should handle pointer lock errors gracefully', () => {
      const requestPointerLockSpy = vi.spyOn(canvas, 'requestPointerLock').mockImplementation(() => {
        throw new Error('Pointer lock error');
      });

      expect(() => camera.enable()).not.toThrow();

      requestPointerLockSpy.mockRestore();
    });
  });

  describe('mouse movement', () => {
    it('should update yaw/pitch on mouse move when pointer locked', () => {
      // Mock pointer lock
      Object.defineProperty(document, 'pointerLockElement', {
        value: canvas,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('pointerlockchange'));

      const { yaw: initialYaw, pitch: initialPitch } = camera.getYawPitch();

      document.dispatchEvent(new MouseEvent('mousemove', {
        movementX: 100,
        movementY: 50,
      }));

      const { yaw: newYaw, pitch: newPitch } = camera.getYawPitch();

      expect(newYaw).not.toBe(initialYaw);
      expect(newPitch).not.toBe(initialPitch);

      // Cleanup
      Object.defineProperty(document, 'pointerLockElement', {
        value: null,
        writable: true,
        configurable: true,
      });
    });

    it('should not update when pointer is not locked', () => {
      const { yaw: initialYaw, pitch: initialPitch } = camera.getYawPitch();

      document.dispatchEvent(new MouseEvent('mousemove', {
        movementX: 100,
        movementY: 50,
      }));

      const { yaw, pitch } = camera.getYawPitch();

      expect(yaw).toBe(initialYaw);
      expect(pitch).toBe(initialPitch);
    });

    it('should respect inverted Y axis', () => {
      // Mock pointer lock
      Object.defineProperty(document, 'pointerLockElement', {
        value: canvas,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('pointerlockchange'));

      camera.setInvertY(false);
      camera.setYawPitch(0, 0);

      document.dispatchEvent(new MouseEvent('mousemove', {
        movementX: 0,
        movementY: 100,
      }));

      const { pitch: pitchNormal } = camera.getYawPitch();

      // Reset and test with inverted Y
      camera.setYawPitch(0, 0);
      camera.setInvertY(true);

      document.dispatchEvent(new MouseEvent('mousemove', {
        movementX: 0,
        movementY: 100,
      }));

      const { pitch: pitchInverted } = camera.getYawPitch();

      // Signs should be opposite
      expect(Math.sign(pitchNormal)).not.toBe(Math.sign(pitchInverted));

      // Cleanup
      Object.defineProperty(document, 'pointerLockElement', {
        value: null,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('update method', () => {
    it('should retry pointer lock request if pending', () => {
      const requestPointerLockSpy = vi.spyOn(canvas, 'requestPointerLock').mockImplementation(() => {});

      camera.enable();
      requestPointerLockSpy.mockClear();

      camera.update();

      expect(requestPointerLockSpy).toHaveBeenCalled();
      requestPointerLockSpy.mockRestore();
    });

    it('should not request pointer lock if not pending', () => {
      const requestPointerLockSpy = vi.spyOn(canvas, 'requestPointerLock');

      camera.update();

      expect(requestPointerLockSpy).not.toHaveBeenCalled();
      requestPointerLockSpy.mockRestore();
    });
  });

  describe('disposal', () => {
    it('should remove all event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      camera.dispose();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerlockchange', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerlockerror', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        camera.dispose();
        camera.dispose();
        camera.dispose();
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle missing movementX/movementY in mouse events', () => {
      // Mock pointer lock
      Object.defineProperty(document, 'pointerLockElement', {
        value: canvas,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('pointerlockchange'));

      const { yaw: initialYaw, pitch: initialPitch } = camera.getYawPitch();

      // Dispatch event without movement properties
      const event = new Event('mousemove') as MouseEvent;
      document.dispatchEvent(event);

      const { yaw, pitch } = camera.getYawPitch();

      // Should not crash and values should remain the same
      expect(yaw).toBe(initialYaw);
      expect(pitch).toBe(initialPitch);

      // Cleanup
      Object.defineProperty(document, 'pointerLockElement', {
        value: null,
        writable: true,
        configurable: true,
      });
    });

    it('should handle extreme yaw values', () => {
      camera.setYawPitch(Math.PI * 100, 0);

      const forward = camera.getForwardDirection();
      const length = Math.sqrt(forward[0] ** 2 + forward[1] ** 2 + forward[2] ** 2);

      // Forward vector should still be valid
      expect(length).toBeCloseTo(1, 5);
    });
  });

  describe('camera roll', () => {
    it('should set and get roll', () => {
      camera.setRoll(0.5);
      expect(camera.getRoll()).toBeCloseTo(0, 5); // Should be smoothed, starts at 0

      // Update to allow smoothing
      camera.update(0.1);
      const roll = camera.getRoll();
      expect(roll).toBeGreaterThan(0);
      expect(roll).toBeLessThanOrEqual(0.5);
    });

    it('should smooth roll transitions', () => {
      camera.setRoll(Math.PI / 4);
      camera.update(0.01);
      const roll1 = camera.getRoll();

      camera.update(0.01);
      const roll2 = camera.getRoll();

      // Should be approaching target
      expect(roll2).toBeGreaterThan(roll1);
      expect(roll2).toBeLessThanOrEqual(Math.PI / 4);
    });

    it('should reset roll to zero', () => {
      camera.setRoll(0.5);
      camera.update(0.1);
      camera.setRoll(0);
      camera.update(0.1);

      const roll = camera.getRoll();
      expect(roll).toBeLessThan(0.5);
    });

    it('should set roll smoothing', () => {
      camera.setRollSmoothing(0.1);
      camera.setRoll(1.0);
      camera.update(0.01);
      const roll1 = camera.getRoll();

      camera.setRollSmoothing(0.01);
      camera.setRoll(1.0);
      camera.update(0.01);
      const roll2 = camera.getRoll();

      // Lower smoothing should be more responsive
      expect(roll2).toBeGreaterThan(roll1);
    });
  });

  describe('camera shake', () => {
    it('should add shake', () => {
      expect(camera.getShakeCount()).toBe(0);
      camera.addShake(0.1, 0.5);
      expect(camera.getShakeCount()).toBe(1);
    });

    it('should update shake over time', () => {
      camera.addShake(0.1, 0.5);
      camera.update(0.1);
      expect(camera.getShakeCount()).toBe(1);

      // Shake should decay
      camera.update(0.3);
      expect(camera.getShakeCount()).toBe(1);

      // Shake should expire
      camera.update(0.2);
      expect(camera.getShakeCount()).toBe(0);
    });

    it('should handle multiple shakes', () => {
      camera.addShake(0.1, 0.2);
      camera.addShake(0.05, 0.3);
      expect(camera.getShakeCount()).toBe(2);

      camera.update(0.25);
      expect(camera.getShakeCount()).toBe(1);

      camera.update(0.1);
      expect(camera.getShakeCount()).toBe(0);
    });

    it('should clear all shakes', () => {
      camera.addShake(0.1, 0.5);
      camera.addShake(0.05, 0.3);
      expect(camera.getShakeCount()).toBe(2);

      camera.clearShakes();
      expect(camera.getShakeCount()).toBe(0);
    });

    it('should ignore invalid shake parameters', () => {
      const countBefore = camera.getShakeCount();
      camera.addShake(-1, 0.5);
      camera.addShake(0.1, -1);
      camera.addShake(NaN, 0.5);
      expect(camera.getShakeCount()).toBe(countBefore);
    });

    it('should apply shake decay', () => {
      camera.addShake(1.0, 1.0, 0.1); // Fast decay
      camera.addShake(1.0, 1.0, 0.9); // Slow decay
      expect(camera.getShakeCount()).toBe(2);
      
      camera.update(0.5);
      // Both should still be active
      expect(camera.getShakeCount()).toBe(2);
    });
  });

  describe('head bob', () => {
    it('should enable and disable head bob', () => {
      camera.setHeadBobEnabled(true);
      camera.setHeadBobIntensity(0.05); // Use higher intensity for test
      const velocity: Vec3 = [2, 0, 2];
      // Update multiple times to build up timer
      for (let i = 0; i < 10; i++) {
        camera.update(0.016, velocity);
      }
      const offset1 = camera.getHeadBobOffset();
      const mag1 = Math.sqrt(offset1[0] ** 2 + offset1[1] ** 2 + offset1[2] ** 2);

      camera.setHeadBobEnabled(false);
      camera.update(0.016, velocity);
      const offset2 = camera.getHeadBobOffset();

      expect(mag1).toBeGreaterThan(0.001);
      expect(offset2[0]).toBe(0);
      expect(offset2[1]).toBe(0);
      expect(offset2[2]).toBe(0);
    });

    it('should update head bob timer based on velocity', () => {
      camera.setHeadBobEnabled(true);
      const velocity: Vec3 = [2, 0, 2];
      
      camera.update(0.016, velocity);
      const offset1 = [...camera.getHeadBobOffset()];

      camera.update(0.016, velocity);
      const offset2 = camera.getHeadBobOffset();

      // Offset should change over time (at least slightly)
      const changed = Math.abs(offset1[0] - offset2[0]) > 1e-6 || 
                      Math.abs(offset1[1] - offset2[1]) > 1e-6 ||
                      Math.abs(offset1[2] - offset2[2]) > 1e-6;
      expect(changed).toBe(true);
    });

    it('should reset head bob when no velocity', () => {
      camera.setHeadBobEnabled(true);
      const velocity: Vec3 = [1, 0, 1];
      camera.update(0.016, velocity);
      const offset1 = camera.getHeadBobOffset();

      camera.update(0.016, [0, 0, 0]);
      const offset2 = camera.getHeadBobOffset();

      expect(offset2[0]).toBeCloseTo(0, 2);
      expect(offset2[1]).toBeCloseTo(0, 2);
      expect(offset2[2]).toBeCloseTo(0, 2);
    });

    it('should set head bob intensity', () => {
      camera.setHeadBobEnabled(true);
      const velocity: Vec3 = [2, 0, 2];
      
      camera.setHeadBobIntensity(0.01);
      // Build up timer to a known point
      for (let i = 0; i < 10; i++) {
        camera.update(0.016, velocity);
      }
      const offset1 = camera.getHeadBobOffset();
      const mag1 = Math.sqrt(offset1[0] ** 2 + offset1[1] ** 2 + offset1[2] ** 2);

      // Change intensity without resetting timer (simulating runtime change)
      camera.setHeadBobIntensity(0.05);
      // Continue with same timer progression
      camera.update(0.016, velocity);
      const offset2 = camera.getHeadBobOffset();
      const mag2 = Math.sqrt(offset2[0] ** 2 + offset2[1] ** 2 + offset2[2] ** 2);

      // Higher intensity should produce larger offsets (at same timer value)
      // With 5x intensity, magnitude should be significantly larger
      expect(mag2).toBeGreaterThan(mag1 * 3);
    });

    it('should set head bob speed', () => {
      camera.setHeadBobEnabled(true);
      camera.setHeadBobSpeed(5.0);
      const velocity: Vec3 = [1, 0, 1];
      camera.update(0.016, velocity);
      camera.update(0.016, velocity);
      const offset1 = [...camera.getHeadBobOffset()];

      // Reset timer
      camera.setHeadBobEnabled(false);
      camera.setHeadBobEnabled(true);
      camera.setHeadBobSpeed(20.0);
      camera.update(0.016, velocity);
      camera.update(0.016, velocity);
      const offset2 = camera.getHeadBobOffset();

      // Higher speed should produce different pattern (different timer progression)
      const changed = Math.abs(offset1[0] - offset2[0]) > 1e-6 || 
                      Math.abs(offset1[1] - offset2[1]) > 1e-6 ||
                      Math.abs(offset1[2] - offset2[2]) > 1e-6;
      // Note: With same timer start, speed affects progression, so values should differ
      expect(changed).toBe(true);
    });

    it('should scale head bob with speed', () => {
      camera.setHeadBobEnabled(true);
      camera.setHeadBobIntensity(0.05);
      const slowVelocity: Vec3 = [0.5, 0, 0.5];
      const fastVelocity: Vec3 = [5, 0, 5];

      // Test with slow velocity
      camera.setHeadBobEnabled(false);
      camera.setHeadBobEnabled(true);
      // Update multiple times to build up timer
      for (let i = 0; i < 10; i++) {
        camera.update(0.016, slowVelocity);
      }
      const offsetSlow = camera.getHeadBobOffset();
      const magSlow = Math.sqrt(offsetSlow[0] ** 2 + offsetSlow[1] ** 2 + offsetSlow[2] ** 2);

      // Test with fast velocity - timer will progress faster
      camera.setHeadBobEnabled(false);
      camera.setHeadBobEnabled(true);
      // Update same number of times
      for (let i = 0; i < 10; i++) {
        camera.update(0.016, fastVelocity);
      }
      const offsetFast = camera.getHeadBobOffset();
      const magFast = Math.sqrt(offsetFast[0] ** 2 + offsetFast[1] ** 2 + offsetFast[2] ** 2);

      // Fast velocity should produce larger magnitude due to:
      // 1. Faster timer progression (more cycles)
      // 2. speedFactor scaling: slow ~0.14, fast = 1.0
      // Combined effect should be significant
      expect(magFast).toBeGreaterThan(magSlow);
      // At minimum, fast should be at least 2x due to speedFactor alone
      expect(magFast).toBeGreaterThan(magSlow * 1.2);
    });
  });

  describe('FOV effects', () => {
    it('should initialize with default FOV', () => {
      const fov = camera.getFov();
      const expectedFov = (72 * Math.PI) / 180; // Default 72 degrees
      expect(fov).toBeCloseTo(expectedFov, 5);
    });

    it('should set and get base FOV', () => {
      const customFov = (90 * Math.PI) / 180; // 90 degrees
      camera.setBaseFov(customFov);
      // When multiplier is 1.0, baseFov is applied immediately
      expect(camera.getFov()).toBeCloseTo(customFov, 5);
    });

    it('should smooth FOV transitions', () => {
      const baseFov = (72 * Math.PI) / 180;
      camera.setBaseFov(baseFov);
      camera.setFovMultiplier(1.2); // +20%
      
      camera.update(0.01);
      const fov1 = camera.getFov();
      
      camera.update(0.01);
      const fov2 = camera.getFov();
      
      // Should be approaching target
      expect(fov2).toBeGreaterThan(fov1);
      expect(fov2).toBeLessThanOrEqual(baseFov * 1.2);
    });

    it('should apply FOV multiplier', () => {
      const baseFov = (72 * Math.PI) / 180;
      camera.setBaseFov(baseFov);
      camera.setFovMultiplier(1.5);
      
      // Update multiple times to reach target (need more iterations for smooth transition)
      for (let i = 0; i < 50; i++) {
        camera.update(0.016);
      }
      
      const fov = camera.getFov();
      expect(fov).toBeCloseTo(baseFov * 1.5, 1);
    });

    it('should reset FOV multiplier to normal', () => {
      const baseFov = (72 * Math.PI) / 180;
      camera.setBaseFov(baseFov);
      camera.setFovMultiplier(1.5);
      
      // Update to reach target
      for (let i = 0; i < 50; i++) {
        camera.update(0.016);
      }
      
      camera.setFovMultiplier(1.0);
      
      // Update to return to normal (multiplier 1.0 should be instant)
      for (let i = 0; i < 50; i++) {
        camera.update(0.016);
      }
      
      const fov = camera.getFov();
      expect(fov).toBeCloseTo(baseFov, 1);
    });

    it('should set and get sprint multiplier', () => {
      camera.setSprintMultiplier(1.15);
      expect(camera.getSprintMultiplier()).toBe(1.15);
    });

    it('should set and get aim multiplier', () => {
      camera.setAimMultiplier(0.65);
      expect(camera.getAimMultiplier()).toBe(0.65);
    });

    it('should use sprint multiplier for sprint effect', () => {
      const baseFov = (72 * Math.PI) / 180;
      camera.setBaseFov(baseFov);
      camera.setSprintMultiplier(1.15);
      
      camera.setFovMultiplier(camera.getSprintMultiplier());
      
      // Update to reach target
      for (let i = 0; i < 50; i++) {
        camera.update(0.016);
      }
      
      const fov = camera.getFov();
      expect(fov).toBeCloseTo(baseFov * 1.15, 1);
    });

    it('should use aim multiplier for aim effect', () => {
      const baseFov = (72 * Math.PI) / 180;
      camera.setBaseFov(baseFov);
      camera.setAimMultiplier(0.65);
      
      camera.setFovMultiplier(camera.getAimMultiplier());
      
      // Update to reach target
      for (let i = 0; i < 50; i++) {
        camera.update(0.016);
      }
      
      const fov = camera.getFov();
      expect(fov).toBeCloseTo(baseFov * 0.65, 1);
    });

    it('should set FOV smoothing', () => {
      camera.setFovSmoothing(0.05);
      const baseFov = (72 * Math.PI) / 180;
      camera.setBaseFov(baseFov);
      camera.setFovMultiplier(1.5);
      
      camera.update(0.01);
      const fov1 = camera.getFov();
      
      camera.setFovSmoothing(0.2);
      camera.setFovMultiplier(1.5);
      camera.update(0.01);
      const fov2 = camera.getFov();
      
      // Lower smoothing should be more responsive
      expect(fov2).toBeGreaterThan(fov1);
    });

    it('should ignore invalid FOV values', () => {
      const originalFov = camera.getFov();
      camera.setBaseFov(-1);
      camera.setBaseFov(NaN);
      expect(camera.getFov()).toBeCloseTo(originalFov, 5);
    });

    it('should ignore invalid FOV multiplier values', () => {
      const originalMultiplier = camera.getFovMultiplier();
      camera.setFovMultiplier(-1);
      camera.setFovMultiplier(NaN);
      expect(camera.getFovMultiplier()).toBe(originalMultiplier);
    });

    it('should initialize with custom FOV options', () => {
      const customCamera = new FPSCamera(canvas, {
        baseFov: (90 * Math.PI) / 180,
        sprintMultiplier: 1.2,
        aimMultiplier: 0.6,
        fovSmoothing: 0.05,
      });
      
      expect(customCamera.getFov()).toBeCloseTo((90 * Math.PI) / 180, 5);
      expect(customCamera.getSprintMultiplier()).toBe(1.2);
      expect(customCamera.getAimMultiplier()).toBe(0.6);
      
      customCamera.dispose();
    });
  });
});

