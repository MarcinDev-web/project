/**
 * Procedural Texture Generator
 *
 * Generates high-quality block textures procedurally for Kogama/Roblox/Minecraft style
 * Uses Canvas 2D API and advanced noise algorithms for realistic textures
 */
import type { BlockFaceTexture } from '../blocks/BlockLibrary';
export interface PBRTextureData {
    /** Base color/albedo texture */
    albedo: ImageData;
    /** Normal map (tangent space) */
    normal?: ImageData;
    /** Roughness map (0 = smooth, 1 = rough) */
    roughness?: ImageData;
    /** Metallic map (0 = dielectric, 1 = metallic) */
    metallic?: ImageData;
    /** Ambient occlusion map */
    ao?: ImageData;
}
export declare class ProceduralTextureGenerator {
    private readonly textureSize;
    private canvas;
    private ctx;
    private perlin;
    private simplex;
    private worley;
    constructor(textureSize?: number, seed?: number);
    /**
     * Generate texture from BlockFaceTexture definition
     */
    generateTexture(face: BlockFaceTexture): ImageData;
    /**
     * Solid color fill
     */
    private drawSolid;
    /**
     * Smooth gradient (Roblox style)
     */
    private drawSmooth;
    /**
     * Grid pattern (wood log cross-section)
     */
    private drawGrid;
    /**
     * Noise texture (dirt, grass) - improved with Perlin noise
     */
    private drawNoise;
    /**
     * Brick pattern
     */
    private drawBricks;
    /**
     * Wood planks pattern
     */
    private drawPlanks;
    /**
     * Cobblestone pattern - improved with Worley noise
     */
    private drawCobble;
    /**
     * Add random noise to current canvas
     */
    private addNoise;
    /**
     * Parse color string to RGBA values
     */
    private parseColor;
    /**
     * Generate normal map from height map
     * Uses Sobel operator for edge detection
     */
    generateNormalMap(heightMap: ImageData, strength?: number): ImageData;
    /**
     * Get height value at position (with wrapping)
     */
    private getHeight;
    /**
     * Generate full PBR texture set
     */
    generatePBRTexture(face: BlockFaceTexture): PBRTextureData;
    /**
     * Generate height map for normal map generation
     */
    private generateHeightMap;
    /**
     * Get brick/plank height for normal maps
     */
    private getBrickHeight;
    /**
     * Generate roughness map
     */
    private generateRoughnessMap;
    /**
     * Generate metallic map
     */
    private generateMetallicMap;
    /**
     * Generate ambient occlusion map
     */
    private generateAOMap;
    /**
     * Export canvas as blob (for debugging/preview)
     */
    exportAsBlob(): Promise<Blob>;
    /**
     * Get canvas element (for debugging)
     */
    getCanvas(): HTMLCanvasElement;
}
//# sourceMappingURL=ProceduralTextureGenerator.d.ts.map