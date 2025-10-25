import { describe, it, expect, vi } from 'vitest';
import { createTextureAtlas } from './resources';

describe('createTextureAtlas - atlasMetaBuffer', () => {
  it('allocates storage buffer sized per material (48 bytes each)', () => {
    const createdBuffers: Array<{ size: number; usage: number; label?: string }> = [];
    const makeTexture = () => ({ createView: vi.fn(() => ({} as GPUTextureView)) }) as unknown as GPUTexture;
    const device = {
      createTexture: vi.fn(makeTexture),
      createSampler: vi.fn(() => ({} as GPUSampler)),
      createBindGroupLayout: vi.fn(() => ({} as GPUBindGroupLayout)),
      createBindGroup: vi.fn(() => ({} as GPUBindGroup)),
      createBuffer: vi.fn((desc: GPUBufferDescriptor) => {
        createdBuffers.push({ size: desc.size ?? 0, usage: desc.usage ?? 0, label: desc.label });
        return { size: desc.size } as unknown as GPUBuffer;
      }),
      queue: {
        writeTexture: vi.fn(),
        writeBuffer: vi.fn(),
      },
    } as unknown as GPUDevice;

    const { atlas, atlasMetaBuffer } = createTextureAtlas(device, undefined, 512, 64);
    expect(atlas.getMaterialCount()).toBeGreaterThan(0);
    // Find meta buffer creation call
    const meta = createdBuffers.find((b) => b.label === 'material-atlas-meta-buffer');
    expect(meta).toBeDefined();
    expect(meta!.size % 48).toBe(0);
    // Sanity: returned handle should be a GPUBuffer
    expect(atlasMetaBuffer).toBeDefined();
  });
});


