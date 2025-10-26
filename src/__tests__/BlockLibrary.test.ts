import { describe, it, expect } from 'vitest';
import {
  BLOCK_LIBRARY,
  getBlock,
  getBlocksByCategory,
  getAllCategories,
} from '@engine/gfx-webgpu';

describe('BlockLibrary', () => {
  describe('BLOCK_LIBRARY', () => {
    it('should contain multiple block definitions', () => {
      expect(Object.keys(BLOCK_LIBRARY).length).toBeGreaterThan(10);
    });

    it('should have valid block IDs matching their keys', () => {
      for (const [key, block] of Object.entries(BLOCK_LIBRARY)) {
        expect(block.id).toBe(key);
      }
    });

    it('should have all required properties for each block', () => {
      for (const block of Object.values(BLOCK_LIBRARY)) {
        expect(block).toHaveProperty('id');
        expect(block).toHaveProperty('name');
        expect(block).toHaveProperty('category');
        expect(block).toHaveProperty('material');
        expect(block).toHaveProperty('textures');
        expect(block).toHaveProperty('properties');
      }
    });

    it('should have valid textures for each block', () => {
      for (const block of Object.values(BLOCK_LIBRARY)) {
        expect(block.textures).toHaveProperty('top');
        expect(block.textures).toHaveProperty('bottom');
        expect(block.textures).toHaveProperty('sides');

        // Validate color format
        expect(block.textures.top.color).toHaveLength(4);
        expect(block.textures.bottom.color).toHaveLength(4);
        expect(block.textures.sides.color).toHaveLength(4);

        // Validate color values (0-1 range)
        for (const value of block.textures.top.color) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should have valid properties for each block', () => {
      for (const block of Object.values(BLOCK_LIBRARY)) {
        const { properties } = block;

        expect(typeof properties.solid).toBe('boolean');
        expect(typeof properties.transparent).toBe('boolean');
        expect(properties.emissive).toBeGreaterThanOrEqual(0);
        expect(properties.emissive).toBeLessThanOrEqual(1);
        expect(properties.roughness).toBeGreaterThanOrEqual(0);
        expect(properties.roughness).toBeLessThanOrEqual(1);
        expect(properties.metallic).toBeGreaterThanOrEqual(0);
        expect(properties.metallic).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('getBlock', () => {
    it('should return a block by ID', () => {
      const grass = getBlock('grass');
      expect(grass).toBeDefined();
      expect(grass?.id).toBe('grass');
      expect(grass?.name).toBe('Grass Block');
    });

    it('should return undefined for non-existent block', () => {
      const nonExistent = getBlock('non_existent_block');
      expect(nonExistent).toBeUndefined();
    });

    it('should return all basic plastic blocks', () => {
      const red = getBlock('plastic_red');
      const blue = getBlock('plastic_blue');
      const green = getBlock('plastic_green');
      const yellow = getBlock('plastic_yellow');

      expect(red).toBeDefined();
      expect(blue).toBeDefined();
      expect(green).toBeDefined();
      expect(yellow).toBeDefined();

      expect(red?.material).toBe('plastic');
      expect(blue?.material).toBe('plastic');
    });

    it('should return glass blocks with transparency', () => {
      const glass = getBlock('glass_clear');
      expect(glass).toBeDefined();
      expect(glass?.material).toBe('glass');
      expect(glass?.properties.transparent).toBe(true);
    });

    it('should return metal blocks with high metallic values', () => {
      const iron = getBlock('metal_iron');
      const gold = getBlock('metal_gold');

      expect(iron?.material).toBe('metal');
      expect(gold?.material).toBe('metal');
      expect(iron?.properties.metallic).toBeGreaterThanOrEqual(0.8);
      expect(gold?.properties.metallic).toBeGreaterThanOrEqual(0.8);
    });

    it('should return light blocks with emissive properties', () => {
      const white = getBlock('light_white');
      const red = getBlock('light_red');

      expect(white?.material).toBe('emissive');
      expect(red?.material).toBe('emissive');
      expect(white?.properties.emissive).toBeGreaterThan(0.5);
      expect(red?.properties.emissive).toBeGreaterThan(0.5);
    });
  });

  describe('getBlocksByCategory', () => {
    it('should return blocks from basic category', () => {
      const basic = getBlocksByCategory('basic');
      expect(basic.length).toBeGreaterThan(0);

      for (const block of basic) {
        expect(block.category).toBe('basic');
      }
    });

    it('should return blocks from natural category', () => {
      const natural = getBlocksByCategory('natural');
      expect(natural.length).toBeGreaterThan(0);

      const names = natural.map((b) => b.id);
      expect(names).toContain('grass');
      expect(names).toContain('dirt');
      expect(names).toContain('stone');
    });

    it('should return blocks from glass category', () => {
      const glass = getBlocksByCategory('glass');
      expect(glass.length).toBeGreaterThan(0);

      for (const block of glass) {
        expect(block.category).toBe('glass');
        expect(block.material).toBe('glass');
        expect(block.properties.transparent).toBe(true);
      }
    });

    it('should return blocks from light category', () => {
      const lights = getBlocksByCategory('light');
      expect(lights.length).toBeGreaterThan(0);

      for (const block of lights) {
        expect(block.category).toBe('light');
        expect(block.material).toBe('emissive');
        expect(block.properties.emissive).toBeGreaterThan(0);
      }
    });

    it('should return empty array for non-existent category', () => {
      const blocks = getBlocksByCategory('non_existent' as any);
      expect(blocks).toEqual([]);
    });
  });

  describe('getAllCategories', () => {
    it('should return all block categories', () => {
      const categories = getAllCategories();
      expect(categories).toContain('basic');
      expect(categories).toContain('natural');
      expect(categories).toContain('decorative');
      expect(categories).toContain('mechanical');
      expect(categories).toContain('glass');
      expect(categories).toContain('light');
    });

    it('should return exactly 6 categories', () => {
      const categories = getAllCategories();
      expect(categories).toHaveLength(6);
    });
  });

  describe('Block Material Properties', () => {
    it('should have plastic blocks with low roughness', () => {
      const plastic = getBlocksByCategory('basic');

      for (const block of plastic) {
        if (block.material === 'plastic') {
          expect(block.properties.roughness).toBeLessThan(0.5);
          expect(block.properties.metallic).toBe(0);
        }
      }
    });

    it('should have natural blocks with high roughness', () => {
      const grass = getBlock('grass');
      const dirt = getBlock('dirt');
      const stone = getBlock('stone');

      expect(grass?.properties.roughness).toBeGreaterThan(0.8);
      expect(dirt?.properties.roughness).toBeGreaterThan(0.8);
      expect(stone?.properties.roughness).toBeGreaterThan(0.8);
    });

    it('should have glass blocks with low roughness and some metallic', () => {
      const glass = getBlocksByCategory('glass');

      for (const block of glass) {
        expect(block.properties.roughness).toBeLessThan(0.2);
        expect(block.properties.metallic).toBeGreaterThan(0);
      }
    });

    it('should have only emissive blocks emit light', () => {
      for (const block of Object.values(BLOCK_LIBRARY)) {
        if (block.properties.emissive > 0) {
          expect(block.material).toBe('emissive');
        }
      }
    });

    it('should have only glass blocks be transparent', () => {
      for (const block of Object.values(BLOCK_LIBRARY)) {
        if (block.properties.transparent) {
          expect(block.material).toBe('glass');
        }
      }
    });
  });

  describe('Block Texture Patterns', () => {
    it('should have smooth pattern for plastic blocks', () => {
      const plastic = getBlock('plastic_red');
      expect(plastic?.textures.top.pattern).toBe('smooth');
      expect(plastic?.textures.bottom.pattern).toBe('smooth');
      expect(plastic?.textures.sides.pattern).toBe('smooth');
    });

    it('should have appropriate patterns for natural blocks', () => {
      const grass = getBlock('grass');
      const wood = getBlock('wood_oak');
      const bricks = getBlock('bricks_red');

      expect(grass?.textures.top.pattern).toBe('noise');
      expect(wood?.textures.top.pattern).toBe('grid');
      expect(bricks?.textures.top.pattern).toBe('bricks');
    });

    it('should have brightness variations for depth', () => {
      const block = getBlock('plastic_red');
      expect(block?.textures.top.brightness).toBeGreaterThan(0.9);
      expect(block?.textures.bottom.brightness).toBeLessThan(0.9);
    });
  });
});
