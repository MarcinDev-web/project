/**
 * ModelBuilder Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelBuilder } from '../src/ModelBuilder';
import type { BuildBounds, LocalPos, AABB } from '../src/ModelBuilderTypes';
import type { MicroBlock, RotationAxis } from '@engine/microblocks';
import { MICRO_BLOCK_SIZE } from '@engine/microblocks';

describe('ModelBuilder', () => {
  let builder: ModelBuilder;
  const bounds: BuildBounds = {
    min: [0, 0, 0],
    max: [15, 15, 15],
  };

  // Helper to get world position from local
  const toWorld = (local: LocalPos): [number, number, number] => [
    local[0] * MICRO_BLOCK_SIZE,
    local[1] * MICRO_BLOCK_SIZE,
    local[2] * MICRO_BLOCK_SIZE,
  ];

  // Helper to create an AABB from local coords
  const createAABB = (min: LocalPos, max: LocalPos): AABB => ({
    min: toWorld(min),
    max: toWorld(max),
  });

  beforeEach(() => {
    builder = new ModelBuilder({ bounds });
  });

  afterEach(() => {
    builder.dispose();
  });

  describe('Initialization', () => {
    it('should create ModelBuilder with bounds', () => {
      expect(builder).toBeDefined();
      const retrievedBounds = builder.getBounds();
      expect(retrievedBounds.min).toEqual(bounds.min);
      expect(retrievedBounds.max).toEqual(bounds.max);
    });

    it('should throw error on invalid bounds', () => {
      expect(() => new ModelBuilder({
        bounds: { min: [10, 0, 0], max: [0, 10, 10] }
      })).toThrow();
    });
  });

  describe('Block Operations', () => {
    const pos: LocalPos = [5, 5, 5];
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
      rotation: 0,
    };

    it('should place block within bounds', () => {
      const result = builder.placeBlock(pos, block);
      expect(result).toBe(true);
      expect(builder.getBlockCount()).toBe(1);
      
      const storedBlock = builder.getStore().getBlock(toWorld(pos));
      expect(storedBlock).toEqual(block);
    });

    it('should not place block outside bounds', () => {
      const outPos: LocalPos = [20, 20, 20];
      const result = builder.placeBlock(outPos, block);
      expect(result).toBe(false);
      expect(builder.getBlockCount()).toBe(0);
    });

    it('should remove block', () => {
      builder.placeBlock(pos, block);
      expect(builder.getBlockCount()).toBe(1);

      const result = builder.removeBlock(pos);
      expect(result).toBe(true);
      expect(builder.getBlockCount()).toBe(0);
    });

    it('should rotate block correctly (0 -> 1 -> 2 -> 3 -> 0)', () => {
      builder.placeBlock(pos, { ...block, rotation: 0 });
      
      // Rotate +1
      expect(builder.rotateBlock(pos, 1)).toBe(true);
      expect(builder.getStore().getBlock(toWorld(pos))?.rotation).toBe(1);

      // Rotate +1 again
      builder.rotateBlock(pos, 1);
      expect(builder.getStore().getBlock(toWorld(pos))?.rotation).toBe(2);

      // Rotate +2 (wrap around)
      builder.rotateBlock(pos, 2); // 2 + 2 = 4 -> 0
      expect(builder.getStore().getBlock(toWorld(pos))?.rotation).toBe(0);
    });

    it('should not rotate block if position is empty', () => {
      expect(builder.rotateBlock(pos, 1)).toBe(false);
    });
  });

  describe('Region Operations', () => {
    it('should fill region', () => {
      const regionBounds = createAABB([0, 0, 0], [1, 1, 1]);
      const block: MicroBlock = { type: 'cube', materialId: 'stone', rotation: 0 };
      
      builder.fillRegion(regionBounds, block);
      
      // 2x2x2 = 8 blocks
      expect(builder.getBlockCount()).toBe(8);
      expect(builder.getStore().getBlock(toWorld([0, 0, 0]))).toBeDefined();
      expect(builder.getStore().getBlock(toWorld([1, 1, 1]))).toBeDefined();
    });

    it('should clear region', () => {
      // Fill first
      const regionBounds = createAABB([0, 0, 0], [1, 1, 1]);
      const block: MicroBlock = { type: 'cube', materialId: 'stone', rotation: 0 };
      builder.fillRegion(regionBounds, block);
      expect(builder.getBlockCount()).toBe(8);

      // Clear partial
      const clearBounds = createAABB([0, 0, 0], [1, 0, 1]); // 2x1x2 = 4 blocks
      builder.clearRegion(clearBounds);
      
      expect(builder.getBlockCount()).toBe(4);
      expect(builder.getStore().getBlock(toWorld([0, 0, 0]))).toBeNull();
      expect(builder.getStore().getBlock(toWorld([0, 1, 0]))).toBeDefined();
    });

    it('should copy and paste region', () => {
      // Setup pattern: single block at 0,0,0
      const srcPos: LocalPos = [0, 0, 0];
      const block: MicroBlock = { type: 'cube', materialId: 'test', rotation: 1 };
      builder.placeBlock(srcPos, block);

      // Copy
      const copyBounds = createAABB([0, 0, 0], [0, 0, 0]);
      const data = builder.copyRegion(copyBounds);
      
      // Paste at offset
      const offset: LocalPos = [2, 2, 2];
      builder.pasteRegion(data, offset);

      // Verify
      const pastedBlock = builder.getStore().getBlock(toWorld([2, 2, 2]));
      expect(pastedBlock).toBeDefined();
      expect(pastedBlock?.materialId).toBe('test');
      expect(pastedBlock?.rotation).toBe(1);
      
      // Original should still exist
      expect(builder.getStore().getBlock(toWorld([0, 0, 0]))).toBeDefined();
    });

    it('should clip pasted region at bounds', () => {
      // Pattern at 0,0,0
      builder.placeBlock([0, 0, 0], { type: 'cube', materialId: 'test' });
      const data = builder.copyRegion(createAABB([0, 0, 0], [0, 0, 0]));

      // Paste at max bounds edge
      // Max is 15, 15, 15. Paste at 16, 16, 16 should fail/clip
      builder.pasteRegion(data, [16, 16, 16]);
      expect(builder.getStore().getBlock(toWorld([16, 16, 16]))).toBeNull(); // Should be null/invalid logic anyway, but check no crash

      // Paste at 15,15,15 (valid)
      builder.pasteRegion(data, [15, 15, 15]);
      expect(builder.getStore().getBlock(toWorld([15, 15, 15]))).toBeDefined();
    });
  });

  describe('Mirror Operations', () => {
    // Helper to setup asymmetric pattern
    // Block at [1, 0, 0] with rotation 1
    const setupPattern = () => {
      builder.clear();
      const block: MicroBlock = { type: 'cube', materialId: 'arrow', rotation: 1 };
      builder.placeBlock([1, 1, 1], block);
    };

    it('should mirror along X axis', () => {
      setupPattern();
      // Mirror region covering [0,0,0] to [2,2,2]
      // Center X = 1. Mirror of 1 is 1. Mirror of 0 is 2.
      // Let's place block at [0, 1, 1] instead to see it move to [2, 1, 1]
      builder.clear();
      const block: MicroBlock = { type: 'cube', materialId: 'arrow', rotation: 1 };
      builder.placeBlock([0, 1, 1], block);

      const region = createAABB([0, 0, 0], [2, 2, 2]);
      builder.mirrorRegion(region, 'x');

      // Expect block at [2, 1, 1]
      const mirroredBlock = builder.getStore().getBlock(toWorld([2, 1, 1]));
      expect(mirroredBlock).toBeDefined();
      // Rotation should be flipped for X mirror (horizontal flip)
      // 1 (90 deg) -> flip -> usually (4 - 1) % 4 = 3
      expect(mirroredBlock?.rotation).toBe(3);
      
      // Original spot should be empty (unless it was center)
      expect(builder.getStore().getBlock(toWorld([0, 1, 1]))).toBeNull();
    });

    it('should mirror along Y axis', () => {
      setupPattern();
      // Block at [1, 1, 1]. Center Y=1. Stays at [1, 1, 1].
      // Let's use block at [1, 0, 1]. Center Y of region 0..2 is 1.
      // 0 -> 2
      builder.clear();
      builder.placeBlock([1, 0, 1], { type: 'cube', materialId: 'arrow', rotation: 1 });

      const region = createAABB([0, 0, 0], [2, 2, 2]);
      builder.mirrorRegion(region, 'y');

      const mirroredBlock = builder.getStore().getBlock(toWorld([1, 2, 1]));
      expect(mirroredBlock).toBeDefined();
      // Y mirror usually doesn't change rotation around Y axis
      expect(mirroredBlock?.rotation).toBe(1);
    });

    it('should mirror along Z axis', () => {
      setupPattern();
      // Block at [1, 1, 0]. Center Z=1. -> [1, 1, 2]
      builder.clear();
      builder.placeBlock([1, 1, 0], { type: 'cube', materialId: 'arrow', rotation: 0 });

      const region = createAABB([0, 0, 0], [2, 2, 2]);
      builder.mirrorRegion(region, 'z');

      const mirroredBlock = builder.getStore().getBlock(toWorld([1, 1, 2]));
      expect(mirroredBlock).toBeDefined();
      // Z mirror is also horizontal flip effectively for Y-axis rotation
      // Rotation 0 (0 deg) -> flip -> (4-0)%4 = 0
      expect(mirroredBlock?.rotation).toBe(0);

      // Try rotation 1
      builder.clear();
      builder.placeBlock([1, 1, 0], { type: 'cube', materialId: 'arrow', rotation: 1 });
      builder.mirrorRegion(region, 'z');
      expect(builder.getStore().getBlock(toWorld([1, 1, 2]))?.rotation).toBe(3);
    });
  });

  describe('Import/Export', () => {
    it('should export and import model correctly', () => {
      const pos: LocalPos = [5, 5, 5];
      const block: MicroBlock = {
        type: 'cube',
        materialId: 'plastic_red',
        rotation: 2,
      };

      builder.placeBlock(pos, block);
      const exported = builder.exportModel({ name: 'Test Model' });
      
      expect(exported.storeData).toBeDefined();
      expect(exported.bounds).toEqual(builder.getBounds());
      expect(exported.metadata?.name).toBe('Test Model');
      expect(exported.metadata?.updatedAt).toBeDefined();

      builder.clear();
      expect(builder.getBlockCount()).toBe(0);

      builder.importModel(exported);
      const importedBlock = builder.getStore().getBlock(toWorld(pos));
      expect(importedBlock).toEqual(block);
    });
  });
});
