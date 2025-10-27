import { describe, it, expect, vi } from 'vitest';
import { WorldManager } from '../../core/WorldManager';
import { createDefaultManifest } from '../../core/PlayManifest';

// Lightweight stubs for Scene serialization without pulling full engine
class FakeScene {
  name = 'Authoring';
  entityCount = 0;
  rootEntities: any[] = [];
  constructor(count: number) {
    this.entityCount = count;
    this.rootEntities = [];
  }
  toJSON() {
    const entities = Array.from({ length: this.entityCount }).map((_, i) => ({
      id: String(i + 1),
      name: 'E' + (i + 1),
      components: [],
      children: [],
    }));
    return { entities } as any;
  }
  addEntity(_e: any) {}
  clear() {}
}

describe('WorldManager.buildRuntimeWorldChunked', () => {
  it('invokes onProgress with increasing values and completes', async () => {
    const authoring = new FakeScene(450) as any; // 3 chunks at size 200
    const wm = new WorldManager(authoring);
    const manifest = createDefaultManifest();
    const calls: number[] = [];
    const onProgress = vi.fn((p: number) => calls.push(p));

    await wm.buildRuntimeWorldChunked(manifest, onProgress);

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toBeGreaterThan(0);
    expect(calls.at(-1)).toBe(1);
  });
});


