import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextureLoader } from '../loaders/texture/TextureLoader';

describe('TextureLoader', () => {
  let loader: TextureLoader;

  beforeEach(() => {
    loader = new TextureLoader();
    // Mock Image loading
    // @ts-ignore
    global.Image = class {
      onload: () => void = () => {};
      onerror: () => void = () => {};
      src: string = '';
      width: number = 100;
      height: number = 100;
      crossOrigin: string = '';
      
      set src(val: string) {
        this._src = val;
        // Simulate async load
        setTimeout(() => this.onload(), 10);
      }
      get src() { return this._src; }
      private _src: string = '';
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a solid color texture', () => {
    const texture = loader.createSolidColor('red', 255, 0, 0, 255, 2);
    expect(texture.id).toBe('red');
    expect(texture.width).toBe(2);
    expect(texture.height).toBe(2);
    expect(texture.data).toHaveLength(2 * 2 * 4);
    expect(texture.data[0]).toBe(255); // R
    expect(texture.data[1]).toBe(0);   // G
    expect(texture.data[2]).toBe(0);   // B
    expect(texture.data[3]).toBe(255); // A
  });

  it('should clear queue', () => {
    loader.clearQueue();
    // Not much to assert here without internal state access, but ensures no crash
  });

  it('should use registered handler for custom extension', async () => {
    const handler = {
      load: vi.fn().mockResolvedValue({
        id: 'custom',
        data: new Uint8Array([1, 2, 3, 4]),
        width: 1,
        height: 1,
        format: 'bc7-rgba-unorm',
      })
    };

    loader.registerHandler('ktx2', handler);

    const result = await loader.load('texture.ktx2');

    expect(handler.load).toHaveBeenCalledWith('texture.ktx2', expect.objectContaining({}));
    expect(result.format).toBe('bc7-rgba-unorm');
  });
});
