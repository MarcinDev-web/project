import { describe, it, expect } from 'vitest';
import {
  BLOCK_LIBRARY,
  getBlock,
  getBlocksByCategory,
  getAllCategories,
} from '../src/BlockLibrary';

describe('BlockLibrary', () => {
  describe('BLOCK_LIBRARY', () => {
    it('should contain multiple block definitions', () => {
      expect(Object.keys(BLOCK_LIBRARY).length).toBeGreaterThanOrEqual(10);
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

    it('should return blocks from gameplay category', () => {
      const gameplay = getBlocksByCategory('gameplay');
      expect(gameplay.length).toBeGreaterThanOrEqual(2);

      for (const block of gameplay) {
        expect(block.category).toBe('gameplay');
      }
    });
  });

  describe('getAllCategories', () => {
    it('should return all block categories', () => {
      const categories = getAllCategories();
      expect(categories).toContain('basic');
      expect(categories).toContain('natural');
      expect(categories).toContain('gameplay');
      expect(categories).toHaveLength(3);
    });
  });
});

