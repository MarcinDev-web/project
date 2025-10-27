import { describe, it, expect } from 'vitest';
import { Scene } from '../src/core/Scene';
import { Entity } from '../src/core/Entity';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { RigidbodyType, PhysicsComponent } from '../src/components/PhysicsComponent';

function forceGC() {
  try {
    // @ts-expect-error Node with --expose-gc only
    global.gc?.();
    // @ts-expect-error Node with --expose-gc only
    global.gc?.();
  } catch {
    // ignore
  }
}

describe('memory: world should not leak after create→run→dispose', () => {
  it('heapUsed returns near baseline after GC', async () => {
    const baselineBefore = process.memoryUsage().heapUsed;
    forceGC();
    const baseline = process.memoryUsage().heapUsed;

    const scene = new Scene('LeakTest');
    const physics = new PhysicsWorld(scene, { useSpatialPartitioning: false });
    physics.start();

    // Create a modest number of dynamic entities with colliders
    const count = 200;
    for (let i = 0; i < count; i++) {
      const e = new Entity(`E_${i}`);
      const t = e.transform;
      t.position = [i % 20, Math.floor(i / 20), 0];
      t.scale = [1, 1, 1];
      const pc = new PhysicsComponent();
      pc.rigidbodyType = RigidbodyType.Dynamic;
      pc.addBoxCollider([1, 1, 1]);
      e.addComponent(pc);
      scene.addEntity(e);
    }

    // Step simulation for a short time
    for (let i = 0; i < 180; i++) {
      physics.update(1 / 60);
    }

    // Dispose: clear scene
    physics.stop();
    scene.clear();

    // Attempt GC twice to stabilize measurements
    forceGC();
    const afterDispose = process.memoryUsage().heapUsed;

    // Allow up to +10% drift to account for JSDOM and test runner allocations
    const limit = baseline * 1.10;
    expect(afterDispose).toBeLessThanOrEqual(limit);
  });
});


