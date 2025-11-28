/**
 * TerrainMeshGenerator - Generates mesh data from heightmap terrain
 *
 * Creates vertices, indices, normals, and UVs for terrain rendering.
 */

import type { Vec3 } from '@engine/core/math';
import type { HeightmapTerrainData } from '@engine/world/components/TerrainComponent';
import { crossVec3, normalizeVec3, subVec3 } from '@engine/core/math';
import { init as initMeshProcessor, type WasmMeshProcessor } from '@engine/wasm-mesh';
import { init as initVoxelEngine, type WasmVoxelEngine } from '@engine/wasm-voxel';

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
  /** Use box projection for UVs (requires normals, uses WASM if available) */
  useBoxProjection?: boolean;
}

/**
 * TerrainMeshGenerator - Generates mesh from heightmap data
 */
export class TerrainMeshGenerator {
  private static wasmProcessor: WasmMeshProcessor | null = null;
  private static wasmVoxelEngine: WasmVoxelEngine | null = null;

  /**
   * Initialize WASM processor
   */
  static async init(): Promise<void> {
    if (!this.wasmProcessor) {
      try {
        this.wasmProcessor = await initMeshProcessor();
      } catch (e) {
        console.warn('Failed to load WASM mesh processor, falling back to JS', e);
      }
    }
    if (!this.wasmVoxelEngine) {
      try {
        this.wasmVoxelEngine = await initVoxelEngine();
      } catch (e) {
        console.warn('Failed to load WASM voxel engine, falling back to JS', e);
      }
    }
  }

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

    // Apply box projection if requested (better for steep terrain/cliffs)
    if (generateUVs && options.useBoxProjection && generateNormals) {
      if (TerrainMeshGenerator.wasmProcessor) {
        try {
          const result = TerrainMeshGenerator.wasmProcessor.computeUvsBox(vertices, normals);
          uvs.set(result);
        } catch (e) {
          console.warn('WASM box UV projection failed', e);
        }
      }
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
    // Try WASM first
    if (TerrainMeshGenerator.wasmProcessor) {
      try {
        const result = TerrainMeshGenerator.wasmProcessor.computeNormalsU16(vertices, indices);
        normals.set(result);
        return;
      } catch (e) {
        console.warn('WASM normal calculation failed, falling back to JS', e);
      }
    }

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
   * 
   * Performance optimization: Uses incremental normal calculation that only
   * processes the affected region + 1-ring neighborhood instead of entire mesh.
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

    // Recalculate normals for affected region only (incremental update)
    if (options.generateNormals !== false && meshData.normals.length > 0) {
      TerrainMeshGenerator.calculateNormalsRegion(
        meshData.vertices,
        meshData.indices,
        meshData.normals,
        effectiveResolution,
        Math.floor(gridMinX / step),
        Math.ceil(gridMaxX / step),
        Math.floor(gridMinZ / step),
        Math.ceil(gridMaxZ / step)
      );
    }
  }

  /**
   * Calculates normals for a specific region of a terrain grid (incremental update)
   * 
   * Optimized for terrain sculpting - only processes triangles touching the
   * affected region and vertices in the region + 1-ring neighborhood.
   * 
   * @param vertices - All vertex positions
   * @param indices - All triangle indices
   * @param normals - Normals buffer (modified in-place)
   * @param resolution - Grid resolution (vertices per side)
   * @param minX - Minimum grid X coordinate of affected region
   * @param maxX - Maximum grid X coordinate of affected region
   * @param minZ - Minimum grid Z coordinate of affected region
   * @param maxZ - Maximum grid Z coordinate of affected region
   */
  private static calculateNormalsRegion(
    vertices: Float32Array,
    indices: Uint16Array,
    normals: Float32Array,
    resolution: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number
  ): void {
    // Clamp coordinates to valid range
    const clampedMinX = Math.max(0, minX);
    const clampedMaxX = Math.min(resolution - 1, maxX);
    const clampedMinZ = Math.max(0, minZ);
    const clampedMaxZ = Math.min(resolution - 1, maxZ);

    // Try WASM first for incremental update
    if (TerrainMeshGenerator.wasmProcessor) {
      try {
        TerrainMeshGenerator.wasmProcessor.computeNormalsRegionU16(
          vertices,
          indices,
          normals,
          resolution,
          clampedMinX,
          clampedMaxX,
          clampedMinZ,
          clampedMaxZ
        );
        return;
      } catch (e) {
        console.warn('WASM incremental normal calculation failed, falling back to JS', e);
      }
    }

    // JavaScript fallback implementation
    TerrainMeshGenerator.calculateNormalsRegionJS(
      vertices,
      normals,
      resolution,
      clampedMinX,
      clampedMaxX,
      clampedMinZ,
      clampedMaxZ
    );
  }

  /**
   * JavaScript fallback for incremental normal calculation
   */
  private static calculateNormalsRegionJS(
    vertices: Float32Array,
    normals: Float32Array,
    resolution: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number
  ): void {
    // Expand region by 1 for neighbor influence
    const expandedMinX = Math.max(0, minX - 1);
    const expandedMaxX = Math.min(resolution - 1, maxX + 1);
    const expandedMinZ = Math.max(0, minZ - 1);
    const expandedMaxZ = Math.min(resolution - 1, maxZ + 1);

    // Local accumulator for affected vertices
    const regionWidth = expandedMaxX - expandedMinX + 1;
    const regionHeight = expandedMaxZ - expandedMinZ + 1;
    const localNormals = new Float32Array(regionWidth * regionHeight * 3);

    // Helper to convert grid coords to vertex index
    const gridToVertex = (x: number, z: number) => z * resolution + x;

    // Helper to check if vertex is in expanded region
    const inExpandedRegion = (x: number, z: number) =>
      x >= expandedMinX && x <= expandedMaxX && z >= expandedMinZ && z <= expandedMaxZ;

    // Helper to convert to local index
    const toLocalIndex = (x: number, z: number) =>
      ((z - expandedMinZ) * regionWidth + (x - expandedMinX)) * 3;

    // Process quads that touch the affected region
    const quadMinX = Math.max(0, expandedMinX - 1);
    const quadMaxX = Math.min(resolution - 2, expandedMaxX);
    const quadMinZ = Math.max(0, expandedMinZ - 1);
    const quadMaxZ = Math.min(resolution - 2, expandedMaxZ);

    for (let qz = quadMinZ; qz <= quadMaxZ; qz++) {
      for (let qx = quadMinX; qx <= quadMaxX; qx++) {
        // Quad vertices
        const tl = gridToVertex(qx, qz);
        const tr = gridToVertex(qx + 1, qz);
        const bl = gridToVertex(qx, qz + 1);
        const br = gridToVertex(qx + 1, qz + 1);

        // Get positions
        const pTl: Vec3 = [vertices[tl * 3]!, vertices[tl * 3 + 1]!, vertices[tl * 3 + 2]!];
        const pTr: Vec3 = [vertices[tr * 3]!, vertices[tr * 3 + 1]!, vertices[tr * 3 + 2]!];
        const pBl: Vec3 = [vertices[bl * 3]!, vertices[bl * 3 + 1]!, vertices[bl * 3 + 2]!];
        const pBr: Vec3 = [vertices[br * 3]!, vertices[br * 3 + 1]!, vertices[br * 3 + 2]!];

        // Triangle 1: tl, tr, bl
        const edge1T1 = subVec3(pTr, pTl);
        const edge2T1 = subVec3(pBl, pTl);
        const normalT1 = crossVec3(edge1T1, edge2T1);

        // Triangle 2: tr, br, bl
        const edge1T2 = subVec3(pBr, pTr);
        const edge2T2 = subVec3(pBl, pTr);
        const normalT2 = crossVec3(edge1T2, edge2T2);

        // Accumulate normals for Triangle 1
        if (inExpandedRegion(qx, qz)) {
          const idx = toLocalIndex(qx, qz);
          localNormals[idx]! += normalT1[0];
          localNormals[idx + 1]! += normalT1[1];
          localNormals[idx + 2]! += normalT1[2];
        }
        if (inExpandedRegion(qx + 1, qz)) {
          const idx = toLocalIndex(qx + 1, qz);
          localNormals[idx]! += normalT1[0];
          localNormals[idx + 1]! += normalT1[1];
          localNormals[idx + 2]! += normalT1[2];
        }
        if (inExpandedRegion(qx, qz + 1)) {
          const idx = toLocalIndex(qx, qz + 1);
          localNormals[idx]! += normalT1[0];
          localNormals[idx + 1]! += normalT1[1];
          localNormals[idx + 2]! += normalT1[2];
        }

        // Accumulate normals for Triangle 2
        if (inExpandedRegion(qx + 1, qz)) {
          const idx = toLocalIndex(qx + 1, qz);
          localNormals[idx]! += normalT2[0];
          localNormals[idx + 1]! += normalT2[1];
          localNormals[idx + 2]! += normalT2[2];
        }
        if (inExpandedRegion(qx + 1, qz + 1)) {
          const idx = toLocalIndex(qx + 1, qz + 1);
          localNormals[idx]! += normalT2[0];
          localNormals[idx + 1]! += normalT2[1];
          localNormals[idx + 2]! += normalT2[2];
        }
        if (inExpandedRegion(qx, qz + 1)) {
          const idx = toLocalIndex(qx, qz + 1);
          localNormals[idx]! += normalT2[0];
          localNormals[idx + 1]! += normalT2[1];
          localNormals[idx + 2]! += normalT2[2];
        }
      }
    }

    // Normalize and write back to the normals buffer
    for (let z = expandedMinZ; z <= expandedMaxZ; z++) {
      for (let x = expandedMinX; x <= expandedMaxX; x++) {
        const localIdx = toLocalIndex(x, z);
        const vertexIdx = gridToVertex(x, z);

        const nx = localNormals[localIdx]!;
        const ny = localNormals[localIdx + 1]!;
        const nz = localNormals[localIdx + 2]!;

        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (length > 0.0001) {
          normals[vertexIdx * 3] = nx / length;
          normals[vertexIdx * 3 + 1] = ny / length;
          normals[vertexIdx * 3 + 2] = nz / length;
        } else {
          // Fallback to up vector
          normals[vertexIdx * 3] = 0;
          normals[vertexIdx * 3 + 1] = 1;
          normals[vertexIdx * 3 + 2] = 0;
        }
      }
    }
  }
}

