import { CoroutineScheduler, } from '../coroutine/CoroutineScheduler.js';
/**
 * Base class for all user-defined behaviors.
 * Extend this and override lifecycle hooks as needed.
 */
export class BehaviorInstance {
    context;
    /** Optional params passed during creation (serialized by ScriptComponent). */
    params;
    /** Enable/disable updates for this behavior instance. */
    enabled = true;
    constructor(context, params) {
        this.context = context;
        this.params = params;
    }
    /** Starts a coroutine owned by this behavior. */
    startCoroutine(iterator) {
        return this.getScheduler().start(iterator, this);
    }
    /** Stops a coroutine previously started by this behavior. */
    stopCoroutine(handle) {
        this.getScheduler().stop(handle);
    }
    /** Convenience to wait for seconds inside async methods. */
    waitForSeconds(seconds) {
        return this.getScheduler().waitForSeconds(seconds);
    }
    waitForFrames(frames) {
        return this.getScheduler().waitForFrames(frames);
    }
    waitUntil(predicate) {
        return this.getScheduler().waitUntil(predicate);
    }
    /** Called once after instance is created and attached to an entity. */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onInit() { }
    /** Called every frame by ScriptSystem when enabled. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    onUpdate(_deltaTime) { }
    /** Called during the fixed timestep loop (typically physics). */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    onFixedUpdate(_fixedDeltaTime) { }
    /** Called after all Update callbacks in the frame. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    onLateUpdate(_deltaTime) { }
    /** Called when a subscribed event is published on the EventBus. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    onEvent(_type, _payload, _sender) { }
    /** Async variant of onEvent, scheduled by coroutine/event dispatchers. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    // eslint-disable-next-line @typescript-eslint/require-await
    async onEventAsync(_type, _payload, _sender) { }
    /** Called before the instance is destroyed or detached. */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onDestroy() { }
    /**
     * Hot-reload hook invoked when the behavior constructor is re-registered.
     * Existing instance prototype is updated; implement to migrate state.
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onHotReload(_previousConstructorName) { }
    getScheduler() {
        const runtime = this.context.scene.scriptRuntime;
        if (!runtime) {
            throw new Error('CoroutineScheduler not available: ScriptSystem not initialized for scene');
        }
        return runtime.scheduler;
    }
}
//# sourceMappingURL=Behavior.js.map