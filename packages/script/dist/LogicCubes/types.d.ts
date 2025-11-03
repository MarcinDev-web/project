import type { BehaviorInstance } from '../behavior/Behavior.js';
import type { CoroutineScheduler } from '../coroutine/CoroutineScheduler.js';
import type { SceneScriptContextBuilder } from '../services/SceneScriptContextBuilder.js';
import type { PhysicsWorld } from '@engine/world';
import type { AnimationSystem } from '@engine/stdlib/Animation';
type Renderer = any;
export interface ScriptRuntime {
    scheduler: CoroutineScheduler;
    /** Tracking for all live behavior instances within the scene */
    behaviors: Set<BehaviorInstance>;
    contextBuilder: SceneScriptContextBuilder;
    physicsWorld?: PhysicsWorld | null;
    animationSystem?: AnimationSystem | null;
    renderingPipeline?: Renderer | null;
    [key: string]: unknown;
}
export {};
//# sourceMappingURL=types.d.ts.map