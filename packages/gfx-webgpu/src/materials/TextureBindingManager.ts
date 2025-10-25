import { createTextureFromData } from '../resources/resources';

export interface FallbackTextures {
  white: GPUTexture;
  black: GPUTexture;
  flatNormal: GPUTexture;
}

/**
 * Manages allocation of texture binding layouts and creation of fallback textures.
 * Does not change the existing renderer pipeline; provides helpers for future integration.
 */
export class TextureBindingManager {
  private device: GPUDevice;
  private fallbacks: FallbackTextures | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /** Creates and caches 1x1 fallback textures (white, black, flat normal). */
  getFallbacks(): FallbackTextures {
    if (this.fallbacks) return this.fallbacks;
    const white = createTextureFromData(this.device, 1, 1, new Uint8Array([255, 255, 255, 255]), 'fallback-white');
    const black = createTextureFromData(this.device, 1, 1, new Uint8Array([0, 0, 0, 255]), 'fallback-black');
    // Flat normal (0.5, 0.5, 1.0) in RGBA8
    const flatNormal = createTextureFromData(this.device, 1, 1, new Uint8Array([128, 128, 255, 255]), 'fallback-flat-normal');
    this.fallbacks = { white, black, flatNormal };
    return this.fallbacks;
  }

  /**
   * Creates a bind group layout with 1 sampler plus N sampled textures.
   * Defaults to 2 textures to mirror the current atlas + normal-atlas layout.
   */
  createLayout(sampledTextureCount = 2): GPUBindGroupLayout {
    const entries: GPUBindGroupLayoutEntry[] = [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    ];
    for (let i = 0; i < sampledTextureCount; i++) {
      entries.push({ binding: 1 + i, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } });
    }
    return this.device.createBindGroupLayout({ label: `tex-bgl+${sampledTextureCount}`, entries });
  }

  /**
   * Creates a bind group for provided textures using the given layout.
   * Expects layout with binding 0 = sampler, 1..N = textures.
   */
  createBindGroup(
    layout: GPUBindGroupLayout,
    sampler: GPUSampler,
    textures: GPUTexture[]
  ): GPUBindGroup {
    const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: sampler },
    ];
    for (let i = 0; i < textures.length; i++) {
      entries.push({ binding: 1 + i, resource: textures[i]!.createView() });
    }
    return this.device.createBindGroup({ label: 'tex-bind-group', layout, entries });
  }
}


