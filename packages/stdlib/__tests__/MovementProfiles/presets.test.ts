import { describe, it, expect } from 'vitest';
import { PRESET_PROFILES, getPresetProfile, getPresetProfileIds } from '../../src/MovementProfiles';
import { DEFAULT_CHARACTER_CONFIG } from '@engine/world';

describe('Preset Profiles', () => {
  describe('PRESET_PROFILES', () => {
    it('should have HUMAN profile', () => {
      expect(PRESET_PROFILES.HUMAN).toBeDefined();
      expect(PRESET_PROFILES.HUMAN.id).toBe('human');
      expect(PRESET_PROFILES.HUMAN.name).toBe('Human');
    });

    it('should have FAST_HUMAN profile with increased speed', () => {
      expect(PRESET_PROFILES.FAST_HUMAN).toBeDefined();
      expect(PRESET_PROFILES.FAST_HUMAN.id).toBe('fast-human');
      expect(PRESET_PROFILES.FAST_HUMAN.config.moveSpeed).toBeGreaterThan(
        DEFAULT_CHARACTER_CONFIG.moveSpeed
      );
      expect(PRESET_PROFILES.FAST_HUMAN.config.sprintMultiplier).toBeGreaterThan(
        DEFAULT_CHARACTER_CONFIG.sprintMultiplier
      );
    });

    it('should have SLOW_HUMAN profile with reduced speed', () => {
      expect(PRESET_PROFILES.SLOW_HUMAN).toBeDefined();
      expect(PRESET_PROFILES.SLOW_HUMAN.id).toBe('slow-human');
      expect(PRESET_PROFILES.SLOW_HUMAN.config.moveSpeed).toBeLessThan(
        DEFAULT_CHARACTER_CONFIG.moveSpeed
      );
      expect(PRESET_PROFILES.SLOW_HUMAN.config.sprintMultiplier).toBeLessThan(
        DEFAULT_CHARACTER_CONFIG.sprintMultiplier
      );
    });

    it('should have HEAVY_HUMAN profile', () => {
      expect(PRESET_PROFILES.HEAVY_HUMAN).toBeDefined();
      expect(PRESET_PROFILES.HEAVY_HUMAN.id).toBe('heavy-human');
      expect(PRESET_PROFILES.HEAVY_HUMAN.config.gravityMultiplier).toBeGreaterThan(
        DEFAULT_CHARACTER_CONFIG.gravityMultiplier
      );
      expect(PRESET_PROFILES.HEAVY_HUMAN.config.airControlMultiplier).toBeLessThan(
        DEFAULT_CHARACTER_CONFIG.airControlMultiplier
      );
    });

    it('should have AGILE_HUMAN profile', () => {
      expect(PRESET_PROFILES.AGILE_HUMAN).toBeDefined();
      expect(PRESET_PROFILES.AGILE_HUMAN.id).toBe('agile-human');
      expect(PRESET_PROFILES.AGILE_HUMAN.config.airControlMultiplier).toBeGreaterThan(
        DEFAULT_CHARACTER_CONFIG.airControlMultiplier
      );
      expect(PRESET_PROFILES.AGILE_HUMAN.config.rotationSpeed).toBeGreaterThan(
        DEFAULT_CHARACTER_CONFIG.rotationSpeed
      );
    });

    it('should have FLYING_HUMAN profile with flying extension', () => {
      expect(PRESET_PROFILES.FLYING_HUMAN).toBeDefined();
      expect(PRESET_PROFILES.FLYING_HUMAN.id).toBe('flying-human');
      expect(PRESET_PROFILES.FLYING_HUMAN.extensions).toBeDefined();
      expect(PRESET_PROFILES.FLYING_HUMAN.extensions?.length).toBeGreaterThan(0);
      expect(PRESET_PROFILES.FLYING_HUMAN.extensions?.[0].id).toBe('flying');
    });

    it('should have SPEED_BOOST_HUMAN profile with speed boost extension', () => {
      expect(PRESET_PROFILES.SPEED_BOOST_HUMAN).toBeDefined();
      expect(PRESET_PROFILES.SPEED_BOOST_HUMAN.id).toBe('speed-boost-human');
      expect(PRESET_PROFILES.SPEED_BOOST_HUMAN.extensions).toBeDefined();
      expect(PRESET_PROFILES.SPEED_BOOST_HUMAN.extensions?.length).toBeGreaterThan(0);
      expect(PRESET_PROFILES.SPEED_BOOST_HUMAN.extensions?.[0].id).toBe('speed-boost');
    });

    it('should have VEHICLE_MODE profile with vehicle extension', () => {
      expect(PRESET_PROFILES.VEHICLE_MODE).toBeDefined();
      expect(PRESET_PROFILES.VEHICLE_MODE.id).toBe('vehicle-mode');
      expect(PRESET_PROFILES.VEHICLE_MODE.extensions).toBeDefined();
      expect(PRESET_PROFILES.VEHICLE_MODE.extensions?.length).toBeGreaterThan(0);
      expect(PRESET_PROFILES.VEHICLE_MODE.extensions?.[0].id).toBe('vehicle');
    });

    it('should have valid config for all presets', () => {
      for (const [key, profile] of Object.entries(PRESET_PROFILES)) {
        expect(profile.id).toBeTruthy();
        expect(profile.name).toBeTruthy();
        expect(profile.config.moveSpeed).toBeGreaterThan(0);
        expect(profile.config.sprintMultiplier).toBeGreaterThan(1);
        expect(profile.config.jumpForce).toBeGreaterThan(0);
        expect(profile.config.gravityMultiplier).toBeGreaterThan(0);
      }
    });
  });

  describe('getPresetProfile', () => {
    it('should return HUMAN preset', () => {
      const profile = getPresetProfile('HUMAN');
      expect(profile).toBe(PRESET_PROFILES.HUMAN);
    });

    it('should return FAST_HUMAN preset', () => {
      const profile = getPresetProfile('FAST_HUMAN');
      expect(profile).toBe(PRESET_PROFILES.FAST_HUMAN);
    });

    it('should return SLOW_HUMAN preset', () => {
      const profile = getPresetProfile('SLOW_HUMAN');
      expect(profile).toBe(PRESET_PROFILES.SLOW_HUMAN);
    });
  });

  describe('getPresetProfileIds', () => {
    it('should return array of preset IDs', () => {
      const ids = getPresetProfileIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
    });

    it('should include all preset profile keys', () => {
      const ids = getPresetProfileIds();
      const expectedKeys = Object.keys(PRESET_PROFILES);

      expect(ids.length).toBe(expectedKeys.length);
      for (const key of expectedKeys) {
        expect(ids).toContain(key);
      }
    });
  });
});
