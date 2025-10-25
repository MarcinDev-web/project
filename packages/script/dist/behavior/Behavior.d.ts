import type { Entity } from '@engine/world';
import type { Scene } from '@engine/world';
import type { EventBus } from '@engine/core/event';
import { type CoroutineGenerator, type WaitForFrames, type WaitForPredicate, type WaitForSeconds } from '../coroutine/CoroutineScheduler';
import type { PhysicsWorld } from '@engine/world/physics';
type AnimationSystem = any;
type Renderer = any;
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
export declare class BehaviorInstance {
    protected readonly context: BehaviorContext;
    /** Optional params passed during creation (serialized by ScriptComponent). */
    protected readonly params: Record<string, unknown> | undefined;
    /** Enable/disable updates for this behavior instance. */
    enabled: boolean;
    constructor(context: BehaviorContext, params?: Record<string, unknown>);
    /** Starts a coroutine owned by this behavior. */
    startCoroutine(iterator: CoroutineGenerator): symbol;
    /** Stops a coroutine previously started by this behavior. */
    stopCoroutine(handle: symbol): void;
    /** Convenience to wait for seconds inside async methods. */
    waitForSeconds(seconds: number): WaitForSeconds;
    waitForFrames(frames: number): WaitForFrames;
    waitUntil(predicate: () => boolean): WaitForPredicate;
    /** Called once after instance is created and attached to an entity. */
    onInit(): void;
    /** Called every frame by ScriptSystem when enabled. */
    onUpdate(_deltaTime: number): void;
    /** Called during the fixed timestep loop (typically physics). */
    onFixedUpdate(_fixedDeltaTime: number): void;
    /** Called after all Update callbacks in the frame. */
    onLateUpdate(_deltaTime: number): void;
    /** Called when a subscribed event is published on the EventBus. */
    onEvent(_type: string, _payload?: unknown, _sender?: Entity | null): void;
    /** Async variant of onEvent, scheduled by coroutine/event dispatchers. */
    onEventAsync(_type: string, _payload?: unknown, _sender?: Entity | null): Promise<void>;
    /** Called before the instance is destroyed or detached. */
    onDestroy(): void;
    /**
     * Hot-reload hook invoked when the behavior constructor is re-registered.
     * Existing instance prototype is updated; implement to migrate state.
     */
    onHotReload(_previousConstructorName?: string): void;
    private getScheduler;
}
export {};
//# sourceMappingURL=Behavior.d.ts.map