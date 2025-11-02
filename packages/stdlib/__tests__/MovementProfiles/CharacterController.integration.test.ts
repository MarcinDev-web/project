import { describe, it, expect, beforeEach } from 'vitest';
import { CharacterController } from '@engine/world';
import { Entity } from '@engine/world';
import { Scene } from '@engine/world';
import { MovementProfile, MovementProfileRegistry, PRESET_PROFILES } from '../../src/MovementProfiles';
import { DEFAULT_CHARACTER_CONFIG } from '@engine/world';

describe('CharacterController - Movement Profiles Integration', () => {
  let entity: Entity;
  let controller: CharacterController;
  let scene: Scene;

  beforeEach(() => {
    scene = new Scene();
    entity = new Entity('TestPlayer');
    entity.transform.position = [0, 10, 0];
    controller = new CharacterController();
    entity.addComponent(controller);
    scene.addEntity(entity);
  });

  describe('applyProfile', () => {
    it('should apply profile config to controller', () => {
      const profile = PRESET_PROFILES.FAST_HUMAN;
      
      controller.applyProfile(profile);

      expect(controller.config.moveSpeed).toBe(profile.config.moveSpeed);
      expect(controller.config.sprintMultiplier).toBe(profile.config.sprintMultiplier);
      expect(controller.config.jumpForce).toBe(profile.config.jumpForce);
    });

    it('should get current profile after applying', () => {
      const profile = PRESET_PROFILES.HUMAN;
      
      controller.applyProfile(profile);

      const currentProfile = controller.getCurrentProfile();
      expect(currentProfile).toBe(profile);
      expect(currentProfile?.id).toBe('human');
    });

    it('should update config when switching profiles', () => {
      const slowProfile = PRESET_PROFILES.SLOW_HUMAN;
      const fastProfile = PRESET_PROFILES.FAST_HUMAN;

      controller.applyProfile(slowProfile);
      expect(controller.config.moveSpeed).toBe(slowProfile.config.moveSpeed);

      controller.applyProfile(fastProfile);
      expect(controller.config.moveSpeed).toBe(fastProfile.config.moveSpeed);
      expect(controller.getCurrentProfile()).toBe(fastProfile);
    });

    it('should apply profile extensions onApply hook', () => {
      let onApplyCalled = false;
      const extension = {
        id: 'test-ext',
        name: 'Test Extension',
        onApply: (ctrl: CharacterController) => {
          onApplyCalled = true;
          expect(ctrl).toBe(controller);
        },
      };

      const profile = MovementProfile.create({
        id: 'with-ext',
        name: 'With Extension',
        config: DEFAULT_CHARACTER_CONFIG,
        extensions: [extension],
      });

      controller.applyProfile(profile);

      expect(onApplyCalled).toBe(true);
    });

    it('should modify config via extension modifyConfig hook', () => {
      const originalSpeed = DEFAULT_CHARACTER_CONFIG.moveSpeed;
      const extension = {
        id: 'modify-config',
        name: 'Modify Config',
        modifyConfig: (config: typeof DEFAULT_CHARACTER_CONFIG) => ({
          ...config,
          moveSpeed: config.moveSpeed * 2,
        }),
      };

      const profile = MovementProfile.create({
        id: 'modify-profile',
        name: 'Modify Profile',
        config: DEFAULT_CHARACTER_CONFIG,
        extensions: [extension],
      });

      controller.applyProfile(profile);

      expect(controller.config.moveSpeed).toBe(originalSpeed * 2);
    });
  });

  describe('Serialization', () => {
    it('should serialize profile ID', () => {
      controller.applyProfile(PRESET_PROFILES.HUMAN);
      
      const serialized = controller.serialize();
      
      expect(serialized.profileId).toBe('human');
      expect(serialized.config).toBeDefined();
    });

    it('should not include profileId if no profile applied', () => {
      const serialized = controller.serialize();
      
      expect(serialized.profileId).toBeUndefined();
    });

    it('should store profile ID placeholder on deserialize', () => {
      const data = {
        type: 'CharacterController',
        config: DEFAULT_CHARACTER_CONFIG,
        state: 'idle' as const,
        isGrounded: false,
        velocity: [0, 0, 0],
        profileId: 'human',
      };

      const deserialized = CharacterController.deserialize(data);
      
      const currentProfile = deserialized.getCurrentProfile();
      expect(currentProfile).toBeDefined();
      expect(currentProfile?.id).toBe('human');
    });
  });

  describe('Profile Registry Integration', () => {
    it('should use profiles from registry', () => {
      const registry = MovementProfileRegistry.getInstance();
      
      const customProfile = MovementProfile.create({
        id: 'custom-test',
        name: 'Custom Test',
        config: { ...DEFAULT_CHARACTER_CONFIG, moveSpeed: 15.0 },
      });

      registry.register(customProfile);

      const retrieved = registry.get('custom-test');
      expect(retrieved).toBe(customProfile);

      controller.applyProfile(retrieved!);
      expect(controller.config.moveSpeed).toBe(15.0);
    });

    it('should work with preset profiles', () => {
      const profile = PRESET_PROFILES.FAST_HUMAN;
      controller.applyProfile(profile);
      
      expect(controller.getCurrentProfile()?.id).toBe('fast-human');
      expect(controller.config.moveSpeed).toBe(7.0);
    });
  });

  describe('Clone', () => {
    it('should clone controller with profile', () => {
      controller.applyProfile(PRESET_PROFILES.HUMAN);
      
      const cloned = controller.clone();
      
      expect(cloned.config.moveSpeed).toBe(controller.config.moveSpeed);
      expect(cloned.getCurrentProfile()?.id).toBe(controller.getCurrentProfile()?.id);
    });
  });
});

