import { describe, it, expect, beforeEach } from 'vitest';
import { Entity } from '@engine/world';
import { AvatarColorManager } from './avatar-color-manager';
import type { RgbaColor } from '@engine/world';
import type { AvatarPartDefinition } from '../slots';

describe('AvatarColorManager', () => {
  let manager: AvatarColorManager;
  let entity: Entity;

  beforeEach(() => {
    manager = new AvatarColorManager();
    entity = new Entity('TestEntity');
  });

  describe('applyColorSlots', () => {
    it('should apply override colors', () => {
      const selection = {
        id: 'test',
        definition: {
          id: 'test',
          displayName: 'Test',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1] as RgbaColor,
        } as AvatarPartDefinition,
        colors: {
          primary: [1, 0, 0, 1] as RgbaColor,
        },
      };

      const applied = manager.applyColorSlots(entity, selection);
      expect(applied.primary).toEqual([1, 0, 0, 1]);
      expect(entity.userData.avatarColorSlots).toBeDefined();
      expect((entity.userData.avatarColorSlots as Record<string, RgbaColor>).primary).toEqual([
        1, 0, 0, 1,
      ]);
    });

    it('should use default color when no override provided', () => {
      const selection = {
        id: 'test',
        definition: {
          id: 'test',
          displayName: 'Test',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [0.5, 0.5, 0.5, 1] as RgbaColor,
          colorSlots: ['primary'],
        } as AvatarPartDefinition,
      };

      const applied = manager.applyColorSlots(entity, selection);
      expect(applied.primary).toEqual([0.5, 0.5, 0.5, 1]);
    });

    it('should handle multiple color slots', () => {
      const selection = {
        id: 'test',
        definition: {
          id: 'test',
          displayName: 'Test',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1] as RgbaColor,
          defaultColors: {
            primary: [1, 0, 0, 1] as RgbaColor,
            secondary: [0, 1, 0, 1] as RgbaColor,
          },
        } as AvatarPartDefinition,
      };

      const applied = manager.applyColorSlots(entity, selection);
      expect(applied.primary).toEqual([1, 0, 0, 1]);
      expect(applied.secondary).toEqual([0, 1, 0, 1]);
    });
  });
});

