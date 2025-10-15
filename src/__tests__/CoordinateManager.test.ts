import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoordinateManager } from '../editor/utils/CoordinateManager';
import type { Vec3 } from '../math';

describe('CoordinateManager', () => {
  describe('format', () => {
    it('should format coordinates with default precision', () => {
      const coords: Vec3 = [1.23456, 2.34567, 3.45678];
      const result = CoordinateManager.format(coords);
      expect(result).toBe('1.235, 2.346, 3.457');
    });

    it('should format coordinates with custom precision', () => {
      const coords: Vec3 = [1.23456, 2.34567, 3.45678];
      const result = CoordinateManager.format(coords, { precision: 2, separator: ', ' });
      expect(result).toBe('1.23, 2.35, 3.46');
    });

    it('should format coordinates with custom separator', () => {
      const coords: Vec3 = [1, 2, 3];
      const result = CoordinateManager.format(coords, { precision: 0, separator: ' ' });
      expect(result).toBe('1 2 3');
    });
  });

  describe('parse', () => {
    it('should parse comma-separated coordinates', () => {
      const result = CoordinateManager.parse('1.5, 2.5, 3.5');
      expect(result).toEqual([1.5, 2.5, 3.5]);
    });

    it('should parse space-separated coordinates', () => {
      const result = CoordinateManager.parse('1.5 2.5 3.5');
      expect(result).toEqual([1.5, 2.5, 3.5]);
    });

    it('should parse bracketed coordinates', () => {
      const result = CoordinateManager.parse('[1.5, 2.5, 3.5]');
      expect(result).toEqual([1.5, 2.5, 3.5]);
    });

    it('should return null for invalid input', () => {
      expect(CoordinateManager.parse('1, 2')).toBeNull();
      expect(CoordinateManager.parse('invalid')).toBeNull();
      expect(CoordinateManager.parse('1, 2, three')).toBeNull();
    });

    it('should handle negative numbers', () => {
      const result = CoordinateManager.parse('-1.5, -2.5, -3.5');
      expect(result).toEqual([-1.5, -2.5, -3.5]);
    });
  });

  describe('validate', () => {
    it('should validate finite numbers', () => {
      expect(CoordinateManager.validate(1.5)).toBe(true);
      expect(CoordinateManager.validate(0)).toBe(true);
      expect(CoordinateManager.validate(-100)).toBe(true);
    });

    it('should reject non-finite numbers', () => {
      expect(CoordinateManager.validate(NaN)).toBe(false);
      expect(CoordinateManager.validate(Infinity)).toBe(false);
      expect(CoordinateManager.validate(-Infinity)).toBe(false);
    });

    it('should validate with min constraint', () => {
      expect(CoordinateManager.validate(5, 0)).toBe(true);
      expect(CoordinateManager.validate(-5, 0)).toBe(false);
    });

    it('should validate with max constraint', () => {
      expect(CoordinateManager.validate(5, undefined, 10)).toBe(true);
      expect(CoordinateManager.validate(15, undefined, 10)).toBe(false);
    });

    it('should validate with both min and max', () => {
      expect(CoordinateManager.validate(5, 0, 10)).toBe(true);
      expect(CoordinateManager.validate(-5, 0, 10)).toBe(false);
      expect(CoordinateManager.validate(15, 0, 10)).toBe(false);
    });
  });

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(CoordinateManager.clamp(5, 0, 10)).toBe(5);
      expect(CoordinateManager.clamp(-5, 0, 10)).toBe(0);
      expect(CoordinateManager.clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('round', () => {
    it('should round to default precision', () => {
      expect(CoordinateManager.round(1.23456)).toBeCloseTo(1.235, 3);
    });

    it('should round to custom precision', () => {
      expect(CoordinateManager.round(1.23456, 2)).toBeCloseTo(1.23, 2);
      expect(CoordinateManager.round(1.23456, 0)).toBe(1);
    });
  });

  describe('snapToGrid', () => {
    it('should snap to grid size', () => {
      expect(CoordinateManager.snapToGrid(1.7, 1.0)).toBe(2);
      expect(CoordinateManager.snapToGrid(1.3, 1.0)).toBe(1);
      expect(CoordinateManager.snapToGrid(1.25, 0.5)).toBe(1.5);
    });

    it('should handle negative values', () => {
      expect(CoordinateManager.snapToGrid(-1.7, 1.0)).toBe(-2);
      expect(CoordinateManager.snapToGrid(-1.3, 1.0)).toBe(-1);
    });
  });

  describe('snapVectorToGrid', () => {
    it('should snap all components', () => {
      const coords: Vec3 = [1.7, 2.3, 3.8];
      const result = CoordinateManager.snapVectorToGrid(coords, 1.0);
      expect(result).toEqual([2, 2, 4]);
    });

    it('should work with different grid sizes', () => {
      const coords: Vec3 = [1.7, 2.3, 3.8];
      const result = CoordinateManager.snapVectorToGrid(coords, 0.5);
      expect(result).toEqual([1.5, 2.5, 4.0]);
    });
  });

  describe('getRelativePosition', () => {
    it('should calculate relative position', () => {
      const from: Vec3 = [1, 2, 3];
      const to: Vec3 = [4, 6, 9];
      const result = CoordinateManager.getRelativePosition(from, to);
      expect(result).toEqual([3, 4, 6]);
    });
  });

  describe('applyOffset', () => {
    it('should apply offset', () => {
      const coords: Vec3 = [1, 2, 3];
      const offset: Vec3 = [10, 20, 30];
      const result = CoordinateManager.applyOffset(coords, offset);
      expect(result).toEqual([11, 22, 33]);
    });
  });

  describe('distance', () => {
    it('should calculate distance', () => {
      const a: Vec3 = [0, 0, 0];
      const b: Vec3 = [3, 4, 0];
      const result = CoordinateManager.distance(a, b);
      expect(result).toBe(5);
    });

    it('should calculate 3D distance', () => {
      const a: Vec3 = [0, 0, 0];
      const b: Vec3 = [1, 1, 1];
      const result = CoordinateManager.distance(a, b);
      expect(result).toBeCloseTo(Math.sqrt(3), 5);
    });
  });

  describe('lerp', () => {
    it('should interpolate at t=0', () => {
      const a: Vec3 = [0, 0, 0];
      const b: Vec3 = [10, 10, 10];
      const result = CoordinateManager.lerp(a, b, 0);
      expect(result).toEqual([0, 0, 0]);
    });

    it('should interpolate at t=1', () => {
      const a: Vec3 = [0, 0, 0];
      const b: Vec3 = [10, 10, 10];
      const result = CoordinateManager.lerp(a, b, 1);
      expect(result).toEqual([10, 10, 10]);
    });

    it('should interpolate at t=0.5', () => {
      const a: Vec3 = [0, 0, 0];
      const b: Vec3 = [10, 10, 10];
      const result = CoordinateManager.lerp(a, b, 0.5);
      expect(result).toEqual([5, 5, 5]);
    });
  });

  describe('isValidVector', () => {
    it('should validate valid vectors', () => {
      expect(CoordinateManager.isValidVector([1, 2, 3])).toBe(true);
      expect(CoordinateManager.isValidVector([0, 0, 0])).toBe(true);
      expect(CoordinateManager.isValidVector([-1, -2, -3])).toBe(true);
    });

    it('should reject invalid vectors', () => {
      expect(CoordinateManager.isValidVector([NaN, 2, 3])).toBe(false);
      expect(CoordinateManager.isValidVector([1, Infinity, 3])).toBe(false);
      expect(CoordinateManager.isValidVector([1, 2, -Infinity])).toBe(false);
    });
  });

  describe('clone', () => {
    it('should create a copy', () => {
      const coords: Vec3 = [1, 2, 3];
      const result = CoordinateManager.clone(coords);
      expect(result).toEqual(coords);
      expect(result).not.toBe(coords);
    });
  });

  describe('equals', () => {
    it('should compare equal vectors', () => {
      const a: Vec3 = [1, 2, 3];
      const b: Vec3 = [1, 2, 3];
      expect(CoordinateManager.equals(a, b)).toBe(true);
    });

    it('should compare different vectors', () => {
      const a: Vec3 = [1, 2, 3];
      const b: Vec3 = [1, 2, 4];
      expect(CoordinateManager.equals(a, b)).toBe(false);
    });

    it('should use epsilon tolerance', () => {
      const a: Vec3 = [1.0000001, 2, 3];
      const b: Vec3 = [1, 2, 3];
      expect(CoordinateManager.equals(a, b, 0.001)).toBe(true);
      expect(CoordinateManager.equals(a, b, 0.0000001)).toBe(false);
    });
  });

  describe('clipboard operations', () => {
    beforeEach(() => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
          readText: vi.fn().mockResolvedValue('1.5, 2.5, 3.5'),
        },
      });
    });

    it('should copy to clipboard', async () => {
      const coords: Vec3 = [1.5, 2.5, 3.5];
      const result = await CoordinateManager.copyToClipboard(coords);
      expect(result).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('1.500, 2.500, 3.500');
    });

    it('should paste from clipboard', async () => {
      const result = await CoordinateManager.pasteFromClipboard();
      expect(result).toEqual([1.5, 2.5, 3.5]);
    });

    it('should handle clipboard errors gracefully', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
        },
      });

      const coords: Vec3 = [1, 2, 3];
      const result = await CoordinateManager.copyToClipboard(coords);
      expect(result).toBe(false);
    });
  });
});

