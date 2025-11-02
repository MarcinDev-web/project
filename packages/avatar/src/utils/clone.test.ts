import { describe, it, expect } from 'vitest';
import { cloneColor, cloneColorRecord, cloneVec3, cloneQuat, clonePartDefinition } from './clone';
import type { RgbaColor } from '@engine/world';
import type { Vec3, Quat } from '@engine/core/math';
import type { AvatarPartDefinition } from '../slots';

describe('clone', () => {
  describe('cloneColor', () => {
    it('should clone rgba color', () => {
      const color: RgbaColor = [0.5, 0.6, 0.7, 1.0];
      const cloned = cloneColor(color);
      expect(cloned).toEqual([0.5, 0.6, 0.7, 1.0]);
      expect(cloned).not.toBe(color); // Different reference
    });
  });

  describe('cloneColorRecord', () => {
    it('should clone color record', () => {
      const colors: Record<string, RgbaColor> = {
        primary: [1, 0, 0, 1],
        secondary: [0, 1, 0, 1],
      };
      const cloned = cloneColorRecord(colors);
      expect(cloned).toEqual(colors);
      expect(cloned).not.toBe(colors);
      expect(cloned?.primary).not.toBe(colors.primary);
    });

    it('should return undefined for undefined input', () => {
      expect(cloneColorRecord(undefined)).toBeUndefined();
    });
  });

  describe('cloneVec3', () => {
    it('should clone vec3', () => {
      const vec: Vec3 = [1, 2, 3];
      const cloned = cloneVec3(vec);
      expect(cloned).toEqual([1, 2, 3]);
      expect(cloned).not.toBe(vec);
    });
  });

  describe('cloneQuat', () => {
    it('should clone quaternion', () => {
      const quat: Quat = [0, 0, 0, 1];
      const cloned = cloneQuat(quat);
      expect(cloned).toEqual([0, 0, 0, 1]);
      expect(cloned).not.toBe(quat);
    });
  });

  describe('clonePartDefinition', () => {
    it('should clone part definition', () => {
      const definition: AvatarPartDefinition = {
        id: 'test',
        displayName: 'Test',
        slot: 'HeadSlot',
        joint: 'Head',
        mesh: 'sphere',
        localPosition: [0, 0, 0],
        localRotation: [0, 0, 0, 1],
        localScale: [1, 1, 1],
        defaultColor: [1, 1, 1, 1],
      };
      const cloned = clonePartDefinition(definition);
      expect(cloned).toEqual(definition);
      expect(cloned).not.toBe(definition);
      expect(cloned.localPosition).not.toBe(definition.localPosition);
      expect(cloned.localRotation).not.toBe(definition.localRotation);
    });
  });
});

