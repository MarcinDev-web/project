import { describe, it, expect } from 'vitest';
import {
  BLOCK_LIBRARY,
  getBlock,
  getBlocksByCategory,
  getAllCategories,
} from '../src/BlockLibrary';
import {
  CARTOON_PALETTE,
  CARTOON_BRIGHTNESS,
  getCartoonFaceTexture,
} from '../src/palette';

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

  describe('Cartoon Palette Integration', () => {
    it('should use palette colors for basic blocks', () => {
      const redBlock = getBlock('plastic_red');
      expect(redBlock).toBeDefined();
      expect(redBlock?.textures.top.color).toEqual(CARTOON_PALETTE.basic.red.color);
      expect(redBlock?.textures.top.pattern).toBe(CARTOON_PALETTE.basic.red.pattern);
    });

    it('should use palette colors for natural blocks', () => {
      const grassBlock = getBlock('grass');
      expect(grassBlock).toBeDefined();
      expect(grassBlock?.textures.top.color).toEqual(CARTOON_PALETTE.natural.grass.color);
      expect(grassBlock?.textures.top.pattern).toBe(CARTOON_PALETTE.natural.grass.pattern);
    });

    it('should use consistent brightness presets', () => {
      const redBlock = getBlock('plastic_red');
      expect(redBlock).toBeDefined();
      
      // Standard blocks should use standard brightness preset
      const standardBrightness = CARTOON_BRIGHTNESS.standard;
      expect(redBlock?.textures.top.brightness).toBe(standardBrightness.top);
      expect(redBlock?.textures.sides.brightness).toBe(standardBrightness.sides);
      expect(redBlock?.textures.bottom.brightness).toBe(standardBrightness.bottom);
    });

    it('should use emissive brightness for light blocks', () => {
      const lightBlock = getBlock('light_white');
      expect(lightBlock).toBeDefined();
      
      const emissiveBrightness = CARTOON_BRIGHTNESS.emissive;
      expect(lightBlock?.textures.top.brightness).toBe(emissiveBrightness.top);
      expect(lightBlock?.textures.sides.brightness).toBe(emissiveBrightness.sides);
      expect(lightBlock?.textures.bottom.brightness).toBe(emissiveBrightness.bottom);
    });

    it('should have cartoon brightness values within expected range', () => {
      for (const block of Object.values(BLOCK_LIBRARY)) {
        // Cartoon style uses minimal brightness variation
        const topBrightness = block.textures.top.brightness || 1.0;
        const sidesBrightness = block.textures.sides.brightness || 1.0;
        const bottomBrightness = block.textures.bottom.brightness || 1.0;

        // Top should be brightest
        expect(topBrightness).toBeGreaterThanOrEqual(sidesBrightness);
        expect(sidesBrightness).toBeGreaterThanOrEqual(bottomBrightness);

        // Variation should be minimal for cartoon flat look
        // Normalize by dividing by top brightness to get relative variation
        const relativeVariation = (topBrightness - bottomBrightness) / topBrightness;
        // Allow small floating point precision error (0.15 + epsilon)
        expect(relativeVariation).toBeLessThanOrEqual(0.1501);
      }
    });

    it('should have bright, saturated colors for cartoon style', () => {
      for (const block of Object.values(BLOCK_LIBRARY)) {
        const [r, g, b] = block.textures.top.color;
        
        // Cartoon colors should be bright (at least one channel > 0.5)
        const maxChannel = Math.max(r, g, b);
        expect(maxChannel).toBeGreaterThan(0.5);
        
        // Colors should be in valid range
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
      }
    });
  });
});

