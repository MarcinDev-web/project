/**
 * MicroBlockComponent tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Entity } from '@engine/world';
import { MicroBlockComponent } from '../src/MicroBlockComponent';
import { MicroBlockStore } from '../src/MicroBlockStore';
import type { MicroBlock } from '../src/types';

describe('MicroBlockComponent', () => {
  let entity: Entity;
  let component: MicroBlockComponent;

  beforeEach(() => {
    entity = new Entity('test');
    component = new MicroBlockComponent();
  });

  it('should create with default settings', () => {
    expect(component.getType()).toBe('MicroBlock');
    expect(component.store).toBeDefined();
    expect(component.chunkSize).toBe(16);
  });

  it('should create with custom chunk size', () => {
    const custom = new MicroBlockComponent({ chunkSize: 32 });
    expect(custom.chunkSize).toBe(32);
    expect(custom.store.chunkSize).toBe(32);
  });

  it('should create with existing store', () => {
    const store = new MicroBlockStore(16);
    const comp = new MicroBlockComponent({ store });
    
    expect(comp.store).toBe(store);
  });

  it('should serialize and deserialize', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    component.store.setBlock([0, 0, 0], block);
    
    const json = component.toJSON();
    expect(json.storeData).toBeDefined();
    expect(json.chunkSize).toBe(16);
    expect(json.storeData.chunks.length).toBe(1);

    const newComponent = new MicroBlockComponent();
    newComponent.fromJSON(json);

    expect(newComponent.chunkSize).toBe(16);
    expect(newComponent.store.getBlockCount()).toBe(1);
    expect(newComponent.store.getBlock([0, 0, 0])?.type).toBe('cube');
  });

  it('should clone correctly', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    component.store.setBlock([0, 0, 0], block);
    
    const clone = component.clone();

    expect(clone).not.toBe(component);
    expect(clone.chunkSize).toBe(component.chunkSize);
    expect(clone.store.getBlockCount()).toBe(1);
    expect(clone.store.getBlock([0, 0, 0])?.type).toBe('cube');
    
    // Clone should be independent
    clone.store.setBlock([0.125, 0, 0], block);
    expect(clone.store.getBlockCount()).toBe(2);
    expect(component.store.getBlockCount()).toBe(1);
  });

  it('should dispose store on dispose', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
    };

    component.store.setBlock([0, 0, 0], block);
    expect(component.store.getBlockCount()).toBe(1);

    component.dispose();
    
    // Store should be disposed (cannot verify directly, but should not throw)
    expect(() => component.dispose()).not.toThrow();
  });
});

