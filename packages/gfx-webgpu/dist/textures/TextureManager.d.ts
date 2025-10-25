/**
 * TextureManager - Unified interface for texture loading
 *
 * Integrates:
 * - Real texture loading from files
 * - Procedural texture generation
 * - Texture caching
 * - Fallback handling
 */
import { type LoadedTexture } from './TextureLoader';
import type { BlockFaceTexture } from '../blocks/BlockLibrary';
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
export declare class TextureManager {
    private textureLoader;
    private proceduralGenerator;
    private loadedTextures;
    constructor(proceduralTextureSize?: number);
    /**
     * Load or generate texture from BlockFaceTexture definition
     */
    loadTexture(id: string, faceTexture: BlockFaceTexture): Promise<ManagedTexture>;
    /**
     * Load texture from URL
     */
    private loadTextureFromUrl;
    /**
     * Generate procedural texture
     */
    private generateProceduralTexture;
    /**
     * Convert ImageData to LoadedTexture
     */
    private imageDataToLoadedTexture;
    /**
     * Load batch of textures
     */
    loadBatch(textures: Array<{
        id: string;
        faceTexture: BlockFaceTexture;
    }>): Promise<ManagedTexture[]>;
    /**
     * Get loaded texture
     */
    getTexture(id: string): ManagedTexture | undefined;
    /**
     * Check if texture is loaded
     */
    hasTexture(id: string): boolean;
    /**
     * Unload texture
     */
    unloadTexture(id: string): void;
    /**
     * Unload all textures
     */
    unloadAll(): void;
    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        procedural: number;
        realTextures: number;
        cacheStats: import("./TextureCache").CacheStats;
    };
    /**
     * Create fallback texture when loading fails
     */
    createFallbackTexture(id: string, color?: [number, number, number, number]): ManagedTexture;
    /**
     * Preload textures for a block definition
     */
    preloadBlockTextures(blockId: string, textures: {
        top: BlockFaceTexture;
        bottom: BlockFaceTexture;
        sides: BlockFaceTexture;
    }): Promise<void>;
}
/**
 * Global texture manager instance
 */
export declare const globalTextureManager: TextureManager;
//# sourceMappingURL=TextureManager.d.ts.map