import { describe, it, expect, beforeEach } from 'vitest';
import { SnapSystem } from './SnapSystem';
import type { Vec3, Quat } from '../../scene/Transform';
import type { SnapConfig } from './SnapConfig';

describe('SnapSystem', () => {
  let snapSystem: SnapSystem;

  beforeEach(() => {
    snapSystem = new SnapSystem({
      enabled: true,
      increment: 1.0,
      axes: { x: true, y: true, z: true },
      rotationIncrement: Math.PI / 4,
      scaleIncrement: 0.5,
    });
  });

  describe('snapPosition', () => {
    it('should snap position to nearest grid point', () => {
      const input: Vec3 = [0.4, 0.6, 1.3];
      const result = snapSystem.snapPosition(input);
      expect(result).toEqual([0, 1, 1]);
    });

    it('should snap position with rounding half up', () => {
      const input1: Vec3 = [0.6, 0.4, 1.7];
      const result1 = snapSystem.snapPosition(input1);
      expect(result1[0]).toBe(1);
      expect(result1[1]).toBe(0);
      expect(result1[2]).toBe(2);

      const input2: Vec3 = [-0.6, -0.4, -1.7];
      const result2 = snapSystem.snapPosition(input2);
      expect(result2[0]).toBe(-1);
      expect(Math.abs(result2[1])).toBe(0); // Handle -0 vs 0
      expect(result2[2]).toBe(-2);
    });

    it('should respect per-axis configuration', () => {
      snapSystem.setConfig({
        axes: { x: true, y: false, z: true },
      });

      const input: Vec3 = [0.4, 0.6, 1.3];
      const result = snapSystem.snapPosition(input);
      expect(result).toEqual([0, 0.6, 1]);
    });

    it('should use custom increment', () => {
      snapSystem.setConfig({ increment: 0.5 });

      const input: Vec3 = [0.3, 0.7, 1.2];
      const result = snapSystem.snapPosition(input);
      expect(result).toEqual([0.5, 0.5, 1.0]);
    });

    it('should not snap when disabled', () => {
      snapSystem.setConfig({ enabled: false });

      const input: Vec3 = [0.4, 0.6, 1.3];
      const result = snapSystem.snapPosition(input);
      expect(result).toEqual(input);
    });

    it('should handle negative positions', () => {
      const input: Vec3 = [-1.4, -2.6, -0.3];
      const result = snapSystem.snapPosition(input);
      expect(result[0]).toBe(-1);
      expect(result[1]).toBe(-3);
      expect(Math.abs(result[2])).toBe(0); // Handle -0 vs 0
    });

    it('should handle zero positions', () => {
      const input: Vec3 = [0, 0, 0];
      const result = snapSystem.snapPosition(input);
      expect(result).toEqual([0, 0, 0]);
    });

    it('should handle per-call config override', () => {
      const input: Vec3 = [0.4, 0.6, 1.3];
      const result = snapSystem.snapPosition(input, { increment: 2.0 });
      expect(result).toEqual([0, 0, 2]);
    });
  });

  describe('snapRotation', () => {
    it('should snap rotation when enabled', () => {
      // Identity quaternion
      const input: Quat = [0, 0, 0, 1];
      const result = snapSystem.snapRotation(input);
      expect(result).toBeDefined();
      expect(result.length).toBe(4);
    });

    it('should not modify rotation when disabled', () => {
      snapSystem.setConfig({ enabled: false });

      const input: Quat = [0.1, 0.2, 0.3, 0.9];
      const result = snapSystem.snapRotation(input);
      expect(result).toEqual(input);
    });

    it('should return valid quaternion', () => {
      const input: Quat = [0.5, 0.5, 0.5, 0.5];
      const result = snapSystem.snapRotation(input);

      // Check quaternion is normalized (length = 1)
      const length = Math.sqrt(
        result[0] * result[0] +
          result[1] * result[1] +
          result[2] * result[2] +
          result[3] * result[3]
      );
      expect(length).toBeCloseTo(1.0, 5);
    });
  });

  describe('snapScale', () => {
    it('should snap scale to nearest increment', () => {
      const input: Vec3 = [1.3, 2.7, 0.4];
      const result = snapSystem.snapScale(input);
      // 1.3 rounds to 1.5 (nearest 0.5)
      // 2.7 rounds to 2.5 (nearest 0.5)
      // 0.4 rounds to 0.5 (nearest 0.5)
      expect(result).toEqual([1.5, 2.5, 0.5]);
    });

    it('should not snap when disabled', () => {
      snapSystem.setConfig({ enabled: false });

      const input: Vec3 = [1.3, 2.7, 0.4];
      const result = snapSystem.snapScale(input);
      expect(result).toEqual(input);
    });

    it('should enforce minimum scale', () => {
      const input: Vec3 = [0, -1, 0.0001];
      const result = snapSystem.snapScale(input);

      // All values should be at least 0.001
      expect(result[0]).toBeGreaterThanOrEqual(0.001);
      expect(result[1]).toBeGreaterThanOrEqual(0.001);
      expect(result[2]).toBeGreaterThanOrEqual(0.001);
    });

    it('should use custom scale increment', () => {
      snapSystem.setConfig({ scaleIncrement: 0.25 });

      const input: Vec3 = [1.3, 2.7, 0.4];
      const result = snapSystem.snapScale(input);
      expect(result).toEqual([1.25, 2.75, 0.5]);
    });
  });

  describe('getNearestGridPoint', () => {
    it('should return nearest grid point regardless of enabled state', () => {
      snapSystem.setConfig({ enabled: false });

      const input: Vec3 = [0.4, 0.6, 1.3];
      const result = snapSystem.getNearestGridPoint(input);
      expect(result).toEqual([0, 1, 1]);
    });

    it('should handle different increments', () => {
      snapSystem.setConfig({ increment: 2.0 });

      const input: Vec3 = [3.4, 5.6, 7.3];
      const result = snapSystem.getNearestGridPoint(input);
      expect(result).toEqual([4, 6, 8]);
    });
  });

  describe('areOnSameGridPoint', () => {
    it('should return true for positions on same grid point', () => {
      const pos1: Vec3 = [0.4, 0.6, 1.3];
      const pos2: Vec3 = [0.3, 0.7, 1.2];

      const result = snapSystem.areOnSameGridPoint(pos1, pos2);
      expect(result).toBe(true);
    });

    it('should return false for positions on different grid points', () => {
      const pos1: Vec3 = [0.4, 0.6, 1.3];
      const pos2: Vec3 = [1.4, 0.6, 1.3];

      const result = snapSystem.areOnSameGridPoint(pos1, pos2);
      expect(result).toBe(false);
    });

    it('should work with different increments', () => {
      snapSystem.setConfig({ increment: 0.5 });

      // Both should snap to [0, 0, 0.5]
      const pos1: Vec3 = [0.1, 0.2, 0.6];
      const pos2: Vec3 = [0.2, 0.1, 0.7];

      const result = snapSystem.areOnSameGridPoint(pos1, pos2);
      expect(result).toBe(true); // Both snap to [0, 0, 0.5]
    });
  });

  describe('configuration management', () => {
    it('should update config with setConfig', () => {
      const newConfig: Partial<SnapConfig> = {
        increment: 2.0,
        enabled: false,
      };

      snapSystem.setConfig(newConfig);
      const config = snapSystem.getConfig();

      expect(config.increment).toBe(2.0);
      expect(config.enabled).toBe(false);
    });

    it('should preserve other config values when partially updating', () => {
      const originalConfig = snapSystem.getConfig();

      snapSystem.setConfig({ increment: 2.0 });
      const newConfig = snapSystem.getConfig();

      expect(newConfig.increment).toBe(2.0);
      expect(newConfig.rotationIncrement).toBe(originalConfig.rotationIncrement);
      expect(newConfig.scaleIncrement).toBe(originalConfig.scaleIncrement);
    });

    it('should return a copy of config with getConfig', () => {
      const config1 = snapSystem.getConfig();
      const config2 = snapSystem.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object references
    });

    it('should return deep copy for axes in getConfig', () => {
      const configA = snapSystem.getConfig();
      const configB = snapSystem.getConfig();
      expect(configA.axes).not.toBe(configB.axes);

      // Mutating returned config should not affect internal state
      configA.axes.x = false;
      const after = snapSystem.getConfig();
      expect(after.axes.x).toBe(true);
    });

    it('should deep-merge axes on setConfig', () => {
      snapSystem.setConfig({ axes: { x: false } });
      const config = snapSystem.getConfig();
      expect(config.axes).toEqual({ x: false, y: true, z: true });
    });
  });

  describe('toggle/enable/disable', () => {
    it('should toggle enabled state', () => {
      expect(snapSystem.isEnabled()).toBe(true);

      snapSystem.toggle();
      expect(snapSystem.isEnabled()).toBe(false);

      snapSystem.toggle();
      expect(snapSystem.isEnabled()).toBe(true);
    });

    it('should enable snapping', () => {
      snapSystem.disable();
      expect(snapSystem.isEnabled()).toBe(false);

      snapSystem.enable();
      expect(snapSystem.isEnabled()).toBe(true);
    });

    it('should disable snapping', () => {
      snapSystem.enable();
      expect(snapSystem.isEnabled()).toBe(true);

      snapSystem.disable();
      expect(snapSystem.isEnabled()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very small increments', () => {
      snapSystem.setConfig({ increment: 0.01 });

      const input: Vec3 = [0.456, 0.789, 1.234];
      const result = snapSystem.snapPosition(input);

      expect(result[0]).toBeCloseTo(0.46, 2);
      expect(result[1]).toBeCloseTo(0.79, 2);
      expect(result[2]).toBeCloseTo(1.23, 2);
    });

    it('should handle very large increments', () => {
      snapSystem.setConfig({ increment: 100 });

      const input: Vec3 = [45, 67, 123];
      const result = snapSystem.snapPosition(input);

      expect(result).toEqual([0, 100, 100]);
    });

    it('should handle exact grid positions', () => {
      const input: Vec3 = [1.0, 2.0, 3.0];
      const result = snapSystem.snapPosition(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle mixed axis snapping', () => {
      snapSystem.setConfig({
        axes: { x: false, y: true, z: false },
      });

      const input: Vec3 = [0.7, 0.7, 0.7];
      const result = snapSystem.snapPosition(input);
      expect(result).toEqual([0.7, 1, 0.7]);
    });

    it('should deep-merge axes in per-call override for snapPosition', () => {
      // Global: all axes snapping enabled
      snapSystem.setConfig({ axes: { x: true, y: true, z: true } });
      const input: Vec3 = [0.6, 0.6, 0.6];
      const result = snapSystem.snapPosition(input, { axes: { x: false } });
      // X should remain unsnapped, Y/Z snapped to 1
      expect(result).toEqual([0.6, 1, 1]);
      // Ensure global config unchanged
      const cfg = snapSystem.getConfig();
      expect(cfg.axes).toEqual({ x: true, y: true, z: true });
    });

    it('should normalize -0 to 0 in snapping results', () => {
      const input: Vec3 = [-0.1, 0.0, -0.4];
      const result = snapSystem.snapPosition(input);
      expect(Object.is(result[0], -0)).toBe(false);
      expect(Object.is(result[1], -0)).toBe(false);
      expect(Object.is(result[2], -0)).toBe(false);
    });

    it('should throw on invalid configuration in constructor', () => {
      expect(() => new SnapSystem({ increment: 0 })).toThrow();
      expect(() => new SnapSystem({ rotationIncrement: 0 })).toThrow();
      expect(() => new SnapSystem({ scaleIncrement: 0 })).toThrow();
      expect(() => new SnapSystem({ minScale: 0 })).toThrow();
    });

    it('should throw on invalid configuration in setConfig', () => {
      expect(() => snapSystem.setConfig({ increment: 0 })).toThrow();
      expect(() => snapSystem.setConfig({ rotationIncrement: 0 })).toThrow();
      expect(() => snapSystem.setConfig({ scaleIncrement: 0 })).toThrow();
      expect(() => snapSystem.setConfig({ minScale: 0 })).toThrow();
    });

    it('should sync snap increment to grid cell size', () => {
      snapSystem.syncSnapToGrid(2);
      const cfg = snapSystem.getConfig();
      expect(cfg.increment).toBe(2);
      const result = snapSystem.snapPosition([1.1, 2.1, 3.1]);
      expect(result).toEqual([2, 2, 4]);
    });
  });
});
