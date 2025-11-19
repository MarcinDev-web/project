/**
 * Micro Block System - Type Definitions
 */

export type MicroBlockType = 'cube' | 'slab' | 'stairs' | 'corner' | 'wedge';

export type RotationAxis = 0 | 1 | 2 | 3; // 90° steps (0°, 90°, 180°, 270°)

export type ChunkCoord = [number, number, number];

export type LocalPos = [number, number, number];

/**
 * Represents a single micro block
 */
export interface MicroBlock {
  /** Block shape type */
  type: MicroBlockType;
  /** Material identifier (references material system) */
  materialId: string;
  /** Optional rotation (0-3 for 90° steps) */
  rotation?: RotationAxis;
}

/**
 * Mesh data structure compatible with engine mesh components
 */
export interface MicroBlockMeshData {
  vertices: Float32Array;
  indices: Uint16Array;
  uvs?: Float32Array;
  normals?: Float32Array;
}

/**
 * Chunk coordinate in chunk space
 */
export interface MicroBlockChunk {
  /** Chunk coordinates */
  coord: ChunkCoord;
  /** Sparse storage: flatIndex -> MicroBlock */
  blocks: Map<number, MicroBlock>;
  /** Whether this chunk needs remeshing */
  dirty: boolean;
  /** Generated mesh data (cached) */
  mesh?: MicroBlockMeshData;
}

/**
 * Serialized chunk data for JSON export/import
 */
export interface MicroBlockChunkData {
  coord: ChunkCoord;
  blocks: Array<[number, MicroBlock]>;
}

/**
 * Serialized store data for JSON export/import
 */
export interface MicroBlockStoreData {
  chunks: MicroBlockChunkData[];
}

/**
 * Component data for serialization
 */
export interface MicroBlockComponentData {
  storeData: MicroBlockStoreData;
  chunkSize: number;
}
