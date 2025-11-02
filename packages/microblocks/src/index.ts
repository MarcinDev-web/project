/**
 * @engine/microblocks - Micro Block System
 *
 * Independent system for building detailed structures using small blocks/shapes.
 * Operates in parallel with BlockLibrary but remains independent.
 */

// Core classes
export { MicroBlockStore, MICRO_BLOCK_SIZE, DEFAULT_CHUNK_SIZE } from './MicroBlockStore';
export { MicroBlockMesher } from './MicroBlockMesher';
export { MicroBlockComponent } from './MicroBlockComponent';
export { MicroBlockSystem } from './MicroBlockSystem';

// Types
export type {
  MicroBlock,
  MicroBlockType,
  MicroBlockChunk,
  ChunkCoord,
  LocalPos,
  RotationAxis,
  MicroBlockChunkData,
  MicroBlockStoreData,
  MicroBlockComponentData,
} from './types';

// Presets
export { MICRO_BLOCK_PRESETS, createMicroBlockFromPreset } from './presets';
export type { MicroBlockPreset } from './presets';

