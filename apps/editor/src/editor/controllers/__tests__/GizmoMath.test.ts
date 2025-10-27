import { describe, it, expect } from 'vitest';
import {
  calculateViewAngle,
  calculateAxisOpacity,
  calculateScreenSpaceScale,
  calculateCenterPoint,
  clamp,
  lerp,
  isPointInCircle,
  isPointInRect,
  getPlaneNormal,
  getPlaneAxes,
} from '../GizmoMath';
import type { Vec3 } from '@engine/core/math';

describe('GizmoMath', () => {
  describe('calculateViewAngle', () => {
    it('returns 0 degrees for parallel vectors', () => {
      const direction: Vec3 = [1, 0, 0];
      const cameraForward: Vec3 = [1, 0, 0];
      
      const angle = calculateViewAngle(direction, cameraForward);
      expect(angle).toBeCloseTo(0, 1);
    });

    it('returns 90 degrees for perpendicular vectors', () => {
      const direction: Vec3 = [1, 0, 0];
      const cameraForward: Vec3 = [0, 1, 0];
      
      const angle = calculateViewAngle(direction, cameraForward);
      expect(angle).toBeCloseTo(90, 1);
    });

    it('returns 180 degrees for opposite vectors', () => {
      const direction: Vec3 = [1, 0, 0];
      const cameraForward: Vec3 = [-1, 0, 0];
      
      const angle = calculateViewAngle(direction, cameraForward);
      expect(angle).toBeCloseTo(180, 1);
    });
  });

  describe('calculateAxisOpacity', () => {
    it('returns full opacity for small angles', () => {
      const opacity = calculateAxisOpacity(0, 85);
      expect(opacity).toBe(1.0);
    });

    it('returns full opacity below fade threshold', () => {
      const opacity = calculateAxisOpacity(45, 85);
      expect(opacity).toBe(1.0);
    });

    it('returns full opacity at exact threshold', () => {
      const opacity = calculateAxisOpacity(85, 85);
      expect(opacity).toBe(1.0);
    });
    
    it('returns reduced opacity above threshold', () => {
      const opacity = calculateAxisOpacity(87, 85);
      expect(opacity).toBeLessThan(1.0);
      expect(opacity).toBeGreaterThanOrEqual(0.1);
    });

    it('returns minimum opacity at 90 degrees', () => {
      const opacity = calculateAxisOpacity(90, 85);
      expect(opacity).toBeCloseTo(0.1, 2);
    });

    it('never returns opacity below 0.1', () => {
      const opacity = calculateAxisOpacity(90, 85);
      expect(opacity).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe('calculateScreenSpaceScale', () => {
    it('increases scale with distance', () => {
      const worldPosition: Vec3 = [0, 0, 0];
      const cameraClose: Vec3 = [0, 0, 5];
      const cameraFar: Vec3 = [0, 0, 10];
      
      const scaleClose = calculateScreenSpaceScale(worldPosition, cameraClose, 60);
      const scaleFar = calculateScreenSpaceScale(worldPosition, cameraFar, 60);
      
      expect(scaleFar).toBeGreaterThan(scaleClose);
    });

    it('returns consistent scale for same distance', () => {
      const worldPosition: Vec3 = [0, 0, 0];
      const cameraPosition: Vec3 = [0, 0, 5];
      
      const scale1 = calculateScreenSpaceScale(worldPosition, cameraPosition, 60);
      const scale2 = calculateScreenSpaceScale(worldPosition, cameraPosition, 60);
      
      expect(scale1).toBeCloseTo(scale2, 5);
    });

    it('adjusts for different FOV values', () => {
      const worldPosition: Vec3 = [0, 0, 0];
      const cameraPosition: Vec3 = [0, 0, 5];
      
      const scaleNarrow = calculateScreenSpaceScale(worldPosition, cameraPosition, 30);
      const scaleWide = calculateScreenSpaceScale(worldPosition, cameraPosition, 90);
      
      expect(scaleWide).toBeGreaterThan(scaleNarrow);
    });
  });

  describe('calculateCenterPoint', () => {
    it('returns origin for empty array', () => {
      const center = calculateCenterPoint([]);
      expect(center).toEqual([0, 0, 0]);
    });

    it('returns same point for single position', () => {
      const positions: Vec3[] = [[1, 2, 3]];
      const center = calculateCenterPoint(positions);
      
      expect(center[0]).toBeCloseTo(1, 5);
      expect(center[1]).toBeCloseTo(2, 5);
      expect(center[2]).toBeCloseTo(3, 5);
    });

    it('calculates center of two points', () => {
      const positions: Vec3[] = [
        [0, 0, 0],
        [2, 0, 0],
      ];
      const center = calculateCenterPoint(positions);
      
      expect(center[0]).toBeCloseTo(1, 5);
      expect(center[1]).toBeCloseTo(0, 5);
      expect(center[2]).toBeCloseTo(0, 5);
    });

    it('calculates center of multiple points', () => {
      const positions: Vec3[] = [
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
      ];
      const center = calculateCenterPoint(positions);
      
      expect(center[0]).toBeCloseTo(1, 5);
      expect(center[1]).toBeCloseTo(1, 5);
      expect(center[2]).toBeCloseTo(0, 5);
    });
  });

  describe('clamp', () => {
    it('returns value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('clamps to minimum', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('clamps to maximum', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('handles equal min and max', () => {
      expect(clamp(5, 3, 3)).toBe(3);
    });
  });

  describe('lerp', () => {
    it('returns start value at t=0', () => {
      expect(lerp(0, 10, 0)).toBe(0);
    });

    it('returns end value at t=1', () => {
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('returns midpoint at t=0.5', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
    });

    it('interpolates correctly', () => {
      expect(lerp(0, 10, 0.25)).toBeCloseTo(2.5, 5);
      expect(lerp(0, 10, 0.75)).toBeCloseTo(7.5, 5);
    });

    it('works with negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
    });
  });

  describe('isPointInCircle', () => {
    it('returns true for point at center', () => {
      expect(isPointInCircle(0, 0, 0, 0, 10)).toBe(true);
    });

    it('returns true for point inside circle', () => {
      expect(isPointInCircle(5, 0, 0, 0, 10)).toBe(true);
    });

    it('returns true for point on edge', () => {
      expect(isPointInCircle(10, 0, 0, 0, 10)).toBe(true);
    });

    it('returns false for point outside circle', () => {
      expect(isPointInCircle(15, 0, 0, 0, 10)).toBe(false);
    });

    it('works with offset circles', () => {
      expect(isPointInCircle(15, 15, 10, 10, 10)).toBe(true);
      expect(isPointInCircle(25, 15, 10, 10, 10)).toBe(false);
    });
  });

  describe('isPointInRect', () => {
    it('returns true for point at corner', () => {
      expect(isPointInRect(0, 0, 0, 0, 10, 10)).toBe(true);
    });

    it('returns true for point inside rect', () => {
      expect(isPointInRect(5, 5, 0, 0, 10, 10)).toBe(true);
    });

    it('returns true for point on edge', () => {
      expect(isPointInRect(10, 5, 0, 0, 10, 10)).toBe(true);
    });

    it('returns false for point outside rect', () => {
      expect(isPointInRect(15, 5, 0, 0, 10, 10)).toBe(false);
      expect(isPointInRect(5, 15, 0, 0, 10, 10)).toBe(false);
    });

    it('works with offset rects', () => {
      expect(isPointInRect(15, 15, 10, 10, 10, 10)).toBe(true);
      expect(isPointInRect(25, 15, 10, 10, 10, 10)).toBe(false);
    });
  });

  describe('getPlaneNormal', () => {
    it('returns correct normal for XY plane', () => {
      const normal = getPlaneNormal('xy');
      expect(normal).toEqual([0, 0, 1]);
    });

    it('returns correct normal for XZ plane', () => {
      const normal = getPlaneNormal('xz');
      expect(normal).toEqual([0, 1, 0]);
    });

    it('returns correct normal for YZ plane', () => {
      const normal = getPlaneNormal('yz');
      expect(normal).toEqual([1, 0, 0]);
    });
  });

  describe('getPlaneAxes', () => {
    it('returns correct axes for XY plane', () => {
      const [axis1, axis2] = getPlaneAxes('xy');
      expect(axis1).toEqual([1, 0, 0]);
      expect(axis2).toEqual([0, 1, 0]);
    });

    it('returns correct axes for XZ plane', () => {
      const [axis1, axis2] = getPlaneAxes('xz');
      expect(axis1).toEqual([1, 0, 0]);
      expect(axis2).toEqual([0, 0, 1]);
    });

    it('returns correct axes for YZ plane', () => {
      const [axis1, axis2] = getPlaneAxes('yz');
      expect(axis1).toEqual([0, 1, 0]);
      expect(axis2).toEqual([0, 0, 1]);
    });
  });
});

