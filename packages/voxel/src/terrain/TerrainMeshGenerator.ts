/**
 * TerrainMeshGenerator - Generates mesh data from heightmap terrain
 *
 * Creates vertices, indices, normals, and UVs for terrain rendering.
 */

import type { Vec3 } from '@engine/core/math';
import type { HeightmapTerrainData } from '@engine/world/components/TerrainComponent';
import { crossVec3, normalizeVec3, subVec3 } from '@engine/core/math';

/**
 * Generated mesh data
 */
export interface TerrainMeshData {
  vertices: Float32Array;
  indices: Uint16Array;
  normals: Float32Array;
  uvs: Float32Array;
  vertexCount: number;
  indexCount: number;
}

/**
 * Options for mesh generation
 */
export interface TerrainMeshOptions {
  /** Level of detail (1 = full detail, 2 = half, 4 = quarter, etc.) */
  lod?: number;
  /** Generate normals (required for lighting) */
  generateNormals?: boolean;
  /** Generate UVs (required for texturing) */
  generateUVs?: boolean;
}

/**
 * TerrainMeshGenerator - Generates mesh from heightmap data
 */
export class TerrainMeshGenerator {
  /**
   * Generates mesh data from heightmap terrain
   */
  static generate(
    heightmapData: HeightmapTerrainData,
    options: TerrainMeshOptions = {}
  ): TerrainMeshData {
    const {
      lod = 1,
      generateNormals = true,
      generateUVs = true,
    } = options;

    const { resolution, size } = heightmapData;
    const { heights } = heightmapData;

    // Calculate effective resolution based on LOD
    const effectiveResolution = Math.max(2, Math.floor(resolution / lod));
    const step = lod;

    // Calculate vertex and index counts
    const vertexCount = effectiveResolution * effectiveResolution;
    const indexCount = (effectiveResolution - 1) * (effectiveResolution - 1) * 6;

    // Allocate arrays
    const vertices = new Float32Array(vertexCount * 3);
    const indices = new Uint16Array(indexCount);
    const normals = generateNormals ? new Float32Array(vertexCount * 3) : new Float32Array(0);
    const uvs = generateUVs ? new Float32Array(vertexCount * 2) : new Float32Array(0);

    const halfSize = size * 0.5;
    const scale = size / (resolution - 1);

    // Generate vertices
    let vertexIndex = 0;
    for (let z = 0; z < effectiveResolution; z++) {
      const gridZ = z * step;
      for (let x = 0; x < effectiveResolution; x++) {
        const gridX = x * step;

        // Clamp to valid range
        const clampedX = Math.min(gridX, resolution - 1);
        const clampedZ = Math.min(gridZ, resolution - 1);

        const heightIndex = clampedZ * resolution + clampedX;
        const height = heights[heightIndex]!;

        // World position
        const worldX = -halfSize + clampedX * scale;
        const worldZ = -halfSize + clampedZ * scale;

        // Store vertex
        vertices[vertexIndex * 3] = worldX;
        vertices[vertexIndex * 3 + 1] = height;
        vertices[vertexIndex * 3 + 2] = worldZ;

        // Generate UVs
        if (generateUVs) {
          uvs[vertexIndex * 2] = clampedX / (resolution - 1);
          uvs[vertexIndex * 2 + 1] = clampedZ / (resolution - 1);
        }

        vertexIndex++;
      }
    }

    // Generate indices (two triangles per quad)
    let indexIndex = 0;
    for (let z = 0; z < effectiveResolution - 1; z++) {
      for (let x = 0; x < effectiveResolution - 1; x++) {
        const topLeft = z * effectiveResolution + x;
        const topRight = topLeft + 1;
        const bottomLeft = (z + 1) * effectiveResolution + x;
        const bottomRight = bottomLeft + 1;

        // First triangle (top-left, top-right, bottom-left)
        indices[indexIndex++] = topLeft;
        indices[indexIndex++] = topRight;
        indices[indexIndex++] = bottomLeft;

        // Second triangle (top-right, bottom-right, bottom-left)
        indices[indexIndex++] = topRight;
        indices[indexIndex++] = bottomRight;
        indices[indexIndex++] = bottomLeft;
      }
    }

    // Generate normals
    if (generateNormals) {
      TerrainMeshGenerator.calculateNormals(vertices, indices, normals, vertexCount);
    }

    return {
      vertices,
      indices,
      normals,
      uvs,
      vertexCount,
      indexCount,
    };
  }

  /**
   * Calculates normals from vertices and indices
   */
  private static calculateNormals(
    vertices: Float32Array,
    indices: Uint16Array,
    normals: Float32Array,
    vertexCount: number
  ): void {
    // Initialize normals to zero
    for (let i = 0; i < vertexCount * 3; i++) {
      normals[i] = 0;
    }

    // Calculate face normals and accumulate to vertex normals
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i]! * 3;
      const i1 = indices[i + 1]! * 3;
      const i2 = indices[i + 2]! * 3;

      const v0: Vec3 = [vertices[i0]!, vertices[i0 + 1]!, vertices[i0 + 2]!];
      const v1: Vec3 = [vertices[i1]!, vertices[i1 + 1]!, vertices[i1 + 2]!];
      const v2: Vec3 = [vertices[i2]!, vertices[i2 + 1]!, vertices[i2 + 2]!];

      // Calculate face normal
      const edge1 = subVec3(v1, v0);
      const edge2 = subVec3(v2, v0);
      const normal = crossVec3(edge1, edge2);
      const normalized = normalizeVec3(normal);

      // Accumulate to vertex normals
      normals[i0]! += normalized[0];
      normals[i0 + 1]! += normalized[1];
      normals[i0 + 2]! += normalized[2];

      normals[i1]! += normalized[0];
      normals[i1 + 1]! += normalized[1];
      normals[i1 + 2]! += normalized[2];

      normals[i2]! += normalized[0];
      normals[i2 + 1]! += normalized[1];
      normals[i2 + 2]! += normalized[2];
    }

    // Normalize all vertex normals
    for (let i = 0; i < vertexCount; i++) {
      const nx = normals[i * 3]!;
      const ny = normals[i * 3 + 1]!;
      const nz = normals[i * 3 + 2]!;

      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (length > 0.0001) {
        normals[i * 3] = nx / length;
        normals[i * 3 + 1] = ny / length;
        normals[i * 3 + 2] = nz / length;
      } else {
        // Fallback to up vector
        normals[i * 3] = 0;
        normals[i * 3 + 1] = 1;
        normals[i * 3 + 2] = 0;
      }
    }
  }

  /**
   * Updates mesh data (for incremental updates during sculpting)
   * Only updates vertices and normals in specified region
   */
  static updateRegion(
    meshData: TerrainMeshData,
    heightmapData: HeightmapTerrainData,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    options: TerrainMeshOptions = {}
  ): void {
    const { resolution, size } = heightmapData;
    const { heights } = heightmapData;
    const { lod = 1 } = options;

    const effectiveResolution = Math.max(2, Math.floor(resolution / lod));
    const step = lod;
    const halfSize = size * 0.5;
    const scale = size / (resolution - 1);

    // Convert world bounds to grid coordinates
    const gridMinX = Math.max(0, Math.floor((minX + halfSize) / scale));
    const gridMaxX = Math.min(resolution - 1, Math.ceil((maxX + halfSize) / scale));
    const gridMinZ = Math.max(0, Math.floor((minZ + halfSize) / scale));
    const gridMaxZ = Math.min(resolution - 1, Math.ceil((maxZ + halfSize) / scale));

    // Update vertices in affected region
    for (let z = 0; z < effectiveResolution; z++) {
      const gridZ = z * step;
      if (gridZ < gridMinZ || gridZ > gridMaxZ) continue;

      for (let x = 0; x < effectiveResolution; x++) {
        const gridX = x * step;
        if (gridX < gridMinX || gridX > gridMaxX) continue;

        const vertexIndex = z * effectiveResolution + x;
        const heightIndex = gridZ * resolution + gridX;
        const height = heights[heightIndex]!;

        meshData.vertices[vertexIndex * 3 + 1] = height;
      }
    }

    // Recalculate normals for affected region (simplified - recalc all)
    if (options.generateNormals !== false && meshData.normals.length > 0) {
      TerrainMeshGenerator.calculateNormals(
        meshData.vertices,
        meshData.indices,
        meshData.normals,
        meshData.vertexCount
      );
    }
  }
}

