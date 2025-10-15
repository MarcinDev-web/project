import { describe, it, expect } from 'vitest';
import { Raycaster } from '../scene/Raycaster';
import { Entity } from '../scene/Entity';

describe('Raycaster', () => {
  describe('ray-AABB intersection', () => {
    it('detects intersection with entity at origin', () => {
      const raycaster = new Raycaster();
      const entity = new Entity('TestCube');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [1, 1, 1];

      const ray = {
        origin: [0, 0, -5] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
      };

      const hit = raycaster.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
      expect(hit?.entity).toBe(entity);
      expect(hit?.distance).toBeGreaterThan(0);
    });

    it('returns null when ray misses entity', () => {
      const raycaster = new Raycaster();
      const entity = new Entity('TestCube');
      entity.transform.position = [10, 0, 0];
      entity.transform.scale = [1, 1, 1];

      const ray = {
        origin: [0, 0, -5] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
      };

      const hit = raycaster.raycastEntity(ray, entity);

      expect(hit).toBeNull();
    });

    it('ignores inactive entities', () => {
      const raycaster = new Raycaster();
      const entity = new Entity('InactiveCube');
      entity.transform.position = [0, 0, 0];
      entity.active = false;

      const ray = {
        origin: [0, 0, -5] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
      };

      const hit = raycaster.raycastEntity(ray, entity);

      expect(hit).toBeNull();
    });

    it('calculates hit point correctly', () => {
      const raycaster = new Raycaster();
      const entity = new Entity('TestCube');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [2, 2, 2];

      const ray = {
        origin: [0, 0, -5] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
      };

      const hit = raycaster.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
      expect(hit!.point[2]).toBeCloseTo(-1, 1); // Front face at z=-1
    });

    it('respects entity scale', () => {
      const raycaster = new Raycaster();
      const smallEntity = new Entity('SmallCube');
      smallEntity.transform.position = [10, 0, 0]; // Positioned away from ray
      smallEntity.transform.scale = [0.1, 0.1, 0.1];

      const largeEntity = new Entity('LargeCube');
      largeEntity.transform.position = [0, 0, 0];
      largeEntity.transform.scale = [10, 10, 10];

      const ray = {
        origin: [0, 0, -10] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
      };

      const smallHit = raycaster.raycastEntity(ray, smallEntity);
      const largeHit = raycaster.raycastEntity(ray, largeEntity);

      expect(smallHit).toBeNull(); // Ray should miss offset small cube
      expect(largeHit).not.toBeNull(); // Ray should hit large cube at origin
    });
  });

  describe('multiple entity raycasting', () => {
    it('returns all hits sorted by distance', () => {
      const raycaster = new Raycaster();
      const near = new Entity('Near');
      near.transform.position = [0, 0, -2];

      const far = new Entity('Far');
      far.transform.position = [0, 0, 2];

      const ray = {
        origin: [0, 0, -10] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
      };

      const hits = raycaster.raycastAll(ray, [far, near]);

      expect(hits).toHaveLength(2);
      expect(hits[0]!.entity).toBe(near); // Closer entity first
      expect(hits[1]!.entity).toBe(far);
      expect(hits[0]!.distance).toBeLessThan(hits[1]!.distance);
    });

    it('returns only the closest hit', () => {
      const raycaster = new Raycaster();
      const near = new Entity('Near');
      near.transform.position = [0, 0, -2];

      const far = new Entity('Far');
      far.transform.position = [0, 0, 2];

      const ray = {
        origin: [0, 0, -10] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
      };

      const hit = raycaster.raycastClosest(ray, [far, near]);

      expect(hit).not.toBeNull();
      expect(hit!.entity).toBe(near);
    });

    it('returns null when no entities are hit', () => {
      const raycaster = new Raycaster();
      const entity = new Entity('TestCube');
      entity.transform.position = [10, 0, 0];

      const ray = {
        origin: [0, 0, -10] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
      };

      const hit = raycaster.raycastClosest(ray, [entity]);

      expect(hit).toBeNull();
    });

    it('filters out inactive entities', () => {
      const raycaster = new Raycaster();
      const active = new Entity('Active');
      active.transform.position = [0, 0, 0];

      const inactive = new Entity('Inactive');
      inactive.transform.position = [0, 0, 1];
      inactive.active = false;

      const ray = {
        origin: [0, 0, -10] as [number, number, number],
        direction: [0, 0, 1] as [number, number, number],
      };

      const hits = raycaster.raycastAll(ray, [active, inactive]);

      expect(hits).toHaveLength(1);
      expect(hits[0]!.entity).toBe(active);
    });
  });

  describe('ray from screen coordinates', () => {
    it('creates ray from screen center', () => {
      const raycaster = new Raycaster();
      const canvasWidth = 800;
      const canvasHeight = 600;

      // Simple identity view/projection for testing
      const viewMatrix = new Float32Array(16);
      const projectionMatrix = new Float32Array(16);

      // Identity matrices
      viewMatrix[0] = viewMatrix[5] = viewMatrix[10] = viewMatrix[15] = 1;
      projectionMatrix[0] = projectionMatrix[5] = projectionMatrix[10] = projectionMatrix[15] = 1;

      const ray = raycaster.createRayFromScreen(
        canvasWidth / 2,
        canvasHeight / 2,
        canvasWidth,
        canvasHeight,
        viewMatrix,
        projectionMatrix
      );

      expect(ray.origin).toBeDefined();
      expect(ray.direction).toBeDefined();
      expect(ray.direction.length).toBe(3);

      // Direction should be normalized
      const len = Math.sqrt(ray.direction[0] ** 2 + ray.direction[1] ** 2 + ray.direction[2] ** 2);
      expect(len).toBeCloseTo(1, 5);
    });

    it('creates different rays for different screen positions', () => {
      const raycaster = new Raycaster();
      const canvasWidth = 800;
      const canvasHeight = 600;

      const viewMatrix = new Float32Array(16);
      const projectionMatrix = new Float32Array(16);
      viewMatrix[0] = viewMatrix[5] = viewMatrix[10] = viewMatrix[15] = 1;
      projectionMatrix[0] = projectionMatrix[5] = projectionMatrix[10] = projectionMatrix[15] = 1;

      const rayCenter = raycaster.createRayFromScreen(
        canvasWidth / 2,
        canvasHeight / 2,
        canvasWidth,
        canvasHeight,
        viewMatrix,
        projectionMatrix
      );

      const rayCorner = raycaster.createRayFromScreen(
        0,
        0,
        canvasWidth,
        canvasHeight,
        viewMatrix,
        projectionMatrix
      );

      // Rays from different screen positions should be different
      const sameDirection =
        rayCenter.direction[0] === rayCorner.direction[0] &&
        rayCenter.direction[1] === rayCorner.direction[1] &&
        rayCenter.direction[2] === rayCorner.direction[2];

      expect(sameDirection).toBe(false);
    });
  });

  describe('custom mesh bounds', () => {
    describe('sphere bounds', () => {
      it('detects intersection with sphere bounds', () => {
        const raycaster = new Raycaster();
        const entity = new Entity('Sphere');
        entity.transform.position = [0, 0, 0];
        entity.transform.scale = [2, 2, 2];
        entity.meshBounds = {
          type: 'sphere',
          sphere: {
            center: [0, 0, 0],
            radius: 0.5, // In local space, scaled by entity scale
          },
        };

        const ray = {
          origin: [0, 0, -5] as [number, number, number],
          direction: [0, 0, 1] as [number, number, number],
        };

        const hit = raycaster.raycastEntity(ray, entity);

        expect(hit).not.toBeNull();
        expect(hit?.entity).toBe(entity);
        expect(hit?.distance).toBeGreaterThan(0);
      });

      it('returns null when ray misses sphere', () => {
        const raycaster = new Raycaster();
        const entity = new Entity('Sphere');
        entity.transform.position = [0, 0, 0];
        entity.transform.scale = [1, 1, 1];
        entity.meshBounds = {
          type: 'sphere',
          sphere: {
            center: [0, 0, 0],
            radius: 0.5,
          },
        };

        const ray = {
          origin: [5, 0, -5] as [number, number, number],
          direction: [0, 0, 1] as [number, number, number],
        };

        const hit = raycaster.raycastEntity(ray, entity);

        expect(hit).toBeNull();
      });

      it('handles scaled sphere correctly', () => {
        const raycaster = new Raycaster();
        const entity = new Entity('LargeSphere');
        entity.transform.position = [0, 0, 0];
        entity.transform.scale = [5, 5, 5]; // Large sphere
        entity.meshBounds = {
          type: 'sphere',
          sphere: {
            center: [0, 0, 0],
            radius: 0.5,
          },
        };

        const ray = {
          origin: [2, 0, -5] as [number, number, number],
          direction: [0, 0, 1] as [number, number, number],
        };

        const hit = raycaster.raycastEntity(ray, entity);

        // Should hit because sphere radius is 0.5 * 5 = 2.5
        expect(hit).not.toBeNull();
      });
    });

    describe('OBB bounds', () => {
      it('detects intersection with OBB bounds', () => {
        const raycaster = new Raycaster();
        const entity = new Entity('Box');
        entity.transform.position = [0, 0, 0];
        entity.transform.scale = [1, 1, 1];
        entity.meshBounds = {
          type: 'obb',
          obb: {
            center: [0, 0, 0],
            halfExtents: [0.5, 0.5, 0.5],
            rotation: [0, 0, 0, 1], // Identity quaternion (no rotation)
          },
        };

        const ray = {
          origin: [0, 0, -5] as [number, number, number],
          direction: [0, 0, 1] as [number, number, number],
        };

        const hit = raycaster.raycastEntity(ray, entity);

        expect(hit).not.toBeNull();
        expect(hit?.entity).toBe(entity);
      });

      it('detects intersection with rotated OBB', () => {
        const raycaster = new Raycaster();
        const entity = new Entity('RotatedBox');
        entity.transform.position = [0, 0, 0];
        entity.transform.scale = [1, 1, 1];
        entity.meshBounds = {
          type: 'obb',
          obb: {
            center: [0, 0, 0],
            halfExtents: [2, 0.1, 0.1], // Thin box along X
            rotation: [0, 0.7071, 0, 0.7071], // 90° rotation around Y axis (makes it thin along Z)
          },
        };

        const ray = {
          origin: [0, 0, -5] as [number, number, number],
          direction: [0, 0, 1] as [number, number, number],
        };

        const hit = raycaster.raycastEntity(ray, entity);

        // Should hit the rotated thin box
        expect(hit).not.toBeNull();
      });

      it('returns null when ray misses OBB', () => {
        const raycaster = new Raycaster();
        const entity = new Entity('Box');
        entity.transform.position = [5, 0, 0];
        entity.transform.scale = [1, 1, 1];
        entity.meshBounds = {
          type: 'obb',
          obb: {
            center: [0, 0, 0],
            halfExtents: [0.5, 0.5, 0.5],
            rotation: [0, 0, 0, 1],
          },
        };

        const ray = {
          origin: [0, 0, -5] as [number, number, number],
          direction: [0, 0, 1] as [number, number, number],
        };

        const hit = raycaster.raycastEntity(ray, entity);

        expect(hit).toBeNull();
      });
    });

    describe('custom AABB bounds', () => {
      it('detects intersection with custom AABB', () => {
        const raycaster = new Raycaster();
        const entity = new Entity('CustomBox');
        entity.transform.position = [0, 0, 0];
        entity.transform.scale = [1, 1, 1];
        entity.meshBounds = {
          type: 'aabb',
          aabb: {
            min: [-1, -0.5, -0.25],
            max: [1, 0.5, 0.25],
          },
        };

        const ray = {
          origin: [0, 0, -5] as [number, number, number],
          direction: [0, 0, 1] as [number, number, number],
        };

        const hit = raycaster.raycastEntity(ray, entity);

        expect(hit).not.toBeNull();
        expect(hit?.entity).toBe(entity);
      });

      it('respects custom AABB scale', () => {
        const raycaster = new Raycaster();
        const entity = new Entity('ScaledCustomBox');
        entity.transform.position = [0, 0, 0];
        entity.transform.scale = [2, 2, 2];
        entity.meshBounds = {
          type: 'aabb',
          aabb: {
            min: [-0.5, -0.5, -0.5],
            max: [0.5, 0.5, 0.5],
          },
        };

        const ray = {
          origin: [0.9, 0, -5] as [number, number, number],
          direction: [0, 0, 1] as [number, number, number],
        };

        const hit = raycaster.raycastEntity(ray, entity);

        // Should hit because AABB is scaled to [-1,1] in each axis
        expect(hit).not.toBeNull();
      });
    });

    describe('fallback to default bounds', () => {
      it('uses default AABB when meshBounds is null', () => {
        const raycaster = new Raycaster();
        const entity = new Entity('DefaultCube');
        entity.transform.position = [0, 0, 0];
        entity.transform.scale = [1, 1, 1];
        entity.meshBounds = null; // Explicitly null

        const ray = {
          origin: [0, 0, -5] as [number, number, number],
          direction: [0, 0, 1] as [number, number, number],
        };

        const hit = raycaster.raycastEntity(ray, entity);

        // Should still work with default cube bounds
        expect(hit).not.toBeNull();
      });
    });
  });
});
