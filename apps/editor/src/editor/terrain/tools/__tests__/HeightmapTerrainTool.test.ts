import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeightmapTerrainTool } from '../HeightmapTerrainTool';
import { Scene, Entity } from '@engine/world';
import { TerrainComponent } from '@engine/world/components/TerrainComponent';
import { MeshComponent } from '@engine/world/components/MeshComponent';

// Mock dependencies
vi.mock('@engine/world', () => {
  return {
    Scene: vi.fn().mockImplementation(() => ({
      createEntity: vi.fn(),
    })),
    Entity: vi.fn().mockImplementation(() => ({
      addComponent: vi.fn(),
      getComponent: vi.fn(),
    })),
  };
});

// Manual mock for HeightmapTerrain to ensure new methods are available
vi.mock('@engine/voxel/terrain', () => {
  return {
    HeightmapTerrain: class {
      config: any;
      heights: Float32Array;
      
      static isValidResolution(n: number) { 
        return n > 1 && ((n - 1) & ((n - 1) - 1)) === 0;
      }
      
      constructor(config: any) {
        this.config = config;
        this.heights = new Float32Array(config.resolution * config.resolution);
      }
      
      useData(data: any) { 
        this.config = data;
        this.heights = data.heights;
      }
      
      generateNoise(scale: number, amplitude: number) {
        // Simple mock implementation that modifies heights
        for(let i=0; i<this.heights.length; i++) {
          this.heights[i] = 10; // Set to non-zero
        }
      }
      
      smooth(iterations: number) {
        // Simple mock implementation
        for(let i=0; i<this.heights.length; i++) {
          this.heights[i] = this.heights[i] * 0.5;
        }
      }
      
      getHeights() { return this.heights; }
      
      exportData() { 
        return {
          ...this.config,
          heights: this.heights
        }; 
      }
      
      markClean() {}
      
      importData(data: any) {
        this.config = data;
        this.heights = new Float32Array(data.heights);
      }
    },
    TerrainMeshGenerator: {
      generate: vi.fn().mockReturnValue({
        vertices: new Float32Array(0),
        indices: new Uint32Array(0),
      }),
    },
  };
});

describe('HeightmapTerrainTool', () => {
  let tool: HeightmapTerrainTool;
  let scene: Scene;
  let entity: Entity;
  let terrainComponent: TerrainComponent;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup scene and entity mocks
    scene = new Scene();
    entity = new Entity();
    
    (scene.createEntity as any).mockReturnValue(entity);
    
    // Setup component mocks
    terrainComponent = new TerrainComponent();
    terrainComponent.terrainData = {
      type: 'heightmap',
      heightmap: {
        resolution: 65,
        size: 100,
        heights: new Float32Array(65 * 65),
        minHeight: 0,
        maxHeight: 100,
      },
    };

    (entity.addComponent as any).mockImplementation((comp: any) => {
      if (comp instanceof TerrainComponent) return terrainComponent;
      return comp;
    });

    (entity.getComponent as any).mockImplementation((compClass: any) => {
      if (compClass === TerrainComponent) return terrainComponent;
      return null;
    });

    tool = new HeightmapTerrainTool(scene);
  });

  it('should create terrain with valid config', () => {
    const config = {
      resolution: 65,
      size: 100,
      minHeight: 0,
      maxHeight: 100,
    };

    const result = tool.createTerrain(config);

    expect(scene.createEntity).toHaveBeenCalledWith('Terrain');
    expect(entity.addComponent).toHaveBeenCalled();
    expect(result).toBe(entity);
  });

  it('should apply noise to terrain', () => {
    // Setup initial terrain data
    const resolution = 65;
    const size = 100;
    terrainComponent.terrainData.heightmap = {
      resolution,
      size,
      heights: new Float32Array(resolution * resolution),
      minHeight: 0,
      maxHeight: 100,
    };

    tool.applyNoise(entity, 5, 10);

    // Check if heights were modified (our mock sets them to 10)
    const heights = terrainComponent.terrainData.heightmap.heights;
    expect(heights[0]).toBe(10);
  });

  it('should apply smooth to terrain', () => {
    // Setup terrain
    const resolution = 65;
    const size = 100;
    const heights = new Float32Array(resolution * resolution);
    heights.fill(100);

    terrainComponent.terrainData.heightmap = {
      resolution,
      size,
      heights,
      minHeight: 0,
      maxHeight: 100,
    };

    tool.applySmooth(entity, 1);

    // Check if smoothed (our mock multiplies by 0.5)
    expect(heights[0]).toBe(50);
  });

  it('should update mesh when modifying terrain', () => {
    const resolution = 65;
    const size = 100;
    terrainComponent.terrainData.heightmap = {
      resolution,
      size,
      heights: new Float32Array(resolution * resolution),
      minHeight: 0,
      maxHeight: 100,
    };

    tool.applyNoise(entity, 5, 10);

    // Check if TerrainMeshGenerator.generate was called
    const { TerrainMeshGenerator } = require('@engine/voxel/terrain');
    expect(TerrainMeshGenerator.generate).toHaveBeenCalled();
  });
});
