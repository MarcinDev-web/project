import { describe, it, expect, beforeEach } from 'vitest';
import { SnapSystem } from '../src/SnapSystem';
import { DEFAULT_SNAP_CONFIG, SNAP_PRESETS } from '../src/SnapConfig';
import type { Vec3, Quat } from '@engine/core/math';

describe('SnapSystem', () => {
  let snapSystem: SnapSystem;

  beforeEach(() => {
    snapSystem = new SnapSystem();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = snapSystem.getConfig();

      expect(config.enabled).toBe(DEFAULT_SNAP_CONFIG.enabled);
      expect(config.increment).toBe(DEFAULT_SNAP_CONFIG.increment);
      expect(config.axes).toEqual(DEFAULT_SNAP_CONFIG.axes);
    });

    it('should initialize with custom config', () => {
      const customSnap = new SnapSystem({
        enabled: false,
        increment: 1.0,
        rotationIncrement: Math.PI / 4,
      });

      const config = customSnap.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.increment).toBe(1.0);
      expect(config.rotationIncrement).toBe(Math.PI / 4);
    });

    it('should throw on invalid config', () => {
      expect(() => new SnapSystem({ increment: 0 })).toThrow('Invalid snap config');
      expect(() => new SnapSystem({ increment: -1 })).toThrow('Invalid snap config');
      expect(() => new SnapSystem({ rotationIncrement: 0 })).toThrow('Invalid snap config');
      expect(() => new SnapSystem({ scaleIncrement: -1 })).toThrow('Invalid snap config');
      expect(() => new SnapSystem({ minScale: 0 })).toThrow('Invalid snap config');
    });
  });

  describe('snapPosition', () => {
    it('should snap position to grid', () => {
      const position: Vec3 = [1.23, 4.56, 7.89];
      const snapped = snapSystem.snapPosition(position);

      // Default increment is 0.5
      expect(snapped[0]).toBeCloseTo(1.0, 5);
      expect(snapped[1]).toBeCloseTo(4.5, 5);
      expect(snapped[2]).toBeCloseTo(8.0, 5);
    });

    it('should snap to nearest grid point', () => {
      const snap1 = snapSystem.snapPosition([0.7, 0, 0]);
      expect(snap1[0]).toBeCloseTo(0.5, 5);

      const snap2 = snapSystem.snapPosition([0.8, 0, 0]);
      expect(snap2[0]).toBeCloseTo(1.0, 5);
    });

    it('should respect per-axis configuration', () => {
      snapSystem.setConfig({
        axes: {
          x: true,
          y: false,
          z: true,
        },
      });

      const position: Vec3 = [1.23, 4.56, 7.89];
      const snapped = snapSystem.snapPosition(position);

      expect(snapped[0]).toBeCloseTo(1.0, 5); // Snapped
      expect(snapped[1]).toBeCloseTo(4.56, 5); // Not snapped
      expect(snapped[2]).toBeCloseTo(8.0, 5); // Snapped
    });

    it('should return original position when disabled', () => {
      snapSystem.disable();

      const position: Vec3 = [1.23, 4.56, 7.89];
      const snapped = snapSystem.snapPosition(position);

      expect(snapped).toEqual([1.23, 4.56, 7.89]);
    });

    it('should not mutate original position', () => {
      const position: Vec3 = [1.23, 4.56, 7.89];
      const original = [...position];

      snapSystem.snapPosition(position);

      expect(position).toEqual(original);
    });

    it('should handle negative values', () => {
      const position: Vec3 = [-1.23, -4.56, -7.89];
      const snapped = snapSystem.snapPosition(position);

      expect(snapped[0]).toBeCloseTo(-1.0, 5);
      expect(snapped[1]).toBeCloseTo(-4.5, 5);
      expect(snapped[2]).toBeCloseTo(-8.0, 5);
    });

    it('should handle zero values', () => {
      const position: Vec3 = [0, 0, 0];
      const snapped = snapSystem.snapPosition(position);

      expect(snapped).toEqual([0, 0, 0]);
      expect(Object.is(snapped[0], -0)).toBe(false);
    });

    it('should accept per-call config override', () => {
      const position: Vec3 = [1.23, 4.56, 7.89];
      const snapped = snapSystem.snapPosition(position, { increment: 1.0 });

      expect(snapped[0]).toBeCloseTo(1.0, 5);
      expect(snapped[1]).toBeCloseTo(5.0, 5);
      expect(snapped[2]).toBeCloseTo(8.0, 5);
    });

    it('should handle very small increments', () => {
      snapSystem.setConfig({ increment: 0.01 });

      const position: Vec3 = [1.234, 0, 0];
      const snapped = snapSystem.snapPosition(position);

      expect(snapped[0]).toBeCloseTo(1.23, 5);
    });

    it('should handle large increments', () => {
      snapSystem.setConfig({ increment: 10.0 });

      const position: Vec3 = [23.4, 0, 0];
      const snapped = snapSystem.snapPosition(position);

      expect(snapped[0]).toBeCloseTo(20.0, 5);
    });
  });

  describe('snapRotation', () => {
    it('should snap rotation quaternion', () => {
      // Identity quaternion (no rotation)
      const rotation: Quat = [0, 0, 0, 1];
      const snapped = snapSystem.snapRotation(rotation);

      expect(snapped).toHaveLength(4);
      expect(snapped[3]).toBeCloseTo(1, 5); // Should still be normalized
    });

    it('should return original rotation when disabled', () => {
      snapSystem.disable();

      const rotation: Quat = [0.1, 0.2, 0.3, 0.9];
      const snapped = snapSystem.snapRotation(rotation);

      expect(snapped[0]).toBeCloseTo(0.1, 5);
      expect(snapped[1]).toBeCloseTo(0.2, 5);
      expect(snapped[2]).toBeCloseTo(0.3, 5);
      expect(snapped[3]).toBeCloseTo(0.9, 5);
    });

    it('should not mutate original rotation', () => {
      const rotation: Quat = [0.1, 0.2, 0.3, 0.9];
      const original = [...rotation];

      snapSystem.snapRotation(rotation);

      expect(rotation).toEqual(original);
    });

    it('should normalize result quaternion', () => {
      const rotation: Quat = [0, 0, 0, 1];
      const snapped = snapSystem.snapRotation(rotation);

      // Check normalized (length = 1)
      const length = Math.sqrt(
        snapped[0] ** 2 + snapped[1] ** 2 + snapped[2] ** 2 + snapped[3] ** 2
      );
      expect(length).toBeCloseTo(1, 5);
    });
  });

  describe('snapScale', () => {
    it('should snap scale values', () => {
      const scale: Vec3 = [1.23, 0.67, 2.45];
      const snapped = snapSystem.snapScale(scale);

      // Default scaleIncrement is 0.5
      expect(snapped[0]).toBeCloseTo(1.0, 5);
      expect(snapped[1]).toBeCloseTo(0.5, 5);
      expect(snapped[2]).toBeCloseTo(2.5, 5);
    });

    it('should enforce minimum scale', () => {
      const scale: Vec3 = [0.0001, 0.0001, 0.0001];
      const snapped = snapSystem.snapScale(scale);

      const minScale = DEFAULT_SNAP_CONFIG.minScale;
      expect(snapped[0]).toBeGreaterThanOrEqual(minScale);
      expect(snapped[1]).toBeGreaterThanOrEqual(minScale);
      expect(snapped[2]).toBeGreaterThanOrEqual(minScale);
    });

    it('should return original scale when disabled', () => {
      snapSystem.disable();

      const scale: Vec3 = [1.23, 0.67, 2.45];
      const snapped = snapSystem.snapScale(scale);

      expect(snapped).toEqual([1.23, 0.67, 2.45]);
    });

    it('should not mutate original scale', () => {
      const scale: Vec3 = [1.23, 0.67, 2.45];
      const original = [...scale];

      snapSystem.snapScale(scale);

      expect(scale).toEqual(original);
    });

    it('should clamp negative scale values to minScale', () => {
      const scale: Vec3 = [-1.23, -0.67, -2.45];
      const snapped = snapSystem.snapScale(scale);

      // Negative scale should be clamped to minScale (scale can't be negative)
      const minScale = DEFAULT_SNAP_CONFIG.minScale;
      expect(snapped[0]).toBe(minScale);
      expect(snapped[1]).toBe(minScale);
      expect(snapped[2]).toBe(minScale);
    });
  });

  describe('getNearestGridPoint', () => {
    it('should always snap regardless of enabled state', () => {
      snapSystem.disable();

      const position: Vec3 = [1.23, 4.56, 7.89];
      const nearest = snapSystem.getNearestGridPoint(position);

      expect(nearest[0]).toBeCloseTo(1.0, 5);
      expect(nearest[1]).toBeCloseTo(4.5, 5);
      expect(nearest[2]).toBeCloseTo(8.0, 5);
    });

    it('should find nearest grid point', () => {
      const position: Vec3 = [0.3, 0, 0];
      const nearest = snapSystem.getNearestGridPoint(position);

      expect(nearest[0]).toBeCloseTo(0.5, 5);
    });
  });

  describe('areOnSameGridPoint', () => {
    it('should return true for positions on same grid point', () => {
      // With default increment of 0.5, these should both snap to [1.0, 2.5, 3.5]
      const pos1: Vec3 = [1.0, 2.3, 3.4];
      const pos2: Vec3 = [1.2, 2.6, 3.6];

      expect(snapSystem.areOnSameGridPoint(pos1, pos2)).toBe(true);
    });

    it('should return false for positions on different grid points', () => {
      const pos1: Vec3 = [1.0, 2.0, 3.0];
      const pos2: Vec3 = [2.0, 2.0, 3.0];

      expect(snapSystem.areOnSameGridPoint(pos1, pos2)).toBe(false);
    });

    it('should handle edge cases near grid boundaries', () => {
      const pos1: Vec3 = [0.74, 0, 0];
      const pos2: Vec3 = [0.76, 0, 0];

      // Both should snap to different grid points (0.5 vs 1.0)
      expect(snapSystem.areOnSameGridPoint(pos1, pos2)).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should get current config', () => {
      const config = snapSystem.getConfig();

      expect(config.enabled).toBeDefined();
      expect(config.increment).toBeDefined();
      expect(config.axes).toBeDefined();
    });

    it('should return cloned config', () => {
      const config = snapSystem.getConfig();
      config.enabled = false;
      config.axes.x = false;

      const newConfig = snapSystem.getConfig();
      expect(newConfig.enabled).toBe(true); // Original unchanged
      expect(newConfig.axes.x).toBe(true);
    });

    it('should set config', () => {
      snapSystem.setConfig({
        increment: 1.0,
        rotationIncrement: Math.PI / 4,
      });

      const config = snapSystem.getConfig();
      expect(config.increment).toBe(1.0);
      expect(config.rotationIncrement).toBe(Math.PI / 4);
    });

    it('should merge config partially', () => {
      snapSystem.setConfig({ increment: 1.0 });

      const config = snapSystem.getConfig();
      expect(config.increment).toBe(1.0);
      expect(config.rotationIncrement).toBe(DEFAULT_SNAP_CONFIG.rotationIncrement);
    });

    it('should throw on invalid config', () => {
      expect(() => snapSystem.setConfig({ increment: 0 })).toThrow('Invalid snap config');
      expect(() => snapSystem.setConfig({ rotationIncrement: -1 })).toThrow('Invalid snap config');
    });

    it('should merge axes config', () => {
      snapSystem.setConfig({
        axes: { x: false },
      });

      const config = snapSystem.getConfig();
      expect(config.axes.x).toBe(false);
      expect(config.axes.y).toBe(true); // Unchanged
      expect(config.axes.z).toBe(true); // Unchanged
    });
  });

  describe('enable/disable/toggle', () => {
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

    it('should toggle snapping state', () => {
      const initialState = snapSystem.isEnabled();

      snapSystem.toggle();
      expect(snapSystem.isEnabled()).toBe(!initialState);

      snapSystem.toggle();
      expect(snapSystem.isEnabled()).toBe(initialState);
    });
  });

  describe('syncSnapToGrid', () => {
    it('should sync snap increment with grid cell size', () => {
      snapSystem.syncSnapToGrid(2.0);

      const config = snapSystem.getConfig();
      expect(config.increment).toBe(2.0);
    });

    it('should throw on invalid cell size', () => {
      expect(() => snapSystem.syncSnapToGrid(0)).toThrow('cellSize must be a positive number');
      expect(() => snapSystem.syncSnapToGrid(-1)).toThrow('cellSize must be a positive number');
      expect(() => snapSystem.syncSnapToGrid(NaN)).toThrow('cellSize must be a positive number');
      expect(() => snapSystem.syncSnapToGrid(Infinity)).toThrow('cellSize must be a positive number');
    });
  });

  describe('presets', () => {
    it('should use FINE preset', () => {
      const fineSnap = new SnapSystem(SNAP_PRESETS.FINE);

      const config = fineSnap.getConfig();
      expect(config.increment).toBe(SNAP_PRESETS.FINE.increment);
      expect(config.rotationIncrement).toBe(SNAP_PRESETS.FINE.rotationIncrement);
    });

    it('should use NORMAL preset', () => {
      const normalSnap = new SnapSystem(SNAP_PRESETS.NORMAL);

      const config = normalSnap.getConfig();
      expect(config.increment).toBe(SNAP_PRESETS.NORMAL.increment);
    });

    it('should use COARSE preset', () => {
      const coarseSnap = new SnapSystem(SNAP_PRESETS.COARSE);

      const config = coarseSnap.getConfig();
      expect(config.increment).toBe(SNAP_PRESETS.COARSE.increment);
    });
  });

  describe('edge cases', () => {
    it('should handle very small position values', () => {
      const position: Vec3 = [0.0001, 0.0002, 0.0003];
      const snapped = snapSystem.snapPosition(position);

      expect(Array.from(snapped).every(v => !isNaN(v))).toBe(true);
    });

    it('should handle very large position values', () => {
      const position: Vec3 = [1000000.5, 1000000.7, 1000000.3];
      const snapped = snapSystem.snapPosition(position);

      expect(snapped[0]).toBeCloseTo(1000000.5, 1);
      expect(snapped[1]).toBeCloseTo(1000000.5, 1);
      expect(snapped[2]).toBeCloseTo(1000000.5, 1);
    });

    it('should handle position exactly on grid', () => {
      const position: Vec3 = [1.0, 2.0, 3.0];
      const snapped = snapSystem.snapPosition(position);

      expect(snapped).toEqual([1.0, 2.0, 3.0]);
    });

    it('should handle uniform scale', () => {
      const scale: Vec3 = [1.23, 1.23, 1.23];
      const snapped = snapSystem.snapScale(scale);

      expect(snapped[0]).toBe(snapped[1]);
      expect(snapped[1]).toBe(snapped[2]);
    });

    it('should handle very small scale values', () => {
      const scale: Vec3 = [0.0001, 0.0001, 0.0001];
      const snapped = snapSystem.snapScale(scale);

      // Should enforce minScale
      const minScale = DEFAULT_SNAP_CONFIG.minScale;
      expect(snapped[0]).toBeGreaterThanOrEqual(minScale);
    });

    it('should clamp all negative components to minScale', () => {
      const scale: Vec3 = [1.23, -0.67, 2.45];
      const snapped = snapSystem.snapScale(scale);
      const minScale = DEFAULT_SNAP_CONFIG.minScale;

      expect(snapped[0]).toBeCloseTo(1.0, 5); // Snapped from 1.23
      expect(snapped[1]).toBe(minScale); // Clamped from negative
      expect(snapped[2]).toBeCloseTo(2.5, 5); // Snapped from 2.45
    });
  });
});

