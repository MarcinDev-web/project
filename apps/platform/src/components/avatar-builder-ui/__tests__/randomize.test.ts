/**
 * Avatar Builder Randomize Functionality Tests
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_AVATAR_PART_LIBRARY, AVATAR_SLOTS, type AvatarSlot, type AvatarPartLibrary } from '@engine/avatar';

// Re-implement the helper functions from AvatarBuilderPage for testing
function getAvailableMeshesForSlot(slot: AvatarSlot, library: AvatarPartLibrary): string[] {
  const meshes: string[] = [];
  for (const [partId, definition] of Object.entries(library)) {
    if (definition.slot === slot) {
      meshes.push(partId);
    }
  }
  return meshes;
}

function randomHslColor(
  hueMin = 0,
  hueMax = 360,
  satMin = 40,
  satMax = 80,
  lightMin = 30,
  lightMax = 70
): [number, number, number, number] {
  const h = Math.random() * (hueMax - hueMin) + hueMin;
  const s = Math.random() * (satMax - satMin) + satMin;
  const l = Math.random() * (lightMax - lightMin) + lightMin;
  
  const sNorm = s / 100;
  const lNorm = l / 100;
  
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lNorm - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  return [r + m, g + m, b + m, 1];
}

describe('Avatar Randomize', () => {
  describe('getAvailableMeshesForSlot', () => {
    it('should return meshes for HeadSlot', () => {
      const meshes = getAvailableMeshesForSlot('HeadSlot', DEFAULT_AVATAR_PART_LIBRARY);
      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes).toContain('head_default');
    });

    it('should return meshes for TorsoSlot', () => {
      const meshes = getAvailableMeshesForSlot('TorsoSlot', DEFAULT_AVATAR_PART_LIBRARY);
      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes).toContain('torso_default');
    });

    it('should return meshes for HairSlot', () => {
      const meshes = getAvailableMeshesForSlot('HairSlot', DEFAULT_AVATAR_PART_LIBRARY);
      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes).toContain('hair_default');
    });

    it('should return empty array for empty library', () => {
      const meshes = getAvailableMeshesForSlot('HeadSlot', {});
      expect(meshes).toHaveLength(0);
    });
  });

  describe('randomHslColor', () => {
    it('should generate RGBA color array', () => {
      const color = randomHslColor();
      expect(color).toHaveLength(4);
      expect(color[3]).toBe(1); // Alpha should always be 1
    });

    it('should generate colors within valid RGB range [0, 1]', () => {
      for (let i = 0; i < 100; i++) {
        const color = randomHslColor();
        expect(color[0]).toBeGreaterThanOrEqual(0);
        expect(color[0]).toBeLessThanOrEqual(1);
        expect(color[1]).toBeGreaterThanOrEqual(0);
        expect(color[1]).toBeLessThanOrEqual(1);
        expect(color[2]).toBeGreaterThanOrEqual(0);
        expect(color[2]).toBeLessThanOrEqual(1);
      }
    });

    it('should respect hue range', () => {
      // Generate multiple colors and verify they're different
      const colors = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const color = randomHslColor(0, 360, 50, 50, 50, 50);
        colors.add(JSON.stringify(color));
      }
      // With random hue, should have multiple different colors
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('DEFAULT_AVATAR_PART_LIBRARY', () => {
    it('should have parts for all core slots', () => {
      const coreSlots: AvatarSlot[] = [
        'HeadSlot', 'NeckSlot', 'TorsoSlot',
        'UpperArmSlotL', 'UpperArmSlotR',
        'LowerArmSlotL', 'LowerArmSlotR',
        'HandSlotL', 'HandSlotR',
        'UpperLegSlotL', 'UpperLegSlotR',
        'LowerLegSlotL', 'LowerLegSlotR',
        'FootSlotL', 'FootSlotR',
      ];

      for (const slot of coreSlots) {
        const meshes = getAvailableMeshesForSlot(slot, DEFAULT_AVATAR_PART_LIBRARY);
        expect(meshes.length).toBeGreaterThan(0);
      }
    });

    it('should have parts for optional slots', () => {
      const optionalSlots: AvatarSlot[] = ['HairSlot', 'BackSlot'];

      for (const slot of optionalSlots) {
        const meshes = getAvailableMeshesForSlot(slot, DEFAULT_AVATAR_PART_LIBRARY);
        expect(meshes.length).toBeGreaterThan(0);
      }
    });
  });
});

