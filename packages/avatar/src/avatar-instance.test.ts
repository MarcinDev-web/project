import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entity } from '@engine/world';
import { AvatarInstance } from './avatar-instance';
import type { AvatarLoadout, AvatarMaterialResolver } from './avatar-instance';
import type { AvatarAnimation } from './animation';
import type { AvatarSlot, AvatarPartLibrary } from './slots';
import type { RgbaColor } from '@engine/world';
import type { AvatarJointName } from './skeleton';
import { DEFAULT_AVATAR_PART_DEFINITIONS } from './default-parts';
import { createAvatarPartLibrary } from './part-library-factory';

describe('AvatarInstance', () => {
  let parentEntity: Entity;

  beforeEach(() => {
    parentEntity = new Entity('TestParent');
  });

  describe('constructor', () => {
    it('should create avatar instance with default options', () => {
      const avatar = new AvatarInstance(parentEntity);

      expect(avatar.getRootEntity()).toBeDefined();
      expect(avatar.getRootEntity().parent).toBe(parentEntity);
      expect(avatar.getRootEntity().userData.isAvatarInstanceRoot).toBe(true);
      expect(avatar.getSkeleton()).toBeDefined();
      expect(avatar.getAnimator()).toBeDefined();
    });

    it('should create avatar instance with custom name', () => {
      const avatar = new AvatarInstance(parentEntity, { name: 'CustomAvatar' });

      expect(avatar.getRootEntity().name).toBe('CustomAvatar');
    });

    it('should apply default loadout on construction', () => {
      const avatar = new AvatarInstance(parentEntity);
      const loadout = avatar.serializeLoadout();

      expect(loadout.version).toBe(1);
      expect(loadout.parts).toBeDefined();
    });

    it('should apply custom loadout on construction', () => {
      const customLoadout: AvatarLoadout = {
        version: 1,
        parts: {
          HeadSlot: { mesh: 'head_default' },
        },
      };

      const avatar = new AvatarInstance(parentEntity, { loadout: customLoadout });
      const serialized = avatar.serializeLoadout();

      expect(serialized.parts?.HeadSlot).toBeDefined();
    });
  });

  describe('getRootEntity', () => {
    it('should return the root entity', () => {
      const avatar = new AvatarInstance(parentEntity);
      const root = avatar.getRootEntity();

      expect(root).toBeDefined();
      expect(root.parent).toBe(parentEntity);
    });
  });

  describe('getSkeleton', () => {
    it('should return the skeleton instance', () => {
      const avatar = new AvatarInstance(parentEntity);
      const skeleton = avatar.getSkeleton();

      expect(skeleton).toBeDefined();
      expect(skeleton.getJointNames().length).toBeGreaterThan(0);
    });
  });

  describe('getAnimator', () => {
    it('should return the animator instance', () => {
      const avatar = new AvatarInstance(parentEntity);
      const animator = avatar.getAnimator();

      expect(animator).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update animator and sync joint entities', () => {
      const avatar = new AvatarInstance(parentEntity);

      // Should not throw
      expect(() => {
        avatar.update(0.016); // ~60fps
      }).not.toThrow();
    });

    it('should handle multiple updates', () => {
      const avatar = new AvatarInstance(parentEntity);

      for (let i = 0; i < 10; i++) {
        avatar.update(0.016);
      }

      // Should still be valid
      expect(avatar.getRootEntity()).toBeDefined();
    });
  });

  describe('playAnimation', () => {
    it('should play animation', () => {
      const avatar = new AvatarInstance(parentEntity);
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      expect(() => {
        avatar.playAnimation(animation, 0);
      }).not.toThrow();
    });

    it('should play animation with custom start time', () => {
      const avatar = new AvatarInstance(parentEntity);
      const animation: AvatarAnimation = {
        name: 'test',
        length: 2.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
          {
            time: 1.0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      expect(() => {
        avatar.playAnimation(animation, 0.5);
      }).not.toThrow();
    });
  });

  describe('stopAnimation', () => {
    it('should stop animation', () => {
      const avatar = new AvatarInstance(parentEntity);
      const animation: AvatarAnimation = {
        name: 'test',
        length: 1.0,
        loop: false,
        frames: [
          {
            time: 0,
            joints: {
              Head: { rotation: [0, 0, 0, 1] },
            },
          },
        ],
      };

      avatar.playAnimation(animation);
      expect(() => {
        avatar.stopAnimation();
      }).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should clean up and remove from parent', () => {
      const avatar = new AvatarInstance(parentEntity);
      const root = avatar.getRootEntity();

      expect(parentEntity.children.includes(root)).toBe(true);

      avatar.dispose();

      expect(parentEntity.children.includes(root)).toBe(false);
    });

    it('should unmount all slots on dispose', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.dispose();

      // Should not throw
      expect(avatar.getRootEntity()).toBeDefined();
    });
  });

  describe('applyLoadout', () => {
    it('should apply loadout with parts', () => {
      const avatar = new AvatarInstance(parentEntity);
      const loadout: AvatarLoadout = {
        version: 1,
        parts: {
          HeadSlot: { mesh: 'head_default' },
          TorsoSlot: { mesh: 'torso_default' },
        },
      };

      avatar.applyLoadout(loadout);
      const serialized = avatar.serializeLoadout();

      expect(serialized.parts?.HeadSlot).toBeDefined();
      expect(serialized.parts?.TorsoSlot).toBeDefined();
    });

    it('should replace existing loadout', () => {
      const avatar = new AvatarInstance(parentEntity);
      const loadout1: AvatarLoadout = {
        version: 1,
        parts: {
          HeadSlot: { mesh: 'head_default' },
        },
      };
      const loadout2: AvatarLoadout = {
        version: 1,
        parts: {
          TorsoSlot: { mesh: 'torso_default' },
        },
      };

      avatar.applyLoadout(loadout1);
      avatar.applyLoadout(loadout2);

      const serialized = avatar.serializeLoadout();
      // HeadSlot should be removed, TorsoSlot should exist
      expect(serialized.parts?.HeadSlot).toBeUndefined();
      expect(serialized.parts?.TorsoSlot).toBeDefined();
    });

    it('should handle empty loadout', () => {
      const avatar = new AvatarInstance(parentEntity);
      const emptyLoadout: AvatarLoadout = {
        version: 1,
        parts: {},
      };

      expect(() => {
        avatar.applyLoadout(emptyLoadout);
      }).not.toThrow();
    });
  });

  describe('setSlot', () => {
    it('should set slot with part', () => {
      const avatar = new AvatarInstance(parentEntity);

      avatar.setSlot('HeadSlot', { mesh: 'head_default' });

      const loadout = avatar.serializeLoadout();
      expect(loadout.parts?.HeadSlot).toBeDefined();
      expect(loadout.parts?.HeadSlot?.mesh).toBe('head_default');
    });

    it('should set slot with colors', () => {
      const avatar = new AvatarInstance(parentEntity);

      avatar.setSlot('HeadSlot', {
        mesh: 'head_default',
        colors: { primary: [1, 0, 0, 1] },
      });

      const loadout = avatar.serializeLoadout();
      expect(loadout.parts?.HeadSlot?.colors?.primary).toEqual([1, 0, 0, 1]);
    });

    it('should set slot with material', () => {
      const avatar = new AvatarInstance(parentEntity);

      avatar.setSlot('HeadSlot', {
        mesh: 'head_default',
        material: 'mat1',
      });

      const loadout = avatar.serializeLoadout();
      expect(loadout.parts?.HeadSlot?.material).toBe('mat1');
    });

    it('should remove slot when set to null', () => {
      const avatar = new AvatarInstance(parentEntity);

      avatar.setSlot('HeadSlot', { mesh: 'head_default' });
      expect(avatar.serializeLoadout().parts?.HeadSlot).toBeDefined();

      avatar.setSlot('HeadSlot', null);
      expect(avatar.serializeLoadout().parts?.HeadSlot).toBeUndefined();
    });

    it('should warn when part definition is missing', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const avatar = new AvatarInstance(parentEntity);
      avatar.setSlot('HeadSlot', { mesh: 'nonexistent_part' });

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('Missing definition');

      consoleSpy.mockRestore();
    });

    it('should warn when part slot mismatch', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Create custom library with wrong slot - use existing part but wrong slot
      const defaultLibrary = createAvatarPartLibrary(DEFAULT_AVATAR_PART_DEFINITIONS);
      const customLibrary: AvatarPartLibrary = {
        ...defaultLibrary,
        head_wrong_slot: {
          id: 'head_wrong_slot',
          displayName: 'Head Wrong Slot',
          slot: 'TorsoSlot' as AvatarSlot, // Wrong slot! Should be HeadSlot
          joint: 'Head' as AvatarJointName,
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1] as RgbaColor,
        },
      } as AvatarPartLibrary;

      const avatar = new AvatarInstance(parentEntity, { partLibrary: customLibrary });
      avatar.setSlot('HeadSlot', { mesh: 'head_wrong_slot' });

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('registered for');

      consoleSpy.mockRestore();
    });
  });

  describe('serializeLoadout', () => {
    it('should serialize current loadout', () => {
      const avatar = new AvatarInstance(parentEntity);
      const loadout = avatar.serializeLoadout();

      expect(loadout.version).toBe(1);
      expect(loadout.parts).toBeDefined();
    });

    it('should serialize loadout with colors', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.setSlot('HeadSlot', {
        mesh: 'head_default',
        colors: { primary: [0.5, 0.5, 0.5, 1] },
      });

      const loadout = avatar.serializeLoadout();
      expect(loadout.parts?.HeadSlot?.colors?.primary).toEqual([0.5, 0.5, 0.5, 1]);
    });

    it('should serialize loadout with material', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.setSlot('HeadSlot', {
        mesh: 'head_default',
        material: 'custom_mat',
      });

      const loadout = avatar.serializeLoadout();
      expect(loadout.parts?.HeadSlot?.material).toBe('custom_mat');
    });

    it('should serialize empty loadout', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.applyLoadout({ version: 1, parts: {} });

      const loadout = avatar.serializeLoadout();
      expect(loadout.parts).toBeDefined();
      expect(Object.keys(loadout.parts || {})).toHaveLength(0);
    });
  });

  describe('isEntityPartOfAvatar', () => {
    it('should return true for root entity', () => {
      const avatar = new AvatarInstance(parentEntity);
      const root = avatar.getRootEntity();

      expect(avatar.isEntityPartOfAvatar(root)).toBe(true);
    });

    it('should return true for child entity', () => {
      const avatar = new AvatarInstance(parentEntity);
      const root = avatar.getRootEntity();

      // Find a child entity (should be a joint)
      const children = root.children;
      expect(children.length).toBeGreaterThan(0);

      if (children.length > 0) {
        expect(avatar.isEntityPartOfAvatar(children[0])).toBe(true);
      }
    });

    it('should return false for unrelated entity', () => {
      const avatar = new AvatarInstance(parentEntity);
      const unrelated = new Entity('Unrelated');

      expect(avatar.isEntityPartOfAvatar(unrelated)).toBe(false);
    });

    it('should return false for null', () => {
      const avatar = new AvatarInstance(parentEntity);

      expect(avatar.isEntityPartOfAvatar(null)).toBe(false);
      expect(avatar.isEntityPartOfAvatar(undefined)).toBe(false);
    });
  });

  describe('setSlotVisible', () => {
    it('should set slot visibility', () => {
      const avatar = new AvatarInstance(parentEntity);

      // Set a slot first
      avatar.setSlot('HeadSlot', { mesh: 'head_default' });

      const slotEntity = avatar.getSlotEntity('HeadSlot');
      expect(slotEntity).toBeDefined();

      if (slotEntity) {
        avatar.setSlotVisible('HeadSlot', false);
        expect(slotEntity.active).toBe(false);

        avatar.setSlotVisible('HeadSlot', true);
        expect(slotEntity.active).toBe(true);
      }
    });

    it('should handle setting visibility for non-existent slot', () => {
      const avatar = new AvatarInstance(parentEntity);

      expect(() => {
        avatar.setSlotVisible('HeadSlot', false);
      }).not.toThrow();
    });
  });

  describe('getSlotEntity', () => {
    it('should return slot entity when set', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.setSlot('HeadSlot', { mesh: 'head_default' });

      const entity = avatar.getSlotEntity('HeadSlot');
      expect(entity).toBeDefined();
      expect(entity?.userData.avatarSlot).toBe('HeadSlot');
    });

    it('should return undefined for unmounted slot', () => {
      const avatar = new AvatarInstance(parentEntity, {
        loadout: { version: 1, parts: {} },
      });

      const entity = avatar.getSlotEntity('HeadSlot');
      expect(entity).toBeUndefined();
    });

    it('should return undefined after removing slot', () => {
      const avatar = new AvatarInstance(parentEntity);
      avatar.setSlot('HeadSlot', { mesh: 'head_default' });
      avatar.setSlot('HeadSlot', null);

      const entity = avatar.getSlotEntity('HeadSlot');
      expect(entity).toBeUndefined();
    });
  });

  describe('materialResolver', () => {
    it('should use material resolver when provided', () => {
      const resolver: AvatarMaterialResolver = vi.fn((id: string) => {
        if (id === 'test_mat') {
          return {
            materialId: 1,
            color: [1, 0, 0, 1] as RgbaColor,
            metallic: 0.5,
            roughness: 0.5,
          };
        }
        return null;
      });

      const avatar = new AvatarInstance(parentEntity, { materialResolver: resolver });

      avatar.setSlot('HeadSlot', {
        mesh: 'head_default',
        material: 'test_mat',
      });

      expect(resolver).toHaveBeenCalledWith('test_mat');
    });
  });
});

