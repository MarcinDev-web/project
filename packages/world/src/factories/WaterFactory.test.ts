import { describe, it, expect } from 'vitest';
import { createWater, createCustomWater, addWaterToEntity } from './WaterFactory';
import { Scene } from '../core';
import { WaterComponent } from '../components/WaterComponent';

describe('WaterFactory', () => {
  describe('createWater', () => {
    it('creates calm lake water', () => {
      const water = createWater('calm_lake');
      expect(water.size).toEqual([50, 50]);
      expect(water.waveSpeed).toBe(0.5);
      expect(water.waveHeight).toBe(0.1);
      expect(water.reflectionStrength).toBe(0.9);
    });

    it('creates ocean water', () => {
      const water = createWater('ocean');
      expect(water.size).toEqual([200, 200]);
      expect(water.waveHeight).toBe(0.5);
      expect(water.waveSpeed).toBe(1.5);
    });

    it('creates pool water', () => {
      const water = createWater('pool');
      expect(water.size).toEqual([10, 10]);
      expect(water.waveHeight).toBe(0.05);
      expect(water.transparency).toBe(0.15);
    });

    it('creates river water', () => {
      const water = createWater('river');
      expect(water.size).toEqual([100, 20]);
      expect(water.waveSpeed).toBe(2.0);
      expect(water.causticsEnabled).toBe(false);
    });

    it('creates pond water', () => {
      const water = createWater('pond');
      expect(water.size).toEqual([15, 15]);
      expect(water.waveHeight).toBe(0.08);
    });

    it('creates stormy ocean water', () => {
      const water = createWater('stormy_ocean');
      expect(water.waveHeight).toBe(1.0);
      expect(water.waveSpeed).toBe(2.5);
      expect(water.foamThreshold).toBe(0.4);
    });

    it('accepts custom size', () => {
      const water = createWater('calm_lake', [30, 40]);
      expect(water.size).toEqual([30, 40]);
    });

    it('normalizes wave direction', () => {
      const water = createWater('ocean');
      const len = Math.sqrt(
        water.waveDirection[0] * water.waveDirection[0] +
          water.waveDirection[1] * water.waveDirection[1]
      );
      expect(len).toBeCloseTo(1.0, 5);
    });
  });

  describe('createCustomWater', () => {
    it('creates water with custom parameters', () => {
      const water = createCustomWater({
        size: [25, 25],
        waveHeight: 0.4,
        waveSpeed: 1.2,
        waterColor: [0.1, 0.2, 0.3, 0.8],
      });

      expect(water.size).toEqual([25, 25]);
      expect(water.waveHeight).toBe(0.4);
      expect(water.waveSpeed).toBe(1.2);
      expect(water.waterColor).toEqual([0.1, 0.2, 0.3, 0.8]);
    });

    it('uses defaults for unspecified parameters', () => {
      const water = createCustomWater({
        size: [20, 20],
      });

      expect(water.size).toEqual([20, 20]);
      expect(water.waveSpeed).toBe(1.0); // default
      expect(water.waveHeight).toBe(0.3); // default
    });

    it('normalizes wave direction when provided', () => {
      const water = createCustomWater({
        waveDirection: [3, 4],
      });

      const len = Math.sqrt(
        water.waveDirection[0] * water.waveDirection[0] +
          water.waveDirection[1] * water.waveDirection[1]
      );
      expect(len).toBeCloseTo(1.0, 5);
    });
  });

  describe('addWaterToEntity', () => {
    it('creates and adds water component to entity', () => {
      const scene = new Scene();
      const entity = scene.createEntity('TestWater');

      const water = addWaterToEntity(entity, 'pool', [15, 15]);

      expect(entity.getComponent(WaterComponent)).toBe(water);
      expect(water.size).toEqual([15, 15]);
    });
  });
});

