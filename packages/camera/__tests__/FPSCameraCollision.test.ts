/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FPSCamera } from '../src/FPSCamera';
import type { Vec3 } from '@engine/core/math';
import type { IFPSCameraCollisionProvider } from '../src/types';
import { FPSRaycastCollision } from '../src/collision/FPSRaycastCollision';
import type { PhysicsWorld, RaycastHit } from '@engine/world';

function mockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'style', {
    value: { cursor: '' },
    writable: true,
  });
  
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

class MockCollisionProvider implements IFPSCameraCollisionProvider {
  public resolveEyeCallCount = 0;
  public lastDesiredEye: Vec3 | null = null;
  public lastForward: Vec3 | null = null;
  public pushBackAmount = 0;

  resolveEye(out: Vec3, desiredEye: Readonly<Vec3>, forward: Readonly<Vec3>): Vec3 {
    this.resolveEyeCallCount++;
    this.lastDesiredEye = [...desiredEye] as Vec3;
    this.lastForward = [...forward] as Vec3;

    // Simple push-back along forward direction
    if (this.pushBackAmount > 0) {
      out[0] = desiredEye[0] - forward[0] * this.pushBackAmount;
      out[1] = desiredEye[1] - forward[1] * this.pushBackAmount;
      out[2] = desiredEye[2] - forward[2] * this.pushBackAmount;
    } else {
      out[0] = desiredEye[0];
      out[1] = desiredEye[1];
      out[2] = desiredEye[2];
    }

    return out;
  }
}

describe('FPSCamera Collision Detection', () => {
  let canvas: HTMLCanvasElement;
  let camera: FPSCamera;
  let mockProvider: MockCollisionProvider;

  beforeEach(() => {
    canvas = mockCanvas();
    camera = new FPSCamera(canvas);
    mockProvider = new MockCollisionProvider();
  });

  afterEach(() => {
    try {
      camera.dispose();
    } catch {}
    try {
      canvas.remove();
    } catch {}
  });

  describe('collision provider', () => {
    it('should not call provider when collision is disabled', () => {
      camera.setCollisionProvider(mockProvider);
      camera.setCollisionEnabled(false);

      const playerPosition: Vec3 = [0, 0, 0];
      camera.getViewMatrix(playerPosition);

      expect(mockProvider.resolveEyeCallCount).toBe(0);
    });

    it('should call provider when collision is enabled', () => {
      camera.setCollisionProvider(mockProvider);
      camera.setCollisionEnabled(true);

      const playerPosition: Vec3 = [0, 0, 0];
      camera.getViewMatrix(playerPosition);

      expect(mockProvider.resolveEyeCallCount).toBe(1);
      expect(mockProvider.lastDesiredEye).not.toBeNull();
    });

    it('should pass correct eye position and forward to provider', () => {
      camera.setCollisionProvider(mockProvider);
      camera.setCollisionEnabled(true);
      camera.setEyeHeight(1.6);

      const playerPosition: Vec3 = [5, 10, 15];
      camera.getViewMatrix(playerPosition);

      expect(mockProvider.lastDesiredEye).not.toBeNull();
      if (mockProvider.lastDesiredEye) {
        // Eye should be at player position + eye height
        expect(mockProvider.lastDesiredEye[0]).toBeCloseTo(5, 5);
        expect(mockProvider.lastDesiredEye[1]).toBeCloseTo(11.6, 5); // 10 + 1.6
        expect(mockProvider.lastDesiredEye[2]).toBeCloseTo(15, 5);
      }
      expect(mockProvider.lastForward).not.toBeNull();
    });

    it('should apply provider correction to view matrix', () => {
      mockProvider.pushBackAmount = 0.5;
      camera.setCollisionProvider(mockProvider);
      camera.setCollisionEnabled(true);
      camera.setYawPitch(0, 0); // Set known orientation

      const playerPosition: Vec3 = [0, 0, 0];
      const viewMatrix1 = new Float32Array(camera.getViewMatrix(playerPosition));

      // Disable collision and get matrix again
      camera.setCollisionEnabled(false);
      const viewMatrix2 = camera.getViewMatrix(playerPosition);

      // Matrices should differ due to collision correction
      // Check translation component (elements 12, 13, 14)
      const diff = Math.abs(viewMatrix1[12] - viewMatrix2[12]) +
                   Math.abs(viewMatrix1[13] - viewMatrix2[13]) +
                   Math.abs(viewMatrix1[14] - viewMatrix2[14]);
      expect(diff).toBeGreaterThan(0.1);
    });

    it('should dispose old provider when setting new one', () => {
      const provider1 = new MockCollisionProvider();
      const provider2 = new MockCollisionProvider();
      
      let disposed1 = false;
      provider1.dispose = () => {
        disposed1 = true;
      };

      camera.setCollisionProvider(provider1);
      camera.setCollisionProvider(provider2);

      expect(disposed1).toBe(true);
    });

    it('should handle null provider', () => {
      camera.setCollisionProvider(mockProvider);
      camera.setCollisionProvider(null);
      camera.setCollisionEnabled(true);

      const playerPosition: Vec3 = [0, 0, 0];
      // Should not throw
      expect(() => camera.getViewMatrix(playerPosition)).not.toThrow();
    });

    it('should set and get collision radius', () => {
      camera.setCollisionRadius(0.3);
      expect(camera.getCollisionRadius()).toBe(0.3);

      camera.setCollisionRadius(0.5);
      expect(camera.getCollisionRadius()).toBe(0.5);
    });

    it('should ignore invalid collision radius', () => {
      const originalRadius = camera.getCollisionRadius();
      camera.setCollisionRadius(-1);
      expect(camera.getCollisionRadius()).toBe(originalRadius);

      camera.setCollisionRadius(NaN);
      expect(camera.getCollisionRadius()).toBe(originalRadius);
    });
  });

  describe('FPSRaycastCollision integration', () => {
    it('should create FPSRaycastCollision with default options', () => {
      const mockPhysics = {
        raycast: vi.fn(() => null),
      } as unknown as PhysicsWorld;

      const provider = new FPSRaycastCollision({
        physics: mockPhysics,
      });

      expect(provider).toBeDefined();
    });

    it('should use custom options', () => {
      const mockPhysics = {
        raycast: vi.fn(() => null),
      } as unknown as PhysicsWorld;

      const provider = new FPSRaycastCollision({
        physics: mockPhysics,
        radius: 0.3,
        backoff: 0.05,
        maxIters: 3,
        sampleCount: 12,
      });

      expect(provider).toBeDefined();
    });

    it('should perform raycasts when resolving eye', () => {
      const mockPhysics = {
        raycast: vi.fn(() => null),
      } as unknown as PhysicsWorld;

      const provider = new FPSRaycastCollision({
        physics: mockPhysics,
        sampleCount: 6,
        maxIters: 2,
      });

      const desiredEye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      const out: Vec3 = [0, 0, 0];

      provider.resolveEye(out, desiredEye, forward);

      // Should perform at least 6 raycasts (one per sample direction)
      // Early exit may prevent second iteration if no hits
      expect(mockPhysics.raycast).toHaveBeenCalled();
      expect(mockPhysics.raycast.mock.calls.length).toBeGreaterThanOrEqual(6);
    });

    it('should push back eye when hit is detected', () => {
      const mockHit: RaycastHit = {
        entity: {} as any,
        physics: {} as any,
        colliderIndex: 0,
        point: [0, 0, -0.1],
        normal: [0, 0, 1],
        distance: 0.1,
      };

      const mockPhysics = {
        raycast: vi.fn(() => mockHit),
      } as unknown as PhysicsWorld;

      const provider = new FPSRaycastCollision({
        physics: mockPhysics,
        radius: 0.2,
        backoff: 0.03,
        maxIters: 1,
        sampleCount: 6,
      });

      const desiredEye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      const out: Vec3 = [0, 0, 0];

      provider.resolveEye(out, desiredEye, forward);

      // Eye should be pushed back
      expect(out).not.toEqual(desiredEye);
    });

    it('should use hit normal when available', () => {
      const mockHit: RaycastHit = {
        entity: {} as any,
        physics: {} as any,
        colliderIndex: 0,
        point: [0, 0, -0.1],
        normal: [0, 0, 1], // Normal pointing back
        distance: 0.1,
      };

      const mockPhysics = {
        raycast: vi.fn(() => mockHit),
      } as unknown as PhysicsWorld;

      const provider = new FPSRaycastCollision({
        physics: mockPhysics,
        radius: 0.2,
        backoff: 0.03,
        maxIters: 1,
        sampleCount: 6,
      });

      const desiredEye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      const out: Vec3 = [0, 0, 0];

      provider.resolveEye(out, desiredEye, forward);

      // Should use normal for correction direction
      expect(mockPhysics.raycast).toHaveBeenCalled();
    });

    it('should handle multiple iterations', () => {
      let callCount = 0;
      const mockPhysics = {
        raycast: vi.fn(() => {
          callCount++;
          // Return hit on first few calls, then no hit
          if (callCount <= 6) {
            return {
              entity: {} as any,
              physics: {} as any,
              colliderIndex: 0,
              point: [0, 0, -0.1],
              normal: [0, 0, 1],
              distance: 0.1,
            } as RaycastHit;
          }
          return null;
        }),
      } as unknown as PhysicsWorld;

      const provider = new FPSRaycastCollision({
        physics: mockPhysics,
        maxIters: 2,
        sampleCount: 6,
      });

      const desiredEye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      const out: Vec3 = [0, 0, 0];

      provider.resolveEye(out, desiredEye, forward);

      // Should perform raycasts for both iterations
      expect(mockPhysics.raycast).toHaveBeenCalledTimes(12); // 6 samples * 2 iterations
    });

    it('should clamp correction magnitude', () => {
      const mockHit: RaycastHit = {
        entity: {} as any,
        physics: {} as any,
        colliderIndex: 0,
        point: [0, 0, -0.1],
        normal: [0, 0, 1],
        distance: 0.01, // Very close hit
      };

      const mockPhysics = {
        raycast: vi.fn(() => mockHit),
      } as unknown as PhysicsWorld;

      const provider = new FPSRaycastCollision({
        physics: mockPhysics,
        radius: 0.2,
        backoff: 0.03,
        maxIters: 1,
        sampleCount: 6,
      });

      const desiredEye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      const out: Vec3 = [0, 0, 0];

      provider.resolveEye(out, desiredEye, forward);

      // Correction should be clamped to maxDistance (with small epsilon for floating point)
      const correctionMag = Math.sqrt(
        (out[0] - desiredEye[0]) ** 2 +
        (out[1] - desiredEye[1]) ** 2 +
        (out[2] - desiredEye[2]) ** 2
      );
      expect(correctionMag).toBeLessThanOrEqual(0.23 + 1e-5); // radius + backoff + epsilon
    });
  });
});

