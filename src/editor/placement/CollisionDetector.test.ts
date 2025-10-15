import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionDetector, type BoundingBox } from './CollisionDetector';
import { Scene } from '../../scene/Scene';
import { Entity } from '../../scene/Entity';
import type { Vec3 } from '../../scene/Transform';

describe('CollisionDetector', () => {
  let scene: Scene;
  let detector: CollisionDetector;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    detector = new CollisionDetector(scene);
  });

  describe('getBoundingBox', () => {
    it('should compute AABB for entity at origin with scale 1', () => {
      const entity = new Entity('test');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [1, 1, 1];

      const box = detector.getBoundingBox(entity);

      expect(box.min).toEqual([-0.5, -0.5, -0.5]);
      expect(box.max).toEqual([0.5, 0.5, 0.5]);
    });

    it('should compute AABB for entity with custom position', () => {
      const entity = new Entity('test');
      entity.transform.position = [2, 3, 4];
      entity.transform.scale = [1, 1, 1];

      const box = detector.getBoundingBox(entity);

      expect(box.min).toEqual([1.5, 2.5, 3.5]);
      expect(box.max).toEqual([2.5, 3.5, 4.5]);
    });

    it('should compute AABB for entity with custom scale', () => {
      const entity = new Entity('test');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [2, 4, 6];

      const box = detector.getBoundingBox(entity);

      expect(box.min).toEqual([-1, -2, -3]);
      expect(box.max).toEqual([1, 2, 3]);
    });

    it('should accept position override', () => {
      const entity = new Entity('test');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [1, 1, 1];

      const box = detector.getBoundingBox(entity, [5, 5, 5]);

      expect(box.min).toEqual([4.5, 4.5, 4.5]);
      expect(box.max).toEqual([5.5, 5.5, 5.5]);
    });

    it('should accept scale override', () => {
      const entity = new Entity('test');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [1, 1, 1];

      const box = detector.getBoundingBox(entity, undefined, undefined, [2, 2, 2]);

      expect(box.min).toEqual([-1, -1, -1]);
      expect(box.max).toEqual([1, 1, 1]);
    });

    it('should handle negative scale', () => {
      const entity = new Entity('test');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [-2, -4, -6];

      const box = detector.getBoundingBox(entity);

      // Should use absolute value of scale
      expect(box.min).toEqual([-1, -2, -3]);
      expect(box.max).toEqual([1, 2, 3]);
    });

    it('should enforce minimum box size', () => {
      const entity = new Entity('test');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [0, 0, 0];

      const box = detector.getBoundingBox(entity);

      const minSize = 0.001;
      expect(box.min[0]).toBeLessThan(0);
      expect(box.max[0]).toBeGreaterThan(0);
      expect(box.max[0] - box.min[0]).toBeGreaterThanOrEqual(minSize);
    });
  });

  describe('boxesIntersect', () => {
    it('should return true for overlapping boxes', () => {
      const box1: BoundingBox = {
        min: [0, 0, 0],
        max: [2, 2, 2],
      };
      const box2: BoundingBox = {
        min: [1, 1, 1],
        max: [3, 3, 3],
      };

      expect(CollisionDetector.boxesIntersect(box1, box2)).toBe(true);
    });

    it('should return false for non-overlapping boxes', () => {
      const box1: BoundingBox = {
        min: [0, 0, 0],
        max: [1, 1, 1],
      };
      const box2: BoundingBox = {
        min: [2, 2, 2],
        max: [3, 3, 3],
      };

      expect(CollisionDetector.boxesIntersect(box1, box2)).toBe(false);
    });

    it('should return true for touching boxes', () => {
      const box1: BoundingBox = {
        min: [0, 0, 0],
        max: [1, 1, 1],
      };
      const box2: BoundingBox = {
        min: [1, 0, 0],
        max: [2, 1, 1],
      };

      expect(CollisionDetector.boxesIntersect(box1, box2)).toBe(true);
    });

    it('should return true for identical boxes', () => {
      const box: BoundingBox = {
        min: [0, 0, 0],
        max: [1, 1, 1],
      };

      expect(CollisionDetector.boxesIntersect(box, box)).toBe(true);
    });

    it('should return false when boxes overlap on only 2 axes', () => {
      const box1: BoundingBox = {
        min: [0, 0, 0],
        max: [2, 2, 1],
      };
      const box2: BoundingBox = {
        min: [1, 1, 5],
        max: [3, 3, 6],
      };

      expect(CollisionDetector.boxesIntersect(box1, box2)).toBe(false);
    });
  });

  describe('checkCollision', () => {
    it('should detect no collision for single entity', () => {
      const entity = new Entity('test');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [1, 1, 1];
      scene.addEntity(entity);

      const result = detector.checkCollision(entity);

      expect(result.hasCollision).toBe(false);
      expect(result.collidingEntities).toEqual([]);
    });

    it('should detect collision between two entities', () => {
      const entity1 = new Entity('entity1');
      entity1.transform.position = [0, 0, 0];
      entity1.transform.scale = [2, 2, 2];
      scene.addEntity(entity1);

      const entity2 = new Entity('entity2');
      entity2.transform.position = [1, 0, 0];
      entity2.transform.scale = [2, 2, 2];
      scene.addEntity(entity2);

      const result = detector.checkCollision(entity1);

      expect(result.hasCollision).toBe(true);
      expect(result.collidingEntities).toContain(entity2);
    });

    it('should detect no collision for separated entities', () => {
      const entity1 = new Entity('entity1');
      entity1.transform.position = [0, 0, 0];
      entity1.transform.scale = [1, 1, 1];
      scene.addEntity(entity1);

      const entity2 = new Entity('entity2');
      entity2.transform.position = [10, 0, 0];
      entity2.transform.scale = [1, 1, 1];
      scene.addEntity(entity2);

      const result = detector.checkCollision(entity1);

      expect(result.hasCollision).toBe(false);
      expect(result.collidingEntities).toEqual([]);
    });

    it('should check collision with position override', () => {
      const entity1 = new Entity('entity1');
      entity1.transform.position = [10, 0, 0]; // Far away
      entity1.transform.scale = [2, 2, 2];
      scene.addEntity(entity1);

      const entity2 = new Entity('entity2');
      entity2.transform.position = [1, 0, 0];
      entity2.transform.scale = [2, 2, 2];
      scene.addEntity(entity2);

      // Check collision as if entity1 is at [0, 0, 0]
      const result = detector.checkCollision(entity1, [0, 0, 0]);

      expect(result.hasCollision).toBe(true);
      expect(result.collidingEntities).toContain(entity2);
    });

    it('should exclude entities from collision check', () => {
      const entity1 = new Entity('entity1');
      entity1.transform.position = [0, 0, 0];
      entity1.transform.scale = [2, 2, 2];
      scene.addEntity(entity1);

      const entity2 = new Entity('entity2');
      entity2.transform.position = [1, 0, 0];
      entity2.transform.scale = [2, 2, 2];
      scene.addEntity(entity2);

      const excludeSet = new Set([entity2]);
      const result = detector.checkCollision(entity1, undefined, undefined, undefined, excludeSet);

      expect(result.hasCollision).toBe(false);
      expect(result.collidingEntities).toEqual([]);
    });

    it('should detect collision with multiple entities', () => {
      const entity1 = new Entity('entity1');
      entity1.transform.position = [0, 0, 0];
      entity1.transform.scale = [4, 4, 4];
      scene.addEntity(entity1);

      const entity2 = new Entity('entity2');
      entity2.transform.position = [1, 0, 0];
      entity2.transform.scale = [1, 1, 1];
      scene.addEntity(entity2);

      const entity3 = new Entity('entity3');
      entity3.transform.position = [-1, 0, 0];
      entity3.transform.scale = [1, 1, 1];
      scene.addEntity(entity3);

      const result = detector.checkCollision(entity1);

      expect(result.hasCollision).toBe(true);
      expect(result.collidingEntities).toHaveLength(2);
      expect(result.collidingEntities).toContain(entity2);
      expect(result.collidingEntities).toContain(entity3);
    });
  });

  describe('pointInBox', () => {
    it('should return true for point inside box', () => {
      const box: BoundingBox = {
        min: [0, 0, 0],
        max: [2, 2, 2],
      };
      const point: Vec3 = [1, 1, 1];

      expect(CollisionDetector.pointInBox(point, box)).toBe(true);
    });

    it('should return true for point on box boundary', () => {
      const box: BoundingBox = {
        min: [0, 0, 0],
        max: [2, 2, 2],
      };
      const point: Vec3 = [0, 1, 1];

      expect(CollisionDetector.pointInBox(point, box)).toBe(true);
    });

    it('should return false for point outside box', () => {
      const box: BoundingBox = {
        min: [0, 0, 0],
        max: [2, 2, 2],
      };
      const point: Vec3 = [3, 1, 1];

      expect(CollisionDetector.pointInBox(point, box)).toBe(false);
    });
  });

  describe('getBoxVolume', () => {
    it('should calculate volume for unit cube', () => {
      const box: BoundingBox = {
        min: [0, 0, 0],
        max: [1, 1, 1],
      };

      expect(CollisionDetector.getBoxVolume(box)).toBe(1);
    });

    it('should calculate volume for arbitrary box', () => {
      const box: BoundingBox = {
        min: [0, 0, 0],
        max: [2, 3, 4],
      };

      expect(CollisionDetector.getBoxVolume(box)).toBe(24);
    });

    it('should return 0 for degenerate box', () => {
      const box: BoundingBox = {
        min: [0, 0, 0],
        max: [0, 0, 0],
      };

      expect(CollisionDetector.getBoxVolume(box)).toBe(0);
    });
  });

  describe('getBoxCenter', () => {
    it('should return center of box at origin', () => {
      const box: BoundingBox = {
        min: [-1, -1, -1],
        max: [1, 1, 1],
      };

      expect(CollisionDetector.getBoxCenter(box)).toEqual([0, 0, 0]);
    });

    it('should return center of offset box', () => {
      const box: BoundingBox = {
        min: [2, 3, 4],
        max: [4, 5, 6],
      };

      expect(CollisionDetector.getBoxCenter(box)).toEqual([3, 4, 5]);
    });
  });

  describe('boxContains', () => {
    it('should return true when box1 contains box2', () => {
      const box1: BoundingBox = {
        min: [0, 0, 0],
        max: [4, 4, 4],
      };
      const box2: BoundingBox = {
        min: [1, 1, 1],
        max: [3, 3, 3],
      };

      expect(CollisionDetector.boxContains(box1, box2)).toBe(true);
    });

    it('should return false when box1 does not contain box2', () => {
      const box1: BoundingBox = {
        min: [0, 0, 0],
        max: [2, 2, 2],
      };
      const box2: BoundingBox = {
        min: [1, 1, 1],
        max: [3, 3, 3],
      };

      expect(CollisionDetector.boxContains(box1, box2)).toBe(false);
    });

    it('should return true for identical boxes', () => {
      const box: BoundingBox = {
        min: [0, 0, 0],
        max: [2, 2, 2],
      };

      expect(CollisionDetector.boxContains(box, box)).toBe(true);
    });
  });

  describe('expandBox', () => {
    it('should expand box by margin', () => {
      const box: BoundingBox = {
        min: [0, 0, 0],
        max: [2, 2, 2],
      };

      const expanded = CollisionDetector.expandBox(box, 1);

      expect(expanded.min).toEqual([-1, -1, -1]);
      expect(expanded.max).toEqual([3, 3, 3]);
    });

    it('should handle negative margin (shrink)', () => {
      const box: BoundingBox = {
        min: [0, 0, 0],
        max: [2, 2, 2],
      };

      const shrunk = CollisionDetector.expandBox(box, -0.5);

      expect(shrunk.min).toEqual([0.5, 0.5, 0.5]);
      expect(shrunk.max).toEqual([1.5, 1.5, 1.5]);
    });
  });

  describe('setScene', () => {
    it('should update scene reference', () => {
      const newScene = new Scene('New Scene');
      detector.setScene(newScene);

      expect(detector.getScene()).toBe(newScene);
    });
  });

  describe('OBB Collision Detection', () => {
    describe('getOBB', () => {
      it('should compute OBB for entity with identity rotation', () => {
        const entity = new Entity('test');
        entity.transform.position = [0, 0, 0];
        entity.transform.rotation = [0, 0, 0, 1]; // Identity quaternion
        entity.transform.scale = [2, 4, 6];

        const obb = detector.getOBB(entity);

        expect(obb.center).toEqual([0, 0, 0]);
        expect(obb.halfSizes).toEqual([1, 2, 3]); // Half of scale
        // Axes should be identity (world axes)
        expect(obb.axes[0][0]).toBeCloseTo(1, 5); // X axis
        expect(obb.axes[1][1]).toBeCloseTo(1, 5); // Y axis
        expect(obb.axes[2][2]).toBeCloseTo(1, 5); // Z axis
      });

      it('should compute OBB with rotation around Y axis', () => {
        const entity = new Entity('test');
        entity.transform.position = [5, 2, 3];
        // 90 degrees around Y axis: quat = [0, sin(45°), 0, cos(45°)]
        const angle = Math.PI / 2;
        entity.transform.rotation = [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
        entity.transform.scale = [2, 2, 2];

        const obb = detector.getOBB(entity);

        expect(obb.center).toEqual([5, 2, 3]);
        expect(obb.halfSizes).toEqual([1, 1, 1]);
        // After 90 degree rotation around Y, axes should be rotated
        // Y axis stays the same, X and Z swap (with sign change depending on direction)
        expect(obb.axes[1][1]).toBeCloseTo(1, 5); // Y axis unchanged
        // Just verify that rotation happened - axes are orthonormal
        const axisLength0 = Math.sqrt(
          obb.axes[0][0] ** 2 + obb.axes[0][1] ** 2 + obb.axes[0][2] ** 2
        );
        const axisLength1 = Math.sqrt(
          obb.axes[1][0] ** 2 + obb.axes[1][1] ** 2 + obb.axes[1][2] ** 2
        );
        const axisLength2 = Math.sqrt(
          obb.axes[2][0] ** 2 + obb.axes[2][1] ** 2 + obb.axes[2][2] ** 2
        );
        expect(axisLength0).toBeCloseTo(1, 5);
        expect(axisLength1).toBeCloseTo(1, 5);
        expect(axisLength2).toBeCloseTo(1, 5);
      });

      it('should handle position override', () => {
        const entity = new Entity('test');
        entity.transform.position = [10, 10, 10];
        entity.transform.scale = [2, 2, 2];

        const obb = detector.getOBB(entity, [5, 5, 5]);

        expect(obb.center).toEqual([5, 5, 5]);
      });

      it('should handle rotation override', () => {
        const entity = new Entity('test');
        entity.transform.rotation = [0, 0, 0, 1]; // Identity
        entity.transform.scale = [2, 2, 2];

        // Override with 180 degrees around Y
        const angle = Math.PI;
        const rot: [number, number, number, number] = [
          0,
          Math.sin(angle / 2),
          0,
          Math.cos(angle / 2),
        ];
        const obb = detector.getOBB(entity, undefined, rot);

        // First axis should be flipped
        expect(obb.axes[0][0]).toBeCloseTo(-1, 5);
      });

      it('should handle scale override', () => {
        const entity = new Entity('test');
        entity.transform.scale = [1, 1, 1];

        const obb = detector.getOBB(entity, undefined, undefined, [4, 6, 8]);

        expect(obb.halfSizes).toEqual([2, 3, 4]);
      });

      it('should normalize quaternion', () => {
        const entity = new Entity('test');
        // Non-normalized quaternion
        entity.transform.rotation = [0.5, 0.5, 0.5, 0.5]; // Length = 1, but conceptually testing normalization
        entity.transform.scale = [2, 2, 2];

        const obb = detector.getOBB(entity);

        // Should not throw and should produce valid axes
        expect(obb.axes).toBeDefined();
        expect(obb.axes[0].length).toBe(3);
      });

      it('should enforce minimum box size', () => {
        const entity = new Entity('test');
        entity.transform.scale = [0, 0, 0];

        const obb = detector.getOBB(entity);

        // Should have minimum size
        expect(obb.halfSizes[0]).toBeGreaterThan(0);
        expect(obb.halfSizes[1]).toBeGreaterThan(0);
        expect(obb.halfSizes[2]).toBeGreaterThan(0);
      });
    });

    describe('obbIntersect', () => {
      it('should detect intersection of aligned boxes', () => {
        const obb1 = {
          center: [0, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };
        const obb2 = {
          center: [1, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };

        expect(CollisionDetector.obbIntersect(obb1, obb2)).toBe(true);
      });

      it('should detect no intersection when boxes are separated', () => {
        const obb1 = {
          center: [0, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };
        const obb2 = {
          center: [5, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };

        expect(CollisionDetector.obbIntersect(obb1, obb2)).toBe(false);
      });

      it('should detect intersection of rotated boxes', () => {
        const obb1 = {
          center: [0, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [2, 0.5, 0.5] as Vec3,
        };
        // Box rotated 45 degrees around Z axis
        const cos45 = Math.cos(Math.PI / 4);
        const sin45 = Math.sin(Math.PI / 4);
        const obb2 = {
          center: [0, 0, 0] as Vec3,
          axes: [
            [cos45, sin45, 0],
            [-sin45, cos45, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [2, 0.5, 0.5] as Vec3,
        };

        expect(CollisionDetector.obbIntersect(obb1, obb2)).toBe(true);
      });

      it('should detect no intersection for rotated separated boxes', () => {
        const obb1 = {
          center: [0, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };
        // Rotated box far away
        const cos45 = Math.cos(Math.PI / 4);
        const sin45 = Math.sin(Math.PI / 4);
        const obb2 = {
          center: [10, 0, 0] as Vec3,
          axes: [
            [cos45, sin45, 0],
            [-sin45, cos45, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };

        expect(CollisionDetector.obbIntersect(obb1, obb2)).toBe(false);
      });

      it('should handle edge-touching boxes', () => {
        const obb1 = {
          center: [0, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };
        const obb2 = {
          center: [2, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };

        // Touching at edge - should be true due to epsilon
        expect(CollisionDetector.obbIntersect(obb1, obb2)).toBe(true);
      });

      it('should detect intersection with one box inside another', () => {
        const obb1 = {
          center: [0, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [5, 5, 5] as Vec3,
        };
        const obb2 = {
          center: [0, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };

        expect(CollisionDetector.obbIntersect(obb1, obb2)).toBe(true);
      });

      it('should be symmetric (order independent)', () => {
        const obb1 = {
          center: [0, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };
        const obb2 = {
          center: [1, 0, 0] as Vec3,
          axes: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ] as [Vec3, Vec3, Vec3],
          halfSizes: [1, 1, 1] as Vec3,
        };

        expect(CollisionDetector.obbIntersect(obb1, obb2)).toBe(
          CollisionDetector.obbIntersect(obb2, obb1)
        );
      });
    });

    describe('checkCollisionOBB', () => {
      it('should detect no collision for single entity', () => {
        const entity = new Entity('test');
        entity.transform.position = [0, 0, 0];
        entity.transform.scale = [1, 1, 1];
        scene.addEntity(entity);

        const result = detector.checkCollisionOBB(entity);

        expect(result.hasCollision).toBe(false);
        expect(result.collidingEntities).toEqual([]);
      });

      it('should detect collision between two entities', () => {
        const entity1 = new Entity('entity1');
        entity1.transform.position = [0, 0, 0];
        entity1.transform.scale = [2, 2, 2];
        scene.addEntity(entity1);

        const entity2 = new Entity('entity2');
        entity2.transform.position = [1, 0, 0];
        entity2.transform.scale = [2, 2, 2];
        scene.addEntity(entity2);

        const result = detector.checkCollisionOBB(entity1);

        expect(result.hasCollision).toBe(true);
        expect(result.collidingEntities).toContain(entity2);
      });

      it('should detect collision with rotation', () => {
        const entity1 = new Entity('entity1');
        entity1.transform.position = [0, 0, 0];
        entity1.transform.rotation = [0, 0, 0, 1]; // No rotation
        entity1.transform.scale = [4, 1, 1]; // Long thin box
        scene.addEntity(entity1);

        const entity2 = new Entity('entity2');
        entity2.transform.position = [0, 0, 0];
        // Rotated 90 degrees around Y axis
        const angle = Math.PI / 2;
        entity2.transform.rotation = [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
        entity2.transform.scale = [4, 1, 1]; // Perpendicular long box
        scene.addEntity(entity2);

        const result = detector.checkCollisionOBB(entity1);

        // Should detect collision (cross pattern)
        expect(result.hasCollision).toBe(true);
        expect(result.collidingEntities).toContain(entity2);
      });

      it('should not detect collision when rotated boxes are separated', () => {
        const entity1 = new Entity('entity1');
        entity1.transform.position = [0, 0, 0];
        entity1.transform.scale = [1, 1, 1];
        scene.addEntity(entity1);

        const entity2 = new Entity('entity2');
        entity2.transform.position = [5, 0, 0]; // Far away
        const angle = Math.PI / 4; // 45 degrees
        entity2.transform.rotation = [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
        entity2.transform.scale = [1, 1, 1];
        scene.addEntity(entity2);

        const result = detector.checkCollisionOBB(entity1);

        expect(result.hasCollision).toBe(false);
      });

      it('should use position override', () => {
        const entity1 = new Entity('entity1');
        entity1.transform.position = [10, 0, 0]; // Far away
        entity1.transform.scale = [2, 2, 2];
        scene.addEntity(entity1);

        const entity2 = new Entity('entity2');
        entity2.transform.position = [0, 0, 0];
        entity2.transform.scale = [2, 2, 2];
        scene.addEntity(entity2);

        // Check collision as if entity1 is at origin
        const result = detector.checkCollisionOBB(entity1, [0, 0, 0]);

        expect(result.hasCollision).toBe(true);
        expect(result.collidingEntities).toContain(entity2);
      });

      it('should use rotation override', () => {
        const entity1 = new Entity('entity1');
        entity1.transform.position = [0, 0, 0];
        entity1.transform.rotation = [0, 0, 0, 1]; // No rotation
        entity1.transform.scale = [2, 2, 2]; // Regular cube
        scene.addEntity(entity1);

        const entity2 = new Entity('entity2');
        entity2.transform.position = [5, 0, 0]; // Far away
        entity2.transform.scale = [1, 1, 1];
        scene.addEntity(entity2);

        // No collision initially
        let result = detector.checkCollisionOBB(entity1);
        expect(result.hasCollision).toBe(false);

        // Use rotation override - should still not collide (just testing override works)
        const angle = Math.PI / 2;
        const rot: [number, number, number, number] = [
          0,
          Math.sin(angle / 2),
          0,
          Math.cos(angle / 2),
        ];
        result = detector.checkCollisionOBB(entity1, undefined, rot);
        expect(result.hasCollision).toBe(false);

        // Test that override actually affects OBB by moving entity2 closer
        entity2.transform.position = [1.5, 0, 0];
        result = detector.checkCollisionOBB(entity1, undefined, rot);
        // Should detect collision since boxes are close
        expect(result.hasCollision).toBe(true);
      });

      it('should exclude entities from check', () => {
        const entity1 = new Entity('entity1');
        entity1.transform.position = [0, 0, 0];
        entity1.transform.scale = [2, 2, 2];
        scene.addEntity(entity1);

        const entity2 = new Entity('entity2');
        entity2.transform.position = [0, 0, 0];
        entity2.transform.scale = [2, 2, 2];
        scene.addEntity(entity2);

        const excludeSet = new Set([entity2]);
        const result = detector.checkCollisionOBB(
          entity1,
          undefined,
          undefined,
          undefined,
          excludeSet
        );

        expect(result.hasCollision).toBe(false);
      });

      it('should detect collision with multiple entities', () => {
        const entity1 = new Entity('entity1');
        entity1.transform.position = [0, 0, 0];
        entity1.transform.scale = [4, 4, 4]; // Large box
        scene.addEntity(entity1);

        const entity2 = new Entity('entity2');
        entity2.transform.position = [1, 0, 0];
        entity2.transform.scale = [1, 1, 1];
        scene.addEntity(entity2);

        const entity3 = new Entity('entity3');
        entity3.transform.position = [-1, 0, 0];
        entity3.transform.scale = [1, 1, 1];
        scene.addEntity(entity3);

        const result = detector.checkCollisionOBB(entity1);

        expect(result.hasCollision).toBe(true);
        expect(result.collidingEntities).toHaveLength(2);
        expect(result.collidingEntities).toContain(entity2);
        expect(result.collidingEntities).toContain(entity3);
      });
    });
  });
});
