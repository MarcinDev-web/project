import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  MaterialRegistry, 
  type MaterialDefinition, 
  type MaterialCategory 
} from '../../../src/materials/MaterialRegistry';

describe('MaterialRegistry', () => {
  let registry: MaterialRegistry;

  const createTestMaterial = (
    id: string,
    atlasIndex: number,
    overrides: Partial<MaterialDefinition> = {}
  ): MaterialDefinition => ({
    id,
    displayName: id.replace(/_/g, ' '),
    category: 'stone' as MaterialCategory,
    atlasIndex,
    textures: { albedo: `/textures/${id}.png` },
    properties: { metallic: 0, roughness: 0.8 },
    status: 'pending',
    ...overrides,
  });

  beforeEach(() => {
    registry = new MaterialRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Registration', () => {
    it('should register a material', () => {
      const material = createTestMaterial('stone', 0);
      
      registry.register(material);
      
      expect(registry.has('stone')).toBe(true);
      expect(registry.count).toBe(1);
    });

    it('should throw when registering duplicate ID', () => {
      const material1 = createTestMaterial('stone', 0);
      const material2 = createTestMaterial('stone', 1);
      
      registry.register(material1);
      
      expect(() => registry.register(material2)).toThrow(/already registered/);
    });

    it('should throw when registering duplicate atlas index', () => {
      const material1 = createTestMaterial('stone', 0);
      const material2 = createTestMaterial('cobblestone', 0);
      
      registry.register(material1);
      
      expect(() => registry.register(material2)).toThrow(/already used/);
    });

    it('should register batch of materials', () => {
      const materials = [
        createTestMaterial('stone', 0),
        createTestMaterial('cobblestone', 1),
        createTestMaterial('granite', 2),
      ];
      
      registry.registerBatch(materials);
      
      expect(registry.count).toBe(3);
      expect(registry.has('stone')).toBe(true);
      expect(registry.has('cobblestone')).toBe(true);
      expect(registry.has('granite')).toBe(true);
    });

    it('should unregister a material', () => {
      const material = createTestMaterial('stone', 0);
      registry.register(material);
      
      const result = registry.unregister('stone');
      
      expect(result).toBe(true);
      expect(registry.has('stone')).toBe(false);
      expect(registry.count).toBe(0);
    });

    it('should return false when unregistering non-existent material', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('should track next available atlas index', () => {
      registry.register(createTestMaterial('stone', 0));
      registry.register(createTestMaterial('cobblestone', 5));
      
      expect(registry.getNextAtlasIndex()).toBe(6);
    });
  });

  describe('Queries', () => {
    beforeEach(() => {
      registry.registerBatch([
        createTestMaterial('stone', 0, { category: 'stone' }),
        createTestMaterial('cobblestone', 1, { category: 'stone' }),
        createTestMaterial('oak_planks', 2, { category: 'wood' }),
        createTestMaterial('iron_block', 3, { category: 'metal', tags: ['shiny', 'precious'] }),
      ]);
    });

    it('should get material by ID', () => {
      const material = registry.get('stone');
      
      expect(material).toBeDefined();
      expect(material?.id).toBe('stone');
    });

    it('should return undefined for non-existent ID', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should get material by atlas index', () => {
      const material = registry.getByAtlasIndex(2);
      
      expect(material).toBeDefined();
      expect(material?.id).toBe('oak_planks');
    });

    it('should get materials by category', () => {
      const stoneMaterials = registry.getByCategory('stone');
      
      expect(stoneMaterials).toHaveLength(2);
      expect(stoneMaterials.map(m => m.id)).toContain('stone');
      expect(stoneMaterials.map(m => m.id)).toContain('cobblestone');
    });

    it('should get materials by tag', () => {
      const shinyMaterials = registry.getByTag('shiny');
      
      expect(shinyMaterials).toHaveLength(1);
      expect(shinyMaterials[0].id).toBe('iron_block');
    });

    it('should list all IDs', () => {
      const ids = registry.listIds();
      
      expect(ids).toHaveLength(4);
      expect(ids).toContain('stone');
      expect(ids).toContain('iron_block');
    });

    it('should list all materials', () => {
      const materials = registry.listAll();
      
      expect(materials).toHaveLength(4);
    });

    it('should get unique categories', () => {
      const categories = registry.getCategories();
      
      expect(categories).toContain('stone');
      expect(categories).toContain('wood');
      expect(categories).toContain('metal');
    });

    it('should search materials', () => {
      const results = registry.search('stone');
      
      expect(results).toHaveLength(2); // stone, cobblestone
    });
  });

  describe('Updates', () => {
    beforeEach(() => {
      registry.register(createTestMaterial('stone', 0));
    });

    it('should update material status', () => {
      registry.setStatus('stone', 'ready');
      
      const material = registry.get('stone');
      expect(material?.status).toBe('ready');
    });

    it('should update material status with error', () => {
      registry.setStatus('stone', 'error', 'Failed to load texture');
      
      const material = registry.get('stone');
      expect(material?.status).toBe('error');
      expect(material?.error).toBe('Failed to load texture');
    });

    it('should update material properties', () => {
      registry.update('stone', { 
        displayName: 'Updated Stone',
        properties: { metallic: 0.5, roughness: 0.5 },
      });
      
      const material = registry.get('stone');
      expect(material?.displayName).toBe('Updated Stone');
      expect(material?.properties.metallic).toBe(0.5);
    });

    it('should get materials by status', () => {
      registry.register(createTestMaterial('cobblestone', 1));
      registry.setStatus('stone', 'ready');
      registry.setStatus('cobblestone', 'error', 'Test error');
      
      const readyMaterials = registry.getByStatus('ready');
      const errorMaterials = registry.getByStatus('error');
      
      expect(readyMaterials).toHaveLength(1);
      expect(readyMaterials[0].id).toBe('stone');
      expect(errorMaterials).toHaveLength(1);
      expect(errorMaterials[0].id).toBe('cobblestone');
    });
  });

  describe('Validation', () => {
    it('should validate valid material', () => {
      registry.register(createTestMaterial('stone', 0));
      
      const result = registry.validate('stone');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for non-existent material', () => {
      const result = registry.validate('nonexistent');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Material "nonexistent" not found');
    });

    it('should detect invalid metallic value', () => {
      registry.register(createTestMaterial('stone', 0, {
        properties: { metallic: 2, roughness: 0.5 },
      }));
      
      const result = registry.validate('stone');
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('metallic'))).toBe(true);
    });

    it('should detect error status', () => {
      registry.register(createTestMaterial('stone', 0));
      registry.setStatus('stone', 'error', 'Test error');
      
      const result = registry.validate('stone');
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('error state'))).toBe(true);
    });

    it('should warn about missing albedo for non-procedural material', () => {
      registry.register(createTestMaterial('stone', 0, {
        textures: { albedo: null },
        isProcedural: false,
      }));
      
      const result = registry.validate('stone');
      
      expect(result.warnings.some(w => w.includes('albedo'))).toBe(true);
    });

    it('should validate all materials', () => {
      registry.registerBatch([
        createTestMaterial('stone', 0),
        createTestMaterial('error_material', 1),
      ]);
      registry.setStatus('error_material', 'error', 'Test error');
      
      const results = registry.validateAll();
      
      expect(results.size).toBe(2);
      expect(results.get('stone')?.valid).toBe(true);
      expect(results.get('error_material')?.valid).toBe(false);
    });
  });

  describe('Static Helpers', () => {
    it('should create material definition with defaults', () => {
      const material = MaterialRegistry.createDefinition('test_material', 0);
      
      expect(material.id).toBe('test_material');
      expect(material.displayName).toBe('Test Material'); // Auto-generated
      expect(material.atlasIndex).toBe(0);
      expect(material.status).toBe('pending');
      expect(material.isProcedural).toBe(true);
    });

    it('should create material definition with overrides', () => {
      const material = MaterialRegistry.createDefinition('test_material', 5, {
        displayName: 'Custom Name',
        category: 'metal',
        properties: { metallic: 1, roughness: 0.2 },
      });
      
      expect(material.displayName).toBe('Custom Name');
      expect(material.category).toBe('metal');
      expect(material.atlasIndex).toBe(5);
      expect(material.properties.metallic).toBe(1);
    });
  });

  describe('Clear', () => {
    it('should clear all materials', () => {
      registry.registerBatch([
        createTestMaterial('stone', 0),
        createTestMaterial('cobblestone', 1),
      ]);
      
      registry.clear();
      
      expect(registry.count).toBe(0);
      expect(registry.listAll()).toHaveLength(0);
      expect(registry.getNextAtlasIndex()).toBe(0);
    });
  });
});

