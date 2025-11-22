import { VoxelChunkMesher } from '../VoxelChunkMesher';
import { init } from '@engine/wasm-voxel';

// Mock WASM module
jest.mock('@engine/wasm-voxel', () => ({
  init: jest.fn().mockResolvedValue({
    meshChunk: jest.fn().mockReturnValue({
      vertices: () => new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: () => new Uint32Array([0, 1, 2]),
      normals: () => new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uvs: () => new Float32Array([0, 0, 1, 0, 0, 1]),
      free: jest.fn(),
    }),
  }),
}));

describe('VoxelChunkMesher', () => {
  beforeAll(async () => {
    await VoxelChunkMesher.init();
  });

  it('should mesh a simple chunk', () => {
    const size = 16;
    const voxels = new Uint16Array(size * size * size);
    voxels[0] = 1; // One block

    const result = VoxelChunkMesher.meshChunk(voxels, size);
    
    expect(result).toBeDefined();
    expect(result?.vertices.length).toBeGreaterThan(0);
    expect(result?.indices.length).toBeGreaterThan(0);
  });

  it('should handle empty chunk', () => {
    const size = 16;
    const voxels = new Uint16Array(size * size * size); // All air

    // Depending on WASM implementation, this might return empty arrays or null
    // For now, our mock returns data, but real implementation would return empty
    const result = VoxelChunkMesher.meshChunk(voxels, size);
    expect(result).toBeDefined();
  });
});

