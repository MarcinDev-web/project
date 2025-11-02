/**
 * MicroBlockMesher tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MicroBlockMesher } from '../src/MicroBlockMesher';
import { MicroBlockStore } from '../src/MicroBlockStore';
import type { MicroBlock } from '../src/types';

describe('MicroBlockMesher', () => {
  let mesher: MicroBlockMesher;
  let store: MicroBlockStore;

  beforeEach(() => {
    mesher = new MicroBlockMesher();
    store = new MicroBlockStore();
  });

  it('should create mesher with default settings', () => {
    expect(mesher).toBeDefined();
  });

  it('should generate mesh for empty chunk', () => {
    const chunk = store.getChunk([0, 0, 0]);
    if (!chunk) {
      // Create chunk by placing a block
      const block: MicroBlock = {
        type: 'cube',
        materialId: 'plastic_red',
      };
      store.setBlock([0, 0, 0], block);
    }
    
    const chunk2 = store.getChunk([0, 0, 0]);
    if (!chunk2) {
      throw new Error('Chunk should exist');
    }

    const mesh = mesher.generateMesh(chunk2);
    expect(mesh).toBeDefined();
    expect(mesh.vertices).toBeDefined();
    expect(mesh.indices).toBeDefined();
  });

  it('should generate mesh with vertices for single block', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    store.setBlock([0, 0, 0], block);
    const chunk = store.getChunk([0, 0, 0]);
    
    if (!chunk) {
      throw new Error('Chunk should exist');
    }

    const mesh = mesher.generateMesh(chunk);
    
    expect(mesh.vertices).toBeDefined();
    expect(mesh.indices).toBeDefined();
    
    // Should have vertices (each face has 4 vertices, 6 components each: x, y, z, nx, ny, nz)
    // 6 faces * 4 vertices * 6 components = 144 components minimum
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
  });

  it('should generate mesh for multiple blocks', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    store.setBlock([0, 0, 0], block);
    store.setBlock([0.125, 0, 0], block);
    store.setBlock([0, 0.125, 0], block);

    const chunk = store.getChunk([0, 0, 0]);
    if (!chunk) {
      throw new Error('Chunk should exist');
    }

    const mesh = mesher.generateMesh(chunk);
    
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    
    // Should have more vertices than single block
    expect(mesh.vertices.length).toBeGreaterThan(144);
  });

  it('should dispose resources', () => {
    expect(() => mesher.dispose()).not.toThrow();
  });
});

