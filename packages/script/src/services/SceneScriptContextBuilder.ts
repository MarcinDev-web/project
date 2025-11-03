import type { Scene } from '@engine/world';
import type { Entity, EntityId } from '@engine/world';
import type { ScriptServices } from '../behavior/Behavior.js';
import type { PhysicsWorld } from '@engine/world';
import type { AnimationSystem } from '@engine/stdlib/Animation';
// NOTE: Renderer type placeholder (gfx-webgpu exists but not exporting Renderer type cleanly yet)
type Renderer = any; // Temp placeholder

/**
 * Creates and caches service facades exposed to scripting behaviors for a scene.
 * Real services are wired in later tasks; currently returns empty facades.
 */
export class SceneScriptContextBuilder {
  private readonly scene: Scene;
  private readonly cache = new Map<EntityId, ScriptServices>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  ensureContext(entity: Entity): void {
    if (!this.cache.has(entity.id)) {
      this.cache.set(entity.id, this.createServices(entity));
    }
  }

  getServices(entity: Entity): ScriptServices | undefined {
    this.ensureContext(entity);
    return this.cache.get(entity.id);
  }

  invalidate(entityId: EntityId): void {
    this.cache.delete(entityId);
  }

  reset(): void {
    this.cache.clear();
  }

  private createServices(entity: Entity): ScriptServices {
    const services: ScriptServices = {};
    void entity; // mark parameter as intentionally unused

    // Lookup scene-level physics runtime if available
    const physics = this.getPhysicsFromScene();
    if (physics) {
      services.physics = { world: physics };
    }

    const animation = this.getAnimationSystem();
    if (animation) {
      services.animation = { system: animation };
    }

    const renderer = this.getRenderer();
    if (renderer) {
      services.rendering = { renderer };
    }

    return services;
  }

  private getPhysicsFromScene(): PhysicsWorld | null {
    const runtime = this.scene.scriptRuntime;
    return (runtime?.physicsWorld as PhysicsWorld) ?? null;
  }

  private getAnimationSystem(): AnimationSystem | null {
    const runtime = this.scene.scriptRuntime;
    return (runtime?.animationSystem as AnimationSystem | undefined) ?? null;
  }

  private getRenderer(): Renderer | null {
    const runtime = this.scene.scriptRuntime;
    return runtime?.renderingPipeline ?? null;
  }
}

