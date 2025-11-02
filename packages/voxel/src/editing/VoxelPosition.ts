/**
 * Voxel coordinate and position utilities
 */

export interface VoxelPos {
  x: number;
  y: number;
  z: number;
}

export interface ChunkPos {
  x: number;
  y: number;
  z: number;
}

/**
 * Convert world position to chunk coordinates
 */
export function worldToChunk(worldPos: VoxelPos, chunkSize: number): ChunkPos {
  return {
    x: Math.floor(worldPos.x / chunkSize),
    y: Math.floor(worldPos.y / chunkSize),
    z: Math.floor(worldPos.z / chunkSize),
  };
}

/**
 * Convert chunk coordinates to world position (chunk origin)
 */
export function chunkToWorld(chunkPos: ChunkPos, chunkSize: number): VoxelPos {
  return {
    x: chunkPos.x * chunkSize,
    y: chunkPos.y * chunkSize,
    z: chunkPos.z * chunkSize,
  };
}

/**
 * Get local position within chunk
 */
export function getLocalPos(worldPos: VoxelPos, chunkPos: ChunkPos, chunkSize: number): VoxelPos {
  const chunkWorld = chunkToWorld(chunkPos, chunkSize);
  return {
    x: worldPos.x - chunkWorld.x,
    y: worldPos.y - chunkWorld.y,
    z: worldPos.z - chunkWorld.z,
  };
}

/**
 * Hash chunk position for use as Map key
 */
export function hashChunkPos(pos: ChunkPos): string {
  return `${pos.x},${pos.y},${pos.z}`;
}

