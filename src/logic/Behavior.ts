import type { Entity } from '../scene/Entity';
import type { Scene } from '../scene/Scene';
import type { EventBus } from './EventBus';
import {
  CoroutineScheduler,
  type CoroutineGenerator,
  type WaitForFrames,
  type WaitForPredicate,
  type WaitForSeconds,
} from './CoroutineScheduler';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { AnimationSystem } from '../animation/AnimationSystem';
import type { Renderer } from '../rendering/core/Renderer';

export interface BehaviorContext {
  entity: Entity;
  scene: Scene;
  events: EventBus;
  /** Optional bucket for engine-provided services (physics, animation, etc.). */
  services?: ScriptServices;
}

export interface ScriptServices {
  physics?: PhysicsScriptFacade;
  animation?: AnimationScriptFacade;
  rendering?: RenderingScriptFacade;
}

export interface PhysicsScriptFacade {
  world: PhysicsWorld;
}

export interface AnimationScriptFacade {
  system: AnimationSystem;
}

export interface RenderingScriptFacade {
  renderer: Renderer;
}

export interface BehaviorConstructor<T extends BehaviorInstance = BehaviorInstance> {
  new (context: BehaviorContext, params?: Record<string, unknown>): T;
  name: string;
}

/**
 * Base class for all user-defined behaviors.
 * Extend this and override lifecycle hooks as needed.
 */
export class BehaviorInstance {
  protected readonly context: BehaviorContext;
  /** Optional params passed during creation (serialized by ScriptComponent). */
  protected readonly params: Record<string, unknown> | undefined;
  /** Enable/disable updates for this behavior instance. */
  enabled = true;

  constructor(context: BehaviorContext, params?: Record<string, unknown>) {
    this.context = context;
    this.params = params;
  }

  /** Starts a coroutine owned by this behavior. */
  startCoroutine(iterator: CoroutineGenerator): symbol {
    return this.getScheduler().start(iterator, this);
  }

  /** Stops a coroutine previously started by this behavior. */
  stopCoroutine(handle: symbol): void {
    this.getScheduler().stop(handle);
  }

  /** Convenience to wait for seconds inside async methods. */
  waitForSeconds(seconds: number): WaitForSeconds {
    return this.getScheduler().waitForSeconds(seconds);
  }

  waitForFrames(frames: number): WaitForFrames {
    return this.getScheduler().waitForFrames(frames);
  }

  waitUntil(predicate: () => boolean): WaitForPredicate {
    return this.getScheduler().waitUntil(predicate);
  }

  /** Called once after instance is created and attached to an entity. */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onInit(): void {}

  /** Called every frame by ScriptSystem when enabled. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  onUpdate(_deltaTime: number): void {}

  /** Called during the fixed timestep loop (typically physics). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  onFixedUpdate(_fixedDeltaTime: number): void {}

  /** Called after all Update callbacks in the frame. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  onLateUpdate(_deltaTime: number): void {}

  /** Called when a subscribed event is published on the EventBus. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  onEvent(_type: string, _payload?: unknown, _sender?: Entity | null): void {}

  /** Async variant of onEvent, scheduled by coroutine/event dispatchers. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  // eslint-disable-next-line @typescript-eslint/require-await
  async onEventAsync(_type: string, _payload?: unknown, _sender?: Entity | null): Promise<void> {}

  /** Called before the instance is destroyed or detached. */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onDestroy(): void {}

  /**
   * Hot-reload hook invoked when the behavior constructor is re-registered.
   * Existing instance prototype is updated; implement to migrate state.
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onHotReload(_previousConstructorName?: string): void {}

  private getScheduler(): CoroutineScheduler {
    const runtime = this.context.scene.scriptRuntime;
    if (!runtime) {
      throw new Error('CoroutineScheduler not available: ScriptSystem not initialized for scene');
    }
    return runtime.scheduler;
  }
}


