import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entity, MaterialComponent } from '@engine/world';
import { AvatarInstance } from './avatar-instance';
import { DEFAULT_AVATAR_LOADOUT } from './default-loadout';
import { DEFAULT_AVATAR_PART_DEFINITIONS } from './default-parts';
import { createAvatarPartLibrary } from './part-library-factory';
import type { AvatarLoadout } from './avatar-instance';
import { AVATAR_SLOTS } from './slots';

describe('AvatarInstance Integration', () => {
  let parentEntity: Entity;

  beforeEach(() => {
    parentEntity = new Entity('TestParent');
  });

  describe('full loadout application', () => {
    it('should create avatar with full default loadout', () => {
      const avatar = new AvatarInstance(parentEntity, {
        loadout: DEFAULT_AVATAR_LOADOUT,
      });

      const serialized = avatar.serializeLoadout();
      expect(serialized.version).toBe(2);
      expect(serialized.parts).toBeDefined();

      // Check that all slots from default loadout are present
      const defaultSlots = Object.keys(DEFAULT_AVATAR_LOADOUT.parts || {});
      for (const slot of defaultSlots) {
        expect(serialized.parts?.[slot as keyof typeof serialized.parts]).toBeDefined();
      }
    });

    it('should mount all parts from loadout', () => {
      const avatar = new AvatarInstance(parentEntity, {
        loadout: DEFAULT_AVATAR_LOADOUT,
      });

      // Check that slot entities exist for all parts in loadout
      for (const slot of AVATAR_SLOTS) {
        const part = DEFAULT_AVATAR_LOADOUT.parts?.[slot];
        if (part) {
          const slotEntity = avatar.getSlotEntity(slot);
          expect(slotEntity).toBeDefined();
          expect(slotEntity?.userData.avatarSlot).toBe(slot);
          expect(slotEntity?.userData.avatarPartId).toBeDefined();
        }
      }
    });

    it('should apply materials and colors correctly', () => {
      const avatar = new AvatarInstance(parentEntity, {
        loadout: DEFAULT_AVATAR_LOADOUT,
      });

      const headSlot = avatar.getSlotEntity('HeadSlot');
      expect(headSlot).toBeDefined();
      if (headSlot) {
        // Check that color slots are set
        expect(headSlot.userData.avatarColorSlots).toBeDefined();
        // Check that material component exists
        const materialComponent = headSlot.getComponent(MaterialComponent);
        expect(materialComponent).toBeDefined();
      }
    });
  });

  describe('loadout validation', () => {
    it('should warn on invalid loadout but continue applying valid parts', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const invalidLoadout: AvatarLoadout = {
        version: 1,
        parts: {
          HeadSlot: { mesh: 'nonexistent_part' },
          TorsoSlot: { mesh: 'torso_default' }, // Valid
        },
      };

      const avatar = new AvatarInstance(parentEntity, {
        loadout: invalidLoadout,
      });

      // Should have warned about invalid part
      expect(consoleSpy).toHaveBeenCalled();
      const warnCalls = consoleSpy.mock.calls.filter((call) =>
        call[0]?.toString().includes('validation failed'),
      );
      expect(warnCalls.length).toBeGreaterThan(0);

      // Valid part should still be applied
      const torsoEntity = avatar.getSlotEntity('TorsoSlot');
      expect(torsoEntity).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe('dispose cleanup', () => {
    it('should clean up all entities on dispose', () => {
      const avatar = new AvatarInstance(parentEntity, {
        loadout: DEFAULT_AVATAR_LOADOUT,
      });

      const root = avatar.getRootEntity();
      expect(parentEntity.children.includes(root)).toBe(true);

      avatar.dispose();

      // Root should be removed from parent
      expect(parentEntity.children.includes(root)).toBe(false);

      // All slot entities should be unmounted
      for (const slot of AVATAR_SLOTS) {
        const slotEntity = avatar.getSlotEntity(slot);
        expect(slotEntity).toBeUndefined();
      }
    });

    it('should not have side effects after dispose', () => {
      const avatar = new AvatarInstance(parentEntity, {
        loadout: DEFAULT_AVATAR_LOADOUT,
      });

      avatar.dispose();

      // Should not throw when accessing disposed avatar
      expect(() => {
        avatar.getRootEntity();
        avatar.getSkeleton();
        avatar.getAnimator();
        avatar.serializeLoadout();
      }).not.toThrow();
    });
  });

  describe('custom part library', () => {
    it('should work with custom part library', () => {
      const customLibrary = createAvatarPartLibrary([
        ...DEFAULT_AVATAR_PART_DEFINITIONS,
        {
          id: 'custom_head',
          displayName: 'Custom Head',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0.12, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [0.3, 0.3, 0.3],
          defaultColor: [1, 0, 0, 1],
          colorSlots: ['primary'],
        },
      ]);

      const customLoadout: AvatarLoadout = {
        version: 1,
        parts: {
          HeadSlot: { mesh: 'custom_head' },
        },
      };

      const avatar = new AvatarInstance(parentEntity, {
        partLibrary: customLibrary,
        loadout: customLoadout,
      });

      const headEntity = avatar.getSlotEntity('HeadSlot');
      expect(headEntity).toBeDefined();
      expect(headEntity?.userData.avatarPartId).toBe('custom_head');
    });
  });
});

