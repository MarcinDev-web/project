import { describe, it, expect, beforeEach } from 'vitest';
import { AvatarLoadoutSerializer } from './avatar-loadout-serializer';
import type { AvatarLoadout } from '../avatar-instance';
import type { AvatarSlot, AvatarPartLibrary } from '../slots';
import type { RgbaColor } from '@engine/world';

describe('AvatarLoadoutSerializer', () => {
  let serializer: AvatarLoadoutSerializer;

  beforeEach(() => {
    serializer = new AvatarLoadoutSerializer();
  });

  describe('serialize', () => {
    it('should serialize selections to loadout', () => {
      const selections = new Map<AvatarSlot, any>();
      selections.set('HeadSlot', {
        id: 'head_default',
        colors: { primary: [1, 0, 0, 1] as RgbaColor },
        materialId: 'mat1',
      });

      const loadout = serializer.serialize(selections);

      expect(loadout.version).toBe(1);
      expect(loadout.parts?.HeadSlot).toEqual({
        mesh: 'head_default',
        material: 'mat1',
        mat: 'mat1',
        colors: { primary: [1, 0, 0, 1] },
      });
    });

    it('should handle selections without material or colors', () => {
      const selections = new Map<AvatarSlot, any>();
      selections.set('HeadSlot', {
        id: 'head_default',
      });

      const loadout = serializer.serialize(selections);

      expect(loadout.parts?.HeadSlot).toEqual({
        mesh: 'head_default',
      });
    });
  });

  describe('validate', () => {
    it('should validate correct loadout', () => {
      const library: AvatarPartLibrary = {
        head_default: {
          id: 'head_default',
          displayName: 'Head',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        },
      };

      const loadout: AvatarLoadout = {
        version: 1,
        parts: {
          HeadSlot: { mesh: 'head_default' },
        },
      };

      const result = serializer.validate(loadout, library);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing mesh in library', () => {
      const library: AvatarPartLibrary = {};

      const loadout: AvatarLoadout = {
        version: 1,
        parts: {
          HeadSlot: { mesh: 'head_default' },
        },
      };

      const result = serializer.validate(loadout, library);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('unknown mesh');
    });

    it('should detect slot mismatch', () => {
      const library: AvatarPartLibrary = {
        head_default: {
          id: 'head_default',
          displayName: 'Head',
          slot: 'TorsoSlot', // Wrong slot!
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1],
        },
      };

      const loadout: AvatarLoadout = {
        version: 1,
        parts: {
          HeadSlot: { mesh: 'head_default' },
        },
      };

      const result = serializer.validate(loadout, library);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('registered for');
    });
  });
});

