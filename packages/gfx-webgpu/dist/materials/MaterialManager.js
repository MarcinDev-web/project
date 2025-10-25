import { Material } from './Material';
/**
 * Central registry for materials with basic cloning and serialization.
 * GPU texture fields are not serialized (non-transferable);
 * applications should manage texture assets separately and rebind on load.
 */
export class MaterialManager {
    idToMaterial = new Map();
    register(id, material) {
        if (!id || typeof id !== 'string')
            throw new Error('Material id must be a non-empty string');
        this.idToMaterial.set(id, material);
    }
    unregister(id) {
        this.idToMaterial.delete(id);
    }
    get(id) {
        return this.idToMaterial.get(id);
    }
    has(id) {
        return this.idToMaterial.has(id);
    }
    listIds() {
        return Array.from(this.idToMaterial.keys());
    }
    clone(id, newId) {
        const src = this.get(id);
        if (!src)
            throw new Error(`Material not found: ${id}`);
        const m = new Material();
        m.color = [src.color[0], src.color[1], src.color[2], src.color[3]];
        m.metallic = src.metallic;
        m.roughness = src.roughness;
        // GPU textures are shallow-copied (reference) intentionally
        m.texture = src.texture;
        m.normalMap = src.normalMap;
        m.metallicRoughnessMap = src.metallicRoughnessMap;
        m.aoMap = src.aoMap;
        m.emissiveMap = src.emissiveMap;
        m.heightMap = src.heightMap;
        m.emissive = [src.emissive[0], src.emissive[1], src.emissive[2]];
        m.emissiveIntensity = src.emissiveIntensity;
        m.opacity = src.opacity;
        m.alphaMode = src.alphaMode;
        m.alphaCutoff = src.alphaCutoff;
        m.doubleSided = src.doubleSided;
        const idToUse = newId ?? `${id}_copy`;
        this.register(idToUse, m);
        return m;
    }
    serialize(id) {
        const m = this.get(id);
        if (!m)
            throw new Error(`Material not found: ${id}`);
        return {
            color: [m.color[0], m.color[1], m.color[2], m.color[3]],
            metallic: m.metallic,
            roughness: m.roughness,
            emissive: [m.emissive[0], m.emissive[1], m.emissive[2]],
            emissiveIntensity: m.emissiveIntensity,
            opacity: m.opacity,
            alphaMode: m.alphaMode,
            alphaCutoff: m.alphaCutoff,
            doubleSided: m.doubleSided,
        };
    }
    deserialize(id, data) {
        const m = new Material();
        m.color = [data.color[0], data.color[1], data.color[2], data.color[3]];
        m.metallic = data.metallic;
        m.roughness = data.roughness;
        m.emissive = [data.emissive[0], data.emissive[1], data.emissive[2]];
        m.emissiveIntensity = data.emissiveIntensity;
        m.opacity = data.opacity;
        m.alphaMode = data.alphaMode;
        m.alphaCutoff = data.alphaCutoff;
        m.doubleSided = data.doubleSided;
        this.register(id, m);
        return m;
    }
}
//# sourceMappingURL=MaterialManager.js.map