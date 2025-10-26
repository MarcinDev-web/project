/**
 * Tests for AssetLibrary
 */

import { describe, it, expect } from 'vitest';
import {
  convertBlocksToAssets,
  getAllBuiltInAssets,
  getAllCollections,
  ASSET_COLLECTIONS,
} from '@engine/assets';

describe('AssetLibrary', () => {
  describe('Block Conversion', () => {
    it('should convert blocks to assets', () => {
      const assets = convertBlocksToAssets();

      expect(assets.length).toBeGreaterThan(0);
      assets.forEach((asset) => {
        expect(asset.type).toBe('block');
        expect(asset.metadata.id).toMatch(/^block_/);
        expect(asset.blockData).toBeDefined();
      });
    });

    it('should convert block with correct properties', () => {
      const assets = convertBlocksToAssets();
      const redBlock = assets.find((a) => a.metadata.id === 'block_plastic_red');

      expect(redBlock).toBeDefined();
      expect(redBlock?.metadata.name).toBe('Red Block');
      expect(redBlock?.category).toBe('Building');
      expect(redBlock?.material).toBe('Plastic');
      expect(redBlock?.isPlaceable).toBe(true);
      expect(redBlock?.tags).toContain('block');
    });

    it('should set built-in flag for converted blocks', () => {
      const assets = convertBlocksToAssets();
      
      assets.forEach((asset) => {
        expect(asset.metadata.isBuiltIn).toBe(true);
      });
    });
  });

  describe('Built-in Assets', () => {
    it('should return all built-in assets', () => {
      const assets = getAllBuiltInAssets();

      expect(assets.length).toBeGreaterThan(0);
      expect(assets.every((a) => a.metadata.isBuiltIn)).toBe(true);
    });

    it('should include furniture assets', () => {
      const assets = getAllBuiltInAssets();
      const furniture = assets.filter((a) => a.category === 'Furniture');

      expect(furniture.length).toBeGreaterThan(0);
      
      // Check specific furniture items
      const chair = furniture.find((a) => a.metadata.id === 'furniture_chair_dining');
      expect(chair).toBeDefined();
      expect(chair?.subcategory).toBe('Seating');
    });

    it('should include architecture assets', () => {
      const assets = getAllBuiltInAssets();
      const architecture = assets.filter((a) => a.category === 'Architecture');

      expect(architecture.length).toBeGreaterThan(0);
      
      const door = architecture.find((a) => a.metadata.id === 'arch_door_standard');
      expect(door).toBeDefined();
      expect(door?.subcategory).toBe('Doors');
    });

    it('should include lighting assets', () => {
      const assets = getAllBuiltInAssets();
      const lighting = assets.filter((a) => a.category === 'Lighting');

      expect(lighting.length).toBeGreaterThan(0);
      
      const ceilingLight = lighting.find((a) => a.metadata.id === 'light_ceiling_modern');
      expect(ceilingLight).toBeDefined();
      expect(ceilingLight?.subcategory).toBe('CeilingLights');
    });

    it('should include decoration assets', () => {
      const assets = getAllBuiltInAssets();
      const decoration = assets.filter((a) => a.category === 'Decoration');

      expect(decoration.length).toBeGreaterThan(0);
      
      const plant = decoration.find((a) => a.metadata.id === 'deco_plant_pot');
      expect(plant).toBeDefined();
      expect(plant?.subcategory).toBe('Plants');
    });

    it('should include nature assets', () => {
      const assets = getAllBuiltInAssets();
      const nature = assets.filter((a) => a.category === 'Nature');

      expect(nature.length).toBeGreaterThan(0);
      
      const tree = nature.find((a) => a.metadata.id === 'nature_tree_oak');
      expect(tree).toBeDefined();
      expect(tree?.subcategory).toBe('Trees');
    });

    it('should include gameplay assets', () => {
      const assets = getAllBuiltInAssets();
      const gameplay = assets.filter((a) => a.category === 'Gameplay');

      expect(gameplay.length).toBeGreaterThan(0);
      
      const spawn = gameplay.find((a) => a.metadata.id === 'gameplay_spawn_point');
      expect(spawn).toBeDefined();
      expect(spawn?.subcategory).toBe('Spawns');
    });
  });

  describe('Asset Properties', () => {
    it('should have valid metadata for all assets', () => {
      const assets = getAllBuiltInAssets();

      assets.forEach((asset) => {
        expect(asset.metadata.id).toBeTruthy();
        expect(asset.metadata.name).toBeTruthy();
        expect(asset.metadata.description).toBeTruthy();
        expect(asset.metadata.isBuiltIn).toBe(true);
      });
    });

    it('should have valid colors', () => {
      const assets = getAllBuiltInAssets();

      assets.forEach((asset) => {
        expect(asset.color).toBeDefined();
        expect(asset.color).toHaveLength(4);
        asset.color.forEach((c) => {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(1);
        });
      });
    });

    it('should have valid scales', () => {
      const assets = getAllBuiltInAssets();

      assets.forEach((asset) => {
        expect(asset.scale).toBeDefined();
        expect(asset.scale).toHaveLength(3);
        asset.scale.forEach((s) => {
          expect(s).toBeGreaterThan(0);
        });
      });
    });

    it('should have appropriate tags', () => {
      const assets = getAllBuiltInAssets();

      assets.forEach((asset) => {
        if (asset.tags) {
          expect(asset.tags.length).toBeGreaterThan(0);
        }
      });
    });

    it('should have keywords for searchability', () => {
      const assets = getAllBuiltInAssets();

      assets.forEach((asset) => {
        if (asset.keywords) {
          expect(asset.keywords.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Variants', () => {
    it('should have variants for some assets', () => {
      const assets = getAllBuiltInAssets();
      const assetsWithVariants = assets.filter((a) => a.variants && a.variants.length > 0);

      expect(assetsWithVariants.length).toBeGreaterThan(0);
    });

    it('should have valid variant structure', () => {
      const assets = getAllBuiltInAssets();
      const chair = assets.find((a) => a.metadata.id === 'furniture_chair_dining');

      expect(chair?.variants).toBeDefined();
      expect(chair!.variants!.length).toBeGreaterThan(0);

      chair!.variants!.forEach((variant) => {
        expect(variant.id).toBeTruthy();
        expect(variant.name).toBeTruthy();
        if (variant.color) {
          expect(variant.color).toHaveLength(4);
        }
      });
    });

    it('should have color variants for furniture', () => {
      const assets = getAllBuiltInAssets();
      const sofa = assets.find((a) => a.metadata.id === 'furniture_sofa_modern');

      expect(sofa?.variants).toBeDefined();
      expect(sofa!.variants!.length).toBeGreaterThanOrEqual(3);
      
      const grayVariant = sofa!.variants!.find((v) => v.name === 'Gray');
      expect(grayVariant).toBeDefined();
      expect(grayVariant?.color).toBeDefined();
    });
  });

  describe('Collections', () => {
    it('should return all collections', () => {
      const collections = getAllCollections();

      expect(collections.length).toBeGreaterThan(0);
      expect(collections).toEqual(ASSET_COLLECTIONS);
    });

    it('should have valid collection structure', () => {
      const collections = getAllCollections();

      collections.forEach((collection) => {
        expect(collection.id).toBeTruthy();
        expect(collection.name).toBeTruthy();
        expect(collection.description).toBeTruthy();
        expect(collection.assetIds).toBeDefined();
        expect(collection.assetIds.length).toBeGreaterThan(0);
      });
    });

    it('should have living room collection', () => {
      const collections = getAllCollections();
      const livingRoom = collections.find((c) => c.id === 'collection_living_room_modern');

      expect(livingRoom).toBeDefined();
      expect(livingRoom?.name).toBe('Modern Living Room Set');
      expect(livingRoom?.assetIds).toContain('furniture_sofa_modern');
      expect(livingRoom?.assetIds).toContain('furniture_coffee_table');
    });

    it('should have bedroom collection', () => {
      const collections = getAllCollections();
      const bedroom = collections.find((c) => c.id === 'collection_bedroom_essential');

      expect(bedroom).toBeDefined();
      expect(bedroom?.assetIds).toContain('furniture_bed_double');
      expect(bedroom?.assetIds).toContain('furniture_dresser');
    });

    it('should have garden collection', () => {
      const collections = getAllCollections();
      const garden = collections.find((c) => c.id === 'collection_garden_outdoor');

      expect(garden).toBeDefined();
      expect(garden?.assetIds).toContain('nature_tree_oak');
      expect(garden?.assetIds).toContain('nature_bush_generic');
    });

    it('should reference valid asset ids', () => {
      const assets = getAllBuiltInAssets();
      const collections = getAllCollections();
      const assetIds = new Set(assets.map((a) => a.metadata.id));

      collections.forEach((collection) => {
        collection.assetIds.forEach((id) => {
          expect(assetIds.has(id)).toBe(true);
        });
      });
    });

    it('should have appropriate tags', () => {
      const collections = getAllCollections();

      collections.forEach((collection) => {
        expect(collection.tags).toBeDefined();
        expect(collection.tags!.length).toBeGreaterThan(0);
        expect(collection.tags).toContain('collection');
      });
    });
  });

  describe('Featured Assets', () => {
    it('should have some featured assets', () => {
      const assets = getAllBuiltInAssets();
      const featured = assets.filter((a) => a.metadata.isFeatured);

      expect(featured.length).toBeGreaterThan(0);
    });

    it('should feature important furniture pieces', () => {
      const assets = getAllBuiltInAssets();
      const featuredFurniture = assets.filter(
        (a) => a.category === 'Furniture' && a.metadata.isFeatured
      );

      expect(featuredFurniture.length).toBeGreaterThan(0);
    });
  });

  describe('Cost System', () => {
    it('should have costs for most assets', () => {
      const assets = getAllBuiltInAssets();
      const assetsWithCost = assets.filter((a) => a.cost !== undefined);

      // Most non-block assets should have costs
      expect(assetsWithCost.length).toBeGreaterThan(0);
    });

    it('should have reasonable cost values', () => {
      const assets = getAllBuiltInAssets();

      assets.forEach((asset) => {
        if (asset.cost !== undefined) {
          expect(asset.cost).toBeGreaterThanOrEqual(0);
          expect(asset.cost).toBeLessThan(10000); // Reasonable upper limit
        }
      });
    });

    it('should have gameplay assets with zero cost', () => {
      const assets = getAllBuiltInAssets();
      const gameplayAssets = assets.filter((a) => a.category === 'Gameplay');

      gameplayAssets.forEach((asset) => {
        expect(asset.cost).toBe(0);
      });
    });
  });

  describe('Asset Types Distribution', () => {
    it('should have multiple asset types', () => {
      const assets = getAllBuiltInAssets();
      const types = new Set(assets.map((a) => a.type));

      expect(types.size).toBeGreaterThan(1);
      expect(types.has('block')).toBe(true);
      expect(types.has('primitive')).toBe(true);
    });

    it('should have multiple categories', () => {
      const assets = getAllBuiltInAssets();
      const categories = new Set(assets.map((a) => a.category));

      expect(categories.size).toBeGreaterThanOrEqual(5);
      expect(categories.has('Building')).toBe(true);
      expect(categories.has('Furniture')).toBe(true);
      expect(categories.has('Nature')).toBe(true);
    });

    it('should have multiple materials', () => {
      const assets = getAllBuiltInAssets();
      const materials = new Set(
        assets.map((a) => a.material).filter((m): m is string => m !== undefined)
      );

      expect(materials.size).toBeGreaterThan(1);
      expect(materials.has('Wood')).toBe(true);
      expect(materials.has('Stone')).toBe(true);
    });

    it('should have multiple styles', () => {
      const assets = getAllBuiltInAssets();
      const allStyles = new Set<string>();

      assets.forEach((asset) => {
        if (asset.styles) {
          asset.styles.forEach((style) => allStyles.add(style));
        }
      });

      expect(allStyles.size).toBeGreaterThan(1);
      expect(allStyles.has('Modern')).toBe(true);
      expect(allStyles.has('Contemporary')).toBe(true);
    });
  });
});

