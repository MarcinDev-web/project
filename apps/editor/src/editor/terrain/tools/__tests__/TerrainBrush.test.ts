import { describe, it, expect } from 'vitest';
import { TerrainBrush } from '../TerrainBrush';
import type { Vec3 } from '@engine/core/math';

describe('TerrainBrush', () => {
  it('should create brush with default config', () => {
    const brush = new TerrainBrush();
    const config = brush.getConfig();

    expect(config.size).toBe(5.0);
    expect(config.intensity).toBe(1.0);
    expect(config.falloff).toBe('smooth');
  });

  it('should calculate influence correctly', () => {
    const brush = new TerrainBrush({ size: 10, intensity: 1.0 });

    // At center (distance = 0)
    expect(brush.getInfluence(0)).toBe(1.0);

    // At edge (distance = size)
    expect(brush.getInfluence(10)).toBe(0);

    // Beyond edge
    expect(brush.getInfluence(15)).toBe(0);
  });

  it('should support different falloff types', () => {
    const center: Vec3 = [0, 0, 0];
    const point1: Vec3 = [5, 0, 0];

    const linearBrush = new TerrainBrush({ size: 10, falloff: 'linear' });
    const smoothBrush = new TerrainBrush({ size: 10, falloff: 'smooth' });
    const sphericalBrush = new TerrainBrush({ size: 10, falloff: 'spherical' });

    const linearInf = linearBrush.getInfluenceAt(center, point1);
    const smoothInf = smoothBrush.getInfluenceAt(center, point1);
    const sphericalInf = sphericalBrush.getInfluenceAt(center, point1);

    // All should be > 0 at distance 5 from center (within radius 10)
    expect(linearInf).toBeGreaterThan(0);
    expect(smoothInf).toBeGreaterThan(0);
    expect(sphericalInf).toBeGreaterThan(0);

    // Spherical should be different from linear
    expect(sphericalInf).not.toBe(linearInf);
  });

  it('should respect intensity', () => {
    const brush1 = new TerrainBrush({ size: 10, intensity: 1.0 });
    const brush2 = new TerrainBrush({ size: 10, intensity: 0.5 });

    const center: Vec3 = [0, 0, 0];
    const point: Vec3 = [0, 0, 0];

    expect(brush2.getInfluenceAt(center, point)).toBe(0.5);
    expect(brush1.getInfluenceAt(center, point)).toBe(1.0);
  });

  it('should generate sample points', () => {
    const brush = new TerrainBrush({ size: 10 });
    const center: Vec3 = [0, 0, 0];
    const points = brush.getSamplePoints(center, 2);

    expect(points.length).toBeGreaterThan(0);
    
    // All points should be within radius
    for (const point of points) {
      expect(brush.isWithinRadius(center, point)).toBe(true);
    }
  });

  it('should calculate height delta for raise operation', () => {
    const brush = new TerrainBrush({ size: 10, intensity: 1.0 });
    const center: Vec3 = [0, 0, 0];
    const point: Vec3 = [0, 0, 0];

    const delta = brush.calculateHeightDelta(center, point, 'raise', 5);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(5);
  });

  it('should calculate smooth factor', () => {
    const brush = new TerrainBrush({ size: 10 });
    const center: Vec3 = [0, 0, 0];
    const point: Vec3 = [0, 0, 0];

    const factor = brush.calculateSmoothFactor(center, point, 1.0);
    expect(factor).toBeGreaterThanOrEqual(0);
    expect(factor).toBeLessThanOrEqual(1.0);
  });
});

