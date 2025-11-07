import type { Scene } from '@engine/world';
import type { Entity, EntityId } from '@engine/world';
import type { ScriptServices } from '../behavior/Behavior.js';
import type { CapabilityManager } from '../security/CapabilityToken.js';
import type { ScriptCapabilityPermissions } from '../security/CapabilityTypes.js';
/**
 * Creates and caches service facades exposed to scripting behaviors for a scene.
 * Real services are wired in later tasks; currently returns empty facades.
 * Supports capability-based access control when capabilityManager and permissions are provided.
 */
export declare class SceneScriptContextBuilder {
    private readonly scene;
    private readonly cache;
    private readonly capabilityManager?;
    private readonly permissions?;
    private readonly capabilityToken?;
    constructor(scene: Scene, options?: {
        capabilityManager?: CapabilityManager;
        permissions?: ScriptCapabilityPermissions;
    });
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