/**
 * Integration Test Examples
 *
 * Demonstrates cross-package integration testing patterns.
 * These tests verify proper interaction between @engine packages.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createIntegrationContext,
  createEventCapture,
  runIntegrationScenario,
  packageMocks,
  validatePackageBoundaries,
  expectPackageInteraction,
  expectEventsInOrder,
  expectCrossPackageSuccess,
  testCoreWorldEntityCreation,
  testWorldAnimationIntegration,
  type PackageName,
} from '../src/integration';

describe('Integration Test Framework', () => {
  describe('Package Boundary Validation', () => {
    it('should allow valid dependencies (core → world)', () => {
      expect(validatePackageBoundaries('@engine/world', '@engine/core')).toBe(true);
    });

    it('should reject invalid dependencies (core ← world)', () => {
      // Core cannot depend on world (would be circular)
      expect(validatePackageBoundaries('@engine/core', '@engine/world')).toBe(false);
    });

    it('should allow self-reference', () => {
      expect(validatePackageBoundaries('@engine/core', '@engine/core')).toBe(true);
    });

    it('should validate multi-level dependencies', () => {
      // gfx-webgpu can use core (direct dependency)
      expect(validatePackageBoundaries('@engine/gfx-webgpu', '@engine/core')).toBe(true);
      // gfx-webgpu can use world (direct dependency)
      expect(validatePackageBoundaries('@engine/gfx-webgpu', '@engine/world')).toBe(true);
    });
  });

  describe('Event Capture', () => {
    it('should capture events in order', () => {
      const capture = createEventCapture<{ value: number }>();

      capture.capture('event:a', { value: 1 });
      capture.capture('event:b', { value: 2 });
      capture.capture('event:a', { value: 3 });

      expect(capture.events).toHaveLength(3);
      expectEventsInOrder(capture, ['event:a', 'event:b', 'event:a']);
    });

    it('should filter events by type', () => {
      const capture = createEventCapture<string>();

      capture.capture('type:a', 'first');
      capture.capture('type:b', 'second');
      capture.capture('type:a', 'third');

      const aEvents = capture.getByType('type:a');
      expect(aEvents).toHaveLength(2);
      expect(aEvents[0]!.data).toBe('first');
      expect(aEvents[1]!.data).toBe('third');
    });

    it('should wait for events with timeout', async () => {
      const capture = createEventCapture<number>();

      // Emit event after delay
      setTimeout(() => {
        capture.capture('delayed', 42);
      }, 50);

      const result = await capture.waitFor('delayed', 1000);
      expect(result).toBe(42);
    });

    it('should resolve immediately if event already captured', async () => {
      const capture = createEventCapture<string>();
      capture.capture('existing', 'already-here');

      const result = await capture.waitFor('existing', 100);
      expect(result).toBe('already-here');
    });
  });

  describe('Package Mocks', () => {
    it('should create working EventBus mock', () => {
      const eventBus = packageMocks.createEventBusMock();
      const handler = vi.fn();

      eventBus.on('test', handler);
      eventBus.emit('test', 'data');

      expect(handler).toHaveBeenCalledWith('data');
    });

    it('should create working Entity mock', () => {
      const entity = packageMocks.createEntityMock(1, 'TestEntity');

      entity.addComponent('transform', { x: 0, y: 0, z: 0 });

      expect(entity.hasComponent('transform')).toBe(true);
      expect(entity.getComponent('transform')).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should create working Scene mock', () => {
      const scene = packageMocks.createSceneMock();

      const entity1 = scene.createEntity('Entity1');
      const entity2 = scene.createEntity('Entity2');

      expect(scene.entities.size).toBe(2);
      expect(scene.getEntity(entity1.id)).toBe(entity1);

      scene.removeEntity(entity1.id);
      expect(scene.entities.size).toBe(1);
    });

    it('should query entities by components', () => {
      const scene = packageMocks.createSceneMock();

      const e1 = scene.createEntity('E1');
      e1.addComponent('transform', {});
      e1.addComponent('mesh', {});

      const e2 = scene.createEntity('E2');
      e2.addComponent('transform', {});

      const withMesh = scene.query(['transform', 'mesh']);
      expect(withMesh).toHaveLength(1);
      expect(withMesh[0]).toBe(e1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should run Core-World entity creation scenario', async () => {
      const result = await testCoreWorldEntityCreation();

      expectCrossPackageSuccess(result);
      expect(result.packagesUsed).toContain('@engine/core');
      expect(result.packagesUsed).toContain('@engine/world');
    });

    it('should run World-Animation integration scenario', async () => {
      const result = await testWorldAnimationIntegration();

      expectCrossPackageSuccess(result);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should run custom scenario with steps', async () => {
      const executedSteps: string[] = [];

      const result = await runIntegrationScenario({
        name: 'Custom Scenario',
        packages: ['@engine/core', '@engine/world'],
        setup: () => ({
          scene: packageMocks.createSceneMock(),
          counter: 0,
        }),
        teardown: (ctx) => {
          ctx.scene.dispose();
        },
        steps: [
          {
            name: 'Step 1: Create entity',
            action: (ctx) => {
              ctx.scene.createEntity('Test');
              ctx.counter++;
              executedSteps.push('step1');
            },
            validate: (ctx) => {
              expect(ctx.scene.entities.size).toBe(1);
              expect(ctx.counter).toBe(1);
            },
          },
          {
            name: 'Step 2: Create more',
            action: (ctx) => {
              ctx.scene.createEntity('Test2');
              ctx.scene.createEntity('Test3');
              ctx.counter += 2;
              executedSteps.push('step2');
            },
            validate: (ctx) => {
              expect(ctx.scene.entities.size).toBe(3);
              expect(ctx.counter).toBe(3);
            },
          },
        ],
      });

      expect(result.passed).toBe(true);
      expect(executedSteps).toEqual(['step1', 'step2']);
    });
  });

  describe('Integration Context', () => {
    it('should create context with boundary validation', async () => {
      const context = createIntegrationContext(
        {
          packages: ['@engine/core', '@engine/world'],
          validateBoundaries: true,
        },
        {
          beforeAll: () => ({ data: 'test' }),
        }
      );

      const ctx = await context.setup();
      expect(ctx.data).toBe('test');

      // Should not throw for valid boundary
      expect(() => context.validateBoundary('@engine/world', '@engine/core')).not.toThrow();

      // Should throw for invalid boundary
      expect(() => context.validateBoundary('@engine/core', '@engine/world')).toThrow();

      await context.teardown(ctx);
    });
  });
});

describe('Integration Test - Real World Example', () => {
  /**
   * Example: Testing Input → Camera → World integration
   *
   * This test verifies that:
   * 1. Input events are captured correctly
   * 2. Camera responds to input
   * 3. World entities are updated based on camera state
   */
  it('should integrate input with camera movement', async () => {
    const eventCapture = createEventCapture<unknown>();

    const result = await runIntegrationScenario({
      name: 'Input-Camera-World Integration',
      description: 'Tests input handling through camera to world updates',
      packages: ['@engine/input', '@engine/camera', '@engine/world'],
      setup: () => {
        const inputManager = packageMocks.createInputManagerMock();
        const scene = packageMocks.createSceneMock();

        // Create camera entity
        const cameraEntity = scene.createEntity('MainCamera');
        cameraEntity.addComponent('transform', { x: 0, y: 0, z: 0 });
        cameraEntity.addComponent('camera', { fov: 60, near: 0.1, far: 1000 });

        return { inputManager, scene, cameraEntity, eventCapture };
      },
      teardown: (ctx) => {
        ctx.scene.dispose();
        ctx.inputManager.dispose();
      },
      steps: [
        {
          name: 'Simulate key press',
          action: (ctx) => {
            ctx.inputManager.simulateKeyDown('KeyW');
            eventCapture.capture('input:keydown', { key: 'KeyW' });
          },
          validate: (ctx) => {
            expect(ctx.inputManager.isKeyDown('KeyW')).toBe(true);
          },
        },
        {
          name: 'Process camera movement',
          action: (ctx) => {
            // Simulate camera processing input
            const transform = ctx.cameraEntity.getComponent('transform') as { x: number; y: number; z: number };
            if (ctx.inputManager.isKeyDown('KeyW')) {
              transform.z -= 1; // Move forward
            }
            eventCapture.capture('camera:moved', { newZ: transform.z });
          },
          validate: (ctx) => {
            const transform = ctx.cameraEntity.getComponent('transform') as { z: number };
            expect(transform.z).toBe(-1);
          },
        },
        {
          name: 'Release key',
          action: (ctx) => {
            ctx.inputManager.simulateKeyUp('KeyW');
            eventCapture.capture('input:keyup', { key: 'KeyW' });
          },
          validate: (ctx) => {
            expect(ctx.inputManager.isKeyDown('KeyW')).toBe(false);
            expect(eventCapture.events).toHaveLength(3);
          },
        },
      ],
    });

    expectCrossPackageSuccess(result);
    expect(eventCapture.getByType('camera:moved')).toHaveLength(1);
  });
});

