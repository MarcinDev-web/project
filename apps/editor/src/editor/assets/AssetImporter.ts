import { Entity } from '@engine/world';
import type { Scene } from '@engine/world';
import type { GltfLite } from './GltfOptimizer';

type OptimizeFn = (file: File) => Promise<GltfLite>;

export class AssetImporter {
  private readonly optimize: OptimizeFn | null;

  constructor(private readonly scene: Scene, opts?: { optimize?: OptimizeFn }) {
    this.optimize = opts?.optimize ?? null;
  }

  async importGLTF(file: File): Promise<Entity> {
    const gltf = await this.loadAndOptimize(file);
    const root = this.convertToEntity(file.name, gltf);
    this.scene.addEntity(root);
    return root;
  }

  private async loadAndOptimize(file: File): Promise<GltfLite> {
    if (this.optimize) {
      return this.optimize(file);
    }
    const mod = await import('./GltfOptimizer');
    return mod.optimizeAndExtractLite(file);
  }

  private convertToEntity(fileName: string, gltf: GltfLite): Entity {
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
      if (!n) continue;
      const child = new Entity(n.name ?? `Node_${idx}`);
      if (n.translation) child.transform.position = [...n.translation];
      if (n.scale) child.transform.scale = [...n.scale];
      child.meshType = 'custom';
      root.addChild(child);
    }
    return root;
  }
}
