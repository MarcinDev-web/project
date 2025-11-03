import type { Scene } from '@engine/world';
import type { Entity, EntityId } from '@engine/world';
import type { ScriptServices } from '../behavior/Behavior.js';
/**
 * Creates and caches service facades exposed to scripting behaviors for a scene.
 * Real services are wired in later tasks; currently returns empty facades.
 */
export declare class SceneScriptContextBuilder {
    private readonly scene;
    private readonly cache;
    constructor(scene: Scene);
    ensureContext(entity: Entity): void;
    getServices(entity: Entity): ScriptServices | undefined;
    invalidate(entityId: EntityId): void;
    reset(): void;
    private createServices;
    private getPhysicsFromScene;
    private getAnimationSystem;
    private getRenderer;
}
//# sourceMappingURL=SceneScriptContextBuilder.d.ts.map