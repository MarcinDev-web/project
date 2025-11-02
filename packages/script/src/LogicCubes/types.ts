import type { BehaviorInstance } from '../behavior/Behavior';
import type { CoroutineScheduler } from '../coroutine/CoroutineScheduler';
import type { SceneScriptContextBuilder } from '../services/SceneScriptContextBuilder';
import type { PhysicsWorld } from '@engine/world';
import type { AnimationSystem } from '@engine/stdlib/Animation';
// NOTE: Renderer placeholder
type Renderer = any; // Temp placeholder

export interface ScriptRuntime {
  scheduler: CoroutineScheduler;
  /** Tracking for all live behavior instances within the scene */
  behaviors: Set<BehaviorInstance>;
  contextBuilder: SceneScriptContextBuilder;
  physicsWorld?: PhysicsWorld | null;
  animationSystem?: AnimationSystem | null;
  renderingPipeline?: Renderer | null;
  [key: string]: unknown; // Index signature for core compatibility
}

