import { Scene } from '@engine/world';
/** Finds path to an entity within the scene's root hierarchy. */
export function computeEntityPath(scene, entity) {
    if (!entity)
        return null;
    const path = [];
    let current = entity;
    while (current) {
        const parent = current.parent;
        const siblings = parent ? parent.children : scene.rootEntities;
        const index = siblings.findIndex((child) => child === current);
        if (index === -1) {
            return null;
        }
        path.unshift(index);
        current = parent;
    }
    return path;
}
/** Resolves entity by path within a scene hierarchy. */
export function resolveEntityByPath(scene, path) {
    if (!path || path.length === 0)
        return null;
    let nodes = scene.rootEntities;
    let entity;
    for (const index of path) {
        entity = nodes[index];
        if (!entity)
            return null;
        nodes = entity.children;
    }
    return entity ?? null;
}
export function serializeScene(scene) {
    return JSON.stringify(scene.toJSON());
}
export function hydrateScene(scene, json) {
    const data = JSON.parse(json);
    const restored = Scene.fromJSON(data);
    scene.clear();
    restored.rootEntities.forEach((entity) => {
        scene.addEntity(entity);
    });
}
//# sourceMappingURL=HistoryHelpers.js.map