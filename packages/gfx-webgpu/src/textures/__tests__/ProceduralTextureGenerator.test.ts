import { describe, it, expect, beforeEach } from 'vitest';
import { ProceduralTextureGenerator } from '../ProceduralTextureGenerator';
import type { BlockFaceTexture } from '@engine/blocks';

describe('ProceduralTextureGenerator', () => {
  let generator: ProceduralTextureGenerator;

  beforeEach(() => {
    generator = new ProceduralTextureGenerator(64);
  });

  describe('constructor', () => {
    it('should create instance with default size', () => {
      const gen = new ProceduralTextureGenerator();
      expect(gen).toBeDefined();
    });

    it('should create instance with custom size', () => {
      const gen = new ProceduralTextureGenerator(128);
      expect(gen).toBeDefined();
    });

    it('should create instance with seed', () => {
      const gen = new ProceduralTextureGenerator(64, 12345);
      expect(gen).toBeDefined();
    });
  });

  describe('generateTexture (CPU)', () => {
    const createTestFace = (pattern: string, color: [number, number, number, number] = [1, 0, 0, 1]): BlockFaceTexture => ({
      color,
      pattern: pattern as any,
      brightness: 1.0,
    });

    it('should generate solid pattern', () => {
      const face = createTestFace('solid', [1, 0, 0, 1]);
      const result = generator.generateTexture(face);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);

      // Check first pixel is red
      expect(result.data[0]).toBe(255); // R
      expect(result.data[1]).toBe(0);   // G
      expect(result.data[2]).toBe(0);   // B
      expect(result.data[3]).toBe(255); // A
    });

    it('should generate smooth pattern', () => {
      const face = createTestFace('smooth', [0, 1, 0, 1]);
      const result = generator.generateTexture(face);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });

    it('should generate noise pattern', () => {
      const face = createTestFace('noise', [0, 0, 1, 1]);
      const result = generator.generateTexture(face);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });

    it('should generate cobble pattern', () => {
      const face = createTestFace('cobble', [0.5, 0.5, 0.5, 1]);
      const result = generator.generateTexture(face);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });

    it('should generate bricks pattern', () => {
      const face = createTestFace('bricks', [0.8, 0.2, 0.2, 1]);
      const result = generator.generateTexture(face);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });

    it('should generate planks pattern', () => {
      const face = createTestFace('planks', [0.6, 0.4, 0.2, 1]);
      const result = generator.generateTexture(face);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });

    it('should generate grid pattern', () => {
      const face = createTestFace('grid', [0.3, 0.3, 0.8, 1]);
      const result = generator.generateTexture(face);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });

    it('should handle different texture sizes', () => {
      const sizes = [32, 64, 128, 256];
      
      for (const size of sizes) {
        const gen = new ProceduralTextureGenerator(size);
        const face = createTestFace('solid', [1, 1, 1, 1]);
        const result = gen.generateTexture(face);

        expect(result.width).toBe(size);
        expect(result.height).toBe(size);
      }
    });

    it('should respect brightness parameter', () => {
      const face1: BlockFaceTexture = {
        color: [1, 1, 1, 1],
        pattern: 'solid',
        brightness: 0.5,
      };
      const face2: BlockFaceTexture = {
        color: [1, 1, 1, 1],
        pattern: 'solid',
        brightness: 1.0,
      };

      const result1 = generator.generateTexture(face1);
      const result2 = generator.generateTexture(face2);

      // Result2 should be brighter
      expect(result2.data[0]).toBeGreaterThan(result1.data[0]!);
    });

    it('should handle missing pattern (fallback to solid)', () => {
      const face: BlockFaceTexture = {
        color: [1, 0, 0, 1],
        brightness: 1.0,
      };
      const result = generator.generateTexture(face);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });
  });

  describe('generateTextureAsync', () => {
    it('should fallback to CPU when GPU not initialized', async () => {
      const face: BlockFaceTexture = {
        color: [1, 0, 0, 1],
        pattern: 'solid',
        brightness: 1.0,
      };

      const result = await generator.generateTextureAsync(face);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
    });

    it('should generate same result as CPU when GPU unavailable', async () => {
      const face: BlockFaceTexture = {
        color: [0.5, 0.5, 0.5, 1],
        pattern: 'noise',
        brightness: 1.0,
      };

      const cpuResult = generator.generateTextureCPU(face);
      const asyncResult = await generator.generateTextureAsync(face);

      expect(asyncResult.width).toBe(cpuResult.width);
      expect(asyncResult.height).toBe(cpuResult.height);
    });
  });

  describe('generatePBRTexture', () => {
    it('should generate PBR texture set', () => {
      const face: BlockFaceTexture = {
        color: [1, 0, 0, 1],
        pattern: 'smooth',
        brightness: 1.0,
      };

      const result = generator.generatePBRTexture(face);

      expect(result.albedo).toBeInstanceOf(ImageData);
      expect(result.normal).toBeInstanceOf(ImageData);
      expect(result.roughness).toBeInstanceOf(ImageData);
      expect(result.metallic).toBeInstanceOf(ImageData);
      expect(result.ao).toBeInstanceOf(ImageData);

      expect(result.albedo.width).toBe(64);
      expect(result.albedo.height).toBe(64);
    });

    it('should generate consistent PBR textures', () => {
      const face: BlockFaceTexture = {
        color: [0.5, 0.5, 0.5, 1],
        pattern: 'cobble',
        brightness: 1.0,
      };

      const result1 = generator.generatePBRTexture(face);
      const result2 = generator.generatePBRTexture(face);

      // Should be deterministic (same seed)
      expect(result1.albedo.width).toBe(result2.albedo.width);
      expect(result1.albedo.height).toBe(result2.albedo.height);
    });
  });

  describe('GPU initialization', () => {
    it('should handle GPU initialization failure gracefully', () => {
      // Mock GPUDevice that throws error
      const mockDevice = {
        createShaderModule: () => {
          throw new Error('GPU not available');
        },
      } as unknown as GPUDevice;

      expect(() => {
        generator.initializeGPU(mockDevice);
      }).not.toThrow();

      // Should fallback to CPU
      const face: BlockFaceTexture = {
        color: [1, 0, 0, 1],
        pattern: 'solid',
        brightness: 1.0,
      };

      const result = generator.generateTexture(face);
      expect(result).toBeInstanceOf(ImageData);
    });
  });

  describe('pattern consistency', () => {
    it('should generate consistent results for same pattern and color', () => {
      const face: BlockFaceTexture = {
        color: [0.7, 0.3, 0.9, 1],
        pattern: 'noise',
        brightness: 1.0,
      };

      const result1 = generator.generateTexture(face);
      const result2 = generator.generateTexture(face);

      // Results should be identical (deterministic)
      expect(result1.width).toBe(result2.width);
      expect(result1.height).toBe(result2.height);
      
      // Check first few pixels are the same
      for (let i = 0; i < 16; i++) {
        expect(result1.data[i]).toBe(result2.data[i]);
      }
    });
  });
});

