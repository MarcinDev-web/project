import { init, type WasmVoxelEngine, type MeshResult } from './index';

/**
 * Generated mesh data compatible with engine format
 */
export interface VoxelMeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  uvs: Float32Array;
}

/**
 * VoxelChunkMesher - Handles WASM-based chunk meshing
 */
export class VoxelChunkMesher {
  private static wasmEngine: WasmVoxelEngine | null = null;

  /**
   * Initialize WASM engine
   */
  static async init(): Promise<void> {
    if (!this.wasmEngine) {
      try {
        this.wasmEngine = await init();
      } catch (e) {
        console.warn('Failed to load WASM voxel engine for chunks', e);
      }
    }
  }

  /**
   * Meshes a chunk of voxels
   * @param voxels Flat array of voxel IDs (0 = air)
   * @param size Chunk size (cubic)
   */
  static meshChunk(voxels: Uint16Array, size: number): VoxelMeshData | null {
    if (!this.wasmEngine) {
        console.warn('WASM engine not initialized');
        return null;
    }

    try {
      const result: MeshResult = this.wasmEngine.meshChunk(voxels, size);
      
      // Copy data out of WASM memory before freeing result
      const vertices = result.vertices();
      const indices = result.indices();
      const normals = result.normals();
      const uvs = result.uvs();

      // Important: Free WASM memory
      result.free();

      return {
        vertices,
        indices,
        normals,
        uvs
      };
    } catch (e) {
      console.error('Failed to mesh chunk in WASM', e);
      return null;
    }
  }
}

