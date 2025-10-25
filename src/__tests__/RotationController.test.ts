import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RotationController } from '../editor/controllers/RotationController';
import { Entity } from '../scene/Entity';
import { QuaternionHelper } from '../editor/utils/QuaternionHelper';
import type { Quat } from '@engine/core/math';
import { transformVec3ByQuat } from '@engine/core/math';

describe('RotationController', () => {
  let controller: RotationController;
  let entity: Entity;
  let onRotationChanged: ReturnType<typeof vi.fn>;
  let onStatusMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRotationChanged = vi.fn();
    onStatusMessage = vi.fn();

    controller = new RotationController({
      onRotationChanged,
      onStatusMessage,
    });

    entity = new Entity('TestEntity');
  });

  describe('snap modes', () => {
    it('should start with 45deg snap mode', () => {
      expect(controller.getSnapMode()).toBe('45deg');
    });

    it('should set snap mode', () => {
      controller.setSnapMode('free');
      expect(controller.getSnapMode()).toBe('free');
      expect(onStatusMessage).toHaveBeenCalledWith('Rotation snap: Free', 1000);
    });

    it('should cycle through snap modes', () => {
      expect(controller.getSnapMode()).toBe('45deg');
      
      controller.cycleSnapMode();
      expect(controller.getSnapMode()).toBe('90deg');
      
      controller.cycleSnapMode();
      expect(controller.getSnapMode()).toBe('free');
      
      controller.cycleSnapMode();
      expect(controller.getSnapMode()).toBe('15deg');
      
      controller.cycleSnapMode();
      expect(controller.getSnapMode()).toBe('45deg');
    });
  });

  describe('rotation operations', () => {
    it('should rotate around X axis', () => {
      const initialRotation = [...entity.transform.rotation];
      
      controller.rotateX(entity, 45);
      
      expect(entity.transform.rotation).not.toEqual(initialRotation);
      expect(onRotationChanged).toHaveBeenCalledWith(entity, entity.transform.rotation);
    });

    it('should rotate around Y axis', () => {
      const initialRotation = [...entity.transform.rotation];
      
      controller.rotateY(entity, 45);
      
      expect(entity.transform.rotation).not.toEqual(initialRotation);
      expect(onRotationChanged).toHaveBeenCalledWith(entity, entity.transform.rotation);
    });

    it('should rotate around Z axis', () => {
      const initialRotation = [...entity.transform.rotation];
      
      controller.rotateZ(entity, 45);
      
      expect(entity.transform.rotation).not.toEqual(initialRotation);
      expect(onRotationChanged).toHaveBeenCalledWith(entity, entity.transform.rotation);
    });

    it('should apply snap mode', () => {
      controller.setSnapMode('90deg');
      
      controller.rotateY(entity, 47); // Should snap to 0 or 90
      
      const euler = controller.getEulerAngles(entity);
      // After snapping, yaw should be a multiple of 90
      expect(euler.yaw % 90).toBeCloseTo(0, 1);
    });
  });

  describe('Euler angle operations', () => {
    it('should set Euler angles', () => {
      controller.setSnapMode('free');
      const euler = { pitch: 30, yaw: 60, roll: 90 };
      
      controller.setEulerAngles(entity, euler);
      
      const result = controller.getEulerAngles(entity);
      expect(result.pitch).toBeCloseTo(30, 0);
      expect(result.yaw).toBeCloseTo(60, 0);
      expect(result.roll).toBeCloseTo(90, 0);
    });

    it('should get Euler angles', () => {
      controller.setSnapMode('free');
      // Use simpler angles that round-trip better
      const euler = { pitch: 0, yaw: 90, roll: 0 };
      controller.setEulerAngles(entity, euler);
      
      const result = controller.getEulerAngles(entity);
      
      expect(result.pitch).toBeCloseTo(0, 1);
      expect(result.yaw).toBeCloseTo(90, 1);
      expect(result.roll).toBeCloseTo(0, 1);
    });
  });

  describe('reset rotation', () => {
    it('should reset to identity', () => {
      controller.rotateY(entity, 90);
      
      controller.resetRotation(entity);
      
      expect(entity.transform.rotation).toEqual(QuaternionHelper.identity());
      expect(onStatusMessage).toHaveBeenCalledWith('Rotation reset', 1000);
    });
  });

  describe('copy and paste', () => {
    it('should copy rotation', () => {
      controller.rotateY(entity, 90);
      
      controller.copyRotation(entity);
      
      expect(onStatusMessage).toHaveBeenCalledWith('Rotation copied', 1000);
    });

    it('should paste rotation', () => {
      const sourceEntity = new Entity('Source');
      controller.rotateY(sourceEntity, 90);
      controller.copyRotation(sourceEntity);
      
      const success = controller.pasteRotation(entity);
      
      expect(success).toBe(true);
      expect(entity.transform.rotation).toEqual(sourceEntity.transform.rotation);
      expect(onStatusMessage).toHaveBeenCalledWith('Rotation pasted', 1000);
    });

    it('should fail to paste without copying first', () => {
      const success = controller.pasteRotation(entity);
      
      expect(success).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith('No rotation to paste', 1000);
    });
  });

  describe('quick rotate', () => {
    it('should quick rotate 45 degrees', () => {
      controller.quickRotate(entity, 'y', 45);
      
      const euler = controller.getEulerAngles(entity);
      expect(euler.yaw).toBeCloseTo(45, 0);
      expect(onStatusMessage).toHaveBeenCalledWith('Rotated to 45° on Y axis', 1000);
    });

    it('should quick rotate 90 degrees', () => {
      controller.quickRotate(entity, 'x', 90);
      
      const euler = controller.getEulerAngles(entity);
      expect(euler.pitch).toBeCloseTo(90, 0);
      expect(onStatusMessage).toHaveBeenCalledWith('Rotated to 90° on X axis', 1000);
    });

    it('should quick rotate 180 degrees', () => {
      controller.quickRotate(entity, 'z', 180);
      
      const euler = controller.getEulerAngles(entity);
      expect(euler.roll).toBeCloseTo(180, 0);
      expect(onStatusMessage).toHaveBeenCalledWith('Rotated to 180° on Z axis', 1000);
    });
  });

  describe('physical axes', () => {
    it('rotateX should keep X axis invariant', () => {
      controller.rotateX(entity, 90);
      const q = entity.transform.rotation as Quat;
      const xAxis: [number, number, number] = [1, 0, 0];
      const rotated = transformVec3ByQuat(xAxis, q);
      expect(rotated[0]).toBeCloseTo(1, 4);
      expect(rotated[1]).toBeCloseTo(0, 4);
      expect(rotated[2]).toBeCloseTo(0, 4);
    });

    it('rotateY should keep Y axis invariant', () => {
      controller.resetRotation(entity);
      controller.rotateY(entity, 90);
      const q = entity.transform.rotation as Quat;
      const yAxis: [number, number, number] = [0, 1, 0];
      const rotated = transformVec3ByQuat(yAxis, q);
      expect(rotated[0]).toBeCloseTo(0, 4);
      expect(rotated[1]).toBeCloseTo(1, 4);
      expect(rotated[2]).toBeCloseTo(0, 4);
    });

    it('rotateZ should keep Z axis invariant', () => {
      controller.resetRotation(entity);
      controller.rotateZ(entity, 90);
      const q = entity.transform.rotation as Quat;
      const zAxis: [number, number, number] = [0, 0, 1];
      const rotated = transformVec3ByQuat(zAxis, q);
      expect(rotated[0]).toBeCloseTo(0, 4);
      expect(rotated[1]).toBeCloseTo(0, 4);
      expect(rotated[2]).toBeCloseTo(1, 4);
    });
  });

  describe('mirror rotation', () => {
    it('should mirror around X axis', () => {
      controller.rotateX(entity, 45);
      const beforeMirror = [...entity.transform.rotation];
      
      controller.mirrorRotation(entity, 'x');
      
      expect(entity.transform.rotation).not.toEqual(beforeMirror);
      expect(onStatusMessage).toHaveBeenCalledWith('Rotation mirrored on X axis', 1000);
    });

    it('should mirror around Y axis', () => {
      controller.rotateY(entity, 45);
      const beforeMirror = [...entity.transform.rotation];
      
      controller.mirrorRotation(entity, 'y');
      
      expect(entity.transform.rotation).not.toEqual(beforeMirror);
      expect(onStatusMessage).toHaveBeenCalledWith('Rotation mirrored on Y axis', 1000);
    });

    it('should mirror around Z axis', () => {
      controller.rotateZ(entity, 45);
      const beforeMirror = [...entity.transform.rotation];
      
      controller.mirrorRotation(entity, 'z');
      
      expect(entity.transform.rotation).not.toEqual(beforeMirror);
      expect(onStatusMessage).toHaveBeenCalledWith('Rotation mirrored on Z axis', 1000);
    });
  });

  describe('align to world', () => {
    it('should align to world axes', () => {
      controller.rotateY(entity, 47); // Close to 45
      controller.setSnapMode('free');
      
      controller.alignToWorld(entity);
      
      const euler = controller.getEulerAngles(entity);
      // Should be snapped to nearest 90° (check distance to nearest 90° interval)
      const nearestPitch90 = Math.round(euler.pitch / 90) * 90;
      const nearestYaw90 = Math.round(euler.yaw / 90) * 90;
      const nearestRoll90 = Math.round(euler.roll / 90) * 90;
      expect(Math.abs(euler.pitch - nearestPitch90)).toBeLessThan(1);
      expect(Math.abs(euler.yaw - nearestYaw90)).toBeLessThan(1);
      expect(Math.abs(euler.roll - nearestRoll90)).toBeLessThan(1);
      expect(onStatusMessage).toHaveBeenCalledWith('Aligned to world axes', 1000);
    });
  });

  describe('format rotation', () => {
    it('should format rotation for display', () => {
      controller.setSnapMode('free');
      // Use simpler angles that convert better
      controller.setEulerAngles(entity, { pitch: 0, yaw: 90, roll: 0 });
      const formatted = controller.formatRotation(entity);

      expect(formatted).toContain('90');
      expect(formatted).toMatch(/\d+\.\d+°/); // Should contain degree symbol and decimal format
    });
  });

  describe('isIdentity', () => {
    it('should recognize identity rotation', () => {
      expect(controller.isIdentity(entity)).toBe(true);
    });

    it('should recognize non-identity rotation', () => {
      controller.rotateY(entity, 45);
      
      expect(controller.isIdentity(entity)).toBe(false);
    });
  });

  describe('clipboard operations', () => {
    beforeEach(() => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
          readText: vi.fn().mockResolvedValue('(45.0°, 90.0°, 135.0°)'),
        },
      });
    });

    it('should copy to clipboard', async () => {
      controller.setEulerAngles(entity, { pitch: 45, yaw: 90, roll: 135 });
      
      const success = await controller.copyToClipboard(entity);
      
      expect(success).toBe(true);
      expect(onStatusMessage).toHaveBeenCalledWith('Rotation copied to clipboard', 1000);
    });

    it('should paste from clipboard', async () => {
      const success = await controller.pasteFromClipboard(entity);
      
      expect(success).toBe(true);
      expect(onStatusMessage).toHaveBeenCalledWith('Rotation pasted from clipboard', 1000);
      
      // Verify rotation was set
      expect(QuaternionHelper.isIdentity(entity.transform.rotation)).toBe(false);
    });

    it('should handle clipboard errors', async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
        },
      });

      const success = await controller.copyToClipboard(entity);
      
      expect(success).toBe(false);
      expect(onStatusMessage).toHaveBeenCalledWith('Failed to copy rotation', 1000);
    });
  });
});

