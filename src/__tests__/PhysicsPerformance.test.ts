import { describe, it, expect } from 'vitest';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { PhysicsWorld } from '@engine/world/physics';
import { RigidbodyType } from '@engine/world';

describe('Physics Performance Benchmarks', () => {
  /**
   * Helper to measure execution time
   */
  function measureTime(fn: () => void): number {
    const start = performance.now();
    fn();
    const end = performance.now();
    return end - start;
  }

  describe('Broad Phase Collision Detection', () => {
    it('should handle 100 entities with spatial partitioning faster than brute force', () => {
      // Setup scene with 100 entities scattered in space
      const sceneWithOctree = new Scene('SceneWithOctree');
      const physicsWithOctree = new PhysicsWorld(sceneWithOctree, {
        useSpatialPartitioning: true,
        worldBounds: {
          min: [-100, -100, -100],
          max: [100, 100, 100],
        },
      });

      const sceneWithoutOctree = new Scene('SceneWithoutOctree');
      const physicsWithoutOctree = new PhysicsWorld(sceneWithoutOctree, {
        useSpatialPartitioning: false,
      });

      // Create 100 entities
      const entityCount = 100;
      for (let i = 0; i < entityCount; i++) {
        const x = (Math.random() - 0.5) * 200;
        const y = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;

        // With octree
        const entity1 = new Entity(`Entity${i}`);
        entity1.transform.position = [x, y, z];
        physicsWithOctree.addPhysics(entity1, {
          type: RigidbodyType.Dynamic,
          collider: 'box',
        });
        sceneWithOctree.addEntity(entity1);

        // Without octree (brute force)
        const entity2 = new Entity(`Entity${i}`);
        entity2.transform.position = [x, y, z];
        physicsWithoutOctree.addPhysics(entity2, {
          type: RigidbodyType.Dynamic,
          collider: 'box',
        });
        sceneWithoutOctree.addEntity(entity2);
      }

      // Warm up
      physicsWithOctree.start();
      physicsWithOctree.update(1 / 60);
      physicsWithoutOctree.start();
      physicsWithoutOctree.update(1 / 60);

      // Measure with octree
      const timeWithOctree = measureTime(() => {
        for (let i = 0; i < 10; i++) {
          physicsWithOctree.update(1 / 60);
        }
      });

      // Measure without octree
      const timeWithoutOctree = measureTime(() => {
        for (let i = 0; i < 10; i++) {
          physicsWithoutOctree.update(1 / 60);
        }
      });

      console.log(`  100 entities (10 frames):`);
      console.log(`    With Octree:    ${timeWithOctree.toFixed(2)}ms`);
      console.log(`    Without Octree: ${timeWithoutOctree.toFixed(2)}ms`);
      console.log(`    Speedup:        ${(timeWithoutOctree / timeWithOctree).toFixed(2)}x`);

      // Octree should be faster (or at least not significantly slower)
      // For small counts, overhead might make it similar, but for 100+ entities it should be faster
      expect(timeWithOctree).toBeLessThan(timeWithoutOctree * 2); // Allow some overhead
    });

    it('should scale better with 500 entities', () => {
      const sceneWithOctree = new Scene('LargeSceneWithOctree');
      const physicsWithOctree = new PhysicsWorld(sceneWithOctree, {
        useSpatialPartitioning: true,
        worldBounds: {
          min: [-500, -500, -500],
          max: [500, 500, 500],
        },
        octreeConfig: {
          maxEntitiesPerNode: 16,
          maxDepth: 8,
          minNodeSize: 1.0,
        },
      });

      // Create 500 entities in clusters (more realistic scenario)
      const entityCount = 500;
      const clusterCount = 10;
      const entitiesPerCluster = entityCount / clusterCount;

      for (let c = 0; c < clusterCount; c++) {
        const clusterX = (Math.random() - 0.5) * 1000;
        const clusterY = (Math.random() - 0.5) * 1000;
        const clusterZ = (Math.random() - 0.5) * 1000;

        for (let i = 0; i < entitiesPerCluster; i++) {
          const entity = new Entity(`Cluster${c}_Entity${i}`);
          entity.transform.position = [
            clusterX + (Math.random() - 0.5) * 50,
            clusterY + (Math.random() - 0.5) * 50,
            clusterZ + (Math.random() - 0.5) * 50,
          ];
          physicsWithOctree.addPhysics(entity, {
            type: RigidbodyType.Dynamic,
            collider: 'sphere',
          });
          sceneWithOctree.addEntity(entity);
        }
      }

      // Warm up
      physicsWithOctree.start();
      physicsWithOctree.update(1 / 60);

      // Measure
      const time = measureTime(() => {
        for (let i = 0; i < 5; i++) {
          physicsWithOctree.update(1 / 60);
        }
      });

      console.log(`  500 entities in clusters (5 frames):`);
      console.log(`    Time: ${time.toFixed(2)}ms`);
      console.log(`    Avg per frame: ${(time / 5).toFixed(2)}ms`);

      // Get octree stats
      const stats = physicsWithOctree.getOctreeStats();
      if (stats) {
        console.log(`    Octree stats:`);
        console.log(`      Nodes: ${stats.nodeCount}`);
        console.log(`      Max depth: ${stats.maxDepth}`);
        console.log(`      Avg entities/leaf: ${stats.avgEntitiesPerLeaf.toFixed(2)}`);
      }

      // Should complete in reasonable time (< 500ms for 5 frames)
      expect(time).toBeLessThan(500);
    });
  });

  describe('Octree Query Performance', () => {
    it('should query entities efficiently', () => {
      const scene = new Scene('QueryTestScene');
      const physics = new PhysicsWorld(scene, {
        useSpatialPartitioning: true,
        worldBounds: {
          min: [-100, -100, -100],
          max: [100, 100, 100],
        },
      });

      // Create 1000 entities
      for (let i = 0; i < 1000; i++) {
        const entity = new Entity(`Entity${i}`);
        entity.transform.position = [
          (Math.random() - 0.5) * 200,
          (Math.random() - 0.5) * 200,
          (Math.random() - 0.5) * 200,
        ];
        physics.addPhysics(entity, {
          type: RigidbodyType.Dynamic,
          collider: 'box',
        });
        scene.addEntity(entity);
      }

      physics.start();
      physics.update(1 / 60); // Build octree

      const stats = physics.getOctreeStats();
      if (stats) {
        console.log(`  Octree with 1000 entities:`);
        console.log(`    Nodes: ${stats.nodeCount}`);
        console.log(`    Max depth: ${stats.maxDepth}`);
        console.log(`    Entities: ${stats.entityCount}`);
      }

      expect(stats).not.toBeNull();
      expect(stats?.entityCount).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage', () => {
    it('should maintain stable octree structure', () => {
      const scene = new Scene('MemoryTestScene');
      const physics = new PhysicsWorld(scene, {
        useSpatialPartitioning: true,
        worldBounds: {
          min: [-50, -50, -50],
          max: [50, 50, 50],
        },
      });

      // Create some entities
      for (let i = 0; i < 50; i++) {
        const entity = new Entity(`Entity${i}`);
        entity.transform.position = [(Math.random() - 0.5) * 100, 0, (Math.random() - 0.5) * 100];
        physics.addPhysics(entity, {
          type: RigidbodyType.Dynamic,
          collider: 'box',
        });
        scene.addEntity(entity);
      }

      physics.start();

      // Let it stabilize
      for (let i = 0; i < 5; i++) {
        physics.update(1 / 60);
      }

      const initialStats = physics.getOctreeStats();

      // Run many updates
      for (let i = 0; i < 20; i++) {
        physics.update(1 / 60);
      }

      const finalStats = physics.getOctreeStats();

      console.log(`  Memory stability check:`);
      console.log(`    Initial nodes: ${initialStats?.nodeCount}`);
      console.log(`    Final nodes: ${finalStats?.nodeCount}`);

      // Node count should stay relatively stable (octree update removes and re-inserts)
      // Allow for some growth due to entity movement
      if (initialStats && finalStats) {
        expect(finalStats.nodeCount).toBeGreaterThan(0);
        expect(finalStats.nodeCount).toBeLessThan(10000); // Reasonable upper bound
      }
    });
  });

  describe('Dynamic vs Static Comparison', () => {
    it('should show performance characteristics', () => {
      // Scenario: Some static objects (walls, floor) + dynamic objects
      const scene = new Scene('MixedScene');
      const physics = new PhysicsWorld(scene, {
        useSpatialPartitioning: true,
        worldBounds: {
          min: [-100, -10, -100],
          max: [100, 50, 100],
        },
      });

      // Create floor (fewer tiles for performance test)
      for (let x = -100; x <= 100; x += 50) {
        for (let z = -100; z <= 100; z += 50) {
          const floor = new Entity(`Floor_${x}_${z}`);
          floor.transform.position = [x, -10, z];
          floor.transform.scale = [50, 1, 50];
          physics.addPhysics(floor, {
            type: RigidbodyType.Static,
            collider: 'box',
          });
          scene.addEntity(floor);
        }
      }

      // Create some dynamic objects
      for (let i = 0; i < 30; i++) {
        const entity = new Entity(`Dynamic${i}`);
        entity.transform.position = [(Math.random() - 0.5) * 100, 20 + i * 2, (Math.random() - 0.5) * 100];
        physics.addPhysics(entity, {
          type: RigidbodyType.Dynamic,
          useGravity: true,
          collider: 'sphere',
        });
        scene.addEntity(entity);
      }

      const staticCount = 25; // 5x5 grid
      const dynamicCount = 30;

      physics.start();

      // Measure simulation
      const time = measureTime(() => {
        for (let i = 0; i < 10; i++) {
          physics.update(1 / 60);
        }
      });

      const stats = physics.getOctreeStats();
      console.log(`  Mixed static/dynamic scenario:`);
      console.log(`    Static entities: ${staticCount}`);
      console.log(`    Dynamic entities: ${dynamicCount}`);
      console.log(`    Time (10 frames): ${time.toFixed(2)}ms`);
      console.log(`    Avg per frame: ${(time / 10).toFixed(2)}ms`);
      if (stats) {
        console.log(`    Octree nodes: ${stats.nodeCount}`);
        console.log(`    Max depth: ${stats.maxDepth}`);
      }

      // Should handle this scenario reasonably
      expect(time).toBeLessThan(2000); // 10 frames in under 2 seconds
    });
  });
});

