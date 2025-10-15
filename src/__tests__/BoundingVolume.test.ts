import { describe, it, expect } from 'vitest';
import { BoundingVolume, type AABB } from '../physics/BoundingVolume';
import { Entity } from '../scene/Entity';
import { PhysicsComponent } from '../scene/components/PhysicsComponent';

describe('BoundingVolume', () => {
  describe('fromCenterSize', () => {
    it('should create AABB from center and half extents', () => {
      const aabb = BoundingVolume.fromCenterSize([0, 0, 0], [5, 5, 5]);

      expect(aabb.min).toEqual([-5, -5, -5]);
      expect(aabb.max).toEqual([5, 5, 5]);
    });

    it('should handle non-uniform sizes', () => {
      const aabb = BoundingVolume.fromCenterSize([1, 2, 3], [2, 3, 4]);

      expect(aabb.min).toEqual([-1, -1, -1]);
      expect(aabb.max).toEqual([3, 5, 7]);
    });
  });

  describe('fromEntity', () => {
    it('should create AABB from entity with box collider', () => {
      const entity = new Entity('TestEntity');
      entity.transform.position = [5, 5, 5];
      entity.transform.scale = [2, 2, 2];

      const physics = new PhysicsComponent();
      physics.addBoxCollider([1, 1, 1]);
      entity.addComponent(physics);

      const aabb = BoundingVolume.fromEntity(entity, physics);

      expect(aabb.min[0]).toBeCloseTo(4, 1);
      expect(aabb.max[0]).toBeCloseTo(6, 1);
    });

    it('should create AABB from entity with sphere collider', () => {
      const entity = new Entity('TestEntity');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [2, 2, 2];

      const physics = new PhysicsComponent();
      physics.addSphereCollider(1.0);
      entity.addComponent(physics);

      const aabb = BoundingVolume.fromEntity(entity, physics);

      expect(aabb.min[0]).toBeCloseTo(-2, 1);
      expect(aabb.max[0]).toBeCloseTo(2, 1);
    });

    it('should create AABB from entity with multiple colliders', () => {
      const entity = new Entity('TestEntity');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [1, 1, 1];

      const physics = new PhysicsComponent();
      physics.addBoxCollider([1, 1, 1], [-2, 0, 0]);
      physics.addBoxCollider([1, 1, 1], [2, 0, 0]);
      entity.addComponent(physics);

      const aabb = BoundingVolume.fromEntity(entity, physics);

      // Should encompass both colliders
      expect(aabb.min[0]).toBeLessThan(-2);
      expect(aabb.max[0]).toBeGreaterThan(2);
    });

    it('should handle entity with no colliders', () => {
      const entity = new Entity('TestEntity');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [2, 3, 4];

      const physics = new PhysicsComponent();
      entity.addComponent(physics);

      const aabb = BoundingVolume.fromEntity(entity, physics);

      // Should use entity scale as fallback
      expect(aabb.min).toEqual([-1, -1.5, -2]);
      expect(aabb.max).toEqual([1, 1.5, 2]);
    });
  });

  describe('intersects', () => {
    it('should detect overlapping AABBs', () => {
      const aabb1: AABB = {
        min: [0, 0, 0],
        max: [2, 2, 2],
      };
      const aabb2: AABB = {
        min: [1, 1, 1],
        max: [3, 3, 3],
      };

      expect(BoundingVolume.intersects(aabb1, aabb2)).toBe(true);
    });

    it('should not detect non-overlapping AABBs', () => {
      const aabb1: AABB = {
        min: [0, 0, 0],
        max: [1, 1, 1],
      };
      const aabb2: AABB = {
        min: [2, 2, 2],
        max: [3, 3, 3],
      };

      expect(BoundingVolume.intersects(aabb1, aabb2)).toBe(false);
    });

    it('should detect AABBs touching at edges', () => {
      const aabb1: AABB = {
        min: [0, 0, 0],
        max: [1, 1, 1],
      };
      const aabb2: AABB = {
        min: [1, 0, 0],
        max: [2, 1, 1],
      };

      expect(BoundingVolume.intersects(aabb1, aabb2)).toBe(true);
    });
  });

  describe('contains', () => {
    it('should detect when one AABB contains another', () => {
      const larger: AABB = {
        min: [0, 0, 0],
        max: [10, 10, 10],
      };
      const smaller: AABB = {
        min: [2, 2, 2],
        max: [8, 8, 8],
      };

      expect(BoundingVolume.contains(larger, smaller)).toBe(true);
    });

    it('should not detect containment when AABBs overlap but one does not contain the other', () => {
      const aabb1: AABB = {
        min: [0, 0, 0],
        max: [5, 5, 5],
      };
      const aabb2: AABB = {
        min: [2, 2, 2],
        max: [7, 7, 7],
      };

      expect(BoundingVolume.contains(aabb1, aabb2)).toBe(false);
    });
  });

  describe('getCenter', () => {
    it('should calculate center of AABB', () => {
      const aabb: AABB = {
        min: [-10, -10, -10],
        max: [10, 10, 10],
      };

      const center = BoundingVolume.getCenter(aabb);
      expect(center).toEqual([0, 0, 0]);
    });

    it('should handle off-center AABBs', () => {
      const aabb: AABB = {
        min: [5, 5, 5],
        max: [15, 15, 15],
      };

      const center = BoundingVolume.getCenter(aabb);
      expect(center).toEqual([10, 10, 10]);
    });
  });

  describe('getSize', () => {
    it('should calculate size of AABB', () => {
      const aabb: AABB = {
        min: [0, 0, 0],
        max: [10, 20, 30],
      };

      const size = BoundingVolume.getSize(aabb);
      expect(size).toEqual([10, 20, 30]);
    });
  });

  describe('expand', () => {
    it('should expand AABB by margin', () => {
      const aabb: AABB = {
        min: [0, 0, 0],
        max: [10, 10, 10],
      };

      const expanded = BoundingVolume.expand(aabb, 5);

      expect(expanded.min).toEqual([-5, -5, -5]);
      expect(expanded.max).toEqual([15, 15, 15]);
    });
  });

  describe('merge', () => {
    it('should merge two AABBs', () => {
      const aabb1: AABB = {
        min: [0, 0, 0],
        max: [5, 5, 5],
      };
      const aabb2: AABB = {
        min: [3, 3, 3],
        max: [8, 8, 8],
      };

      const merged = BoundingVolume.merge(aabb1, aabb2);

      expect(merged.min).toEqual([0, 0, 0]);
      expect(merged.max).toEqual([8, 8, 8]);
    });

    it('should handle non-overlapping AABBs', () => {
      const aabb1: AABB = {
        min: [0, 0, 0],
        max: [1, 1, 1],
      };
      const aabb2: AABB = {
        min: [10, 10, 10],
        max: [11, 11, 11],
      };

      const merged = BoundingVolume.merge(aabb1, aabb2);

      expect(merged.min).toEqual([0, 0, 0]);
      expect(merged.max).toEqual([11, 11, 11]);
    });
  });

  describe('getVolume', () => {
    it('should calculate volume of AABB', () => {
      const aabb: AABB = {
        min: [0, 0, 0],
        max: [2, 3, 4],
      };

      const volume = BoundingVolume.getVolume(aabb);
      expect(volume).toBe(24); // 2 * 3 * 4
    });

    it('should return zero for flat AABB', () => {
      const aabb: AABB = {
        min: [0, 0, 0],
        max: [10, 0, 10],
      };

      const volume = BoundingVolume.getVolume(aabb);
      expect(volume).toBe(0);
    });
  });

  describe('getSurfaceArea', () => {
    it('should calculate surface area of AABB', () => {
      const aabb: AABB = {
        min: [0, 0, 0],
        max: [2, 2, 2],
      };

      const surfaceArea = BoundingVolume.getSurfaceArea(aabb);
      expect(surfaceArea).toBe(24); // 2 * (2*2 + 2*2 + 2*2) = 2 * 12
    });
  });
});

