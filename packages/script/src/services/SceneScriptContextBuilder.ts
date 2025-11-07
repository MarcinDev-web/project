import type { Scene } from '@engine/world';
import type { Entity, EntityId } from '@engine/world';
import type {
  ScriptServices,
  PhysicsScriptFacade,
  AnimationScriptFacade,
  RenderingScriptFacade,
} from '../behavior/Behavior.js';
import type { PhysicsWorld } from '@engine/world';
import type { AnimationSystem } from '@engine/stdlib/Animation';
import type { CapabilityManager } from '../security/CapabilityToken.js';
import type { ScriptCapabilityPermissions } from '../security/CapabilityTypes.js';
import { getGrantedCapabilities } from '../security/CapabilityTypes.js';
import {
  CapabilityPhysicsFacade,
  CapabilityAnimationFacade,
  CapabilityRenderingFacade,
} from './CapabilityScriptServices.js';
// NOTE: Renderer type placeholder (gfx-webgpu exists but not exporting Renderer type cleanly yet)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Renderer = any; // Temp placeholder

/**
 * Creates and caches service facades exposed to scripting behaviors for a scene.
 * Real services are wired in later tasks; currently returns empty facades.
 * Supports capability-based access control when capabilityManager and permissions are provided.
 */
export class SceneScriptContextBuilder {
  private readonly scene: Scene;
  private readonly cache = new Map<EntityId, ScriptServices>();
  private readonly capabilityManager?: CapabilityManager;
  private readonly permissions?: ScriptCapabilityPermissions;
  private readonly capabilityToken?: import('../security/CapabilityToken.js').CapabilityToken;

  constructor(
    scene: Scene,
    options?: {
      capabilityManager?: CapabilityManager | undefined;
      permissions?: ScriptCapabilityPermissions | undefined;
    }
  ) {
    this.scene = scene;
    this.capabilityManager = options?.capabilityManager;
    this.permissions = options?.permissions;

    // Grant capabilities based on permissions if manager is provided
    if (this.capabilityManager && this.permissions) {
      const granted = getGrantedCapabilities(this.permissions);
      if (granted.length > 0) {
        this.capabilityToken = this.capabilityManager.grantCapabilities(granted);
      }
    }
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
      const physicsFacade: PhysicsScriptFacade = { world: physics };
      if (this.capabilityManager && this.capabilityToken && this.permissions?.physics) {
        services.physics = new CapabilityPhysicsFacade(
          this.capabilityToken,
          this.capabilityManager,
          physicsFacade
        );
      } else if (!this.capabilityManager) {
        // No capability manager = full access (backward compatibility)
        services.physics = physicsFacade;
      }
      // If capability manager exists but permission not granted, don't add service
    }

    const animation = this.getAnimationSystem();
    if (animation) {
      const animationFacade: AnimationScriptFacade = { system: animation };
      if (this.capabilityManager && this.capabilityToken && this.permissions?.animation) {
        services.animation = new CapabilityAnimationFacade(
          this.capabilityToken,
          this.capabilityManager,
          animationFacade
        );
      } else if (!this.capabilityManager) {
        services.animation = animationFacade;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const renderer = this.getRenderer();
    if (renderer) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const renderingFacade: RenderingScriptFacade = { renderer };
      if (this.capabilityManager && this.capabilityToken && this.permissions?.rendering) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        services.rendering = new CapabilityRenderingFacade(
          this.capabilityToken,
          this.capabilityManager,
          renderingFacade
        );
      } else if (!this.capabilityManager) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        services.rendering = renderingFacade;
      }
    }

    return services;
  }

  private getPhysicsFromScene(): PhysicsWorld | null {
    const runtime = this.scene.scriptRuntime;
    return (runtime?.physicsWorld as PhysicsWorld | null | undefined) ?? null;
  }

  private getAnimationSystem(): AnimationSystem | null {
    const runtime = this.scene.scriptRuntime;
    return (runtime?.animationSystem as AnimationSystem | null | undefined) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  private getRenderer(): Renderer | null {
    const runtime = this.scene.scriptRuntime;
    if (!runtime?.renderingPipeline) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return runtime.renderingPipeline as any;
  }
}
