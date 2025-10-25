/**
 * TextureRegistry - Central registry for block and asset textures
 *
 * Manages texture paths and provides easy access to texture resources
 */
export interface TextureSet {
    /** Base texture (albedo/diffuse) */
    base: string;
    /** Normal map */
    normal?: string;
    /** Roughness map */
    roughness?: string;
    /** Metallic map */
    metallic?: string;
    /** Ambient occlusion map */
    ao?: string;
    /** Height/displacement map */
    height?: string;
}
/**
 * Texture registry for common block types
 *
 * Note: These are placeholder paths. In production:
 * - Replace with actual texture file paths
 * - Use asset bundler (Vite, Webpack) for proper asset management
 * - Consider using texture packs similar to Minecraft resource packs
 */
export declare const TEXTURE_REGISTRY: Record<string, TextureSet>;
/**
 * Helper to get texture path
 */
export declare function getTexturePath(id: string, type?: keyof TextureSet): string | undefined;
/**
 * Helper to check if texture exists
 */
export declare function hasTexture(id: string): boolean;
/**
 * Get all texture IDs
 */
export declare function getAllTextureIds(): string[];
/**
 * Register custom texture set
 */
export declare function registerTexture(id: string, textureSet: TextureSet): void;
/**
 * Create data URL for placeholder texture
 * Useful for development when actual textures are not available
 */
export declare function createPlaceholderDataUrl(width?: number, height?: number, color1?: string, color2?: string): string;
/**
 * Texture pack system (similar to Minecraft resource packs)
 */
export interface TexturePack {
    id: string;
    name: string;
    description: string;
    version: string;
    basePath: string;
    textures: Record<string, TextureSet>;
}
export declare class TexturePackManager {
    private activePack;
    private packs;
    /**
     * Register a texture pack
     */
    registerPack(pack: TexturePack): void;
    /**
     * Activate a texture pack
     */
    activatePack(packId: string): boolean;
    /**
     * Get active pack
     */
    getActivePack(): TexturePack | null;
    /**
     * Get all registered packs
     */
    getAllPacks(): TexturePack[];
    /**
     * Deactivate current pack
     */
    deactivatePack(): void;
}
/**
 * Global texture pack manager
 */
export declare const globalTexturePackManager: TexturePackManager;
//# sourceMappingURL=TextureRegistry.d.ts.map