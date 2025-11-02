/**
 * TextureAtlas - Efficient texture packing system for materials
 *
 * Reduces bind calls by packing multiple material textures into a single atlas.
 * Instead of binding N textures (2 per material), we bind 1 atlas and use UV offsets.
 *
 * Performance: 100 materials = 2 bind calls instead of 200!
 */
const DEFAULT_ATLAS_CONFIG = {
    atlasSize: 2048,
    materialTextureSize: 128,
    padding: 2,
    generateMipmaps: true,
    filterMode: 'trilinear',
    anisotropyLevel: 8,
};
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
export class TextureAtlas {
    config;
    materials = [];
    regions = new Map();
    materialsPerRow;
    maxMaterials;
    constructor(config) {
        this.config = { ...DEFAULT_ATLAS_CONFIG, ...config };
        // Calculate how many material textures fit per row (accounting for side+top)
        const cellSize = this.config.materialTextureSize + this.config.padding;
        this.materialsPerRow = Math.floor(this.config.atlasSize / cellSize);
        // Each material uses 2 cells (side + top)
        const totalCells = this.materialsPerRow * this.materialsPerRow;
        this.maxMaterials = Math.floor(totalCells / 2);
    }
    /**
     * Adds a material to the atlas.
     * @returns Material ID (used for UV offset lookup)
     */
    addMaterial(material) {
        if (this.materials.length >= this.maxMaterials) {
            throw new Error(`TextureAtlas full: max ${this.maxMaterials} materials`);
        }
        const materialId = this.materials.length;
        this.materials.push(material);
        // Calculate atlas positions for side and top textures
        const cellIndex = materialId * 2; // Each material uses 2 cells
        const sideCell = cellIndex;
        const topCell = cellIndex + 1;
        this.regions.set(materialId, {
            side: this.calculateRegion(sideCell),
            top: this.calculateRegion(topCell),
        });
        return materialId;
    }
    /**
     * Gets atlas region for a material's side texture.
     */
    getSideRegion(materialId) {
        return this.regions.get(materialId)?.side ?? null;
    }
    /**
     * Gets atlas region for a material's top texture.
     */
    getTopRegion(materialId) {
        return this.regions.get(materialId)?.top ?? null;
    }
    /**
     * Calculates UV region for a cell in the atlas grid.
     */
    calculateRegion(cellIndex) {
        const row = Math.floor(cellIndex / this.materialsPerRow);
        const col = cellIndex % this.materialsPerRow;
        const cellSize = this.config.materialTextureSize + this.config.padding;
        const texSize = this.config.materialTextureSize;
        // UV coordinates (normalized to [0..1])
        const offsetX = (col * cellSize) / this.config.atlasSize;
        const offsetY = (row * cellSize) / this.config.atlasSize;
        const scaleX = texSize / this.config.atlasSize;
        const scaleY = texSize / this.config.atlasSize;
        return {
            id: cellIndex,
            offsetX,
            offsetY,
            scaleX,
            scaleY,
        };
    }
    /**
     * Builds the atlas texture data by packing all materials.
     * @returns RGBA pixel data for the complete atlas
     */
    buildAtlasData() {
        const atlasSize = this.config.atlasSize;
        const atlasData = new Uint8Array(atlasSize * atlasSize * 4);
        // Fill with transparent black by default
        atlasData.fill(0);
        for (let i = 0; i < this.materials.length; i++) {
            const material = this.materials[i];
            const regions = this.regions.get(i);
            if (!regions)
                continue;
            // Copy side texture
            this.copyTextureToAtlas(material.sideData, material.size, atlasData, atlasSize, regions.side);
            // Copy top texture
            this.copyTextureToAtlas(material.topData, material.size, atlasData, atlasSize, regions.top);
        }
        return atlasData;
    }
    /**
     * Builds the normal atlas texture data by packing all materials' normal maps.
     * Missing normal maps are filled with a flat normal value (0.5, 0.5, 1.0, 1.0).
     * @returns RGBA pixel data for the complete normal atlas
     */
    buildNormalAtlasData() {
        const atlasSize = this.config.atlasSize;
        const atlasData = new Uint8Array(atlasSize * atlasSize * 4);
        // Initialize with flat normal by default to avoid uninitialized regions
        atlasData.fill(0);
        const texSize = this.config.materialTextureSize;
        // Single reusable flat normal tile
        const flatTile = new Uint8Array(texSize * texSize * 4);
        for (let i = 0; i < texSize * texSize; i++) {
            flatTile[i * 4 + 0] = 128; // X
            flatTile[i * 4 + 1] = 128; // Y
            flatTile[i * 4 + 2] = 255; // Z
            flatTile[i * 4 + 3] = 255; // A
        }
        for (let i = 0; i < this.materials.length; i++) {
            const material = this.materials[i];
            const regions = this.regions.get(i);
            if (!regions)
                continue;
            // Side normal
            const sideSrc = material.sideNormalData && material.sideNormalData.length > 0
                ? material.sideNormalData
                : flatTile;
            this.copyTextureToAtlas(sideSrc, material.sideNormalData ? material.size : texSize, atlasData, atlasSize, regions.side);
            // Top normal
            const topSrc = material.topNormalData && material.topNormalData.length > 0
                ? material.topNormalData
                : flatTile;
            this.copyTextureToAtlas(topSrc, material.topNormalData ? material.size : texSize, atlasData, atlasSize, regions.top);
        }
        return atlasData;
    }
    /**
     * Copies a texture into the atlas at the specified region.
     */
    copyTextureToAtlas(srcData, srcSize, dstData, dstSize, region) {
        const texSize = this.config.materialTextureSize;
        const startX = Math.round(region.offsetX * dstSize);
        const startY = Math.round(region.offsetY * dstSize);
        for (let y = 0; y < texSize && y < srcSize; y++) {
            for (let x = 0; x < texSize && x < srcSize; x++) {
                const srcIdx = (y * srcSize + x) * 4;
                const dstIdx = ((startY + y) * dstSize + (startX + x)) * 4;
                if (dstIdx + 3 < dstData.length && srcIdx + 3 < srcData.length) {
                    dstData[dstIdx + 0] = srcData[srcIdx + 0];
                    dstData[dstIdx + 1] = srcData[srcIdx + 1];
                    dstData[dstIdx + 2] = srcData[srcIdx + 2];
                    dstData[dstIdx + 3] = srcData[srcIdx + 3];
                }
            }
        }
    }
    /**
     * Gets the number of materials currently in the atlas.
     */
    getMaterialCount() {
        return this.materials.length;
    }
    /**
     * Gets the maximum number of materials this atlas can hold.
     */
    getMaxMaterials() {
        return this.maxMaterials;
    }
    /**
     * Gets atlas configuration.
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Generate mipmaps for atlas texture data
     * Uses box filtering for downsampling
     */
    generateMipmaps(baseLevel, width, height) {
        const mipmaps = [baseLevel];
        let currentWidth = width;
        let currentHeight = height;
        let currentLevel = baseLevel;
        while (currentWidth > 1 || currentHeight > 1) {
            const newWidth = Math.max(1, Math.floor(currentWidth / 2));
            const newHeight = Math.max(1, Math.floor(currentHeight / 2));
            const newLevel = this.downsample(currentLevel, currentWidth, currentHeight, newWidth, newHeight);
            mipmaps.push(newLevel);
            currentLevel = newLevel;
            currentWidth = newWidth;
            currentHeight = newHeight;
        }
        return mipmaps;
    }
    /**
     * Downsample texture using box filter
     */
    downsample(srcData, srcWidth, srcHeight, dstWidth, dstHeight) {
        const dstData = new Uint8Array(dstWidth * dstHeight * 4);
        const xRatio = srcWidth / dstWidth;
        const yRatio = srcHeight / dstHeight;
        for (let y = 0; y < dstHeight; y++) {
            for (let x = 0; x < dstWidth; x++) {
                const srcX = Math.floor(x * xRatio);
                const srcY = Math.floor(y * yRatio);
                // Box filter - average 2x2 pixels
                let r = 0, g = 0, b = 0, a = 0;
                let count = 0;
                for (let dy = 0; dy < Math.ceil(yRatio); dy++) {
                    for (let dx = 0; dx < Math.ceil(xRatio); dx++) {
                        const sx = Math.min(srcX + dx, srcWidth - 1);
                        const sy = Math.min(srcY + dy, srcHeight - 1);
                        const srcIdx = (sy * srcWidth + sx) * 4;
                        r += srcData[srcIdx + 0];
                        g += srcData[srcIdx + 1];
                        b += srcData[srcIdx + 2];
                        a += srcData[srcIdx + 3];
                        count++;
                    }
                }
                const dstIdx = (y * dstWidth + x) * 4;
                dstData[dstIdx + 0] = Math.round(r / count);
                dstData[dstIdx + 1] = Math.round(g / count);
                dstData[dstIdx + 2] = Math.round(b / count);
                dstData[dstIdx + 3] = Math.round(a / count);
            }
        }
        return dstData;
    }
    /**
     * Build atlas with all mipmap levels
     */
    buildAtlasDataWithMipmaps() {
        const baseLevel = this.buildAtlasData();
        if (!this.config.generateMipmaps) {
            return { baseLevel, mipmaps: [baseLevel] };
        }
        const mipmaps = this.generateMipmaps(baseLevel, this.config.atlasSize, this.config.atlasSize);
        return { baseLevel, mipmaps };
    }
    /**
     * Build normal atlas with all mipmap levels
     */
    buildNormalAtlasDataWithMipmaps() {
        const baseLevel = this.buildNormalAtlasData();
        if (!this.config.generateMipmaps) {
            return { baseLevel, mipmaps: [baseLevel] };
        }
        const mipmaps = this.generateMipmaps(baseLevel, this.config.atlasSize, this.config.atlasSize);
        return { baseLevel, mipmaps };
    }
    /**
     * Checks if atlas has space for more materials.
     */
    hasSpace() {
        return this.materials.length < this.maxMaterials;
    }
    /**
     * Gets all material names in order.
     */
    getMaterialNames() {
        return this.materials.map((m) => m.name);
    }
    /**
     * Finds material ID by name.
     */
    findMaterialId(name) {
        const index = this.materials.findIndex((m) => m.name === name);
        return index >= 0 ? index : null;
    }
}
//# sourceMappingURL=TextureAtlas.js.map