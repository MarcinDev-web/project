import { describe, it, expect } from 'vitest';
import { TerrainComponent, TerrainData } from './TerrainComponent.js';

describe('TerrainComponent', () => {
  it('initializes with default values', () => {
    const component = new TerrainComponent();
    expect(component.terrainData.type).toBe('heightmap');
    expect(component.terrainData.metadata).toBeDefined();
  });

  it('clones and serializes heightmap data', () => {
    const component = new TerrainComponent();
    const heightmapData = {
      resolution: 2,
      size: 10,
      heights: new Float32Array([0, 1, 2, 3]),
      minHeight: 0,
      maxHeight: 3,
    };
    component.terrainData = {
      type: 'heightmap',
      heightmap: heightmapData,
    };

    // Clone
    const clone = component.clone();
    expect(clone).not.toBe(component);
    expect(clone.terrainData.type).toBe('heightmap');
    expect(clone.terrainData.heightmap).toEqual(heightmapData);
    expect(clone.terrainData.heightmap?.heights).toBeInstanceOf(Float32Array);
    expect(clone.terrainData.heightmap?.heights).not.toBe(heightmapData.heights); // Deep copy

    // Serialize
    const json = component.toJSON();
    expect(json.type).toBe('heightmap');
    expect(Array.isArray(json.heightmap?.heights)).toBe(true); // Should be array, not typed array
    expect(json.heightmap?.heights).toEqual([0, 1, 2, 3]);

    // Deserialize
    const restored = new TerrainComponent();
    restored.fromJSON(json);
    expect(restored.terrainData.type).toBe('heightmap');
    expect(restored.terrainData.heightmap).toEqual(heightmapData);
    expect(restored.terrainData.heightmap?.heights).toBeInstanceOf(Float32Array);
  });

  it('clones and serializes voxel data', () => {
    const component = new TerrainComponent();
    const chunks = new Map<string, Uint8Array>();
    chunks.set('0,0,0', new Uint8Array([1, 2, 3]));
    
    component.terrainData = {
      type: 'voxel',
      voxels: {
        chunkSize: 16,
        chunks: chunks,
      },
    };

    // Clone
    const clone = component.clone();
    expect(clone.terrainData.type).toBe('voxel');
    expect(clone.terrainData.voxels?.chunkSize).toBe(16);
    expect(clone.terrainData.voxels?.chunks.get('0,0,0')).toEqual(new Uint8Array([1, 2, 3]));
    expect(clone.terrainData.voxels?.chunks).not.toBe(chunks); // Deep copy

    // Serialize
    const json = component.toJSON();
    expect(json.type).toBe('voxel');
    expect(json.voxels?.chunks).toBeInstanceOf(Array);
    expect(json.voxels?.chunks[0]).toEqual(['0,0,0', [1, 2, 3]]);

    // Deserialize
    const restored = new TerrainComponent();
    restored.fromJSON(json);
    expect(restored.terrainData.type).toBe('voxel');
    expect(restored.terrainData.voxels?.chunks.get('0,0,0')).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('clones and serializes texture layers', () => {
    const component = new TerrainComponent();
    component.terrainData = {
      type: 'heightmap',
      textureLayers: [
        {
          textureId: 'grass',
          scale: 1,
          blendFactor: new Float32Array([0.5, 0.5]),
        },
      ],
    };

    // Clone
    const clone = component.clone();
    expect(clone.terrainData.textureLayers?.[0].textureId).toBe('grass');
    expect(clone.terrainData.textureLayers?.[0].blendFactor).toBeInstanceOf(Float32Array);

    // Serialize
    const json = component.toJSON();
    expect(Array.isArray(json.textureLayers?.[0].blendFactor)).toBe(true);

    // Deserialize
    const restored = new TerrainComponent();
    restored.fromJSON(json);
    expect(restored.terrainData.textureLayers?.[0].blendFactor).toBeInstanceOf(Float32Array);
  });

  it('validates heightmap resolution on deserialization', () => {
    const component = new TerrainComponent();
    const invalidData = {
      type: 'heightmap' as const,
      heightmap: {
        resolution: 2,
        size: 10,
        heights: [0, 1, 2], // Should be 4 elements (2x2)
      },
    };

    // We expect this to warn or throw, or handle gracefully. 
    // For now, let's assume we want it to throw or at least we test the validation logic we are about to add.
    // Since we haven't added validation yet, this test might fail or pass depending on current implementation (which has no validation).
    // We will implement validation to throw an error.
    
    expect(() => component.fromJSON(invalidData)).toThrow();
  });
});

