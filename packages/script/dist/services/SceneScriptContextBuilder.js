/**
 * Creates and caches service facades exposed to scripting behaviors for a scene.
 * Real services are wired in later tasks; currently returns empty facades.
 */
export class SceneScriptContextBuilder {
    scene;
    cache = new Map();
    constructor(scene) {
        this.scene = scene;
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
    getPhysicsFromScene() {
        const runtime = this.scene.scriptRuntime;
        return runtime?.physicsWorld ?? null;
    }
    getAnimationSystem() {
        const runtime = this.scene.scriptRuntime;
        return runtime?.animationSystem ?? null;
    }
    getRenderer() {
        const runtime = this.scene.scriptRuntime;
        return runtime?.renderingPipeline ?? null;
    }
}
//# sourceMappingURL=SceneScriptContextBuilder.js.map