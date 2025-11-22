import { MicroBlockMesher } from '../MicroBlockMesher';
import { VoxelChunkMesher } from '@engine/wasm-voxel';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock VoxelChunkMesher
vi.mock('@engine/wasm-voxel', () => ({
  VoxelChunkMesher: {
    init: vi.fn().mockResolvedValue(undefined),
    meshChunk: vi.fn().mockReturnValue({
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
    }),
  },
}));

describe('MicroBlockMesher', () => {
  let mesher: MicroBlockMesher;

  beforeEach(async () => {
    mesher = new MicroBlockMesher();
    // Wait for init
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('should generate mesh using WASM mesher', async () => {
    const chunk = {
      coord: [0, 0, 0] as [number, number, number],
      blocks: new Map([[0, { type: 'cube', materialId: 'stone' }]]),
      dirty: true,
    };

    const mesh = mesher.generateMesh(chunk);

    expect(VoxelChunkMesher.meshChunk).toHaveBeenCalled();
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  it('should return empty mesh for empty chunk', () => {
    const chunk = {
      coord: [0, 0, 0] as [number, number, number],
      blocks: new Map(),
      dirty: true,
    };

    const mesh = mesher.generateMesh(chunk);
    
    expect(mesh.vertices.length).toBe(0);
  });
});

