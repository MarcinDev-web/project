/**
 * MicroBlockStore tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MicroBlockStore, MICRO_BLOCK_SIZE, DEFAULT_CHUNK_SIZE } from '../src/MicroBlockStore';
import type { MicroBlock, ChunkCoord } from '../src/types';

describe('MicroBlockStore', () => {
  let store: MicroBlockStore;

  beforeEach(() => {
    store = new MicroBlockStore();
  });

  it('should create with default chunk size', () => {
    expect(store.chunkSize).toBe(DEFAULT_CHUNK_SIZE);
    expect(store.blockSize).toBe(MICRO_BLOCK_SIZE);
  });

  it('should create with custom chunk size', () => {
    const customStore = new MicroBlockStore(32);
    expect(customStore.chunkSize).toBe(32);
  });

  it('should reject invalid chunk size', () => {
    expect(() => new MicroBlockStore(0)).toThrow();
    expect(() => new MicroBlockStore(-1)).toThrow();
    expect(() => new MicroBlockStore(1.5)).toThrow();
  });

  it('should convert world position to chunk coordinate', () => {
    const chunk = store.worldToChunk([0, 0, 0]);
    expect(chunk).toEqual([0, 0, 0]);

    const chunk2 = store.worldToChunk([2.0, 2.0, 2.0]);
    expect(chunk2).toEqual([1, 1, 1]);
  });

  it('should get and set blocks', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    store.setBlock([0, 0, 0], block);
    const retrieved = store.getBlock([0, 0, 0]);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.type).toBe('cube');
    expect(retrieved?.materialId).toBe('plastic_red');
  });

  it('should return null for empty position', () => {
    const block = store.getBlock([0, 0, 0]);
    expect(block).toBeNull();
  });

  it('should remove blocks when set to null', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    store.setBlock([0, 0, 0], block);
    expect(store.getBlock([0, 0, 0])).not.toBeNull();

    store.setBlock([0, 0, 0], null);
    expect(store.getBlock([0, 0, 0])).toBeNull();

    // Chunk should be removed when empty
    const chunk = store.getChunk([0, 0, 0]);
    expect(chunk).toBeUndefined();
  });

  it('should mark chunks as dirty when blocks change', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    store.setBlock([0, 0, 0], block);
    
    const dirtyChunks = store.getDirtyChunks();
    expect(dirtyChunks.length).toBeGreaterThan(0);
    
    const chunk = store.getChunk([0, 0, 0]);
    expect(chunk?.dirty).toBe(true);
  });

  it('should clear dirty flag', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    store.setBlock([0, 0, 0], block);
    const chunk = store.getChunk([0, 0, 0]);
    
    expect(chunk?.dirty).toBe(true);
    
    store.clearChunkDirty([0, 0, 0]);
    expect(chunk?.dirty).toBe(false);
  });

  it('should get chunk count', () => {
    expect(store.getChunkCount()).toBe(0);

    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    store.setBlock([0, 0, 0], block);
    expect(store.getChunkCount()).toBe(1);

    // Different chunk
    store.setBlock([3.0, 0, 0], block);
    expect(store.getChunkCount()).toBe(2);
  });

  it('should get block count', () => {
    expect(store.getBlockCount()).toBe(0);

    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    store.setBlock([0, 0, 0], block);
    expect(store.getBlockCount()).toBe(1);

    store.setBlock([0.125, 0, 0], block);
    expect(store.getBlockCount()).toBe(2);
  });

  it('should serialize and deserialize', () => {
    const block1: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };
    const block2: MicroBlock = {
      type: 'slab',
      materialId: 'plastic_blue',
    };

    store.setBlock([0, 0, 0], block1);
    store.setBlock([0.125, 0, 0], block2);

    const data = store.toJSON();
    expect(data.chunks.length).toBe(1);

    const newStore = new MicroBlockStore();
    newStore.fromJSON(data);

    expect(newStore.getBlockCount()).toBe(2);
    expect(newStore.getBlock([0, 0, 0])?.type).toBe('cube');
    expect(newStore.getBlock([0.125, 0, 0])?.type).toBe('slab');
  });

  it('should clear all blocks', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    store.setBlock([0, 0, 0], block);
    store.setBlock([0.125, 0, 0], block);

    expect(store.getBlockCount()).toBe(2);

    store.clear();
    expect(store.getBlockCount()).toBe(0);
    expect(store.getChunkCount()).toBe(0);
  });

  it('should dispose resources', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    store.setBlock([0, 0, 0], block);
    expect(store.getBlockCount()).toBe(1);

    store.dispose();
    expect(store.getBlockCount()).toBe(0);
  });

  it('should handle blocks at chunk boundaries', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    // Place block at chunk boundary
    const boundaryPos = DEFAULT_CHUNK_SIZE * MICRO_BLOCK_SIZE;
    store.setBlock([boundaryPos, 0, 0], block);

    const retrieved = store.getBlock([boundaryPos, 0, 0]);
    expect(retrieved).not.toBeNull();
  });
});

