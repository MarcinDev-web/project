import { describe, it, expect, vi } from 'vitest';
import { createTextureAtlas } from './resources';
describe('createTextureAtlas - atlasMetaBuffer', () => {
    it('allocates storage buffer sized per material (48 bytes each)', () => {
        const createdBuffers = [];
        const makeTexture = () => ({ createView: vi.fn(() => ({})) });
        const device = {
            createTexture: vi.fn(makeTexture),
            createSampler: vi.fn(() => ({})),
            createBindGroupLayout: vi.fn(() => ({})),
            createBindGroup: vi.fn(() => ({})),
            createBuffer: vi.fn((desc) => {
                createdBuffers.push({ size: desc.size ?? 0, usage: desc.usage ?? 0, label: desc.label });
                return { size: desc.size };
            }),
            queue: {
                writeTexture: vi.fn(),
                writeBuffer: vi.fn(),
            },
        };
        const { atlas, atlasMetaBuffer } = createTextureAtlas(device, undefined, 512, 64);
        expect(atlas.getMaterialCount()).toBeGreaterThan(0);
        // Find meta buffer creation call
        const meta = createdBuffers.find((b) => b.label === 'material-atlas-meta-buffer');
        expect(meta).toBeDefined();
        expect(meta.size % 48).toBe(0);
        // Sanity: returned handle should be a GPUBuffer
        expect(atlasMetaBuffer).toBeDefined();
    });
});
//# sourceMappingURL=atlasMeta.test.js.map