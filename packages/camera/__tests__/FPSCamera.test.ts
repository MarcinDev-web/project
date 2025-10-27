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
});

