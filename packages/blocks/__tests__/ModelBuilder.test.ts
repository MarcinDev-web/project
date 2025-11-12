/**
 * ModelBuilder Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelBuilder } from '../src/ModelBuilder';
import type { BuildBounds, LocalPos } from '../src/ModelBuilderTypes';
import type { MicroBlock } from '@engine/microblocks';
import type { Vec3 } from '@engine/core/math';

describe('ModelBuilder', () => {
  let builder: ModelBuilder;
  const bounds: BuildBounds = {
    min: [0, 0, 0],
    max: [15, 15, 15],
  };

  beforeEach(() => {
    builder = new ModelBuilder({ bounds });
  });

  afterEach(() => {
    builder.dispose();
  });

  it('should create ModelBuilder with bounds', () => {
    expect(builder).toBeDefined();
    const retrievedBounds = builder.getBounds();
    expect(retrievedBounds.min).toEqual(bounds.min);
    expect(retrievedBounds.max).toEqual(bounds.max);
  });

  it('should place block within bounds', () => {
    const pos: LocalPos = [5, 5, 5];
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
      rotation: 0,
    };

    const result = builder.placeBlock(pos, block);
    expect(result).toBe(true);
    expect(builder.getBlockCount()).toBe(1);
  });

  it('should not place block outside bounds', () => {
    const pos: LocalPos = [20, 20, 20]; // Outside bounds
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
      rotation: 0,
    };

    const result = builder.placeBlock(pos, block);
    expect(result).toBe(false);
    expect(builder.getBlockCount()).toBe(0);
  });

  it('should remove block', () => {
    const pos: LocalPos = [5, 5, 5];
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
      rotation: 0,
    };

    builder.placeBlock(pos, block);
    expect(builder.getBlockCount()).toBe(1);

    const result = builder.removeBlock(pos);
    expect(result).toBe(true);
    expect(builder.getBlockCount()).toBe(0);
  });

  it('should rotate block', () => {
    const pos: LocalPos = [5, 5, 5];
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
      rotation: 0,
    };

    builder.placeBlock(pos, block);
    const result = builder.rotateBlock(pos, 1);
    expect(result).toBe(true);
  });

  it('should fill region', () => {
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
      rotation: 0,
    };

    const bounds = builder.getBounds();
    const fillBounds = {
      min: [bounds.min[0] * 0.125, bounds.min[1] * 0.125, bounds.min[2] * 0.125] as Vec3,
      max: [bounds.max[0] * 0.125, bounds.max[1] * 0.125, bounds.max[2] * 0.125] as Vec3,
    };

    builder.fillRegion(fillBounds, block);
    expect(builder.getBlockCount()).toBeGreaterThan(0);
  });

  it('should clear region', () => {
    const pos: LocalPos = [5, 5, 5];
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
      rotation: 0,
    };

    builder.placeBlock(pos, block);
    expect(builder.getBlockCount()).toBe(1);

    const bounds = builder.getBounds();
    const clearBounds = {
      min: [bounds.min[0] * 0.125, bounds.min[1] * 0.125, bounds.min[2] * 0.125] as Vec3,
      max: [bounds.max[0] * 0.125, bounds.max[1] * 0.125, bounds.max[2] * 0.125] as Vec3,
    };

    builder.clearRegion(clearBounds);
    expect(builder.getBlockCount()).toBe(0);
  });

  it('should export and import model', () => {
    const pos: LocalPos = [5, 5, 5];
    const block: MicroBlock = {
      type: 'cube',
      materialId: 'plastic_red',
      rotation: 0,
    };

    builder.placeBlock(pos, block);
    const exported = builder.exportModel();
    
    expect(exported).toBeDefined();
    expect(exported.storeData).toBeDefined();
    expect(exported.bounds).toBeDefined();

    builder.clear();
    expect(builder.getBlockCount()).toBe(0);

    builder.importModel(exported);
    expect(builder.getBlockCount()).toBe(1);
  });
});

