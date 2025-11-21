import { TextureLoader, type TextureLoadOptions, type RawTexture } from './loaders/texture/TextureLoader.js';
import { parseGlb, type ParsedGlb } from './formats/gltf/parseGLB.js';

export class AssetPipeline {
  public readonly textureLoader = new TextureLoader();

  public async loadTexture(url: string, options?: TextureLoadOptions): Promise<RawTexture> {
    return this.textureLoader.load(url, options);
  }

  public parseGlb(buffer: ArrayBuffer): ParsedGlb {
    return parseGlb(buffer);
  }
}
