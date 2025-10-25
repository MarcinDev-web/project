/**
 * TextureLoader - Loads real texture images from files/URLs
 *
 * Supports:
 * - PNG, JPG, WebP formats
 * - Data URLs
 * - Async loading with progress
 * - Image preprocessing (resize, flip, etc.)
 * - Integration with TextureCache
 */
export interface TextureLoadOptions {
    /** Resize texture to this size (maintains aspect ratio if only width or height specified) */
    width?: number;
    height?: number;
    /** Flip texture vertically (useful for WebGL) */
    flipY?: boolean;
    /** Generate mipmaps */
    generateMipmaps?: boolean;
    /** Cache loaded texture */
    cache?: boolean;
    /** Texture ID for caching */
    cacheId?: string;
}
export interface LoadedTexture {
    /** Texture ID */
    id: string;
    /** Raw RGBA pixel data */
    data: Uint8Array;
    /** Width in pixels */
    width: number;
    /** Height in pixels */
    height: number;
    /** Original image element (for debugging) */
    image?: HTMLImageElement;
    /** Mipmaps if generated */
    mipmaps?: Uint8Array[];
}
export declare class TextureLoader {
    private loadingTextures;
    /**
     * Load texture from URL or data URL
     */
    load(url: string, options?: TextureLoadOptions): Promise<LoadedTexture>;
    /**
     * Internal loading implementation
     */
    private loadInternal;
    /**
     * Load image from URL
     */
    private loadImage;
    /**
     * Generate mipmaps using box filter
     */
    private generateMipmaps;
    /**
     * Downsample texture data
     */
    private downsample;
    /**
     * Load multiple textures in parallel
     */
    loadBatch(urls: string[], options?: TextureLoadOptions): Promise<LoadedTexture[]>;
    /**
     * Preload textures without returning them
     */
    preload(urls: string[], options?: TextureLoadOptions): Promise<void>;
    /**
     * Create texture from raw pixel data
     */
    createFromPixels(id: string, data: Uint8Array, width: number, height: number, options?: TextureLoadOptions): LoadedTexture;
    /**
     * Create solid color texture
     */
    createSolidColor(id: string, r: number, g: number, b: number, a?: number, size?: number): LoadedTexture;
    /**
     * Clear loading queue
     */
    clearQueue(): void;
}
/**
 * Global texture loader instance
 */
export declare const globalTextureLoader: TextureLoader;
//# sourceMappingURL=TextureLoader.d.ts.map