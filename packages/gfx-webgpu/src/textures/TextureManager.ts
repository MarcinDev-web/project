/**
 * TextureManager - Unified interface for texture loading
 * 
 * Integrates:
 * - Real texture loading from files
 * - Procedural texture generation
 * - Texture caching
 * - Fallback handling
 */

import { TextureLoader, type LoadedTexture } from './TextureLoader';
import { ProceduralTextureGenerator } from './ProceduralTextureGenerator';
import { globalTextureCache } from './TextureCache';
import type { BlockFaceTexture } from '@engine/blocks';

export interface ManagedTexture {
  /** Texture ID */
  id: string;
  /** Albedo/diffuse texture */
  albedo: LoadedTexture;
  /** Normal map */
  normal?: LoadedTexture;
  /** Roughness map */
  roughness?: LoadedTexture;
  /** Metallic map */
  metallic?: LoadedTexture;
  /** Ambient occlusion map */
  ao?: LoadedTexture;
  /** Whether this texture was generated procedurally */
  isProcedural: boolean;
}

export class TextureManager {
  private textureLoader: TextureLoader;
  private proceduralGenerator: ProceduralTextureGenerator;
  private loadedTextures: Map<string, ManagedTexture> = new Map();

  constructor(proceduralTextureSize: number = 128) {
    this.textureLoader = new TextureLoader();
    this.proceduralGenerator = new ProceduralTextureGenerator(proceduralTextureSize);
  }

  /**
   * Load or generate texture from BlockFaceTexture definition
   */
  public async loadTexture(
    id: string,
    faceTexture: BlockFaceTexture
  ): Promise<ManagedTexture> {
    // Check if already loaded
    if (this.loadedTextures.has(id)) {
      return this.loadedTextures.get(id)!;
    }

    let managedTexture: ManagedTexture;

    // Try to load from file if URL provided and not forcing procedural
    if (faceTexture.textureUrl && !faceTexture.forceProcedural) {
      try {
        managedTexture = await this.loadTextureFromUrl(id, faceTexture);
      } catch (error) {
        console.warn(`[TextureManager] Failed to load texture from ${faceTexture.textureUrl}, falling back to procedural`, error);
        managedTexture = this.generateProceduralTexture(id, faceTexture);
      }
    } else {
      // Generate procedurally
      managedTexture = this.generateProceduralTexture(id, faceTexture);
    }

    this.loadedTextures.set(id, managedTexture);
    return managedTexture;
  }

  /**
   * Load texture from URL
   */
  private async loadTextureFromUrl(
    id: string,
    faceTexture: BlockFaceTexture
  ): Promise<ManagedTexture> {
    // Load albedo texture
    const albedo = await this.textureLoader.load(faceTexture.textureUrl!, {
      cache: true,
      cacheId: `${id}_albedo`,
      generateMipmaps: true,
      flipY: true,
    });

    // Load optional PBR maps
    const normal = faceTexture.normalMapUrl
      ? await this.textureLoader.load(faceTexture.normalMapUrl, {
          cache: true,
          cacheId: `${id}_normal`,
          generateMipmaps: true,
          flipY: true,
        })
      : undefined;

    const roughness = faceTexture.roughnessMapUrl
      ? await this.textureLoader.load(faceTexture.roughnessMapUrl, {
          cache: true,
          cacheId: `${id}_roughness`,
          generateMipmaps: true,
          flipY: true,
        })
      : undefined;

    const metallic = faceTexture.metallicMapUrl
      ? await this.textureLoader.load(faceTexture.metallicMapUrl, {
          cache: true,
          cacheId: `${id}_metallic`,
          generateMipmaps: true,
          flipY: true,
        })
      : undefined;

    const ao = faceTexture.aoMapUrl
      ? await this.textureLoader.load(faceTexture.aoMapUrl, {
          cache: true,
          cacheId: `${id}_ao`,
          generateMipmaps: true,
          flipY: true,
        })
      : undefined;

    return {
      id,
      albedo,
      ...(normal ? { normal } : {}),
      ...(roughness ? { roughness } : {}),
      ...(metallic ? { metallic } : {}),
      ...(ao ? { ao } : {}),
      isProcedural: false,
    };
  }

  /**
   * Generate procedural texture
   */
  private generateProceduralTexture(
    id: string,
    faceTexture: BlockFaceTexture
  ): ManagedTexture {
    // Generate PBR texture set
    const pbrTextures = this.proceduralGenerator.generatePBRTexture(faceTexture);

    // Convert ImageData to LoadedTexture format
    const albedo = this.imageDataToLoadedTexture(
      `${id}_albedo`,
      pbrTextures.albedo
    );

    const normal = pbrTextures.normal
      ? this.imageDataToLoadedTexture(`${id}_normal`, pbrTextures.normal)
      : undefined;

    const roughness = pbrTextures.roughness
      ? this.imageDataToLoadedTexture(`${id}_roughness`, pbrTextures.roughness)
      : undefined;

    const metallic = pbrTextures.metallic
      ? this.imageDataToLoadedTexture(`${id}_metallic`, pbrTextures.metallic)
      : undefined;

    const ao = pbrTextures.ao
      ? this.imageDataToLoadedTexture(`${id}_ao`, pbrTextures.ao)
      : undefined;

    // Add to cache
    globalTextureCache.add(albedo.id, albedo.data, albedo.width, albedo.height);
    if (normal) globalTextureCache.add(normal.id, normal.data, normal.width, normal.height);
    if (roughness) globalTextureCache.add(roughness.id, roughness.data, roughness.width, roughness.height);
    if (metallic) globalTextureCache.add(metallic.id, metallic.data, metallic.width, metallic.height);
    if (ao) globalTextureCache.add(ao.id, ao.data, ao.width, ao.height);

    return {
      id,
      albedo,
      ...(normal ? { normal } : {}),
      ...(roughness ? { roughness } : {}),
      ...(metallic ? { metallic } : {}),
      ...(ao ? { ao } : {}),
      isProcedural: true,
    };
  }

  /**
   * Convert ImageData to LoadedTexture
   */
  private imageDataToLoadedTexture(id: string, imageData: ImageData): LoadedTexture {
    return {
      id,
      data: new Uint8Array(imageData.data),
      width: imageData.width,
      height: imageData.height,
    };
  }

  /**
   * Load batch of textures
   */
  public async loadBatch(
    textures: Array<{ id: string; faceTexture: BlockFaceTexture }>
  ): Promise<ManagedTexture[]> {
    const promises = textures.map(({ id, faceTexture }) =>
      this.loadTexture(id, faceTexture)
    );
    return Promise.all(promises);
  }

  /**
   * Get loaded texture
   */
  public getTexture(id: string): ManagedTexture | undefined {
    return this.loadedTextures.get(id);
  }

  /**
   * Check if texture is loaded
   */
  public hasTexture(id: string): boolean {
    return this.loadedTextures.has(id);
  }

  /**
   * Unload texture
   */
  public unloadTexture(id: string): void {
    const texture = this.loadedTextures.get(id);
    if (!texture) return;

    // Release from cache
    globalTextureCache.release(texture.albedo.id);
    if (texture.normal) globalTextureCache.release(texture.normal.id);
    if (texture.roughness) globalTextureCache.release(texture.roughness.id);
    if (texture.metallic) globalTextureCache.release(texture.metallic.id);
    if (texture.ao) globalTextureCache.release(texture.ao.id);

    this.loadedTextures.delete(id);
  }

  /**
   * Unload all textures
   */
  public unloadAll(): void {
    for (const id of this.loadedTextures.keys()) {
      this.unloadTexture(id);
    }
    this.loadedTextures.clear();
  }

  /**
   * Get statistics
   */
  public getStats() {
    const total = this.loadedTextures.size;
    let procedural = 0;
    let realTextures = 0;

    for (const texture of this.loadedTextures.values()) {
      if (texture.isProcedural) {
        procedural++;
      } else {
        realTextures++;
      }
    }

    return {
      total,
      procedural,
      realTextures,
      cacheStats: globalTextureCache.getStats(),
    };
  }

  /**
   * Create fallback texture when loading fails
   */
  public createFallbackTexture(
    id: string,
    color: [number, number, number, number] = [1, 0, 1, 1] // Magenta for visibility
  ): ManagedTexture {
    const size = 4;
    const r = Math.round(color[0] * 255);
    const g = Math.round(color[1] * 255);
    const b = Math.round(color[2] * 255);
    const a = Math.round(color[3] * 255);

    const albedo = this.textureLoader.createSolidColor(`${id}_fallback`, r, g, b, a, size);

    const managedTexture: ManagedTexture = {
      id,
      albedo,
      isProcedural: true,
    };

    this.loadedTextures.set(id, managedTexture);
    return managedTexture;
  }

  /**
   * Preload textures for a block definition
   */
  public async preloadBlockTextures(blockId: string, textures: {
    top: BlockFaceTexture;
    bottom: BlockFaceTexture;
    sides: BlockFaceTexture;
  }): Promise<void> {
    const texturePromises = [
      this.loadTexture(`${blockId}_top`, textures.top),
      this.loadTexture(`${blockId}_bottom`, textures.bottom),
      this.loadTexture(`${blockId}_sides`, textures.sides),
    ];

    await Promise.all(texturePromises);
  }
}

/**
 * Global texture manager instance
 */
export const globalTextureManager = new TextureManager();

