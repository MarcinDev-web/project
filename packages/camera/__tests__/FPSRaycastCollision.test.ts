/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FPSRaycastCollision, type FPSRaycastCollisionOptions } from '../src/collision/FPSRaycastCollision';
import type { Vec3 } from '@engine/core/math';
import type { PhysicsWorld, RaycastResult } from '@engine/world';

// Mock PhysicsWorld
function createMockPhysicsWorld(raycastResults: Map<string, RaycastResult | null> = new Map()): PhysicsWorld {
  return {
    raycast: vi.fn((origin: Vec3, direction: Vec3, options?: { maxDistance?: number }) => {
      // Generate a key based on direction for deterministic testing
      const key = `${direction[0].toFixed(1)},${direction[1].toFixed(1)},${direction[2].toFixed(1)}`;
      return raycastResults.get(key) ?? null;
    }),
  } as unknown as PhysicsWorld;
}

describe('FPSRaycastCollision', () => {
  describe('initialization', () => {
    it('should initialize with default options', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics });

      expect(collision).toBeDefined();
      collision.dispose();
    });

    it('should initialize with 6 sample directions by default', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics });

      const eye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      collision.resolveEye(eye, eye, forward);

      // Should have called raycast 6 times (±X, ±Y, ±Z)
      expect(physics.raycast).toHaveBeenCalledTimes(6);

      collision.dispose();
    });

    it('should initialize with 12 sample directions when specified', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics, sampleCount: 12 });

      const eye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      collision.resolveEye(eye, eye, forward);

      // Should have called raycast 12 times (±X, ±Y, ±Z + diagonals)
      expect(physics.raycast).toHaveBeenCalledTimes(12);

      collision.dispose();
    });

    it('should fallback to 6 directions for unsupported sample count', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics, sampleCount: 8 }); // Unsupported

      const eye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      collision.resolveEye(eye, eye, forward);

      // Should fallback to 6 directions
      expect(physics.raycast).toHaveBeenCalledTimes(6);

      collision.dispose();
    });

    it('should accept custom radius', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics, radius: 0.5 });

      expect(collision).toBeDefined();
      collision.dispose();
    });

    it('should accept custom backoff', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics, backoff: 0.1 });

      expect(collision).toBeDefined();
      collision.dispose();
    });

    it('should accept custom maxIters', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics, maxIters: 5 });

      expect(collision).toBeDefined();
      collision.dispose();
    });
  });

  describe('resolveEye without collision', () => {
    it('should return unchanged eye position when no collisions', () => {
      const physics = createMockPhysicsWorld(); // No hits
      const collision = new FPSRaycastCollision({ physics });

      const desiredEye: Vec3 = [5, 2, 3];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      expect(out[0]).toBe(desiredEye[0]);
      expect(out[1]).toBe(desiredEye[1]);
      expect(out[2]).toBe(desiredEye[2]);

      collision.dispose();
    });

    it('should work with in-place modification (out === desiredEye)', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics });

      const eye: Vec3 = [1, 2, 3];
      const forward: Vec3 = [0, 0, -1];

      const result = collision.resolveEye(eye, eye, forward);

      expect(result).toBe(eye);
      expect(eye[0]).toBe(1);
      expect(eye[1]).toBe(2);
      expect(eye[2]).toBe(3);

      collision.dispose();
    });
  });

  describe('resolveEye with collision', () => {
    it('should push eye away from collision in +X direction', () => {
      const results = new Map<string, RaycastResult>([
        ['1.0,0.0,0.0', {
          entity: null as any,
          distance: 0.1, // Less than maxDistance (0.2 + 0.03 = 0.23)
          point: [0.1, 0, 0] as Vec3,
          normal: [-1, 0, 0] as Vec3, // Normal pointing away from hit
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ physics });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      // Should be pushed in negative X direction (away from wall)
      expect(out[0]).toBeLessThan(0);

      collision.dispose();
    });

    it('should push eye away from collision in -Y direction', () => {
      const results = new Map<string, RaycastResult>([
        ['0.0,-1.0,0.0', {
          entity: null as any,
          distance: 0.15,
          point: [0, -0.15, 0] as Vec3,
          normal: [0, 1, 0] as Vec3, // Normal pointing up
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ physics });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      // Should be pushed up (positive Y)
      expect(out[1]).toBeGreaterThan(0);

      collision.dispose();
    });

    it('should use hit.normal for correction direction', () => {
      // Hit in +X but normal points in diagonal
      const results = new Map<string, RaycastResult>([
        ['1.0,0.0,0.0', {
          entity: null as any,
          distance: 0.1,
          point: [0.1, 0, 0] as Vec3,
          normal: [-0.707, 0.707, 0] as Vec3, // Diagonal normal
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ physics });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      // Should be pushed along normal direction (both -X and +Y)
      expect(out[0]).toBeLessThan(0);
      expect(out[1]).toBeGreaterThan(0);

      collision.dispose();
    });

    it('should fallback to opposite direction when normal is zero', () => {
      const results = new Map<string, RaycastResult>([
        ['1.0,0.0,0.0', {
          entity: null as any,
          distance: 0.1,
          point: [0.1, 0, 0] as Vec3,
          normal: [0, 0, 0] as Vec3, // Zero normal
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ physics });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      // Should be pushed in negative X (opposite of ray direction)
      expect(out[0]).toBeLessThan(0);

      collision.dispose();
    });

    it('should handle multiple collisions', () => {
      const results = new Map<string, RaycastResult>([
        ['1.0,0.0,0.0', {
          entity: null as any,
          distance: 0.1,
          point: [0.1, 0, 0] as Vec3,
          normal: [-1, 0, 0] as Vec3,
        }],
        ['0.0,0.0,1.0', {
          entity: null as any,
          distance: 0.1,
          point: [0, 0, 0.1] as Vec3,
          normal: [0, 0, -1] as Vec3,
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ physics });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      // Should be pushed away from both walls
      expect(out[0]).toBeLessThan(0);
      expect(out[2]).toBeLessThan(0);

      collision.dispose();
    });
  });

  describe('correction clamping', () => {
    it('should clamp correction magnitude to prevent overshooting', () => {
      // Create a scenario with large penetration on all axes
      const sqrt3 = 1 / Math.sqrt(3);
      const results = new Map<string, RaycastResult>([
        ['1.0,0.0,0.0', {
          entity: null as any,
          distance: 0.01, // Very close - large penetration
          point: [0.01, 0, 0] as Vec3,
          normal: [-1, 0, 0] as Vec3,
        }],
        ['-1.0,0.0,0.0', {
          entity: null as any,
          distance: 0.01,
          point: [-0.01, 0, 0] as Vec3,
          normal: [1, 0, 0] as Vec3,
        }],
        ['0.0,1.0,0.0', {
          entity: null as any,
          distance: 0.01,
          point: [0, 0.01, 0] as Vec3,
          normal: [0, -1, 0] as Vec3,
        }],
        ['0.0,-1.0,0.0', {
          entity: null as any,
          distance: 0.01,
          point: [0, -0.01, 0] as Vec3,
          normal: [0, 1, 0] as Vec3,
        }],
        ['0.0,0.0,1.0', {
          entity: null as any,
          distance: 0.01,
          point: [0, 0, 0.01] as Vec3,
          normal: [0, 0, -1] as Vec3,
        }],
        ['0.0,0.0,-1.0', {
          entity: null as any,
          distance: 0.01,
          point: [0, 0, -0.01] as Vec3,
          normal: [0, 0, 1] as Vec3,
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ 
        physics, 
        radius: 0.2,
        backoff: 0.03,
        maxIters: 1, // Single iteration to test clamping
      });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      // Calculate correction magnitude
      const correctionMag = Math.sqrt(out[0] ** 2 + out[1] ** 2 + out[2] ** 2);
      const maxDistance = 0.2 + 0.03; // radius + backoff

      // Correction should be clamped
      expect(correctionMag).toBeLessThanOrEqual(maxDistance + 0.001); // Small epsilon for floating point

      collision.dispose();
    });
  });

  describe('early exit optimization', () => {
    it('should exit early when correction is negligible', () => {
      // No collision - no correction needed, should exit after first iteration
      const physics = createMockPhysicsWorld(); // No hits
      const collision = new FPSRaycastCollision({ 
        physics,
        maxIters: 5, // Allow multiple iterations
      });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      // With no collision (correction = 0 < 0.001), should exit after 1 iteration
      // So raycast should be called only 6 times (1 iteration * 6 directions)
      expect(physics.raycast).toHaveBeenCalledTimes(6);

      collision.dispose();
    });

    it('should iterate multiple times when correction is significant', () => {
      // Significant collision - needs multiple iterations
      const results = new Map<string, RaycastResult>([
        ['1.0,0.0,0.0', {
          entity: null as any,
          distance: 0.1, // Significant penetration
          point: [0.1, 0, 0] as Vec3,
          normal: [-1, 0, 0] as Vec3,
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ 
        physics,
        maxIters: 2,
      });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      // Should iterate twice (2 iterations * 6 directions = 12 calls)
      expect(physics.raycast).toHaveBeenCalledTimes(12);

      collision.dispose();
    });
  });

  describe('disposal', () => {
    it('should dispose without errors', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics });

      expect(() => collision.dispose()).not.toThrow();
    });

    it('should be safe to call dispose multiple times', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics });

      expect(() => {
        collision.dispose();
        collision.dispose();
        collision.dispose();
      }).not.toThrow();
    });
  });

  describe('raycast options', () => {
    it('should pass maxDistance to raycast', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ 
        physics,
        radius: 0.3,
        backoff: 0.05,
      });

      const eye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      collision.resolveEye(eye, eye, forward);

      // maxDistance should be radius + backoff = 0.35
      expect(physics.raycast).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ maxDistance: 0.35 })
      );

      collision.dispose();
    });
  });

  describe('12 sample directions with diagonals', () => {
    it('should sample in diagonal directions', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics, sampleCount: 12 });

      const eye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      collision.resolveEye(eye, eye, forward);

      // Should have called with diagonal directions
      const calls = (physics.raycast as any).mock.calls;
      const directions = calls.map((call: any) => call[1]);
      
      // Check that at least one diagonal exists (normalized: 1/sqrt(3) ≈ 0.577)
      const sqrt3 = 1 / Math.sqrt(3);
      const hasDiagonal = directions.some((dir: Vec3) => 
        Math.abs(Math.abs(dir[0]) - sqrt3) < 0.01 &&
        Math.abs(Math.abs(dir[1]) - sqrt3) < 0.01 &&
        Math.abs(Math.abs(dir[2]) - sqrt3) < 0.01
      );
      expect(hasDiagonal).toBe(true);

      collision.dispose();
    });

    it('should handle diagonal collision', () => {
      const sqrt3 = 1 / Math.sqrt(3);
      const results = new Map<string, RaycastResult>([
        [`${sqrt3.toFixed(1)},${sqrt3.toFixed(1)},${sqrt3.toFixed(1)}`, {
          entity: null as any,
          distance: 0.1,
          point: [sqrt3 * 0.1, sqrt3 * 0.1, sqrt3 * 0.1] as Vec3,
          normal: [-sqrt3, -sqrt3, -sqrt3] as Vec3,
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ physics, sampleCount: 12 });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      // Should be pushed in diagonal direction
      expect(out[0]).toBeLessThan(0);
      expect(out[1]).toBeLessThan(0);
      expect(out[2]).toBeLessThan(0);

      collision.dispose();
    });
  });

  describe('ignoreEntities', () => {
    it('should accept ignoreEntities in constructor', () => {
      const physics = createMockPhysicsWorld();
      const mockEntity = { id: 'player' } as any;
      const collision = new FPSRaycastCollision({ 
        physics, 
        ignoreEntities: [mockEntity] 
      });

      expect(collision.getIgnoreEntities()).toContain(mockEntity);
      collision.dispose();
    });

    it('should pass ignoreEntities to raycast', () => {
      const physics = createMockPhysicsWorld();
      const mockEntity = { id: 'player' } as any;
      const collision = new FPSRaycastCollision({ 
        physics, 
        ignoreEntities: [mockEntity] 
      });

      const eye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      collision.resolveEye(eye, eye, forward);

      expect(physics.raycast).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ ignoreEntities: [mockEntity] })
      );

      collision.dispose();
    });

    it('should not pass ignoreEntities when empty', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics });

      const eye: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];
      collision.resolveEye(eye, eye, forward);

      // Verify raycast was called with options that don't include ignoreEntities
      expect(physics.raycast).toHaveBeenCalled();
      const lastCall = vi.mocked(physics.raycast).mock.calls[0];
      const options = lastCall?.[2];
      // When ignoreEntities is empty, it should not be passed at all
      expect(options).not.toHaveProperty('ignoreEntities');

      collision.dispose();
    });

    it('should allow setting ignoreEntities at runtime', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics });
      const mockEntity = { id: 'player' } as any;

      collision.setIgnoreEntities([mockEntity]);
      expect(collision.getIgnoreEntities()).toContain(mockEntity);

      collision.dispose();
    });

    it('should allow adding single entity to ignore list', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics });
      const mockEntity1 = { id: 'player1' } as any;
      const mockEntity2 = { id: 'player2' } as any;

      collision.addIgnoreEntity(mockEntity1);
      collision.addIgnoreEntity(mockEntity2);
      
      expect(collision.getIgnoreEntities()).toHaveLength(2);
      expect(collision.getIgnoreEntities()).toContain(mockEntity1);
      expect(collision.getIgnoreEntities()).toContain(mockEntity2);

      collision.dispose();
    });

    it('should not add duplicate entities', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics });
      const mockEntity = { id: 'player' } as any;

      collision.addIgnoreEntity(mockEntity);
      collision.addIgnoreEntity(mockEntity);
      
      expect(collision.getIgnoreEntities()).toHaveLength(1);

      collision.dispose();
    });

    it('should allow removing entity from ignore list', () => {
      const physics = createMockPhysicsWorld();
      const mockEntity = { id: 'player' } as any;
      const collision = new FPSRaycastCollision({ 
        physics, 
        ignoreEntities: [mockEntity] 
      });

      collision.removeIgnoreEntity(mockEntity);
      expect(collision.getIgnoreEntities()).toHaveLength(0);

      collision.dispose();
    });

    it('should handle removing non-existent entity gracefully', () => {
      const physics = createMockPhysicsWorld();
      const collision = new FPSRaycastCollision({ physics });
      const mockEntity = { id: 'player' } as any;

      expect(() => collision.removeIgnoreEntity(mockEntity)).not.toThrow();
      expect(collision.getIgnoreEntities()).toHaveLength(0);

      collision.dispose();
    });

    it('should allow clearing all ignored entities', () => {
      const physics = createMockPhysicsWorld();
      const mockEntity1 = { id: 'player1' } as any;
      const mockEntity2 = { id: 'player2' } as any;
      const collision = new FPSRaycastCollision({ 
        physics, 
        ignoreEntities: [mockEntity1, mockEntity2] 
      });

      collision.clearIgnoreEntities();
      expect(collision.getIgnoreEntities()).toHaveLength(0);

      collision.dispose();
    });

    it('should clear ignore list on dispose', () => {
      const physics = createMockPhysicsWorld();
      const mockEntity = { id: 'player' } as any;
      const collision = new FPSRaycastCollision({ 
        physics, 
        ignoreEntities: [mockEntity] 
      });

      collision.dispose();
      expect(collision.getIgnoreEntities()).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle collision at exact maxDistance boundary', () => {
      const results = new Map<string, RaycastResult>([
        ['1.0,0.0,0.0', {
          entity: null as any,
          distance: 0.23, // Exactly at maxDistance (0.2 + 0.03)
          point: [0.23, 0, 0] as Vec3,
          normal: [-1, 0, 0] as Vec3,
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ physics });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      // Should not crash and return position unchanged (no penetration)
      expect(() => collision.resolveEye(out, desiredEye, forward)).not.toThrow();

      collision.dispose();
    });

    it('should handle collision beyond maxDistance (ignored)', () => {
      const results = new Map<string, RaycastResult>([
        ['1.0,0.0,0.0', {
          entity: null as any,
          distance: 0.5, // Beyond maxDistance
          point: [0.5, 0, 0] as Vec3,
          normal: [-1, 0, 0] as Vec3,
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ physics });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      collision.resolveEye(out, desiredEye, forward);

      // Should remain unchanged (collision beyond range)
      expect(out[0]).toBe(0);
      expect(out[1]).toBe(0);
      expect(out[2]).toBe(0);

      collision.dispose();
    });

    it('should handle zero distance collision', () => {
      const results = new Map<string, RaycastResult>([
        ['1.0,0.0,0.0', {
          entity: null as any,
          distance: 0, // Inside geometry
          point: [0, 0, 0] as Vec3,
          normal: [-1, 0, 0] as Vec3,
        }],
      ]);
      const physics = createMockPhysicsWorld(results);
      const collision = new FPSRaycastCollision({ physics });

      const desiredEye: Vec3 = [0, 0, 0];
      const out: Vec3 = [0, 0, 0];
      const forward: Vec3 = [0, 0, -1];

      // Should handle gracefully
      expect(() => collision.resolveEye(out, desiredEye, forward)).not.toThrow();
      // Should push maximally away
      expect(out[0]).toBeLessThan(0);

      collision.dispose();
    });
  });
});

