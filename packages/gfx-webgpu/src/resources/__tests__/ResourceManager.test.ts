import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResourceManager } from '../ResourceManager';
import { type MaterialDefinition } from '../../materials/MaterialRegistry';

// Mock GPU device
const createMockDevice = (): GPUDevice => ({
  createTexture: vi.fn(() => ({
    destroy: vi.fn(),
    createView: vi.fn(),
  })),
  createBuffer: vi.fn(),
  createBindGroup: vi.fn(),
  createBindGroupLayout: vi.fn(),
  queue: {
    writeTexture: vi.fn(),
    writeBuffer: vi.fn(),
  },
  destroy: vi.fn(),
} as unknown as GPUDevice);

describe('ResourceManager', () => {
  let manager: ResourceManager;
  let mockDevice: GPUDevice;

  const createTestMaterial = (id: string, atlasIndex: number): MaterialDefinition => ({
    id,
    displayName: id.replace(/_/g, ' '),
    category: 'stone',
    atlasIndex,
    textures: { albedo: `/textures/${id}.png` },
    properties: { metallic: 0, roughness: 0.8 },
    status: 'pending',
  });

  beforeEach(() => {
    mockDevice = createMockDevice();
    manager = new ResourceManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('Initialization', () => {
    it('should create manager without GPU device', () => {
      expect(manager.isInitialized).toBe(false);
      expect(manager.device).toBeNull();
    });

    it('should initialize with GPU device', () => {
      const result = manager.initialize(mockDevice);
      
      expect(result.success).toBe(true);
      expect(manager.isInitialized).toBe(true);
      expect(manager.device).toBe(mockDevice);
    });

    it('should return existing state when initializing twice', () => {
      manager.registerMaterial(createTestMaterial('stone', 0));
      manager.initialize(mockDevice);
      
      const result = manager.initialize(mockDevice);
      
      expect(result.success).toBe(true);
      expect(result.materialsLoaded).toBe(1);
    });
  });

  describe('Subsystem Access', () => {
    it('should provide access to texture manager', () => {
      expect(manager.textures).toBeDefined();
    });

    it('should provide access to material registry', () => {
      expect(manager.materials).toBeDefined();
    });

    it('should provide access to texture cache', () => {
      expect(manager.cache).toBeDefined();
    });

    it('should provide access to diagnostics', () => {
      expect(manager.diagnostics).toBeDefined();
    });

    it('should return null for streaming before initialization', () => {
      expect(manager.streaming).toBeNull();
    });

    it('should provide streaming after initialization', () => {
      manager.initialize(mockDevice);
      expect(manager.streaming).toBeDefined();
    });
  });

  describe('Material Operations', () => {
    it('should register a material', () => {
      const material = createTestMaterial('stone', 0);
      
      manager.registerMaterial(material);
      
      expect(manager.getMaterial('stone')).toBeDefined();
      expect(manager.getMaterial('stone')?.id).toBe('stone');
    });

    it('should register multiple materials', () => {
      const materials = [
        createTestMaterial('stone', 0),
        createTestMaterial('cobblestone', 1),
      ];
      
      manager.registerMaterials(materials);
      
      expect(manager.getMaterial('stone')).toBeDefined();
      expect(manager.getMaterial('cobblestone')).toBeDefined();
    });

    it('should get material by atlas index', () => {
      manager.registerMaterial(createTestMaterial('stone', 5));
      
      const material = manager.getMaterialByAtlasIndex(5);
      
      expect(material).toBeDefined();
      expect(material?.id).toBe('stone');
    });

    it('should get materials by category', () => {
      manager.registerMaterials([
        createTestMaterial('stone', 0),
        { ...createTestMaterial('oak_planks', 1), category: 'wood' },
      ]);
      
      const stoneMaterials = manager.getMaterialsByCategory('stone');
      
      expect(stoneMaterials).toHaveLength(1);
      expect(stoneMaterials[0].id).toBe('stone');
    });

    it('should resolve atlas index for valid material', () => {
      manager.registerMaterial(createTestMaterial('stone', 7));
      
      const index = manager.resolveAtlasIndex('stone');
      
      expect(index).toBe(7);
    });

    it('should return fallback for unknown material', () => {
      const index = manager.resolveAtlasIndex('nonexistent', 99);
      
      expect(index).toBe(99);
    });
  });

  describe('Validation', () => {
    it('should validate a material', () => {
      manager.registerMaterial(createTestMaterial('stone', 0));
      
      const result = manager.validateMaterial('stone');
      
      expect(result.valid).toBe(true);
      expect(result.materialId).toBe('stone');
    });

    it('should validate all materials', () => {
      manager.registerMaterials([
        createTestMaterial('stone', 0),
        createTestMaterial('cobblestone', 1),
      ]);
      
      const results = manager.validateAllMaterials();
      
      expect(results.size).toBe(2);
      expect(results.get('stone')?.valid).toBe(true);
      expect(results.get('cobblestone')?.valid).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should return resource stats', () => {
      manager.registerMaterials([
        createTestMaterial('stone', 0),
        createTestMaterial('cobblestone', 1),
      ]);
      
      const stats = manager.getStats();
      
      expect(stats.materials.total).toBe(2);
      expect(stats.materials.byStatus.pending).toBe(2);
    });

    it('should return memory usage', () => {
      const usage = manager.getMemoryUsage();
      
      expect(usage.cacheUsed).toBeDefined();
      expect(usage.cacheMax).toBeGreaterThan(0);
      expect(typeof usage.cachePercent).toBe('number');
    });
  });

  describe('Diagnostics', () => {
    it('should run full diagnostics', () => {
      manager.registerMaterial(createTestMaterial('stone', 0));
      
      const report = manager.runDiagnostics();
      
      expect(report.stats).toBeDefined();
      expect(report.validation).toBeDefined();
      expect(report.missingTextures).toBeDefined();
    });

    it('should subscribe to errors', () => {
      const errorHandler = vi.fn();
      const unsubscribe = manager.onError(errorHandler);
      
      // Trigger an error through diagnostics
      manager.diagnostics.recordError({
        type: 'material',
        id: 'test',
        message: 'Test error',
      });
      
      expect(errorHandler).toHaveBeenCalledTimes(1);
      
      unsubscribe();
    });

    it('should subscribe to warnings', () => {
      const warningHandler = vi.fn();
      const unsubscribe = manager.onWarning(warningHandler);
      
      // Trigger a warning
      manager.diagnostics.recordWarning({
        type: 'general',
        id: 'test',
        message: 'Test warning',
      });
      
      expect(warningHandler).toHaveBeenCalledTimes(1);
      
      unsubscribe();
    });
  });

  describe('Cache Operations', () => {
    it('should clear cache', () => {
      manager.clearCache();
      
      const stats = manager.getStats();
      expect(stats.textures.cached).toBe(0);
    });

    it('should defragment cache', () => {
      const removed = manager.defragmentCache();
      
      expect(typeof removed).toBe('number');
    });
  });

  describe('Streaming Operations', () => {
    beforeEach(() => {
      manager.initialize(mockDevice);
    });

    it('should register streaming texture', () => {
      manager.registerStreamingTexture('test', '/textures/test.png');
      
      const stats = manager.streaming?.getStats();
      expect(stats?.textureCount).toBe(1);
    });

    it('should update streaming each frame', () => {
      manager.registerStreamingTexture('test', '/textures/test.png');
      
      // Should not throw
      manager.updateStreaming();
    });

    it('should update texture distance', () => {
      manager.registerStreamingTexture('test', '/textures/test.png', 100);
      manager.updateTextureDistance('test', 50);
      
      // Should update without throwing
    });
  });

  describe('Lifecycle', () => {
    it('should dispose all resources', () => {
      manager.initialize(mockDevice);
      manager.registerMaterial(createTestMaterial('stone', 0));
      
      manager.dispose();
      
      expect(manager.isInitialized).toBe(false);
      expect(manager.device).toBeNull();
      expect(manager.materials.count).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      const customManager = new ResourceManager({
        cache: {
          maxMemoryBytes: 128 * 1024 * 1024,
          maxTextures: 500,
          enableLRU: true,
          evictionTimeout: 15000,
        },
        diagnostics: {
          logLevel: 'error',
          enableConsoleLogging: false,
        },
      });
      
      expect(customManager).toBeDefined();
      
      customManager.dispose();
    });
  });
});

