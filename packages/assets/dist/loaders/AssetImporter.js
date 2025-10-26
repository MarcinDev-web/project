import { Entity } from '@engine/world';
export class AssetImporter {
    scene;
    optimize;
    constructor(scene, opts) {
        this.scene = scene;
        this.optimize = opts?.optimize ?? null;
    }
    async importGLTF(file) {
        const gltf = await this.loadAndOptimize(file);
        const root = this.convertToEntity(file.name, gltf);
        this.scene.addEntity(root);
        return root;
    }
    async loadAndOptimize(file) {
        if (this.optimize) {
            return this.optimize(file);
        }
        const mod = await import('./GltfOptimizer');
        return mod.optimizeAndExtractLite(file);
    }
    convertToEntity(fileName, gltf) {
        const root = new Entity(fileName.replace(/\.[^/.]+$/, ''));
        root.meshType = 'custom';
        root.userData.asset = 'GLTF';
        root.userData.gltfMeta = {
            version: gltf.asset?.version,
            generator: gltf.asset?.generator,
        };
        const nodes = gltf.nodes ?? [];
        const sceneIndices = gltf.scenes?.[0]?.nodes ?? [];
        for (const idx of sceneIndices) {
            const n = nodes[idx ?? -1];
            if (!n)
                continue;
            const child = new Entity(n.name ?? `Node_${idx}`);
            if (n.translation)
                child.transform.position = [...n.translation];
            if (n.scale)
                child.transform.scale = [...n.scale];
            child.meshType = 'custom';
            root.addChild(child);
        }
        return root;
    }
}
//# sourceMappingURL=AssetImporter.js.map