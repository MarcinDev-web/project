import { Scene, Entity } from '@engine/world';
const TRANSIENT_ENTITY_IDS = new Set(['__editor_preview_player']);
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
    const sceneData = scene.toJSON();
    return JSON.stringify({
        ...sceneData,
        entities: pruneTransientEntities(sceneData.entities),
    });
}
export function hydrateScene(scene, json) {
    const data = JSON.parse(json);
    const restored = Scene.fromJSON(data);
    scene.clear();
    restored.rootEntities.forEach((entity) => {
        scene.addEntity(entity);
    });
}
function pruneTransientEntities(entities) {
    const pruned = [];
    for (const entity of entities) {
        if (isTransientEntity(entity)) {
            continue;
        }
        const children = entity.children?.length ? pruneTransientEntities(entity.children) : [];
        pruned.push({
            ...entity,
            children,
        });
    }
    return pruned;
}
function isTransientEntity(entity) {
    if (TRANSIENT_ENTITY_IDS.has(entity.id)) {
        return true;
    }
    const userData = entity.userData;
    return userData?.isEditorPreviewPlayer === true;
}
//# sourceMappingURL=HistoryHelpers.js.map