import { Scene as WorldScene } from '@engine/world';
const idToProvider = new Map();
function matchesFilter(meta, filter) {
    if (!filter)
        return true;
    if (filter.kind && meta.kind !== filter.kind)
        return false;
    if (filter.tags && filter.tags.length > 0) {
        const metaTags = new Set(meta.tags ?? []);
        for (const tag of filter.tags) {
            if (!metaTags.has(tag))
                return false;
        }
    }
    return true;
}
export function registerTemplates(providers) {
    for (const provider of providers) {
        idToProvider.set(provider.meta.id, provider);
    }
}
export function listTemplates(filter) {
    const results = [];
    for (const provider of idToProvider.values()) {
        if (matchesFilter(provider.meta, filter)) {
            results.push(provider.meta);
        }
    }
    return results;
}
export function getTemplate(id) {
    return idToProvider.get(id) ?? null;
}
export async function instantiate(id) {
    const provider = getTemplate(id);
    if (!provider) {
        throw new Error(`Template not found: ${id}`);
    }
    const scene = await provider.build();
    return scene;
}
export async function applyTo(target, id, options) {
    const scene = await instantiate(id);
    if (options?.clear) {
        target.clear();
    }
    // Merge: add root entities from built scene into target
    const roots = scene.rootEntities;
    for (const root of roots) {
        target.addEntity(root);
    }
}
//# sourceMappingURL=TemplateRegistry.js.map