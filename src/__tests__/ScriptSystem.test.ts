import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { ScriptComponent } from '@engine/world';
import { ScriptSystem } from '@engine/script';
import { BehaviorInstance, type BehaviorConstructor } from '@engine/script';
import { BehaviorRegistry } from '@engine/script';

class CounterBehavior extends BehaviorInstance {
  ticks = 0;
  override onUpdate(dt: number): void {
    if (dt > 0) this.ticks++;
  }
}

class ListenerBehavior extends BehaviorInstance {
  last: unknown = null;
  override onInit(): void {
    const id = this.context.entity.id;
    this.context.events.subscribe(
      'ping',
      (e) => {
        this.last = e.payload;
      },
      { entityId: id }
    );
  }
}

describe('ScriptSystem', () => {
  let scene: Scene;
  let system: ScriptSystem;
  let entity: Entity;

  beforeEach(() => {
    scene = new Scene('Logic Test');
    system = new ScriptSystem(scene);
    entity = new Entity('Actor');
    scene.addEntity(entity);
    BehaviorRegistry.register('Counter', CounterBehavior as unknown as BehaviorConstructor);
    BehaviorRegistry.register('Listener', ListenerBehavior as unknown as BehaviorConstructor);
  });

  it('updates behavior instances each frame', () => {
    const scripts = new ScriptComponent();
    scripts.fromJSON({ scripts: [{ name: 'Counter' }] });
    entity.addComponent(scripts);

    system.update(0.016);
    system.update(0.016);

    const inst = scripts.getInstances()[0] as CounterBehavior;
    expect(inst.ticks).toBe(2);
  });

  it('delivers directed events through EventBus', () => {
    const scripts = new ScriptComponent();
    scripts.fromJSON({ scripts: [{ name: 'Listener' }] });
    entity.addComponent(scripts);

    // Initialize behavior
    system.update(0.016);

    scene.events.publishTo(entity, 'ping', { hello: 'world' }, null);

    const inst = scripts.getInstances()[0] as ListenerBehavior;
    expect(inst.last).toEqual({ hello: 'world' });
  });

  it('hot-reloads behavior by re-registering', () => {
    const scripts = new ScriptComponent();
    scripts.fromJSON({ scripts: [{ name: 'Counter' }] });
    entity.addComponent(scripts);

    system.update(0.016);

    // Re-register Counter with different behavior
    class CounterBehaviorV2 extends BehaviorInstance {
      ticks = 0;
      override onUpdate(): void {
        this.ticks += 10;
      }
    }
    BehaviorRegistry.hotRegister('Counter', CounterBehaviorV2 as unknown as BehaviorConstructor);

    // Next update should rebuild and use V2
    system.update(0.016);

    const inst = scripts.getInstances()[0] as unknown as CounterBehaviorV2;
    expect(inst.ticks).toBe(10);
  });

  it('runs onUpdate even when deltaTime is 0', () => {
    class ZeroDtBehavior extends BehaviorInstance {
      ticks = 0;
      override onUpdate(_dt: number): void {
        this.ticks++;
      }
    }
    BehaviorRegistry.register('ZeroDT', ZeroDtBehavior as unknown as BehaviorConstructor);
    const scripts = new ScriptComponent();
    scripts.fromJSON({ scripts: [{ name: 'ZeroDT' }] });
    entity.addComponent(scripts);

    system.update(0);

    const inst = scripts.getInstances()[0] as ZeroDtBehavior;
    expect(inst.ticks).toBe(1);
  });

  it('runs onFixedUpdate using accumulator with configurable timestep', () => {
    class FixedBehavior extends BehaviorInstance {
      fixedTicks = 0;
      override onFixedUpdate(_dt: number): void {
        this.fixedTicks++;
      }
    }
    BehaviorRegistry.register('Fixed', FixedBehavior as unknown as BehaviorConstructor);
    const scripts = new ScriptComponent();
    scripts.fromJSON({ scripts: [{ name: 'Fixed' }] });
    entity.addComponent(scripts);

    // Configure fixed step to 10ms and process 25ms of variable time
    system.setFixedTimeStep(0.01);
    system.setMaxFixedStepsPerUpdate(10);
    system.update(0.025);

    const inst = scripts.getInstances()[0] as FixedBehavior;
    // Expect 2 fixed steps (0.02 consumed, 0.005 carried)
    expect(inst.fixedTicks).toBe(2);
  });
});


