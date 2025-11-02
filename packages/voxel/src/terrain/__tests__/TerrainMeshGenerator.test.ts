import { describe, it, expect } from 'vitest';
import { TerrainMeshGenerator } from '../TerrainMeshGenerator';
import type { HeightmapTerrainData } from '@engine/world/components/TerrainComponent';

describe('TerrainMeshGenerator', () => {
  const createTestHeightmap = (resolution: number): HeightmapTerrainData => {
    const heights = new Float32Array(resolution * resolution);
    for (let i = 0; i < heights.length; i++) {
      heights[i] = 0;
    }

    return {
      resolution,
      size: 100,
      heights,
      minHeight: 0,
      maxHeight: 100,
    };
  };

  it('should generate mesh data', () => {
    const heightmap = createTestHeightmap(65);
    const meshData = TerrainMeshGenerator.generate(heightmap);

    expect(meshData.vertices.length).toBeGreaterThan(0);
    expect(meshData.indices.length).toBeGreaterThan(0);
    expect(meshData.normals.length).toBeGreaterThan(0);
    expect(meshData.uvs.length).toBeGreaterThan(0);
  });

  it('should generate correct vertex count', () => {
    const heightmap = createTestHeightmap(65);
    const meshData = TerrainMeshGenerator.generate(heightmap);

    expect(meshData.vertexCount).toBe(65 * 65);
    expect(meshData.vertices.length).toBe(65 * 65 * 3);
  });

  it('should generate correct index count', () => {
    const heightmap = createTestHeightmap(65);
    const meshData = TerrainMeshGenerator.generate(heightmap);

    // (resolution - 1) * (resolution - 1) * 2 triangles * 3 indices
    const expectedIndices = (65 - 1) * (65 - 1) * 6;
    expect(meshData.indexCount).toBe(expectedIndices);
    expect(meshData.indices.length).toBe(expectedIndices);
  });

  it('should generate normals', () => {
    const heightmap = createTestHeightmap(65);
    const meshData = TerrainMeshGenerator.generate(heightmap, {
      generateNormals: true,
    });

    expect(meshData.normals.length).toBe(meshData.vertexCount * 3);
    
    // Check that normals are normalized (length ≈ 1)
    for (let i = 0; i < meshData.vertexCount; i++) {
      const nx = meshData.normals[i * 3]!;
      const ny = meshData.normals[i * 3 + 1]!;
      const nz = meshData.normals[i * 3 + 2]!;
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      expect(length).toBeCloseTo(1, 1);
    }
  });

  it('should generate UVs', () => {
    const heightmap = createTestHeightmap(65);
    const meshData = TerrainMeshGenerator.generate(heightmap, {
      generateUVs: true,
    });

    expect(meshData.uvs.length).toBe(meshData.vertexCount * 2);
    
    // Check UV range [0, 1]
    for (let i = 0; i < meshData.vertexCount; i++) {
      const u = meshData.uvs[i * 2]!;
      const v = meshData.uvs[i * 2 + 1]!;
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('should support LOD', () => {
    const heightmap = createTestHeightmap(129);
    const meshDataLOD1 = TerrainMeshGenerator.generate(heightmap, { lod: 1 });
    const meshDataLOD2 = TerrainMeshGenerator.generate(heightmap, { lod: 2 });

    // LOD 2 should have fewer vertices
    expect(meshDataLOD2.vertexCount).toBeLessThan(meshDataLOD1.vertexCount);
    expect(meshDataLOD2.indexCount).toBeLessThan(meshDataLOD1.indexCount);
  });
});

