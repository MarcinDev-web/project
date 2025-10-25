const registry = new Map();
export function registerComponent(type, ctor) {
    registry.set(type, ctor);
}
export function getComponentConstructor(type) {
    return registry.get(type);
}
export function getRegisteredComponentTypes() {
    return Array.from(registry.keys());
}
//# sourceMappingURL=registry.js.map