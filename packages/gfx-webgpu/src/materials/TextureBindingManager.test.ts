import { describe, it, expect, vi } from 'vitest';
import { TextureBindingManager } from './TextureBindingManager';

// Minimal GPU mocks to satisfy types during unit tests that don't execute GPU calls.
const mockDevice = {
  createBindGroupLayout: vi.fn().mockReturnValue({} as unknown as GPUBindGroupLayout),
  createBindGroup: vi.fn().mockReturnValue({} as unknown as GPUBindGroup),
  createTexture: vi.fn().mockReturnValue({ createView: vi.fn().mockReturnValue({}) } as unknown as GPUTexture),
  createSampler: vi.fn().mockReturnValue({} as unknown as GPUSampler),
  queue: { writeTexture: vi.fn(), writeBuffer: vi.fn(), submit: vi.fn() },
} as unknown as GPUDevice;

describe('TextureBindingManager', () => {
  it('creates fallback textures and reuses them', () => {
    const tbm = new TextureBindingManager(mockDevice);
    const f1 = tbm.getFallbacks();
    const f2 = tbm.getFallbacks();
    expect(f1.white).toBe(f2.white);
    expect(f1.black).toBe(f2.black);
    expect(f1.flatNormal).toBe(f2.flatNormal);
  });

  it('creates bind group layouts and bind groups with N textures', () => {
    const tbm = new TextureBindingManager(mockDevice);
    const layout = tbm.createLayout(2);
    const sampler = (mockDevice.createSampler as any)();
    const tex = (mockDevice.createTexture as any)();
    const bg = tbm.createBindGroup(layout, sampler, [tex, tex]);
    expect(layout).toBeTruthy();
    expect(bg).toBeTruthy();
  });
});


