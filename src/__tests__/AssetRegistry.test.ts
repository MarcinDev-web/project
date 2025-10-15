/**
 * Tests for AssetRegistry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AssetRegistry } from '../editor/assets/AssetRegistry';
import type { Asset } from '../editor/assets/AssetTypes';

describe('AssetRegistry', () => {
  let registry: AssetRegistry;

  beforeEach(() => {
    registry = new AssetRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Basic Registration', () => {
    it('should register a valid asset', () => {
      const asset: Asset = createTestAsset('test1', 'Test Asset');
      
      registry.register(asset);
      
      const retrieved = registry.get('test1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.name).toBe('Test Asset');
    });

    it('should register multiple assets', () => {
      const assets = [
        createTestAsset('test1', 'Asset 1'),
        createTestAsset('test2', 'Asset 2'),
        createTestAsset('test3', 'Asset 3'),
      ];

      registry.registerBatch(assets);

      expect(registry.getAll()).toHaveLength(3);
    });

    it('should throw error for invalid asset', () => {
      const invalidAsset = {
        type: 'block',
        // missing required fields
      } as unknown as Asset;

      expect(() => registry.register(invalidAsset)).toThrow();
    });

    it('should overwrite existing asset with same id', () => {
      const asset1 = createTestAsset('test1', 'Original');
      const asset2 = createTestAsset('test1', 'Updated');

      registry.register(asset1);
      registry.register(asset2);

      const retrieved = registry.get('test1');
      expect(retrieved?.metadata.name).toBe('Updated');
      expect(registry.getAll()).toHaveLength(1);
    });
  });

  describe('Querying', () => {
    beforeEach(() => {
      // Register test assets
      registry.registerBatch([
        createTestAsset('block1', 'Red Block', {
          type: 'block',
          category: 'Building',
          subcategory: 'Walls',
          styles: ['Modern'],
          material: 'Plastic',
          tags: ['red', 'building'],
        }),
        createTestAsset('block2', 'Blue Block', {
          type: 'block',
          category: 'Building',
          subcategory: 'Walls',
          styles: ['Modern'],
          material: 'Plastic',
          tags: ['blue', 'building'],
        }),
        createTestAsset('furniture1', 'Chair', {
          type: 'primitive',
          category: 'Furniture',
          subcategory: 'Seating',
          styles: ['Traditional'],
          material: 'Wood',
          tags: ['seating', 'furniture'],
        }),
        createTestAsset('furniture2', 'Table', {
          type: 'primitive',
          category: 'Furniture',
          subcategory: 'Tables',
          styles: ['Modern'],
          material: 'Wood',
          tags: ['table', 'furniture'],
        }),
      ]);
    });

    it('should query by type', () => {
      const blocks = registry.query({ type: 'block' });
      expect(blocks).toHaveLength(2);
      expect(blocks.every((a) => a.type === 'block')).toBe(true);
    });

    it('should query by category', () => {
      const furniture = registry.query({ category: 'Furniture' });
      expect(furniture).toHaveLength(2);
      expect(furniture.every((a) => a.category === 'Furniture')).toBe(true);
    });

    it('should query by subcategory', () => {
      const seating = registry.query({ subcategory: 'Seating' });
      expect(seating).toHaveLength(1);
      expect(seating[0]?.metadata.name).toBe('Chair');
    });

    it('should query by style', () => {
      const modern = registry.query({ style: 'Modern' });
      expect(modern.length).toBeGreaterThanOrEqual(3);
      expect(modern.every((a) => a.styles?.includes('Modern'))).toBe(true);
    });

    it('should query by material', () => {
      const wood = registry.query({ material: 'Wood' });
      expect(wood).toHaveLength(2);
      expect(wood.every((a) => a.material === 'Wood')).toBe(true);
    });

    it('should query by tags', () => {
      const building = registry.query({ tags: ['building'] });
      expect(building).toHaveLength(2);
    });

    it('should search by text', () => {
      const results = registry.search('chair');
      expect(results).toHaveLength(1);
      expect(results[0]?.metadata.name).toBe('Chair');
    });

    it('should combine multiple filters', () => {
      const results = registry.query({
        type: 'primitive',
        category: 'Furniture',
        style: 'Modern',
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.metadata.name).toBe('Table');
    });

    it('should return empty array when no matches', () => {
      const results = registry.query({ type: 'audio' });
      expect(results).toHaveLength(0);
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      registry.registerBatch([
        createTestAsset('asset1', 'Zebra', {
          cost: 100,
          metadata: { rating: 3, usageCount: 50 },
        }),
        createTestAsset('asset2', 'Apple', {
          cost: 50,
          metadata: { rating: 5, usageCount: 100 },
        }),
        createTestAsset('asset3', 'Banana', {
          cost: 75,
          metadata: { rating: 4, usageCount: 75 },
        }),
      ]);
    });

    it('should sort by name ascending', () => {
      const results = registry.query({}, { sortBy: 'name', ascending: true });
      expect(results[0]?.metadata.name).toBe('Apple');
      expect(results[2]?.metadata.name).toBe('Zebra');
    });

    it('should sort by name descending', () => {
      const results = registry.query({}, { sortBy: 'name', ascending: false });
      expect(results[0]?.metadata.name).toBe('Zebra');
      expect(results[2]?.metadata.name).toBe('Apple');
    });

    it('should sort by cost', () => {
      const results = registry.query({}, { sortBy: 'cost', ascending: true });
      expect(results[0]?.cost).toBe(50);
      expect(results[2]?.cost).toBe(100);
    });

    it('should sort by rating', () => {
      const results = registry.query({}, { sortBy: 'rating', ascending: false });
      expect(results[0]?.metadata.rating).toBe(5);
      expect(results[2]?.metadata.rating).toBe(3);
    });

    it('should sort by usage', () => {
      const results = registry.query({}, { sortBy: 'usage', ascending: false });
      expect(results[0]?.metadata.usageCount).toBe(100);
      expect(results[2]?.metadata.usageCount).toBe(50);
    });
  });

  describe('Update and Remove', () => {
    it('should update an existing asset', () => {
      const asset = createTestAsset('test1', 'Original');
      registry.register(asset);

      const success = registry.update('test1', {
        metadata: { ...asset.metadata, name: 'Updated' },
      });

      expect(success).toBe(true);
      const updated = registry.get('test1');
      expect(updated?.metadata.name).toBe('Updated');
    });

    it('should fail to update non-existent asset', () => {
      const success = registry.update('nonexistent', {});
      expect(success).toBe(false);
    });

    it('should remove an asset', () => {
      const asset = createTestAsset('test1', 'Test');
      registry.register(asset);

      const removed = registry.remove('test1');

      expect(removed).toBe(true);
      expect(registry.get('test1')).toBeUndefined();
    });

    it('should return false when removing non-existent asset', () => {
      const removed = registry.remove('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('Collections', () => {
    it('should register a collection', () => {
      const collection = {
        id: 'col1',
        name: 'Test Collection',
        description: 'Test',
        assetIds: ['asset1', 'asset2'],
      };

      registry.registerCollection(collection);

      const retrieved = registry.getCollection('col1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Collection');
    });

    it('should get all collections', () => {
      registry.registerCollection({
        id: 'col1',
        name: 'Collection 1',
        description: 'Test',
        assetIds: [],
      });
      registry.registerCollection({
        id: 'col2',
        name: 'Collection 2',
        description: 'Test',
        assetIds: [],
      });

      const collections = registry.getAllCollections();
      expect(collections).toHaveLength(2);
    });

    it('should get assets in a collection', () => {
      registry.registerBatch([
        createTestAsset('asset1', 'Asset 1'),
        createTestAsset('asset2', 'Asset 2'),
      ]);

      registry.registerCollection({
        id: 'col1',
        name: 'Collection',
        description: 'Test',
        assetIds: ['asset1', 'asset2'],
      });

      const assets = registry.getCollectionAssets('col1');
      expect(assets).toHaveLength(2);
    });

    it('should handle non-existent assets in collection', () => {
      registry.registerCollection({
        id: 'col1',
        name: 'Collection',
        description: 'Test',
        assetIds: ['nonexistent1', 'nonexistent2'],
      });

      const assets = registry.getCollectionAssets('col1');
      expect(assets).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', () => {
      registry.registerBatch([
        createTestAsset('block1', 'Block', { type: 'block', category: 'Building' }),
        createTestAsset('block2', 'Block', { type: 'block', category: 'Building' }),
        createTestAsset('model1', 'Model', { type: 'model', category: 'Nature' }),
        createTestAsset('custom1', 'Custom', {
          metadata: { isBuiltIn: false },
          category: 'Custom',
        }),
      ]);

      registry.registerCollection({ id: 'col1', name: 'C1', description: 'T', assetIds: [] });

      const stats = registry.getStats();

      expect(stats.totalAssets).toBe(4);
      expect(stats.builtInAssets).toBe(3);
      expect(stats.customAssets).toBe(1);
      expect(stats.collections).toBe(1);
      expect(stats.byType.block).toBe(2);
      expect(stats.byType.model).toBe(1);
      expect(stats.byCategory.Building).toBe(2);
      expect(stats.byCategory.Nature).toBe(1);
    });
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createTestAsset(
  id: string,
  name: string,
  overrides?: Partial<Asset>
): Asset {
  const baseAsset: Asset = {
    type: 'primitive',
    category: 'Building',
    metadata: {
      id,
      name,
      description: `Test asset: ${name}`,
      isBuiltIn: true,
    },
    color: [1, 1, 1, 1],
    scale: [1, 1, 1],
    isPlaceable: true,
  };

  // Merge overrides properly
  if (overrides) {
    return {
      ...baseAsset,
      ...overrides,
      metadata: {
        ...baseAsset.metadata,
        ...overrides.metadata,
      },
    };
  }

  return baseAsset;
}

