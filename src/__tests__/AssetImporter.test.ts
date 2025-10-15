import { describe, it, expect, vi } from 'vitest';
import { Scene } from '../scene/Scene';
import { AssetImporter } from '../editor/assets/AssetImporter';

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'model/gltf+json' });
}

describe('AssetImporter + Optimizer integration', () => {
  it('imports GLTF using injected optimizer lite output', async () => {
    const scene = new Scene('Test');
    const optimize = vi.fn(async () => ({
      asset: { version: '2.0', generator: 'test-gen' },
      scenes: [{ nodes: [0, 1] }],
      nodes: [
        { name: 'A', translation: [1, 2, 3], scale: [1, 1, 1] },
        { name: 'B', translation: [0, 0, 0], scale: [2, 2, 2] },
      ],
    }));

    const importer = new AssetImporter(scene, { optimize });
    const file = makeFile('model.gltf', JSON.stringify({}));
    const root = await importer.importGLTF(file);

    expect(optimize).toHaveBeenCalledTimes(1);
    expect(scene.rootEntities.length).toBe(1);
    expect(root.name).toBe('model');
    expect(root.children.length).toBe(2);
    expect(root.findChildByName('A')).not.toBeNull();
    const b = root.findChildByName('B');
    expect(b).not.toBeNull();
    expect(b!.transform.scale).toEqual([2, 2, 2]);
    expect((root.userData as any).gltfMeta.version).toBe('2.0');
  });
});


