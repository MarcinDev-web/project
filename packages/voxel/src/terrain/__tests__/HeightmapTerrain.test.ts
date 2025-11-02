import { describe, it, expect } from 'vitest';
import { HeightmapTerrain } from '../HeightmapTerrain';

describe('HeightmapTerrain', () => {
  it('should create terrain with valid resolution', () => {
    const terrain = new HeightmapTerrain({
      resolution: 129,
      size: 100,
      minHeight: 0,
      maxHeight: 100,
    });

    expect(terrain.getConfig().resolution).toBe(129);
    expect(terrain.getConfig().size).toBe(100);
  });

  it('should reject invalid resolution', () => {
    expect(() => {
      new HeightmapTerrain({
        resolution: 100, // Not power of 2 + 1
        size: 100,
      });
    }).toThrow();
  });

  it('should get and set height at grid coordinates', () => {
    const terrain = new HeightmapTerrain({
      resolution: 65,
      size: 100,
    });

    terrain.setHeightAtGrid(10, 20, 50);
    expect(terrain.getHeightAtGrid(10, 20)).toBe(50);
  });

  it('should clamp heights to min/max range', () => {
    const terrain = new HeightmapTerrain({
      resolution: 65,
      size: 100,
      minHeight: 0,
      maxHeight: 100,
    });

    terrain.setHeightAtGrid(10, 10, 150); // Above max
    expect(terrain.getHeightAtGrid(10, 10)).toBe(100);

    terrain.setHeightAtGrid(10, 10, -50); // Below min
    expect(terrain.getHeightAtGrid(10, 10)).toBe(0);
  });

  it('should interpolate height at world position', () => {
    const terrain = new HeightmapTerrain({
      resolution: 65,
      size: 100,
    });

    // Set some heights
    terrain.setHeightAtGrid(10, 10, 10);
    terrain.setHeightAtGrid(11, 10, 20);
    terrain.setHeightAtGrid(10, 11, 30);
    terrain.setHeightAtGrid(11, 11, 40);

    // Get height at interpolated position
    const halfSize = 50;
    const scale = 100 / 64; // resolution - 1
    const worldX = -halfSize + 10.5 * scale;
    const worldZ = -halfSize + 10.5 * scale;

    const height = terrain.getHeightAt(worldX, worldZ);
    expect(height).toBeGreaterThan(10);
    expect(height).toBeLessThan(40);
  });

  it('should apply smooth operation', () => {
    const terrain = new HeightmapTerrain({
      resolution: 65,
      size: 100,
    });

    // Create a spike
    terrain.setHeightAtGrid(32, 32, 100);
    terrain.smooth(1);

    // Height should be reduced
    const height = terrain.getHeightAtGrid(32, 32);
    expect(height).toBeLessThan(100);
  });

  it('should export and import data', () => {
    const terrain1 = new HeightmapTerrain({
      resolution: 65,
      size: 100,
    });

    terrain1.setHeightAtGrid(10, 10, 50);
    const data = terrain1.exportData();

    const terrain2 = new HeightmapTerrain({
      resolution: 65,
      size: 100,
    });
    terrain2.importData(data);

    expect(terrain2.getHeightAtGrid(10, 10)).toBe(50);
  });
});

