/**
 * TextureLoader - Loads real texture images from files/URLs
 * 
 * Supports:
 * - PNG, JPG, WebP formats
 * - Compressed formats (KTX2, etc.) via handlers
 * - Data URLs
 * - Async loading with progress
 * - Image preprocessing (resize, flip, etc.)
 * - Integration with TextureCache
 */

import { globalTextureCache } from './TextureCache';
import { 
  TextureLoader as AssetTextureLoader, 
  type TextureLoadOptions as AssetTextureLoadOptions, 
  type RawTexture,
  type TextureLoaderHandler 
} from '@engine/asset-pipeline';

export interface TextureLoadOptions extends AssetTextureLoadOptions {
  /** Cache loaded texture */
  cache?: boolean;
}

export type LoadedTexture = RawTexture;

export class TextureLoader {
  private loader = new AssetTextureLoader();

  /**
   * Register a handler for a specific file extension
   */
  public registerHandler(extension: string, handler: TextureLoaderHandler): void {
    this.loader.registerHandler(extension, handler);
  }

  /**
   * Load texture from URL or data URL
   */
  public async load(
    url: string,
    options: TextureLoadOptions = {}
  ): Promise<LoadedTexture> {
    const cacheId = options.cacheId || url;

    // Check cache first
    if (options.cache !== false) {
      const cached = globalTextureCache.get(cacheId);
      if (cached) {
        return {
          id: cacheId,
          data: cached.data,
          width: cached.width,
          height: cached.height,
          format: cached.format,
          ...(cached.mipmaps !== undefined ? { mipmaps: cached.mipmaps } : {}),
        };
      }
    }

    // Load using asset pipeline
    const texture = await this.loader.load(url, options);

    // Add to cache if enabled
    if (options.cache !== false) {
      globalTextureCache.add(
        cacheId,
        texture.data,
        texture.width,
        texture.height,
        texture.mipmaps,
        texture.format
      );
    }

    return texture;
  }

  /**
   * Load multiple textures in parallel
   */
  public async loadBatch(
    urls: string[],
    options: TextureLoadOptions = {}
  ): Promise<LoadedTexture[]> {
    const promises = urls.map(url => this.load(url, options));
    return Promise.all(promises);
  }

  /**
   * Preload textures without returning them
   */
  public async preload(urls: string[], options: TextureLoadOptions = {}): Promise<void> {
    await this.loadBatch(urls, { ...options, cache: true });
  }

  /**
   * Create texture from raw pixel data
   */
  public createFromPixels(
    id: string,
    data: Uint8Array,
    width: number,
    height: number,
    options: TextureLoadOptions = {}
  ): LoadedTexture {
    const texture = this.loader.createFromPixels(id, data, width, height, options);

    // Add to cache if enabled
    if (options.cache !== false) {
      globalTextureCache.add(id, texture.data, texture.width, texture.height, texture.mipmaps, texture.format);
    }

    return texture;
  }

  /**
   * Create solid color texture
   */
  public createSolidColor(
    id: string,
    r: number,
    g: number,
    b: number,
    a: number = 255,
    size: number = 4
  ): LoadedTexture {
    const texture = this.loader.createSolidColor(id, r, g, b, a, size);
    
    globalTextureCache.add(id, texture.data, texture.width, texture.height, texture.mipmaps, texture.format);
    return texture;
  }

  /**
   * Clear loading queue
   */
  public clearQueue(): void {
    this.loader.clearQueue();
  }
}

/**
 * Global texture loader instance
 */
export const globalTextureLoader = new TextureLoader();
