/**
 * Example test demonstrating all test-utils features
 * This serves as a reference for writing tests across the project
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  // Mocks
  createMockCanvas,
  createMockGPUDevice,
  createMockAnimationFrame,
  createMockPerformance,
  // Fixtures
  vec3Fixtures,
  transformFixtures,
  entityFixtures,
  sceneFixtures,
  performanceFixtures,
  // Assertions
  expectVec3ToBeCloseTo,
  expectToBeInRange,
  expectToExecuteWithin,
  // Helpers
  waitFor,
  benchmark,
  randomData,
  createTestContext,
  // Snapshots
  expectToMatchSnapshot,
} from '../src';

describe('Test Utils Examples', () => {
  describe('Mocks', () => {
    it('uses mock canvas', () => {
      const canvas = createMockCanvas(800, 600);

      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
      expect(canvas.getContext).toBeDefined();

      const ctx = canvas.getContext('webgpu');
      expect(ctx).toBeDefined();
    });

    it('uses mock GPU device', () => {
      const device = createMockGPUDevice();

      const buffer = device.createBuffer({
        size: 256,
        usage: 0x40, // UNIFORM
      });

      expect(buffer).toBeDefined();
      expect(buffer.destroy).toBeDefined();
      expect(device.createBuffer).toHaveBeenCalled();
    });

    it('uses mock animation frame', () => {
      const { requestAnimationFrame, tick, getCurrentTime } = createMockAnimationFrame();

      let frameCount = 0;
      const callback = () => frameCount++;

      requestAnimationFrame(callback);
      tick(16);

      expect(frameCount).toBe(1);
      expect(getCurrentTime()).toBe(16);
    });

    it('uses mock performance', () => {
      const perf = createMockPerformance();

      const start = perf.now();
      perf.advance(100);
      const duration = perf.now() - start;

      expect(duration).toBe(100);
    });
  });

  describe('Fixtures', () => {
    it('uses vector fixtures', () => {
      expect(vec3Fixtures.zero).toEqual([0, 0, 0]);
      expect(vec3Fixtures.one).toEqual([1, 1, 1]);
      expect(vec3Fixtures.unitX).toEqual([1, 0, 0]);
      expect(vec3Fixtures.up).toEqual([0, 1, 0]);
    });

    it('uses transform fixtures', () => {
      const identity = transformFixtures.identity;
      expect(identity.position).toEqual([0, 0, 0]);
      expect(identity.scale).toEqual([1, 1, 1]);

      const scaled = transformFixtures.scaled;
      expect(scaled.scale).toEqual([2, 2, 2]);
    });

    it('uses entity fixtures', () => {
      const entity = entityFixtures.simple();
      expect(entity.id).toBeDefined();
      expect(entity.name).toBe('TestEntity');

      const withTransform = entityFixtures.withTransform();
      expect(withTransform.components?.transform).toBeDefined();
    });

    it('uses scene fixtures', () => {
      const emptyScene = sceneFixtures.empty();
      expect(emptyScene.entities).toHaveLength(0);

      const scene = sceneFixtures.withEntities(5);
      expect(scene.entities).toHaveLength(5);

      const hierarchy = sceneFixtures.hierarchy();
      expect(hierarchy.entities.some((e) => 'parentId' in e)).toBe(true);
    });

    it('uses performance fixtures', () => {
      const entities = performanceFixtures.largeEntitySet(100);
      expect(entities).toHaveLength(100);
      expect(entities[0].position).toBeDefined();

      const mesh = performanceFixtures.largeMesh(1000);
      expect(mesh.vertices.length).toBe(3000); // 1000 * 3
      expect(mesh.indices.length).toBe(1000);
    });
  });

  describe('Assertions', () => {
    it('asserts vector closeness', () => {
      const pos = [1.0001, 2.0002, 3.0001];
      expectVec3ToBeCloseTo(pos, [1, 2, 3], 3);
    });

    it('asserts value in range', () => {
      const value = 5;
      expectToBeInRange(value, 0, 10);
    });

    it('asserts execution time', async () => {
      await expectToExecuteWithin(() => {
        // Fast operation
        const arr = new Array(100).fill(0);
        arr.forEach((_, i) => arr[i] = i * 2);
      }, 10); // Should complete in <10ms
    });
  });

  describe('Helpers', () => {
    it('waits for condition', async () => {
      let ready = false;
      setTimeout(() => (ready = true), 100);

      await waitFor(() => ready, 500);
      expect(ready).toBe(true);
    });

    it('benchmarks function', async () => {
      const fn = () => {
        const arr = new Array(100).fill(0);
        return arr.map((_, i) => i * i);
      };

      const bench = benchmark(fn, 100);
      const results = await bench();

      expect(results.iterations).toBe(100);
      expect(results.average).toBeGreaterThan(0);
      expect(results.min).toBeLessThanOrEqual(results.average);
      expect(results.max).toBeGreaterThanOrEqual(results.average);
    });

    it('generates random data', () => {
      const num = randomData.int(0, 10);
      expectToBeInRange(num, 0, 10);

      const float = randomData.float(0, 1);
      expectToBeInRange(float, 0, 1);

      const str = randomData.string(20);
      expect(str).toHaveLength(20);

      const arr = randomData.array(() => randomData.int(0, 10), 5);
      expect(arr).toHaveLength(5);

      const picked = randomData.pick([1, 2, 3, 4, 5]);
      expectToBeInRange(picked, 1, 5);
    });

    it('uses test context', async () => {
      const ctx = createTestContext(
        () => ({ value: 42 }),
        (obj) => {
          obj.value = 0;
        }
      );

      await ctx.beforeEach();
      const context = ctx.getContext();
      expect(context.value).toBe(42);

      await ctx.afterEach();
      expect(context.value).toBe(0);
    });
  });

  describe('Snapshots', () => {
    it('takes snapshot of scene', () => {
      const scene = sceneFixtures.withEntities(2);

      expectToMatchSnapshot(scene, {
        exclude: ['id'], // Exclude dynamic IDs
        sortArrays: true,
      });
    });

    it('handles dynamic values', () => {
      const obj = {
        name: 'Test',
        timestamp: Date.now(),
        id: 'abc123-def456-ghi789',
        data: [3, 1, 2],
      };

      expectToMatchSnapshot(obj, {
        exclude: ['timestamp'],
        replacements: {
          id: '<uuid>',
        },
        sortArrays: true,
      });
    });
  });

  describe('Integration Example', () => {
    // Setup context
    const ctx = createTestContext(
      () => ({
        canvas: createMockCanvas(800, 600),
        device: createMockGPUDevice(),
        scene: sceneFixtures.withEntities(3),
      }),
      (context) => {
        // Cleanup
        context.scene.entities = [];
      }
    );

    beforeEach(ctx.beforeEach);
    afterEach(ctx.afterEach);

    it('performs integrated operations', async () => {
      const { canvas, device, scene } = ctx.getContext();

      // Test setup
      expect(canvas.width).toBe(800);
      expect(scene.entities).toHaveLength(3);

      // Simulate async operation
      let processed = false;
      setTimeout(() => (processed = true), 50);

      await waitFor(() => processed, 200);
      expect(processed).toBe(true);

      // Performance test
      await expectToExecuteWithin(() => {
        scene.entities.forEach((e) => {
          // Simulate transform operation
          const pos = [e.id, e.id, e.id];
          expectVec3ToBeCloseTo(pos, [e.id, e.id, e.id]);
        });
      }, 50);

      // Device was used
      expect(device.createBuffer).toBeDefined();
    });

    it('benchmarks scene operations', async () => {
      const { scene } = ctx.getContext();

      const bench = benchmark(() => {
        // Simulate scene update
        scene.entities.forEach((e) => {
          e.name = `Entity${e.id}`;
        });
      }, 100);

      const results = await bench();
      expect(results.average).toBeLessThan(1); // Should be <1ms
    });

    it('takes scene snapshot', () => {
      const { scene } = ctx.getContext();

      expectToMatchSnapshot(scene, {
        exclude: ['_internal'],
        sortArrays: true,
      });
    });
  });
});

