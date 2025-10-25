import { describe, it, expect, vi } from 'vitest';
import { QuaternionHelper } from '../editor/utils/QuaternionHelper';
import type { Quat } from '@engine/core/math';
import { transformVec3ByQuat } from '@engine/core/math';

describe('QuaternionHelper', () => {
  describe('identity', () => {
    it('should create identity quaternion', () => {
      const result = QuaternionHelper.identity();
      expect(result).toEqual([0, 0, 0, 1]);
    });
  });

  describe('isIdentity', () => {
    it('should recognize identity quaternion', () => {
      const quat: Quat = [0, 0, 0, 1];
      expect(QuaternionHelper.isIdentity(quat)).toBe(true);
    });

    it('should recognize non-identity quaternion', () => {
      const quat: Quat = [0.707, 0, 0, 0.707];
      expect(QuaternionHelper.isIdentity(quat)).toBe(false);
    });

    it('should use epsilon tolerance', () => {
      const quat: Quat = [0.00001, 0, 0, 1];
      expect(QuaternionHelper.isIdentity(quat, 0.001)).toBe(true);
      expect(QuaternionHelper.isIdentity(quat, 0.000001)).toBe(false);
    });
  });

  describe('normalizeAngle', () => {
    it('should keep angles in [0, 360)', () => {
      expect(QuaternionHelper.normalizeAngle(45)).toBe(45);
      expect(QuaternionHelper.normalizeAngle(360)).toBe(0);
      expect(QuaternionHelper.normalizeAngle(720)).toBe(0);
    });

    it('should handle negative angles', () => {
      expect(QuaternionHelper.normalizeAngle(-45)).toBe(315);
      expect(QuaternionHelper.normalizeAngle(-360)).toBe(0);
    });
  });

  describe('snapAngle', () => {
    it('should not snap in free mode', () => {
      expect(QuaternionHelper.snapAngle(47, 'free')).toBe(47);
    });

    it('should snap to 15 degrees', () => {
      expect(QuaternionHelper.snapAngle(47, '15deg')).toBe(45);
      expect(QuaternionHelper.snapAngle(52, '15deg')).toBe(60);
    });

    it('should snap to 45 degrees', () => {
      expect(QuaternionHelper.snapAngle(47, '45deg')).toBe(45);
      expect(QuaternionHelper.snapAngle(70, '45deg')).toBe(90);
    });

    it('should snap to 90 degrees', () => {
      expect(QuaternionHelper.snapAngle(47, '90deg')).toBe(0);
      expect(QuaternionHelper.snapAngle(80, '90deg')).toBe(90);
    });
  });

  describe('normalize', () => {
    it('should normalize quaternion', () => {
      const quat: Quat = [1, 0, 0, 1];
      const result = QuaternionHelper.normalize(quat);
      
      // Check length is 1
      const len = Math.sqrt(
        result[0] ** 2 +
        result[1] ** 2 +
        result[2] ** 2 +
        result[3] ** 2
      );
      expect(len).toBeCloseTo(1, 5);
    });

    it('should return identity for zero quaternion', () => {
      const quat: Quat = [0, 0, 0, 0];
      const result = QuaternionHelper.normalize(quat);
      expect(result).toEqual(QuaternionHelper.identity());
    });
  });

  describe('isValid', () => {
    it('should validate valid quaternions', () => {
      expect(QuaternionHelper.isValid([0, 0, 0, 1])).toBe(true);
      expect(QuaternionHelper.isValid([0.707, 0, 0, 0.707])).toBe(true);
    });

    it('should reject invalid quaternions', () => {
      expect(QuaternionHelper.isValid([NaN, 0, 0, 1])).toBe(false);
      expect(QuaternionHelper.isValid([0, Infinity, 0, 1])).toBe(false);
    });
  });

  describe('clone', () => {
    it('should create a copy', () => {
      const quat: Quat = [1, 2, 3, 4];
      const result = QuaternionHelper.clone(quat);
      expect(result).toEqual(quat);
      expect(result).not.toBe(quat);
    });
  });

  describe('getSnapIncrement', () => {
    it('should return correct increments', () => {
      expect(QuaternionHelper.getSnapIncrement('free')).toBe(1);
      expect(QuaternionHelper.getSnapIncrement('15deg')).toBe(15);
      expect(QuaternionHelper.getSnapIncrement('45deg')).toBe(45);
      expect(QuaternionHelper.getSnapIncrement('90deg')).toBe(90);
    });
  });

  describe('formatEuler', () => {
    it('should format Euler angles', () => {
      const euler = { pitch: 45, yaw: 90, roll: 180 };
      const result = QuaternionHelper.formatEuler(euler);
      expect(result).toBe('(45.0°, 90.0°, 180.0°)');
    });

    it('should use custom precision', () => {
      const euler = { pitch: 45.123, yaw: 90.456, roll: 180.789 };
      const result = QuaternionHelper.formatEuler(euler, 2);
      expect(result).toBe('(45.12°, 90.46°, 180.79°)');
    });
  });

  describe('parseEuler', () => {
    it('should parse comma-separated angles', () => {
      const result = QuaternionHelper.parseEuler('45, 90, 180');
      expect(result).toEqual({ pitch: 45, yaw: 90, roll: 180 });
    });

    it('should parse parenthesized angles', () => {
      const result = QuaternionHelper.parseEuler('(45, 90, 180)');
      expect(result).toEqual({ pitch: 45, yaw: 90, roll: 180 });
    });

    it('should parse angles with degree symbols', () => {
      const result = QuaternionHelper.parseEuler('(45°, 90°, 180°)');
      expect(result).toEqual({ pitch: 45, yaw: 90, roll: 180 });
    });

    it('should return null for invalid input', () => {
      expect(QuaternionHelper.parseEuler('45, 90')).toBeNull();
      expect(QuaternionHelper.parseEuler('invalid')).toBeNull();
      expect(QuaternionHelper.parseEuler('45, 90, invalid')).toBeNull();
    });
  });

  describe('slerp', () => {
    it('should interpolate at t=0', () => {
      const a: Quat = [0, 0, 0, 1];
      const b: Quat = [0.707, 0, 0, 0.707];
      const result = QuaternionHelper.slerp(a, b, 0);
      
      // Should be close to 'a', normalized
      expect(result[0]).toBeCloseTo(0, 5);
      expect(result[3]).toBeCloseTo(1, 5);
    });

    it('should interpolate at t=1', () => {
      const a: Quat = [0, 0, 0, 1];
      const b: Quat = [0.707, 0, 0, 0.707];
      const result = QuaternionHelper.slerp(a, b, 1);
      
      // Should be close to 'b', normalized
      expect(result[0]).toBeCloseTo(0.707, 2);
      expect(result[3]).toBeCloseTo(0.707, 2);
    });
  });

  describe('clipboard operations', () => {
    it('should copy to clipboard', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      const quat: Quat = [0, 0, 0, 1];
      const result = await QuaternionHelper.copyToClipboard(quat);
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalled();
    });

    it('should paste from clipboard', async () => {
      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue('(0.0°, 0.0°, 0.0°)'),
        },
      });

      const result = await QuaternionHelper.pasteFromClipboard();
      expect(result).not.toBeNull();
    });

    it('should handle clipboard errors gracefully', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
        },
      });

      const quat: Quat = [0, 0, 0, 1];
      const result = await QuaternionHelper.copyToClipboard(quat);
      expect(result).toBe(false);
    });
  });

  describe('rotation operations', () => {
    it('should rotate around X axis', () => {
      const identity = QuaternionHelper.identity();
      const result = QuaternionHelper.rotateX(identity, 90);
      
      // Verify rotation was applied (not identity)
      expect(QuaternionHelper.isIdentity(result)).toBe(false);

      // Physical check: X axis should remain invariant
      const xAxis: [number, number, number] = [1, 0, 0];
      const rotated = transformVec3ByQuat(xAxis, result);
      expect(rotated[0]).toBeCloseTo(1, 4);
      expect(rotated[1]).toBeCloseTo(0, 4);
      expect(rotated[2]).toBeCloseTo(0, 4);
    });

    it('should rotate around Y axis', () => {
      const identity = QuaternionHelper.identity();
      const result = QuaternionHelper.rotateY(identity, 90);
      
      // Verify rotation was applied (not identity)
      expect(QuaternionHelper.isIdentity(result)).toBe(false);

      // Physical check: Y axis should remain invariant
      const yAxis: [number, number, number] = [0, 1, 0];
      const rotated = transformVec3ByQuat(yAxis, result);
      expect(rotated[0]).toBeCloseTo(0, 4);
      expect(rotated[1]).toBeCloseTo(1, 4);
      expect(rotated[2]).toBeCloseTo(0, 4);
    });

    it('should rotate around Z axis', () => {
      const identity = QuaternionHelper.identity();
      const result = QuaternionHelper.rotateZ(identity, 90);
      
      // Verify rotation was applied (not identity)
      expect(QuaternionHelper.isIdentity(result)).toBe(false);

      // Physical check: Z axis should remain invariant
      const zAxis: [number, number, number] = [0, 0, 1];
      const rotated = transformVec3ByQuat(zAxis, result);
      expect(rotated[0]).toBeCloseTo(0, 4);
      expect(rotated[1]).toBeCloseTo(0, 4);
      expect(rotated[2]).toBeCloseTo(1, 4);
    });
  });

  describe('mirror', () => {
    it('should mirror rotation around X axis', () => {
      const quat = QuaternionHelper.rotateX(QuaternionHelper.identity(), 45);
      const mirrored = QuaternionHelper.mirror(quat, 'x');
      
      // Mirrored rotation should be different
      expect(mirrored).not.toEqual(quat);
    });

    it('should mirror rotation around Y axis', () => {
      const quat = QuaternionHelper.rotateY(QuaternionHelper.identity(), 45);
      const mirrored = QuaternionHelper.mirror(quat, 'y');
      
      // Mirrored rotation should be different
      expect(mirrored).not.toEqual(quat);
    });

    it('should mirror rotation around Z axis', () => {
      const quat = QuaternionHelper.rotateZ(QuaternionHelper.identity(), 45);
      const mirrored = QuaternionHelper.mirror(quat, 'z');
      
      // Mirrored rotation should be different
      expect(mirrored).not.toEqual(quat);
    });
  });
});

