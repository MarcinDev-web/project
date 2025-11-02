/**
 * TextureAtlas - Efficient texture packing system for materials
 *
 * Reduces bind calls by packing multiple material textures into a single atlas.
 * Instead of binding N textures (2 per material), we bind 1 atlas and use UV offsets.
 *
 * Performance: 100 materials = 2 bind calls instead of 200!
 */
export interface AtlasRegion {
    /** Material ID (0-based index) */
    id: number;
    /** UV offset X [0..1] */
    offsetX: number;
    /** UV offset Y [0..1] */
    offsetY: number;
    /** UV scale X [0..1] */
    scaleX: number;
    /** UV scale Y [0..1] */
    scaleY: number;
}
export interface MaterialTextureData {
    /** Material name/identifier */
    name: string;
    /** Side texture data (RGBA) */
    sideData: Uint8Array;
    /** Top texture data (RGBA) */
    topData: Uint8Array;
    /** Optional side normal map data (RGBA, tangent-space normal) */
    sideNormalData?: Uint8Array;
    /** Optional top normal map data (RGBA, tangent-space normal) */
    topNormalData?: Uint8Array;
    /** Texture size (assumed square) */
    size: number;
}
export interface AtlasConfig {
    /** Atlas texture size (width/height) */
    atlasSize: number;
    /** Individual material texture size */
    materialTextureSize: number;
    /** Padding between textures (prevents bleeding) */
    padding: number;
    /** Generate mipmaps for better quality at distance */
    generateMipmaps?: boolean;
    /** Texture filtering mode */
    filterMode?: 'nearest' | 'linear' | 'trilinear' | 'anisotropic';
    /** Anisotropic filtering level (1-16, only used if filterMode is 'anisotropic') */
    anisotropyLevel?: number;
}
/**
 * TextureAtlas manages packing of multiple material textures into a single GPU texture.
 *
 * Layout:
 * - Atlas divided into grid of cells
 * - Each material occupies 2 cells (side + top texture)
 * - Materials packed in row-major order
 *
 * Example (4 materials, 2048x2048 atlas, 128px textures):
 * +-------+-------+-------+-------+-------+
 * | Mat0  | Mat0  | Mat1  | Mat1  | Mat2  |
 * | Side  | Top   | Side  | Top   | Side  |
 * +-------+-------+-------+-------+-------+
 * | Mat2  | Mat3  | Mat3  | Empty | Empty |
 * | Top   | Side  | Top   |       |       |
 * +-------+-------+-------+-------+-------+
 */
export declare class TextureAtlas {
    private readonly config;
    private materials;
    private regions;
    private materialsPerRow;
    private maxMaterials;
    constructor(config?: Partial<AtlasConfig>);
    /**
     * Adds a material to the atlas.
     * @returns Material ID (used for UV offset lookup)
     */
    addMaterial(material: MaterialTextureData): number;
    /**
     * Gets atlas region for a material's side texture.
     */
    getSideRegion(materialId: number): AtlasRegion | null;
    /**
     * Gets atlas region for a material's top texture.
     */
    getTopRegion(materialId: number): AtlasRegion | null;
    /**
     * Calculates UV region for a cell in the atlas grid.
     */
    private calculateRegion;
    /**
     * Builds the atlas texture data by packing all materials.
     * @returns RGBA pixel data for the complete atlas
     */
    buildAtlasData(): Uint8Array;
    /**
     * Builds the normal atlas texture data by packing all materials' normal maps.
     * Missing normal maps are filled with a flat normal value (0.5, 0.5, 1.0, 1.0).
     * @returns RGBA pixel data for the complete normal atlas
     */
    buildNormalAtlasData(): Uint8Array;
    /**
     * Copies a texture into the atlas at the specified region.
     */
    private copyTextureToAtlas;
    /**
     * Gets the number of materials currently in the atlas.
     */
    getMaterialCount(): number;
    /**
     * Gets the maximum number of materials this atlas can hold.
     */
    getMaxMaterials(): number;
    /**
     * Gets atlas configuration.
     */
    getConfig(): AtlasConfig;
    /**
     * Generate mipmaps for atlas texture data
     * Uses box filtering for downsampling
     */
    generateMipmaps(baseLevel: Uint8Array, width: number, height: number): Uint8Array[];
    /**
     * Downsample texture using box filter
     */
    private downsample;
    /**
     * Build atlas with all mipmap levels
     */
    buildAtlasDataWithMipmaps(): {
        baseLevel: Uint8Array;
        mipmaps: Uint8Array[];
    };
    /**
     * Build normal atlas with all mipmap levels
     */
    buildNormalAtlasDataWithMipmaps(): {
        baseLevel: Uint8Array;
        mipmaps: Uint8Array[];
    };
    /**
     * Checks if atlas has space for more materials.
     */
    hasSpace(): boolean;
    /**
     * Gets all material names in order.
     */
    getMaterialNames(): string[];
    /**
     * Finds material ID by name.
     */
    findMaterialId(name: string): number | null;
}
//# sourceMappingURL=TextureAtlas.d.ts.map