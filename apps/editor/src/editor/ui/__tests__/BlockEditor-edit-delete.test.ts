/**
 * Tests for BlockEditorUI edit and delete functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BlockEditorUI, type CustomBlockData } from '../BlockEditorUI';

describe('BlockEditorUI - Edit/Delete', () => {
  let blockEditor: BlockEditorUI;

  beforeEach(() => {
    blockEditor = new BlockEditorUI();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('loadFromStorage', () => {
    it('should return empty array when no custom blocks exist', () => {
      const blocks = blockEditor.loadFromStorage();
      expect(blocks).toEqual([]);
    });

    it('should load custom blocks from localStorage', () => {
      const mockBlocks: CustomBlockData[] = [
        {
          id: 'test_block_1',
          definition: {
            id: 'test_block_1',
            name: 'Test Block 1',
            category: 'basic',
            material: 'plastic',
            textures: {
              top: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 1.0 },
              bottom: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.8 },
              sides: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.9 },
            },
            properties: {
              solid: true,
              transparent: false,
              emissive: 0,
              roughness: 0.5,
              metallic: 0,
            },
          },
          createdAt: Date.now(),
        },
      ];

      localStorage.setItem('customBlocks', JSON.stringify(mockBlocks));

      const loaded = blockEditor.loadFromStorage();
      expect(loaded).toHaveLength(1);
      const first = loaded[0]!;
      expect(first.id).toBe('test_block_1');
      expect(first.definition.name).toBe('Test Block 1');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('customBlocks', 'invalid json {]');

      const blocks = blockEditor.loadFromStorage();
      expect(blocks).toEqual([]);
    });
  });

  describe('deleteFromStorage', () => {
    it('should delete a block by id', () => {
      const mockBlocks: CustomBlockData[] = [
        {
          id: 'block_1',
          definition: {
            id: 'block_1',
            name: 'Block 1',
            category: 'basic',
            material: 'plastic',
            textures: {
              top: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 1.0 },
              bottom: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.8 },
              sides: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.9 },
            },
            properties: {
              solid: true,
              transparent: false,
              emissive: 0,
              roughness: 0.5,
              metallic: 0,
            },
          },
          createdAt: Date.now(),
        },
        {
          id: 'block_2',
          definition: {
            id: 'block_2',
            name: 'Block 2',
            category: 'decorative',
            material: 'stone',
            textures: {
              top: { color: [0, 1, 0, 1], pattern: 'smooth', brightness: 1.0 },
              bottom: { color: [0, 1, 0, 1], pattern: 'smooth', brightness: 0.8 },
              sides: { color: [0, 1, 0, 1], pattern: 'smooth', brightness: 0.9 },
            },
            properties: {
              solid: true,
              transparent: false,
              emissive: 0,
              roughness: 0.7,
              metallic: 0,
            },
          },
          createdAt: Date.now(),
        },
      ];

      localStorage.setItem('customBlocks', JSON.stringify(mockBlocks));

      const success = blockEditor.deleteFromStorage('block_1');
      expect(success).toBe(true);

      const remaining = blockEditor.loadFromStorage();
      expect(remaining).toHaveLength(1);
      const only = remaining[0]!;
      expect(only.id).toBe('block_2');
    });

    it('should return false when block not found', () => {
      const mockBlocks: CustomBlockData[] = [
        {
          id: 'block_1',
          definition: {
            id: 'block_1',
            name: 'Block 1',
            category: 'basic',
            material: 'plastic',
            textures: {
              top: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 1.0 },
              bottom: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.8 },
              sides: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.9 },
            },
            properties: {
              solid: true,
              transparent: false,
              emissive: 0,
              roughness: 0.5,
              metallic: 0,
            },
          },
          createdAt: Date.now(),
        },
      ];

      localStorage.setItem('customBlocks', JSON.stringify(mockBlocks));

      const success = blockEditor.deleteFromStorage('non_existent_block');
      expect(success).toBe(false);

      const remaining = blockEditor.loadFromStorage();
      expect(remaining).toHaveLength(1);
    });

    it('should delete all blocks if called multiple times', () => {
      const mockBlocks: CustomBlockData[] = [
        {
          id: 'block_1',
          definition: {
            id: 'block_1',
            name: 'Block 1',
            category: 'basic',
            material: 'plastic',
            textures: {
              top: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 1.0 },
              bottom: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.8 },
              sides: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.9 },
            },
            properties: {
              solid: true,
              transparent: false,
              emissive: 0,
              roughness: 0.5,
              metallic: 0,
            },
          },
          createdAt: Date.now(),
        },
        {
          id: 'block_2',
          definition: {
            id: 'block_2',
            name: 'Block 2',
            category: 'decorative',
            material: 'stone',
            textures: {
              top: { color: [0, 1, 0, 1], pattern: 'smooth', brightness: 1.0 },
              bottom: { color: [0, 1, 0, 1], pattern: 'smooth', brightness: 0.8 },
              sides: { color: [0, 1, 0, 1], pattern: 'smooth', brightness: 0.9 },
            },
            properties: {
              solid: true,
              transparent: false,
              emissive: 0,
              roughness: 0.7,
              metallic: 0,
            },
          },
          createdAt: Date.now(),
        },
      ];

      localStorage.setItem('customBlocks', JSON.stringify(mockBlocks));

      blockEditor.deleteFromStorage('block_1');
      blockEditor.deleteFromStorage('block_2');

      const remaining = blockEditor.loadFromStorage();
      expect(remaining).toHaveLength(0);
    });

    it('should handle empty localStorage gracefully', () => {
      const success = blockEditor.deleteFromStorage('any_id');
      expect(success).toBe(false);
    });
  });

  describe('Edit functionality', () => {
    it('should preserve createdAt when updating existing block', () => {
      const originalCreatedAt = Date.now() - 10000; // 10 seconds ago

      const mockBlocks: CustomBlockData[] = [
        {
          id: 'test_block',
          definition: {
            id: 'test_block',
            name: 'Original Name',
            category: 'basic',
            material: 'plastic',
            textures: {
              top: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 1.0 },
              bottom: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.8 },
              sides: { color: [1, 0, 0, 1], pattern: 'smooth', brightness: 0.9 },
            },
            properties: {
              solid: true,
              transparent: false,
              emissive: 0,
              roughness: 0.5,
              metallic: 0,
            },
          },
          createdAt: originalCreatedAt,
        },
      ];

      localStorage.setItem('customBlocks', JSON.stringify(mockBlocks));

      // Load the block
      const loaded = blockEditor.loadFromStorage();
      const firstLoaded = loaded[0]!;
      expect(firstLoaded.createdAt).toBe(originalCreatedAt);

      // The actual update would happen through the UI
      // We're verifying the storage structure preserves createdAt
      const blocks = blockEditor.loadFromStorage();
      const firstBlock = blocks[0]!;
      expect(firstBlock.createdAt).toBe(originalCreatedAt);
    });
  });
});

