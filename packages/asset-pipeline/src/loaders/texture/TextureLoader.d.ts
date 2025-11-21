import type { LoadOptions } from '../../types.js';
export type TextureFormat = 'rgba8unorm' | 'rgba8unorm-srgb' | 'bgra8unorm' | 'bgra8unorm-srgb' | 'rg8unorm' | 'r8unorm' | 'bc1-rgba-unorm' | 'bc2-rgba-unorm' | 'bc3-rgba-unorm' | 'bc4-r-unorm' | 'bc5-rg-unorm' | 'bc7-rgba-unorm' | 'etc2-rgb8unorm' | 'etc2-rgb8a1unorm' | 'etc2-rgba8unorm' | 'astc-4x4-unorm' | string;
export interface TextureLoadOptions extends LoadOptions {
    /** Resize texture to this size (maintains aspect ratio if only width or height specified) */
    width?: number;
    height?: number;
    /** Flip texture vertically (useful for WebGL) */
    flipY?: boolean;
    /** Generate mipmaps */
    generateMipmaps?: boolean;
    /** Target format (hint for transcoders) */
    format?: TextureFormat;
}
export interface RawTexture {
    /** Texture ID */
    id: string;
    /** Raw pixel data (compressed or uncompressed) */
    data: Uint8Array;
    /** Width in pixels */
    width: number;
    /** Height in pixels */
    height: number;
    /** Texture format */
    format: TextureFormat;
    /** Original image element (for debugging) */
    image?: HTMLImageElement;
    /** Mipmaps if generated/loaded */
    mipmaps?: Uint8Array[];
}
/**
 * Handler for specific file extensions (e.g. .ktx2, .dds)
 */
export interface TextureLoaderHandler {
    load(url: string, options: TextureLoadOptions): Promise<RawTexture>;
}
export declare class TextureLoader {
    private loadingTextures;
    private handlers;
    /**
     * Register a handler for a specific file extension
     * @param extension File extension (e.g. 'ktx2')
     * @param handler Handler instance
     */
    registerHandler(extension: string, handler: TextureLoaderHandler): void;
    /**
     * Load texture from URL or data URL
     */
    load(url: string, options?: TextureLoadOptions): Promise<RawTexture>;
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
    loadBatch(urls: string[], options?: TextureLoadOptions): Promise<RawTexture[]>;
    /**
     * Create texture from raw pixel data
     */
    createFromPixels(id: string, data: Uint8Array, width: number, height: number, options?: TextureLoadOptions): RawTexture;
    /**
     * Create solid color texture
     */
    createSolidColor(id: string, r: number, g: number, b: number, a?: number, size?: number): RawTexture;
    /**
     * Clear loading queue
     */
    clearQueue(): void;
}
//# sourceMappingURL=TextureLoader.d.ts.map