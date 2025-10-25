const sceneConnectionManagers = new WeakMap();
export function registerLogicConnectionManager(scene, manager) {
    sceneConnectionManagers.set(scene, manager);
}
export function unregisterLogicConnectionManager(scene, manager) {
    const current = sceneConnectionManagers.get(scene);
    if (current === manager) {
        sceneConnectionManagers.delete(scene);
    }
}
export function getLogicConnectionManager(scene) {
    if (!scene) {
        return null;
    }
    return sceneConnectionManagers.get(scene) ?? null;
}
//# sourceMappingURL=LogicConnectionRegistry.js.map