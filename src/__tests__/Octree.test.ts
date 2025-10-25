import { describe, it, expect, beforeEach } from 'vitest';
import { Octree, DEFAULT_OCTREE_CONFIG } from '../physics/Octree';
import { BoundingVolume, type AABB } from '../physics/BoundingVolume';
import { Entity } from '@engine/world';

describe('Octree', () => {
  let octree: Octree;
  const worldBounds: AABB = {
    min: [-10, -10, -10],
    max: [10, 10, 10],
  };

  beforeEach(() => {
    octree = new Octree(worldBounds);
  });

  describe('initialization', () => {
    it('should create an empty octree', () => {
      const stats = octree.getStats();
      expect(stats.nodeCount).toBe(1);
      expect(stats.entityCount).toBe(0);
      expect(stats.maxDepth).toBe(0);
    });

    it('should create with custom config', () => {
      const customOctree = new Octree(worldBounds, {
        maxEntitiesPerNode: 4,
        maxDepth: 8,
      });

      expect(customOctree).toBeDefined();
    });
  });

  describe('insertion', () => {
    it('should insert a single entity', () => {
      const entity = new Entity('TestEntity');
      const aabb = BoundingVolume.fromCenterSize([0, 0, 0], [1, 1, 1]);

      octree.insert(entity, aabb);

      const stats = octree.getStats();
      expect(stats.entityCount).toBe(1);
    });

    it('should insert multiple entities', () => {
      for (let i = 0; i < 10; i++) {
        const entity = new Entity(`Entity${i}`);
        const aabb = BoundingVolume.fromCenterSize([i, 0, 0], [0.5, 0.5, 0.5]);
        octree.insert(entity, aabb);
      }

      const stats = octree.getStats();
      expect(stats.entityCount).toBe(10);
    });

    it('should split nodes when capacity is exceeded', () => {
      const customOctree = new Octree(worldBounds, {
        maxEntitiesPerNode: 2,
        maxDepth: 3,
        minNodeSize: 1.0,
      });

      // Insert entities at same location to force split
      for (let i = 0; i < 5; i++) {
        const entity = new Entity(`Entity${i}`);
        const aabb = BoundingVolume.fromCenterSize([0, 0, 0], [0.5, 0.5, 0.5]);
        customOctree.insert(entity, aabb);
      }

      const stats = customOctree.getStats();
      expect(stats.nodeCount).toBeGreaterThan(1); // Should have split
      expect(stats.entityCount).toBe(5);
    });
  });

  describe('removal', () => {
    it('should remove an entity', () => {
      const entity = new Entity('TestEntity');
      const aabb = BoundingVolume.fromCenterSize([0, 0, 0], [1, 1, 1]);

      octree.insert(entity, aabb);
      expect(octree.getStats().entityCount).toBe(1);

      const removed = octree.remove(entity);
      expect(removed).toBe(true);
      expect(octree.getStats().entityCount).toBe(0);
    });

    it('should return false when removing non-existent entity', () => {
      const entity = new Entity('TestEntity');
      const removed = octree.remove(entity);
      expect(removed).toBe(false);
    });

    it('should merge nodes when entity count drops', () => {
      const customOctree = new Octree(worldBounds, {
        maxEntitiesPerNode: 2,
        maxDepth: 3,
        minNodeSize: 1.0,
      });

      const entities: Entity[] = [];
      for (let i = 0; i < 5; i++) {
        const entity = new Entity(`Entity${i}`);
        entities.push(entity);
        const aabb = BoundingVolume.fromCenterSize([0, 0, 0], [0.5, 0.5, 0.5]);
        customOctree.insert(entity, aabb);
      }

      const statsBefore = customOctree.getStats();

      // Remove most entities
      for (let i = 0; i < 4; i++) {
        const entity = entities[i];
        if (entity) customOctree.remove(entity);
      }

      const statsAfter = customOctree.getStats();
      expect(statsAfter.entityCount).toBe(1);
      expect(statsAfter.nodeCount).toBeLessThanOrEqual(statsBefore.nodeCount);
    });
  });

  describe('update', () => {
    it('should update entity position', () => {
      const entity = new Entity('TestEntity');
      const aabb1 = BoundingVolume.fromCenterSize([0, 0, 0], [1, 1, 1]);
      octree.insert(entity, aabb1);

      const aabb2 = BoundingVolume.fromCenterSize([5, 5, 5], [1, 1, 1]);
      octree.update(entity, aabb2);

      // Query at new position
      const results = octree.query(aabb2);
      expect(results).toContain(entity);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Insert entities in a grid pattern
      for (let x = -8; x <= 8; x += 4) {
        for (let z = -8; z <= 8; z += 4) {
          const entity = new Entity(`Entity_${x}_${z}`);
          const aabb = BoundingVolume.fromCenterSize([x, 0, z], [1, 1, 1]);
          octree.insert(entity, aabb);
        }
      }
    });

    it('should query entities in a region', () => {
      const queryAABB = BoundingVolume.fromCenterSize([0, 0, 0], [3, 3, 3]);
      const results = octree.query(queryAABB);

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(octree.getStats().entityCount);
    });

    it('should return empty array for query outside bounds', () => {
      const queryAABB = BoundingVolume.fromCenterSize([100, 100, 100], [1, 1, 1]);
      const results = octree.query(queryAABB);

      expect(results).toEqual([]);
    });

    it('should return all entities when querying entire bounds', () => {
      const results = octree.query(worldBounds);
      expect(results.length).toBe(octree.getStats().entityCount);
    });
  });

  describe('queryPairs', () => {
    it('should return potential collision pairs', () => {
      // Insert overlapping entities
      const entity1 = new Entity('Entity1');
      const entity2 = new Entity('Entity2');
      const entity3 = new Entity('Entity3');

      octree.insert(entity1, BoundingVolume.fromCenterSize([0, 0, 0], [1, 1, 1]));
      octree.insert(entity2, BoundingVolume.fromCenterSize([0.5, 0, 0], [1, 1, 1]));
      octree.insert(entity3, BoundingVolume.fromCenterSize([10, 10, 10], [1, 1, 1])); // Far away

      const pairs = octree.queryPairs();

      // Should find pair between entity1 and entity2
      expect(pairs.length).toBeGreaterThan(0);

      // Should not pair entity3 with others (too far)
      const hasFarPair = pairs.some(
        ([a, b]) => (a === entity3 && b !== entity3) || (b === entity3 && a !== entity3)
      );
      expect(hasFarPair).toBe(false);
    });

    it('should not return duplicate pairs', () => {
      const entity1 = new Entity('Entity1');
      const entity2 = new Entity('Entity2');

      octree.insert(entity1, BoundingVolume.fromCenterSize([0, 0, 0], [2, 2, 2]));
      octree.insert(entity2, BoundingVolume.fromCenterSize([0, 0, 0], [2, 2, 2]));

      const pairs = octree.queryPairs();

      // Count occurrences of this specific pair
      const pairCount = pairs.filter(
        ([a, b]) => (a === entity1 && b === entity2) || (a === entity2 && b === entity1)
      ).length;

      expect(pairCount).toBeLessThanOrEqual(1);
    });

    it('should handle many entities efficiently', () => {
      const customOctree = new Octree(
        { min: [-50, -50, -50], max: [50, 50, 50] },
        {
          maxEntitiesPerNode: 8,
          maxDepth: 6,
          minNodeSize: 1.0,
        }
      );

      // Insert 100 entities
      for (let i = 0; i < 100; i++) {
        const entity = new Entity(`Entity${i}`);
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        const aabb = BoundingVolume.fromCenterSize([x, y, z], [1, 1, 1]);
        customOctree.insert(entity, aabb);
      }

      const pairs = customOctree.queryPairs();

      // Should find some pairs but far fewer than brute force (100 * 99 / 2 = 4950)
      expect(pairs.length).toBeLessThan(4950);
    });
  });

  describe('clear', () => {
    it('should clear all entities', () => {
      for (let i = 0; i < 10; i++) {
        const entity = new Entity(`Entity${i}`);
        const aabb = BoundingVolume.fromCenterSize([i, 0, 0], [1, 1, 1]);
        octree.insert(entity, aabb);
      }

      expect(octree.getStats().entityCount).toBe(10);

      octree.clear();

      const stats = octree.getStats();
      expect(stats.entityCount).toBe(0);
      expect(stats.nodeCount).toBe(1);
    });
  });

  describe('rebuild', () => {
    it('should rebuild the octree', () => {
      for (let i = 0; i < 10; i++) {
        const entity = new Entity(`Entity${i}`);
        const aabb = BoundingVolume.fromCenterSize([i, 0, 0], [1, 1, 1]);
        octree.insert(entity, aabb);
      }

      const statsBefore = octree.getStats();
      octree.rebuild();
      const statsAfter = octree.getStats();

      expect(statsAfter.entityCount).toBe(statsBefore.entityCount);
    });
  });

  describe('statistics', () => {
    it('should track node count accurately', () => {
      const customOctree = new Octree(worldBounds, {
        maxEntitiesPerNode: 2,
        maxDepth: 3,
        minNodeSize: 1.0,
      });

      const initialStats = customOctree.getStats();
      expect(initialStats.nodeCount).toBe(1);

      // Force splits
      for (let i = 0; i < 10; i++) {
        const entity = new Entity(`Entity${i}`);
        const aabb = BoundingVolume.fromCenterSize([i * 0.1, 0, 0], [0.5, 0.5, 0.5]);
        customOctree.insert(entity, aabb);
      }

      const stats = customOctree.getStats();
      expect(stats.nodeCount).toBeGreaterThan(1);
      expect(stats.maxDepth).toBeGreaterThan(0);
    });

    it('should calculate average entities per leaf', () => {
      for (let i = 0; i < 10; i++) {
        const entity = new Entity(`Entity${i}`);
        const aabb = BoundingVolume.fromCenterSize([i, 0, 0], [0.5, 0.5, 0.5]);
        octree.insert(entity, aabb);
      }

      const stats = octree.getStats();
      expect(stats.avgEntitiesPerLeaf).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle entities at world bounds', () => {
      const entity = new Entity('BoundaryEntity');
      const aabb = BoundingVolume.fromCenterSize([9.5, 9.5, 9.5], [0.5, 0.5, 0.5]);

      octree.insert(entity, aabb);
      const results = octree.query(aabb);

      expect(results).toContain(entity);
    });

    it('should handle very small AABBs', () => {
      const entity = new Entity('TinyEntity');
      const aabb = BoundingVolume.fromCenterSize([0, 0, 0], [0.01, 0.01, 0.01]);

      octree.insert(entity, aabb);
      const results = octree.query(aabb);

      expect(results).toContain(entity);
    });

    it('should handle large AABBs that span multiple octants', () => {
      const entity = new Entity('LargeEntity');
      const aabb = BoundingVolume.fromCenterSize([0, 0, 0], [8, 8, 8]);

      octree.insert(entity, aabb);
      const results = octree.query(aabb);

      expect(results).toContain(entity);
    });

    it('should not split beyond max depth', () => {
      const customOctree = new Octree(worldBounds, {
        maxEntitiesPerNode: 1,
        maxDepth: 2,
        minNodeSize: 0.1,
      });

      // Try to insert many entities to force deep splits
      for (let i = 0; i < 20; i++) {
        const entity = new Entity(`Entity${i}`);
        const aabb = BoundingVolume.fromCenterSize([0, 0, 0], [0.1, 0.1, 0.1]);
        customOctree.insert(entity, aabb);
      }

      const stats = customOctree.getStats();
      expect(stats.maxDepth).toBeLessThanOrEqual(2);
    });

    it('should not split below minimum node size', () => {
      const customOctree = new Octree(worldBounds, {
        maxEntitiesPerNode: 1,
        maxDepth: 10,
        minNodeSize: 5.0,
      });

      for (let i = 0; i < 10; i++) {
        const entity = new Entity(`Entity${i}`);
        const aabb = BoundingVolume.fromCenterSize([0, 0, 0], [0.5, 0.5, 0.5]);
        customOctree.insert(entity, aabb);
      }

      const stats = customOctree.getStats();
      // Should limit splitting due to minNodeSize
      expect(stats.maxDepth).toBeLessThan(5);
    });
  });
});

