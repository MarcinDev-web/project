import type { BehaviorInstance } from './Behavior';
import type { CoroutineScheduler } from './CoroutineScheduler';
import type { SceneScriptContextBuilder } from './services/SceneScriptContextBuilder';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { AnimationSystem } from '@engine/stdlib/Animation';
import type { Renderer } from '../rendering/core/Renderer';

export interface ScriptRuntime {
  scheduler: CoroutineScheduler;
  /** Tracking for all live behavior instances within the scene */
  behaviors: Set<BehaviorInstance>;
  contextBuilder: SceneScriptContextBuilder;
  physicsWorld?: PhysicsWorld | null;
  animationSystem?: AnimationSystem | null;
  renderingPipeline?: Renderer | null;
}

