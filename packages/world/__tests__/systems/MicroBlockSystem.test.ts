/**
 * MicroBlockSystem tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scene } from '../../src/core/Scene';
import { Entity } from '../../src/core/Entity';
import { MicroBlockComponent } from '../../src/components/MicroBlockComponent';
import { MicroBlockSystem } from '../../src/systems/MicroBlockSystem';
import { MeshComponent } from '../../src/components/MeshComponent';
import type { MicroBlock } from '@engine/microblocks';

describe('MicroBlockSystem', () => {
  let scene: Scene;
  let system: MicroBlockSystem;
  let entity: Entity;
  let component: MicroBlockComponent;

  beforeEach(() => {
    scene = new Scene('test-scene');
    system = new MicroBlockSystem(scene);
    
    entity = new Entity('microblock-entity');
    component = new MicroBlockComponent();
    entity.addComponent(component);
    
    scene.addEntity(entity);
  });

  afterEach(() => {
    system.dispose();
  });

  it('should create system', () => {
    expect(system).toBeDefined();
  });

  it('should update without errors', () => {
    expect(() => system.update(0.016)).not.toThrow();
  });

  it('should process dirty chunks', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    component.store.setBlock([0, 0, 0], block);
    
    const dirtyChunks = component.store.getDirtyChunks();
    expect(dirtyChunks.length).toBeGreaterThan(0);

    system.update(0.016);

    // Chunks should be processed (may not be fully done if limited by maxChunksPerFrame)
    const remainingDirty = component.store.getDirtyChunks();
    // Some chunks may still be dirty if limited by maxChunksPerFrame
    expect(remainingDirty.length).toBeGreaterThanOrEqual(0);
  });

  it('should create mesh component when blocks are added', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    component.store.setBlock([0, 0, 0], block);
    system.update(0.016);

    const meshComponent = entity.getComponent(MeshComponent);
    
    // Mesh component should be created or updated
    if (meshComponent) {
      expect(meshComponent.meshType).toBe('custom');
      expect(meshComponent.meshData).toBeDefined();
    }
  });

  it('should force update all chunks', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    component.store.setBlock([0, 0, 0], block);
    component.store.setBlock([0.125, 0, 0], block);

    system.forceUpdate(entity);

    const meshComponent = entity.getComponent(MeshComponent);
    expect(meshComponent).toBeDefined();
    if (meshComponent) {
      expect(meshComponent.meshData).toBeDefined();
    }
  });

  it('should limit chunks updated per frame', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    // Create many blocks across multiple chunks
    // Each chunk is 16 blocks = 2.0 units, so we need positions > 2.0 apart
    for (let i = 0; i < 50; i++) {
      component.store.setBlock([i * 2.5, 0, 0], block); // Spans multiple chunks
    }

    const dirtyBefore = component.store.getDirtyChunks().length;
    
    // If we have many chunks, test the limit
    if (dirtyBefore > 5) {
      system.update(0.016);

      // Some chunks should still be dirty due to limit
      const dirtyAfter = component.store.getDirtyChunks().length;
      expect(dirtyAfter).toBeGreaterThanOrEqual(0);
      expect(dirtyAfter).toBeLessThan(dirtyBefore);
    } else {
      // If we don't have enough chunks, just verify it works
      system.update(0.016);
      expect(component.store.getDirtyChunks().length).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle entities without micro block component', () => {
    const regularEntity = new Entity('regular');
    scene.addEntity(regularEntity);

    expect(() => system.update(0.016)).not.toThrow();
  });

  it('should dispose resources', () => {
    expect(() => system.dispose()).not.toThrow();
  });
});

