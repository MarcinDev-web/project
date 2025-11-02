/**
 * GeometryCache - Manages GPU buffers for custom mesh geometries
 * 
 * Handles caching and reuse of geometry buffers for entities with meshData.
 * Supports multiple custom geometries per frame (sphere, avatar_torso, etc.)
 */

import type { CustomMeshData } from '@engine/world';
import { createGeometryBuffers, packVerticesFloat32ToPacked24 } from '../resources/resources';

// Type for geometry buffers returned by createGeometryBuffers
type GeometryBuffers = {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  instanceOffsetBuffer: GPUBuffer;
  instanceColorScaleBuffer: GPUBuffer;
  instanceSecondaryColorBuffer: GPUBuffer;
  instanceEmissiveColorBuffer: GPUBuffer;
  instanceMaterialParamsBuffer: GPUBuffer;
  instanceRotationBuffer: GPUBuffer;
  instanceMaterialIdBuffer: GPUBuffer;
};

interface CachedGeometry {
  buffers: GeometryBuffers;
  vertexCount: number;
  indexCount: number;
  lastUsed: number;
}

/**
 * Cache key for geometry - based on meshData content
 */
function getGeometryKey(meshData: CustomMeshData): string {
  if (!meshData.vertices || !meshData.indices) {
    return 'invalid';
  }
  // Use length as simple key (could hash content for more accuracy)
  return `${meshData.vertices.byteLength}-${meshData.indices.byteLength}`;
}

/**
 * Silently validates geometry data without logging errors.
 * Returns true if geometry is valid, false otherwise.
 */
function isValidGeometrySilent(vertices: Uint8Array, indices: Uint16Array): boolean {
  const strideBytes = 24;
  const numVertices = vertices.byteLength / strideBytes;

  // Check vertex buffer alignment
  if (!Number.isInteger(numVertices) || numVertices === 0) {
    return false;
  }

  // Check index buffer alignment
  if (indices.byteLength % 2 !== 0) {
    return false;
  }

  // Check indices count is multiple of 3 (triangles)
  if (indices.length % 3 !== 0) {
    return false;
  }

  // Check indices reference valid vertices
  if (!indices.every((i) => i >= 0 && i < numVertices)) {
    return false;
  }

  // Check for degenerate triangles (basic check - skip if vertices overlap)
  const eps = 1e-10;
  const dv = new DataView(vertices.buffer as ArrayBuffer, vertices.byteOffset, vertices.byteLength);
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const ia = indices[i]! * strideBytes;
    const ib = indices[i + 1]! * strideBytes;
    const ic = indices[i + 2]! * strideBytes;
    
    if (ic + 12 > vertices.byteLength) {
      return false;
    }

    const ax = dv.getFloat32(ia + 0, true);
    const ay = dv.getFloat32(ia + 4, true);
    const az = dv.getFloat32(ia + 8, true);
    const bx = dv.getFloat32(ib + 0, true);
    const by = dv.getFloat32(ib + 4, true);
    const bz = dv.getFloat32(ib + 8, true);
    const cx = dv.getFloat32(ic + 0, true);
    const cy = dv.getFloat32(ic + 4, true);
    const cz = dv.getFloat32(ic + 8, true);
    
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;
    const cxX = aby * acz - abz * acy;
    const cxY = abz * acx - abx * acz;
    const cxZ = abx * acy - aby * acx;
    const area2 = cxX * cxX + cxY * cxY + cxZ * cxZ;
    
    if (!(area2 > eps)) {
      return false; // Degenerate triangle
    }
  }

  return true;
}

/**
 * GeometryCache manages GPU buffers for custom mesh geometries.
 * Reuses buffers when multiple entities share the same geometry.
 */
export class GeometryCache {
  private cache = new Map<string, CachedGeometry>();
  private frameCounter = 0;
  private readonly maxCacheSize = 50; // Maximum number of cached geometries

  /**
   * Get or create geometry buffers for custom mesh data
   */
  getGeometryBuffers(
    device: GPUDevice, // WebGPU API type
    meshData: CustomMeshData
  ): (GeometryBuffers & { vertexCount: number; indexCount: number }) | null {
    if (!meshData.vertices || !meshData.indices) {
      return null;
    }

    const key = getGeometryKey(meshData);
    let cached = this.cache.get(key);

    if (cached) {
      cached.lastUsed = this.frameCounter;
      return {
        ...cached.buffers,
        vertexCount: cached.vertexCount,
        indexCount: cached.indexCount,
      };
    }

    // Create new geometry buffers
    try {
      // Convert CustomMeshData to GeometryData format
      // CustomMeshData has interleaved vertices (x,y,z,nx,ny,nz per vertex)
      const vertexData = meshData.vertices;
      const indices = meshData.indices;

      // Pack vertices to packed format (24-bit) if needed
      // Format: Float32Array with 8 floats per vertex: [x,y,z, nx,ny,nz, u,v]
      let packedVertices: Uint8Array;
      if (vertexData instanceof Float32Array) {
        // Convert Float32Array (8 floats per vertex: pos(3) + normal(3) + uv(2)) to packed format
        packedVertices = packVerticesFloat32ToPacked24(vertexData, 1.0);
      } else {
        // Assume already packed (Uint8Array with 24 bytes per vertex)
        packedVertices = vertexData as Uint8Array;
      }

      // Validate geometry silently before creating buffers
      if (!isValidGeometrySilent(packedVertices, indices)) {
        // Return null - caller will log entity-specific warning
        return null;
      }

      // Create minimal GeometryData for single entity
      const geometryData = {
        vertices: packedVertices,
        indices: indices,
        instanceCount: 1,
        opaqueCount: 1,
        instanceOffsetData: new Float32Array(3), // [0, 0, 0]
        instanceColorScaleData: new Float32Array(4), // [1, 1, 1, 1]
        instanceSecondaryColorData: new Float32Array(4), // [1, 1, 1, 1]
        instanceEmissiveColorData: new Float32Array(4), // [0, 0, 0, 0]
        instanceMaterialParamsData: new Float32Array(4), // [1, 0, 1, 0]
        instanceRotationData: new Float32Array(4), // [0, 0, 0, 1] (identity quaternion)
        instanceMaterialIdData: new Float32Array(1), // [0]
      };

      const buffers = createGeometryBuffers(device, geometryData);

      // Calculate vertex count from packed vertices (24 bytes per vertex)
      // packedVertices is Uint8Array with 24 bytes per vertex
      const vertexCount = packedVertices.length / 24;
      const indexCount = indices.length;

      cached = {
        buffers,
        vertexCount,
        indexCount,
        lastUsed: this.frameCounter,
      };

      // Add to cache (with LRU eviction if needed)
      if (this.cache.size >= this.maxCacheSize) {
        this.evictOldest();
      }
      this.cache.set(key, cached);

      return {
        ...buffers,
        vertexCount,
        indexCount,
      };
    } catch (err) {
      console.warn('[GeometryCache] Failed to create geometry buffers:', err);
      return null;
    }
  }

  /**
   * Evict oldest unused geometry from cache
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestFrame = Infinity;

    for (const [key, cached] of this.cache.entries()) {
      if (cached.lastUsed < oldestFrame) {
        oldestFrame = cached.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const cached = this.cache.get(oldestKey);
      if (cached) {
        // Destroy GPU buffers
        try {
          cached.buffers.vertexBuffer.destroy();
          cached.buffers.indexBuffer.destroy();
          cached.buffers.instanceOffsetBuffer.destroy();
          cached.buffers.instanceColorScaleBuffer.destroy();
          cached.buffers.instanceSecondaryColorBuffer.destroy();
          cached.buffers.instanceEmissiveColorBuffer.destroy();
          cached.buffers.instanceMaterialParamsBuffer.destroy();
          cached.buffers.instanceRotationBuffer.destroy();
          cached.buffers.instanceMaterialIdBuffer.destroy();
        } catch (err) {
          // Ignore errors during cleanup
        }
      }
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Mark new frame (for LRU tracking)
   */
  tick(): void {
    this.frameCounter++;
  }

  /**
   * Clear all cached geometries
   */
  dispose(): void {
    for (const cached of this.cache.values()) {
      try {
        cached.buffers.vertexBuffer.destroy();
        cached.buffers.indexBuffer.destroy();
        cached.buffers.instanceOffsetBuffer.destroy();
        cached.buffers.instanceColorScaleBuffer.destroy();
        cached.buffers.instanceSecondaryColorBuffer.destroy();
        cached.buffers.instanceEmissiveColorBuffer.destroy();
        cached.buffers.instanceMaterialParamsBuffer.destroy();
        cached.buffers.instanceRotationBuffer.destroy();
        cached.buffers.instanceMaterialIdBuffer.destroy();
      } catch (err) {
        // Ignore errors during cleanup
      }
    }
    this.cache.clear();
  }
}

