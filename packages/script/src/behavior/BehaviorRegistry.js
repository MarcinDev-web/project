/**
 * Global behavior registry to allow deserialization and hot-reload.
 * Register behavior classes by a unique name.
 */
export class BehaviorRegistry {
    static behaviors = new Map();
    static version = 0;
    static register(name, ctor) {
        const prev = BehaviorRegistry.behaviors.get(name);
        if (prev === ctor)
            return; // no-op for duplicate registration
        BehaviorRegistry.behaviors.set(name, ctor);
        BehaviorRegistry.version++;
    }
    static get(name) {
        return BehaviorRegistry.behaviors.get(name);
    }
    static has(name) {
        return BehaviorRegistry.behaviors.has(name);
    }
    /**
     * Hot-re-register a behavior. Existing instances can be notified to migrate.
     */
    static hotRegister(name, ctor) {
        const prev = BehaviorRegistry.behaviors.get(name);
        if (prev === ctor)
            return; // avoid unnecessary rebuild on identical ctor
        BehaviorRegistry.behaviors.set(name, ctor);
        BehaviorRegistry.version++;
    }
    static list() {
        return Array.from(BehaviorRegistry.behaviors.keys());
    }
    static getVersion() {
        return BehaviorRegistry.version;
    }
}
//# sourceMappingURL=BehaviorRegistry.js.map