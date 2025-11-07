import type { Scene } from '@engine/world';
import { ScriptComponent } from '../components/ScriptComponent.js';
import type { BehaviorInstance } from '../behavior/Behavior.js';
import { SceneScriptContextBuilder } from '../services/SceneScriptContextBuilder.js';
import { BehaviorRegistry } from '../behavior/BehaviorRegistry.js';
import { CoroutineScheduler } from '../coroutine/CoroutineScheduler.js';
import type { ScriptRuntime } from '../LogicCubes/types.js';
import { CapabilityManager } from '../security/CapabilityToken.js';
import type { ScriptCapabilityPermissions } from '../security/CapabilityTypes.js';

/**
 * Runs Behavior instances on entities with ScriptComponent.
 * Also supports hot-reload by monitoring registry changes via a simple version.
 * Supports capability-based access control when permissions are provided.
 */
export class ScriptSystem {
  private readonly scene: Scene;
  private lastRegistryVersion = -1;
  private readonly runtime: ScriptRuntime;
  private fixedAccumulator = 0;
  private fixedDeltaTime = 1 / 60; // default 60 Hz
  private maxFixedStepsPerUpdate = 10;
  private enabled = true;
  private readonly capabilityManager?: CapabilityManager;

  constructor(scene: Scene, options?: { permissions?: ScriptCapabilityPermissions }) {
    this.scene = scene;
    
    // Create capability manager if permissions provided
    if (options?.permissions) {
      this.capabilityManager = new CapabilityManager();
    }
    
    const contextBuilder = new SceneScriptContextBuilder(scene, {
      ...(this.capabilityManager ? { capabilityManager: this.capabilityManager } : {}),
      ...(options?.permissions ? { permissions: options.permissions } : {}),
    });
    
    this.runtime = {
      scheduler: new CoroutineScheduler(),
      behaviors: new Set<BehaviorInstance>(),
      contextBuilder,
      scriptSystem: this, // Expose ScriptSystem instance for external control
    };
    this.scene.scriptRuntime = this.runtime;
  }

  /** Sets the fixed time step in seconds (<=0 disables fixed updates). */
  setFixedTimeStep(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    this.fixedDeltaTime = seconds > 0 ? seconds : 0;
  }

  /** Limits the number of fixed steps processed per variable update. */
  setMaxFixedStepsPerUpdate(steps: number): void {
    if (!Number.isFinite(steps)) return;
    this.maxFixedStepsPerUpdate = Math.max(0, Math.floor(steps));
  }

  /** Enable or disable script execution. When disabled, update() and lateUpdate() do nothing. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Check if script execution is enabled. */
  isEnabled(): boolean {
    return this.enabled;
  }

  update(deltaTime: number): void {
    if (!this.enabled) return;
    if (!Number.isFinite(deltaTime) || deltaTime < 0) return;

    // Hot reload detection: if registry content changed, rebuild instances
    const version = BehaviorRegistry.getVersion();
    if (version !== this.lastRegistryVersion) {
      this.lastRegistryVersion = version;
      const entities = this.scene.queryEntities(ScriptComponent);
      for (const entity of entities) {
        const comp = entity.getComponent(ScriptComponent);
        comp?.rebuildInstances();
      }
    }

    // Ensure runtime.behaviors contains all active instances before fixed-step
    {
      const entities = this.scene.queryEntities(ScriptComponent);
      for (const entity of entities) {
        const comp = entity.getComponent(ScriptComponent);
        if (!comp) continue;
        const instances: BehaviorInstance[] = comp.getInstances();
        this.runtime.contextBuilder.ensureContext(entity);
        for (const inst of instances) {
          if (!inst || inst.enabled !== true) continue;
          this.runtime.behaviors.add(inst);
        }
      }
    }

    // Process fixed-step updates using an accumulator
    if (this.fixedDeltaTime > 0 && deltaTime > 0 && this.maxFixedStepsPerUpdate > 0) {
      this.fixedAccumulator += deltaTime;
      let steps = 0;
      while (this.fixedAccumulator >= this.fixedDeltaTime && steps < this.maxFixedStepsPerUpdate) {
        this.fixedAccumulator -= this.fixedDeltaTime;
        for (const inst of this.runtime.behaviors) {
          if (!inst || inst.enabled !== true) continue;
          try {
            inst.onFixedUpdate(this.fixedDeltaTime);
          } catch {
            // ignore fixed update errors
          }
        }
        steps++;
      }
    }

    const entities = this.scene.queryEntities(ScriptComponent);
    for (const entity of entities) {
      const comp = entity.getComponent(ScriptComponent);
      if (!comp) continue;
      const instances: BehaviorInstance[] = comp.getInstances();
      this.runtime.contextBuilder.ensureContext(entity);
      for (const inst of instances) {
        if (!inst || inst.enabled !== true) continue;
        this.runtime.behaviors.add(inst);
        try {
          inst.onUpdate(deltaTime);
        } catch {
          // ignore instance errors to avoid breaking main loop
        }
      }
    }

    this.runtime.scheduler.update(deltaTime);
  }

  lateUpdate(deltaTime: number): void {
    if (!this.enabled) return;
    if (!Number.isFinite(deltaTime) || deltaTime < 0) return;
    for (const behavior of this.runtime.behaviors) {
      if (!behavior.enabled) continue;
      try {
        behavior.onLateUpdate(deltaTime);
      } catch {
        // ignore late update errors
      }
    }
    this.runtime.scheduler.lateUpdate(deltaTime);
  }

  /** Resets cached services and coroutine state. */
  reset(): void {
    this.runtime.scheduler.reset();
    this.runtime.behaviors.clear();
    this.runtime.contextBuilder.reset();
  }
}
