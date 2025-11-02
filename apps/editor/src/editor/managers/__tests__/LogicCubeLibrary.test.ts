import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scene, Entity } from '@engine/world';
import { LogicCubeLibrary } from '../LogicCubeLibrary';
import { LogicCubeRegistry, LogicCube } from '@engine/script';
import type { LogicCubeConstructor } from '@engine/script';

describe('LogicCubeLibrary', () => {
  beforeEach(() => {
    LogicCubeLibrary.clear();
  });

  afterEach(() => {
    LogicCubeLibrary.clear();
  });

  it('getCategories returns dynamic categories with stable ordering', () => {
    // Register two fake cube types with categories including a custom one
    const makeCtor = (meta: { type: string; displayName: string; category: string }): LogicCubeConstructor => {
      class DummyCube extends LogicCube {
        static type = meta.type;
        constructor(entity: Entity, scene: Scene, config?: Record<string, unknown>) {
          super(entity, scene, config);
          // Parameters are required by base class constructor but unused in test mocks
        }
        getMetadata() {
          return {
            type: meta.type,
            displayName: meta.displayName,
            category: meta.category,
            description: '',
            inputs: [],
            outputs: [],
            parameters: [],
          };
        }
        // Unused in this test
        onInit() {}
        onDestroy() {}
        onUpdate() {}
        canReceiveSignal() { return true; }
        onSignalReceived() { return null; }
        toJSON() {
          return {
            config: {},
            state: {},
            cooldown: 0,
          };
        }
        fromJSON() {}
      }
      return DummyCube as unknown as LogicCubeConstructor;
    };

    LogicCubeRegistry.register('dummyTrigger', makeCtor({ type: 'dummyTrigger', displayName: 'Dummy Trigger', category: 'trigger' }));
    LogicCubeRegistry.register('dummyCustom', makeCtor({ type: 'dummyCustom', displayName: 'Dummy Custom', category: 'custom' }));

    // Initialize the library to populate entries
    LogicCubeLibrary.initialize();

    const categories = LogicCubeLibrary.getCategories();

    // Should include default categories present ('trigger') first
    expect(categories[0]).toBe('trigger');
    // Custom categories should appear after defaults, sorted
    expect(categories.includes('custom' as never)).toBe(true);
    const triggerIndex = categories.indexOf('trigger');
    const customIndex = categories.indexOf('custom' as never);
    expect(customIndex).toBeGreaterThan(triggerIndex);
  });

  it('createEntity attaches created entity to provided scene', () => {
    // Minimal cube to be registered
    const makeCtor = (meta: { type: string; displayName: string; category: string }): LogicCubeConstructor => {
      class DummyCube extends LogicCube {
        static type = meta.type;
        constructor(entity: Entity, scene: Scene, config?: Record<string, unknown>) {
          super(entity, scene, config);
          // Parameters are required by base class constructor but unused in test mocks
        }
        getMetadata() {
          return {
            type: meta.type,
            displayName: meta.displayName,
            category: meta.category,
            description: '',
            inputs: [],
            outputs: [],
            parameters: [],
          };
        }
        onInit() {}
        onDestroy() {}
        onUpdate() {}
        canReceiveSignal() { return true; }
        onSignalReceived() { return null; }
        toJSON() {
          return {
            config: {},
            state: {},
            cooldown: 0,
          };
        }
        fromJSON() {}
      }
      return DummyCube as unknown as LogicCubeConstructor;
    };

    LogicCubeRegistry.register('attachTest', makeCtor({ type: 'attachTest', displayName: 'Attach Test', category: 'logic' }));
    LogicCubeLibrary.initialize();

    const entry = LogicCubeLibrary.get('attachTest');
    expect(entry).toBeTruthy();

    const scene = new Scene('Test');
    const beforeCount = scene.entityCount;
    const entity = entry!.createEntity(scene);
    expect(entity.scene).toBe(scene);
    expect(scene.entityCount).toBe(beforeCount + 1);
  });
});



