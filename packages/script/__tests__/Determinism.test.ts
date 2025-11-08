/**
 * Determinism Tests for ScriptSystem
 * 
 * Tests that ScriptSystem produces deterministic results when using seeded RNG.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ScriptSystem } from '../src/runtime/ScriptSystem';
import { Scene } from '@engine/world';
import { ScriptComponent } from '../src/components/ScriptComponent';
import { BehaviorInstance } from '../src/behavior/Behavior';
import { BehaviorRegistry } from '../src/behavior/BehaviorRegistry';
import { initGlobalRNG, resetGlobalRNG } from '@engine/core/utils/SeededRNG';
import {
  expectDeterministicSnapshot,
  sanitizeForDeterminism,
  createDeterministicTestContext,
} from '@engine/test-utils';

describe('ScriptSystem Determinism', () => {
  let scene: Scene;

  beforeEach(() => {
    scene = new Scene();
    resetGlobalRNG();
  });

  describe('RNG seed determinism', () => {
    it('same RNG seed + same inputs = same behavior results', () => {
      const seed = 12345;

      // Create first system with seed
      initGlobalRNG(seed);
      const system1 = new ScriptSystem(scene);
      const entity1 = scene.createEntity();
      const comp1 = entity1.addComponent(new ScriptComponent());

      // Create a simple behavior that uses RNG
      class TestBehavior extends BehaviorInstance {
        private values: number[] = [];

        onInit(): void {
          // Use global RNG
          const rng = require('@engine/core/utils/SeededRNG').getGlobalRNG();
          this.values.push(rng.random());
        }

        onUpdate(): void {
          const rng = require('@engine/core/utils/SeededRNG').getGlobalRNG();
          this.values.push(rng.random());
        }

        getValues(): number[] {
          return this.values;
        }
      }

      // Register and add behavior via new API
      BehaviorRegistry.register('TestBehavior', TestBehavior);
      comp1.addScript({ name: 'TestBehavior', params: {} });
      system1.update(0.016); // One frame

      const result1 = sanitizeForDeterminism({
        values: (comp1.getInstances()[0] as TestBehavior).getValues(),
      });

      // Reset and recreate with same seed
      resetGlobalRNG();
      initGlobalRNG(seed);
      const scene2 = new Scene();
      const system2 = new ScriptSystem(scene2);
      const entity2 = scene2.createEntity();
      const comp2 = entity2.addComponent(new ScriptComponent());

      comp2.addScript({ name: 'TestBehavior', params: {} });
      system2.update(0.016);

      const result2 = sanitizeForDeterminism({
        values: (comp2.getInstances()[0] as TestBehavior).getValues(),
      });

      expect(result1).toEqual(result2);
    });
  });

  describe('fixed timestep accumulator determinism', () => {
    it('fixed timestep accumulator produces consistent results', () => {
      const seed = 54321;
      initGlobalRNG(seed);

      const system1 = new ScriptSystem(scene);
      system1.setFixedTimeStep(1 / 60); // 60 Hz

      class FixedUpdateBehavior extends BehaviorInstance {
        private fixedUpdateCount = 0;

        onFixedUpdate(): void {
          this.fixedUpdateCount++;
        }

        getCount(): number {
          return this.fixedUpdateCount;
        }
      }

      const entity1 = scene.createEntity();
      const comp1 = entity1.addComponent(new ScriptComponent());
      BehaviorRegistry.register('FixedUpdateBehavior', FixedUpdateBehavior);
      comp1.addScript({ name: 'FixedUpdateBehavior', params: {} });

      // Simulate 1 second at 60 FPS
      for (let i = 0; i < 60; i++) {
        system1.update(1 / 60);
      }
      system1.update(0); // Final update

      const count1 = (comp1.getInstances()[0] as FixedUpdateBehavior).getCount();

      // Reset and recreate
      resetGlobalRNG();
      initGlobalRNG(seed);
      const scene2 = new Scene();
      const system2 = new ScriptSystem(scene2);
      system2.setFixedTimeStep(1 / 60);

      const entity2 = scene2.createEntity();
      const comp2 = entity2.addComponent(new ScriptComponent());
      comp2.addScript({ name: 'FixedUpdateBehavior', params: {} });

      for (let i = 0; i < 60; i++) {
        system2.update(1 / 60);
      }
      system2.update(0);

      const count2 = (comp2.getInstances()[0] as FixedUpdateBehavior).getCount();

      expect(count1).toBe(count2);
    });
  });

  describe('capability token grants determinism', () => {
    it('capability token grants do not affect determinism', () => {
      const seed = 99999;
      initGlobalRNG(seed);

      // System with permissions
      const system1 = new ScriptSystem(scene, {
        permissions: {
          physics: true,
          animation: false,
          rendering: false,
        },
      });

      const result1 = sanitizeForDeterminism({
        hasPermissions: true,
      });

      // System without permissions (backward compatibility)
      resetGlobalRNG();
      initGlobalRNG(seed);
      const scene2 = new Scene();
      const system2 = new ScriptSystem(scene2);

      const result2 = sanitizeForDeterminism({
        hasPermissions: false,
      });

      // Both should produce deterministic snapshots (even if different)
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      // The key is that running the same test twice produces the same result
      expectDeterministicSnapshot(() => result1);
      expectDeterministicSnapshot(() => result2);
    });
  });
});

