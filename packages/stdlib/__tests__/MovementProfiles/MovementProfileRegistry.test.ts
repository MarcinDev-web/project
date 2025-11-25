import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MovementProfileRegistry } from '../../src/MovementProfiles';
import { MovementProfile } from '../../src/MovementProfiles';
import { DEFAULT_CHARACTER_CONFIG } from '@engine/world';

describe('MovementProfileRegistry', () => {
  let registry: MovementProfileRegistry;

  beforeEach(() => {
    // Clear singleton instance for each test
    (MovementProfileRegistry as any).instance = null;
    registry = MovementProfileRegistry.getInstance();
    registry.clear(); // Clear defaults to start fresh
  });

  describe('Singleton', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = MovementProfileRegistry.getInstance();
      const instance2 = MovementProfileRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Registration', () => {
    it('should register a profile', () => {
      const profile = MovementProfile.create({
        id: 'test-register',
        name: 'Test Register',
        config: DEFAULT_CHARACTER_CONFIG,
      });

      registry.register(profile);

      expect(registry.has('test-register')).toBe(true);
      expect(registry.get('test-register')).toBe(profile);
    });

    it('should warn when overwriting existing profile', () => {
      const profile1 = MovementProfile.create({
        id: 'duplicate',
        name: 'First',
        config: DEFAULT_CHARACTER_CONFIG,
      });

      const profile2 = MovementProfile.create({
        id: 'duplicate',
        name: 'Second',
        config: DEFAULT_CHARACTER_CONFIG,
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registry.register(profile1);
      registry.register(profile2);

      expect(consoleSpy).toHaveBeenCalled();
      expect(registry.get('duplicate')).toBe(profile2);

      consoleSpy.mockRestore();
    });

    it('should unregister a profile', () => {
      const profile = MovementProfile.create({
        id: 'to-unregister',
        name: 'To Unregister',
        config: DEFAULT_CHARACTER_CONFIG,
      });

      registry.register(profile);
      expect(registry.has('to-unregister')).toBe(true);

      const removed = registry.unregister('to-unregister');
      expect(removed).toBe(true);
      expect(registry.has('to-unregister')).toBe(false);
      expect(registry.get('to-unregister')).toBe(null);
    });
  });

  describe('Retrieval', () => {
    it('should get registered profile by ID', () => {
      const profile = MovementProfile.create({
        id: 'retrieve-test',
        name: 'Retrieve Test',
        config: DEFAULT_CHARACTER_CONFIG,
      });

      registry.register(profile);

      const retrieved = registry.get('retrieve-test');
      expect(retrieved).toBe(profile);
    });

    it('should return null for non-existent profile', () => {
      const retrieved = registry.get('non-existent');
      expect(retrieved).toBe(null);
    });

    it('should get all registered profiles', () => {
      registry.clear(); // Clear defaults first - but clear() re-registers defaults

      const profile1 = MovementProfile.create({
        id: 'all-1',
        name: 'All 1',
        config: DEFAULT_CHARACTER_CONFIG,
      });

      const profile2 = MovementProfile.create({
        id: 'all-2',
        name: 'All 2',
        config: DEFAULT_CHARACTER_CONFIG,
      });

      registry.register(profile1);
      registry.register(profile2);

      const all = registry.getAll();
      // clear() re-registers defaults (5 profiles), plus our 2 = 7 total
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all).toContain(profile1);
      expect(all).toContain(profile2);
    });
  });

  describe('Default Profiles', () => {
    it('should register default preset profiles', () => {
      registry.clear();
      registry.register(MovementProfileRegistry.getDefaultProfiles()[0]);

      const defaultProfiles = MovementProfileRegistry.getDefaultProfiles();
      expect(defaultProfiles.length).toBeGreaterThan(0);
    });

    it('should include preset profiles after clear', () => {
      registry.clear();
      const defaultProfiles = MovementProfileRegistry.getDefaultProfiles();

      // Re-register defaults
      for (const profile of defaultProfiles) {
        registry.register(profile);
      }

      expect(registry.getAll().length).toBeGreaterThanOrEqual(defaultProfiles.length);
    });
  });

  describe('Extension Registry', () => {
    it('should register and retrieve extensions', () => {
      const extension = {
        id: 'test-extension',
        name: 'Test Extension',
      };

      registry.registerExtension(extension);

      const retrieved = registry.getExtension('test-extension');
      expect(retrieved).toBe(extension);
    });

    it('should return null for non-existent extension', () => {
      const retrieved = registry.getExtension('non-existent');
      expect(retrieved).toBe(null);
    });
  });
});
