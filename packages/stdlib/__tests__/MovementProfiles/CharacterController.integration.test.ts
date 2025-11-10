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

  describe('applyProfile validation', () => {
    it('should throw error when profile is null', () => {
      expect(() => {
        controller.applyProfile(null as any);
      }).toThrow('MovementProfile cannot be null or undefined');
    });

    it('should throw error when profile is undefined', () => {
      expect(() => {
        controller.applyProfile(undefined as any);
      }).toThrow('MovementProfile cannot be null or undefined');
    });

    it('should throw error when profile missing id', () => {
      const invalidProfile = {
        name: 'Test',
        config: DEFAULT_CHARACTER_CONFIG,
      } as any;
      
      expect(() => {
        controller.applyProfile(invalidProfile);
      }).toThrow('MovementProfile missing id');
    });

    it('should throw error when profile missing config', () => {
      const invalidProfile = {
        id: 'test',
        name: 'Test',
      } as any;
      
      expect(() => {
        controller.applyProfile(invalidProfile);
      }).toThrow('MovementProfile "test" missing config');
    });

    it('should throw error when config is not an object', () => {
      const invalidProfile = {
        id: 'test',
        name: 'Test',
        config: 'not-an-object',
      } as any;
      
      expect(() => {
        controller.applyProfile(invalidProfile);
      }).toThrow('config must be an object');
    });

    it('should throw error when config is an array', () => {
      const invalidProfile = {
        id: 'test',
        name: 'Test',
        config: [],
      } as any;
      
      expect(() => {
        controller.applyProfile(invalidProfile);
      }).toThrow('config must be an object');
    });

    it('should throw error when moveSpeed is not positive', () => {
      const invalidProfile = MovementProfile.create({
        id: 'test',
        name: 'Test',
        config: {
          ...DEFAULT_CHARACTER_CONFIG,
          moveSpeed: -1,
        },
      });
      
      expect(() => {
        controller.applyProfile(invalidProfile);
      }).toThrow('moveSpeed must be positive');
    });

    it('should throw error when jumpForce is not positive', () => {
      const invalidProfile = MovementProfile.create({
        id: 'test',
        name: 'Test',
        config: {
          ...DEFAULT_CHARACTER_CONFIG,
          jumpForce: 0,
        },
      });
      
      expect(() => {
        controller.applyProfile(invalidProfile);
      }).toThrow('jumpForce must be positive');
    });

    it('should throw error when gravityMultiplier is negative', () => {
      const invalidProfile = MovementProfile.create({
        id: 'test',
        name: 'Test',
        config: {
          ...DEFAULT_CHARACTER_CONFIG,
          gravityMultiplier: -1,
        },
      });
      
      expect(() => {
        controller.applyProfile(invalidProfile);
      }).toThrow('gravityMultiplier cannot be negative');
    });

    it('should throw error when maxSlopeAngle is out of range', () => {
      const invalidProfile = MovementProfile.create({
        id: 'test',
        name: 'Test',
        config: {
          ...DEFAULT_CHARACTER_CONFIG,
          maxSlopeAngle: 100,
        },
      });
      
      expect(() => {
        controller.applyProfile(invalidProfile);
      }).toThrow('maxSlopeAngle must be between 0 and 90 degrees');
    });

    it('should throw error when airControlMultiplier is out of range', () => {
      const invalidProfile = MovementProfile.create({
        id: 'test',
        name: 'Test',
        config: {
          ...DEFAULT_CHARACTER_CONFIG,
          airControlMultiplier: 1.5,
        },
      });
      
      expect(() => {
        controller.applyProfile(invalidProfile);
      }).toThrow('airControlMultiplier must be between 0 and 1');
    });

    it('should accept valid profile', () => {
      const validProfile = MovementProfile.create({
        id: 'test',
        name: 'Test',
        config: DEFAULT_CHARACTER_CONFIG,
      });
      
      expect(() => {
        controller.applyProfile(validProfile);
      }).not.toThrow();
      
      expect(controller.getCurrentProfile()).toBe(validProfile);
    });
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

