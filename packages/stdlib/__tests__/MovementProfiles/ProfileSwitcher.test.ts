import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileSwitcher } from '../../src/MovementProfiles/ProfileSwitcher';
import { MovementProfile } from '../../src/MovementProfiles';
import { PRESET_PROFILES } from '../../src/MovementProfiles/presets';
import { DEFAULT_CHARACTER_CONFIG } from '@engine/world';

describe('ProfileSwitcher', () => {
  let profile1: MovementProfile;
  let profile2: MovementProfile;
  let profile3: MovementProfile;

  beforeEach(() => {
    profile1 = MovementProfile.create({
      id: 'profile-1',
      name: 'Profile 1',
      config: DEFAULT_CHARACTER_CONFIG,
    });

    profile2 = MovementProfile.create({
      id: 'profile-2',
      name: 'Profile 2',
      config: { ...DEFAULT_CHARACTER_CONFIG, moveSpeed: 10.0 },
    });

    profile3 = MovementProfile.create({
      id: 'profile-3',
      name: 'Profile 3',
      config: { ...DEFAULT_CHARACTER_CONFIG, moveSpeed: 15.0 },
    });
  });

  describe('Construction', () => {
    it('should create switcher with profiles', () => {
      const switcher = new ProfileSwitcher([profile1, profile2]);

      expect(switcher.getProfileCount()).toBe(2);
      expect(switcher.getCurrentProfile()).toBe(profile1);
    });

    it('should throw error if no profiles provided', () => {
      expect(() => new ProfileSwitcher([])).toThrow();
    });

    it('should set initial index correctly', () => {
      const switcher = new ProfileSwitcher([profile1, profile2, profile3], 1);

      expect(switcher.getCurrentProfile()).toBe(profile2);
      expect(switcher.getCurrentIndex()).toBe(1);
    });

    it('should clamp initial index to valid range', () => {
      const switcher1 = new ProfileSwitcher([profile1, profile2], -1);
      expect(switcher1.getCurrentIndex()).toBe(0);

      const switcher2 = new ProfileSwitcher([profile1, profile2], 10);
      expect(switcher2.getCurrentIndex()).toBe(1);
    });
  });

  describe('Switching', () => {
    it('should switch to next profile', () => {
      const switcher = new ProfileSwitcher([profile1, profile2, profile3]);

      expect(switcher.getCurrentProfile()).toBe(profile1);
      expect(switcher.switchToNext()).toBe(profile2);
      expect(switcher.getCurrentProfile()).toBe(profile2);
    });

    it('should cycle back to first when switching next from last', () => {
      const switcher = new ProfileSwitcher([profile1, profile2, profile3], 2);

      expect(switcher.getCurrentProfile()).toBe(profile3);
      expect(switcher.switchToNext()).toBe(profile1);
      expect(switcher.getCurrentProfile()).toBe(profile1);
    });

    it('should switch to previous profile', () => {
      const switcher = new ProfileSwitcher([profile1, profile2, profile3], 1);

      expect(switcher.getCurrentProfile()).toBe(profile2);
      expect(switcher.switchToPrevious()).toBe(profile1);
      expect(switcher.getCurrentProfile()).toBe(profile1);
    });

    it('should cycle back to last when switching previous from first', () => {
      const switcher = new ProfileSwitcher([profile1, profile2, profile3], 0);

      expect(switcher.getCurrentProfile()).toBe(profile1);
      expect(switcher.switchToPrevious()).toBe(profile3);
      expect(switcher.getCurrentProfile()).toBe(profile3);
    });

    it('should switch to specific profile by ID', () => {
      const switcher = new ProfileSwitcher([profile1, profile2, profile3]);

      const result = switcher.switchTo('profile-3');

      expect(result).toBe(profile3);
      expect(switcher.getCurrentProfile()).toBe(profile3);
      expect(switcher.getCurrentIndex()).toBe(2);
    });

    it('should return null when switching to non-existent profile', () => {
      const switcher = new ProfileSwitcher([profile1, profile2, profile3]);

      const result = switcher.switchTo('non-existent');

      expect(result).toBe(null);
      // Current profile should not change
      expect(switcher.getCurrentProfile()).toBe(profile1);
    });
  });

  describe('Getters', () => {
    it('should get all profiles', () => {
      const profiles = [profile1, profile2, profile3];
      const switcher = new ProfileSwitcher(profiles);

      expect(switcher.getAllProfiles()).toEqual(profiles);
    });

    it('should check if profile exists', () => {
      const switcher = new ProfileSwitcher([profile1, profile2, profile3]);

      expect(switcher.hasProfile('profile-1')).toBe(true);
      expect(switcher.hasProfile('profile-2')).toBe(true);
      expect(switcher.hasProfile('non-existent')).toBe(false);
    });
  });

  describe('Integration with Presets', () => {
    it('should work with preset profiles', () => {
      const switcher = new ProfileSwitcher([
        PRESET_PROFILES.HUMAN,
        PRESET_PROFILES.FAST_HUMAN,
        PRESET_PROFILES.FLYING_HUMAN,
      ]);

      expect(switcher.getCurrentProfile().id).toBe('human');

      switcher.switchToNext();
      expect(switcher.getCurrentProfile().id).toBe('fast-human');

      switcher.switchTo('flying-human');
      expect(switcher.getCurrentProfile().id).toBe('flying-human');
    });
  });
});
