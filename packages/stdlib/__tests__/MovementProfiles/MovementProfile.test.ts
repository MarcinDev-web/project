import { describe, it, expect, beforeEach } from 'vitest';
import { MovementProfile, type MovementProfileData, type MovementProfileExtension } from '../../src/MovementProfiles';
import { DEFAULT_CHARACTER_CONFIG } from '@engine/world';
import type { CharacterController } from '@engine/world';

describe('MovementProfile', () => {
  let testConfig: typeof DEFAULT_CHARACTER_CONFIG;

  beforeEach(() => {
    testConfig = { ...DEFAULT_CHARACTER_CONFIG };
  });

  describe('Creation', () => {
    it('should create profile with required fields', () => {
      const profile = MovementProfile.create({
        id: 'test-profile',
        name: 'Test Profile',
        config: testConfig,
      });

      expect(profile.id).toBe('test-profile');
      expect(profile.name).toBe('Test Profile');
      expect(profile.config).toEqual(testConfig);
    });

    it('should create profile with optional description', () => {
      const profile = MovementProfile.create({
        id: 'test-profile',
        name: 'Test Profile',
        description: 'Test description',
        config: testConfig,
      });

      expect(profile.description).toBe('Test description');
    });

    it('should create profile with extensions', () => {
      const mockExtension: MovementProfileExtension = {
        id: 'test-ext',
        name: 'Test Extension',
      };

      const profile = MovementProfile.create({
        id: 'test-profile',
        name: 'Test Profile',
        config: testConfig,
        extensions: [mockExtension],
      });

      expect(profile.extensions).toHaveLength(1);
      expect(profile.extensions?.[0]).toBe(mockExtension);
    });

    it('should create profile using constructor', () => {
      const profileData: MovementProfileData = {
        id: 'constructor-profile',
        name: 'Constructor Profile',
        description: 'Created via constructor',
        config: testConfig,
      };

      const profile = new MovementProfile(profileData);

      expect(profile.id).toBe('constructor-profile');
      expect(profile.name).toBe('Constructor Profile');
      expect(profile.description).toBe('Created via constructor');
    });
  });

  describe('Serialization', () => {
    it('should serialize profile to JSON-compatible data', () => {
      const profile = MovementProfile.create({
        id: 'test-profile',
        name: 'Test Profile',
        description: 'Test description',
        config: testConfig,
      });

      const serialized = profile.serialize();

      expect(serialized).toEqual({
        id: 'test-profile',
        name: 'Test Profile',
        description: 'Test description',
        config: testConfig,
        extensions: undefined,
      });
    });

    it('should serialize extensions as IDs', () => {
      const extension: MovementProfileExtension = {
        id: 'ext-1',
        name: 'Extension 1',
      };

      const profile = MovementProfile.create({
        id: 'test-profile',
        name: 'Test Profile',
        config: testConfig,
        extensions: [extension],
      });

      const serialized = profile.serialize();

      expect(serialized.extensions).toEqual(['ext-1']);
    });

    it('should deserialize profile from data', () => {
      const data: MovementProfileData = {
        id: 'deserialized-profile',
        name: 'Deserialized Profile',
        config: testConfig,
      };

      const profile = MovementProfile.deserialize(data);

      expect(profile.id).toBe('deserialized-profile');
      expect(profile.name).toBe('Deserialized Profile');
      expect(profile.config).toEqual(testConfig);
    });

    it('should deserialize profile with extensions using resolver', () => {
      const extension: MovementProfileExtension = {
        id: 'resolved-ext',
        name: 'Resolved Extension',
      };

      const data: MovementProfileData = {
        id: 'profile-with-ext',
        name: 'Profile With Extension',
        config: testConfig,
        extensions: ['resolved-ext'],
      };

      const resolver = (id: string) => (id === 'resolved-ext' ? extension : null);
      const profile = MovementProfile.deserialize(data, resolver);

      expect(profile.extensions).toHaveLength(1);
      expect(profile.extensions?.[0]).toBe(extension);
    });

    it('should deserialize profile without extensions if resolver returns null', () => {
      const data: MovementProfileData = {
        id: 'profile-no-ext',
        name: 'Profile No Extension',
        config: testConfig,
        extensions: ['missing-ext'],
      };

      const resolver = () => null;
      const profile = MovementProfile.deserialize(data, resolver);

      expect(profile.extensions).toHaveLength(0);
    });
  });

  describe('Cloning', () => {
    it('should clone profile with all properties', () => {
      const extension: MovementProfileExtension = {
        id: 'clone-ext',
        name: 'Clone Extension',
      };

      const original = MovementProfile.create({
        id: 'original',
        name: 'Original',
        description: 'Original description',
        config: testConfig,
        extensions: [extension],
      });

      const cloned = original.clone();

      expect(cloned.id).toBe(original.id);
      expect(cloned.name).toBe(original.name);
      expect(cloned.description).toBe(original.description);
      expect(cloned.config).toEqual(original.config);
      expect(cloned.extensions).toEqual(original.extensions);
      expect(cloned.extensions).not.toBe(original.extensions); // Different array reference
    });
  });
});

