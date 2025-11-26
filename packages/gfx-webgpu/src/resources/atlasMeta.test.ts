import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createTextureAtlas } from './resources';

// Mock WebGPU constants that aren't available in test environment
beforeAll(() => {
  (globalThis as any).GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
  (globalThis as any).GPUBufferUsage = {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
  };
  (globalThis as any).GPUShaderStage = {
    VERTEX: 0x1,
    FRAGMENT: 0x2,
    COMPUTE: 0x4,
  };
});

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


