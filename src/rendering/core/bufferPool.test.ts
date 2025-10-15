import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GPUBufferPool } from './bufferPool';

describe('GPUBufferPool', () => {
  let device: GPUDevice;
  let createBufferSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createBufferSpy = vi.fn(() => ({ destroy: vi.fn() }));
    device = {
      createBuffer: createBufferSpy,
    } as unknown as GPUDevice;
  });

  it('creates buffer with next power-of-two capacity and caches it', () => {
    const pool = new GPUBufferPool(device);
    const usage = GPUBufferUsage.VERTEX;

    const bufferA = pool.getOrCreate('mesh', 300, usage, 'mesh-buffer');
    expect(createBufferSpy).toHaveBeenCalledWith({
      label: 'mesh-buffer',
      size: 512,
      usage,
    });

    createBufferSpy.mockClear();
    const bufferB = pool.getOrCreate('mesh', 256, usage);
    expect(bufferB).toBe(bufferA);
    expect(createBufferSpy).not.toHaveBeenCalled();
  });

  it('recreates buffer when usage changes or size exceeds capacity', () => {
    const destroySpy = vi.fn();
    createBufferSpy
      .mockReturnValueOnce({ destroy: destroySpy })
      .mockReturnValueOnce({ destroy: vi.fn() });

    const pool = new GPUBufferPool(device);
    const first = pool.getOrCreate('mesh', 200, GPUBufferUsage.VERTEX);
    expect(first).toBeDefined();

    const second = pool.getOrCreate('mesh', 900, GPUBufferUsage.INDEX);
    expect(createBufferSpy).toHaveBeenCalledTimes(2);
    expect(destroySpy).toHaveBeenCalled();
    expect(second).not.toBe(first);
  });

  it('disposes all buffers on disposeAll', () => {
    const destroySpy = vi.fn();
    createBufferSpy.mockReturnValue({ destroy: destroySpy });

    const pool = new GPUBufferPool(device);
    pool.getOrCreate('mesh', 100, GPUBufferUsage.VERTEX);
    pool.getOrCreate('material', 200, GPUBufferUsage.UNIFORM);

    pool.disposeAll();
    expect(destroySpy).toHaveBeenCalledTimes(2);
  });
});
