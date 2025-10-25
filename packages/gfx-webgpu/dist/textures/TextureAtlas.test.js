import { describe, it, expect } from 'vitest';
import { TextureAtlas } from './TextureAtlas';
describe('TextureAtlas', () => {
    const createMockMaterial = (name, size = 128) => ({
        name,
        sideData: new Uint8Array(size * size * 4).fill(255),
        topData: new Uint8Array(size * size * 4).fill(128),
        size,
    });
    describe('constructor', () => {
        it('should create atlas with default config', () => {
            const atlas = new TextureAtlas();
            expect(atlas.getMaterialCount()).toBe(0);
            expect(atlas.getMaxMaterials()).toBeGreaterThan(0);
            expect(atlas.hasSpace()).toBe(true);
        });
        it('should create atlas with custom config', () => {
            const atlas = new TextureAtlas({
                atlasSize: 1024,
                materialTextureSize: 64,
                padding: 1,
            });
            const config = atlas.getConfig();
            expect(config.atlasSize).toBe(1024);
            expect(config.materialTextureSize).toBe(64);
            expect(config.padding).toBe(1);
        });
        it('should calculate correct max materials', () => {
            // 2048x2048 atlas, 128px textures + 2px padding = 130px per cell
            // 2048 / 130 = 15 textures per row
            // 15 * 15 = 225 total cells
            // Each material uses 2 cells (side + top) = 112 materials max
            const atlas = new TextureAtlas({
                atlasSize: 2048,
                materialTextureSize: 128,
                padding: 2,
            });
            expect(atlas.getMaxMaterials()).toBe(112);
        });
    });
    describe('addMaterial', () => {
        it('should add material and return ID', () => {
            const atlas = new TextureAtlas();
            const material = createMockMaterial('test');
            const id = atlas.addMaterial(material);
            expect(id).toBe(0);
            expect(atlas.getMaterialCount()).toBe(1);
        });
        it('should assign sequential IDs', () => {
            const atlas = new TextureAtlas();
            const id1 = atlas.addMaterial(createMockMaterial('mat1'));
            const id2 = atlas.addMaterial(createMockMaterial('mat2'));
            const id3 = atlas.addMaterial(createMockMaterial('mat3'));
            expect(id1).toBe(0);
            expect(id2).toBe(1);
            expect(id3).toBe(2);
            expect(atlas.getMaterialCount()).toBe(3);
        });
        it('should throw when atlas is full', () => {
            const atlas = new TextureAtlas({
                atlasSize: 256, // Small atlas for testing
                materialTextureSize: 128,
                padding: 0,
            });
            // This atlas can hold 2 materials (2x2 grid / 2 cells per material)
            atlas.addMaterial(createMockMaterial('mat1'));
            atlas.addMaterial(createMockMaterial('mat2'));
            expect(() => atlas.addMaterial(createMockMaterial('mat3'))).toThrow(/full/);
        });
        it('should update hasSpace correctly', () => {
            const atlas = new TextureAtlas({
                atlasSize: 256,
                materialTextureSize: 128,
                padding: 0,
            });
            expect(atlas.hasSpace()).toBe(true);
            atlas.addMaterial(createMockMaterial('mat1'));
            expect(atlas.hasSpace()).toBe(true);
            atlas.addMaterial(createMockMaterial('mat2'));
            expect(atlas.hasSpace()).toBe(false);
        });
    });
    describe('getSideRegion / getTopRegion', () => {
        it('should return null for invalid material ID', () => {
            const atlas = new TextureAtlas();
            expect(atlas.getSideRegion(0)).toBeNull();
            expect(atlas.getTopRegion(0)).toBeNull();
        });
        it('should return regions after adding material', () => {
            const atlas = new TextureAtlas();
            const id = atlas.addMaterial(createMockMaterial('test'));
            const sideRegion = atlas.getSideRegion(id);
            const topRegion = atlas.getTopRegion(id);
            expect(sideRegion).not.toBeNull();
            expect(topRegion).not.toBeNull();
        });
        it('should return correct UV coordinates for first material', () => {
            const atlas = new TextureAtlas({
                atlasSize: 2048,
                materialTextureSize: 128,
                padding: 2,
            });
            const id = atlas.addMaterial(createMockMaterial('test'));
            const sideRegion = atlas.getSideRegion(id);
            const topRegion = atlas.getTopRegion(id);
            expect(sideRegion).toBeDefined();
            expect(topRegion).toBeDefined();
            // First material: side at (0,0), top at (130,0)
            expect(sideRegion.offsetX).toBe(0);
            expect(sideRegion.offsetY).toBe(0);
            expect(sideRegion.scaleX).toBeCloseTo(128 / 2048);
            expect(sideRegion.scaleY).toBeCloseTo(128 / 2048);
            // Top texture is next cell (col=1)
            expect(topRegion.offsetX).toBeGreaterThan(0);
            expect(topRegion.offsetY).toBe(0);
        });
        it('should have different regions for side and top', () => {
            const atlas = new TextureAtlas();
            const id = atlas.addMaterial(createMockMaterial('test'));
            const sideRegion = atlas.getSideRegion(id);
            const topRegion = atlas.getTopRegion(id);
            expect(sideRegion.offsetX).not.toBe(topRegion.offsetX);
        });
        it('should have different regions for different materials', () => {
            const atlas = new TextureAtlas();
            const id1 = atlas.addMaterial(createMockMaterial('mat1'));
            const id2 = atlas.addMaterial(createMockMaterial('mat2'));
            const side1 = atlas.getSideRegion(id1);
            const side2 = atlas.getSideRegion(id2);
            expect(side1.offsetX).not.toBe(side2.offsetX);
        });
    });
    describe('buildAtlasData', () => {
        it('should return Uint8Array of correct size', () => {
            const atlas = new TextureAtlas({
                atlasSize: 512,
                materialTextureSize: 128,
                padding: 0,
            });
            atlas.addMaterial(createMockMaterial('test', 128));
            const data = atlas.buildAtlasData();
            expect(data).toBeInstanceOf(Uint8Array);
            expect(data.length).toBe(512 * 512 * 4);
        });
        it('should initialize to zeros', () => {
            const atlas = new TextureAtlas({
                atlasSize: 256,
                materialTextureSize: 64,
                padding: 0,
            });
            const data = atlas.buildAtlasData();
            // Empty atlas should be all zeros
            expect(data.every((byte) => byte === 0)).toBe(true);
        });
        it('should contain material data after adding materials', () => {
            const atlas = new TextureAtlas({
                atlasSize: 256,
                materialTextureSize: 64,
                padding: 0,
            });
            // Create material with distinctive colors
            const material = createMockMaterial('test', 64);
            material.sideData.fill(255); // All white
            material.topData.fill(128); // Mid gray
            atlas.addMaterial(material);
            const data = atlas.buildAtlasData();
            // Atlas should no longer be all zeros
            const hasNonZero = data.some((byte) => byte !== 0);
            expect(hasNonZero).toBe(true);
        });
    });
    describe('getMaterialNames', () => {
        it('should return empty array for empty atlas', () => {
            const atlas = new TextureAtlas();
            expect(atlas.getMaterialNames()).toEqual([]);
        });
        it('should return material names in order', () => {
            const atlas = new TextureAtlas();
            atlas.addMaterial(createMockMaterial('wood'));
            atlas.addMaterial(createMockMaterial('metal'));
            atlas.addMaterial(createMockMaterial('stone'));
            expect(atlas.getMaterialNames()).toEqual(['wood', 'metal', 'stone']);
        });
    });
    describe('findMaterialId', () => {
        it('should return null for non-existent material', () => {
            const atlas = new TextureAtlas();
            expect(atlas.findMaterialId('wood')).toBeNull();
        });
        it('should return correct ID for existing material', () => {
            const atlas = new TextureAtlas();
            atlas.addMaterial(createMockMaterial('wood'));
            atlas.addMaterial(createMockMaterial('metal'));
            atlas.addMaterial(createMockMaterial('stone'));
            expect(atlas.findMaterialId('wood')).toBe(0);
            expect(atlas.findMaterialId('metal')).toBe(1);
            expect(atlas.findMaterialId('stone')).toBe(2);
        });
    });
    describe('atlas packing layout', () => {
        it('should pack materials in row-major order', () => {
            const atlas = new TextureAtlas({
                atlasSize: 512,
                materialTextureSize: 128,
                padding: 0,
            });
            // Add multiple materials
            const id1 = atlas.addMaterial(createMockMaterial('mat1'));
            const id2 = atlas.addMaterial(createMockMaterial('mat2'));
            const side1 = atlas.getSideRegion(id1);
            const side2 = atlas.getSideRegion(id2);
            // Material 1: cells 0,1 (side, top)
            // Material 2: cells 2,3 (side, top)
            // With 512px atlas and 128px textures = 4 textures per row
            // So mat2 should be in same row as mat1
            expect(side2.offsetX).toBeGreaterThan(side1.offsetX);
            expect(side2.offsetY).toBe(side1.offsetY);
        });
        it('should wrap to next row when needed', () => {
            const atlas = new TextureAtlas({
                atlasSize: 512,
                materialTextureSize: 128,
                padding: 0,
            });
            // 512 / 128 = 4 textures per row
            // Each material uses 2 textures
            // So 2 materials per row
            atlas.addMaterial(createMockMaterial('mat1'));
            atlas.addMaterial(createMockMaterial('mat2'));
            const id3 = atlas.addMaterial(createMockMaterial('mat3'));
            const side3 = atlas.getSideRegion(id3);
            // Material 3 should be on second row
            expect(side3.offsetY).toBeGreaterThan(0);
            expect(side3.offsetX).toBe(0); // Start of new row
        });
    });
    describe('edge cases', () => {
        it('should handle single material atlas', () => {
            const atlas = new TextureAtlas({
                atlasSize: 256,
                materialTextureSize: 128,
                padding: 0,
            });
            const id = atlas.addMaterial(createMockMaterial('single'));
            expect(atlas.getMaterialCount()).toBe(1);
            expect(atlas.getSideRegion(id)).not.toBeNull();
            expect(atlas.getTopRegion(id)).not.toBeNull();
        });
        it('should handle maximum materials', () => {
            const atlas = new TextureAtlas({
                atlasSize: 256,
                materialTextureSize: 128,
                padding: 0,
            });
            const maxMaterials = atlas.getMaxMaterials();
            for (let i = 0; i < maxMaterials; i++) {
                atlas.addMaterial(createMockMaterial(`mat${i}`));
            }
            expect(atlas.getMaterialCount()).toBe(maxMaterials);
            expect(atlas.hasSpace()).toBe(false);
        });
    });
});
//# sourceMappingURL=TextureAtlas.test.js.map