import { SCRIPT_CAPABILITIES, getGrantedCapabilities } from '../security/CapabilityTypes.js';
import { CapabilityPhysicsFacade, CapabilityAnimationFacade, CapabilityRenderingFacade, } from './CapabilityScriptServices.js';
/**
 * Creates and caches service facades exposed to scripting behaviors for a scene.
 * Real services are wired in later tasks; currently returns empty facades.
 * Supports capability-based access control when capabilityManager and permissions are provided.
 */
export class SceneScriptContextBuilder {
    scene;
    cache = new Map();
    capabilityManager;
    permissions;
    capabilityToken;
    constructor(scene, options) {
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
    ensureContext(entity) {
        if (!this.cache.has(entity.id)) {
            this.cache.set(entity.id, this.createServices(entity));
        }
    }
    getServices(entity) {
        this.ensureContext(entity);
        return this.cache.get(entity.id);
    }
    invalidate(entityId) {
        this.cache.delete(entityId);
    }
    reset() {
        this.cache.clear();
    }
    createServices(entity) {
        const services = {};
        void entity; // mark parameter as intentionally unused
        // Lookup scene-level physics runtime if available
        const physics = this.getPhysicsFromScene();
        if (physics) {
            const physicsFacade = { world: physics };
            if (this.capabilityManager && this.capabilityToken && this.permissions?.physics) {
                services.physics = new CapabilityPhysicsFacade(this.capabilityToken, this.capabilityManager, physicsFacade);
            }
            else if (!this.capabilityManager) {
                // No capability manager = full access (backward compatibility)
                services.physics = physicsFacade;
            }
            // If capability manager exists but permission not granted, don't add service
        }
        const animation = this.getAnimationSystem();
        if (animation) {
            const animationFacade = { system: animation };
            if (this.capabilityManager && this.capabilityToken && this.permissions?.animation) {
                services.animation = new CapabilityAnimationFacade(this.capabilityToken, this.capabilityManager, animationFacade);
            }
            else if (!this.capabilityManager) {
                services.animation = animationFacade;
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const renderer = this.getRenderer();
        if (renderer) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const renderingFacade = { renderer };
            if (this.capabilityManager && this.capabilityToken && this.permissions?.rendering) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                services.rendering = new CapabilityRenderingFacade(this.capabilityToken, this.capabilityManager, renderingFacade);
            }
            else if (!this.capabilityManager) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                services.rendering = renderingFacade;
            }
        }
        return services;
    }
    getPhysicsFromScene() {
        const runtime = this.scene.scriptRuntime;
        return runtime?.physicsWorld ?? null;
    }
    getAnimationSystem() {
        const runtime = this.scene.scriptRuntime;
        return runtime?.animationSystem ?? null;
    }
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    getRenderer() {
        const runtime = this.scene.scriptRuntime;
        if (!runtime?.renderingPipeline)
            return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return runtime.renderingPipeline;
    }
}
//# sourceMappingURL=SceneScriptContextBuilder.js.map