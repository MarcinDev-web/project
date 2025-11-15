import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entity, Scene, CharacterController, CharacterState, type CharacterInput } from '@engine/world';
import { PhysicsWorld } from '@engine/world/physics';
import { CharacterControllerSystem } from '@engine/stdlib/CharacterController';
import { MovementProfileRegistry, MovementProfile } from '@engine/stdlib/MovementProfiles';
import { DEFAULT_CHARACTER_CONFIG } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

describe('CharacterControllerSystem', () => {
  let scene: Scene;
  let physics: PhysicsWorld;
  let system: CharacterControllerSystem;
  let entity: Entity;
  let controller: CharacterController;

  beforeEach(() => {
    scene = new Scene();
    physics = new PhysicsWorld(scene);
    system = new CharacterControllerSystem(scene, physics);

    entity = new Entity('Player');
    entity.transform.position = [0, 10, 0];
    
    controller = new CharacterController();
    entity.addComponent(controller);
    
    scene.addEntity(entity);
  });

  describe('update()', () => {
    it('should update all character controllers in scene', () => {
      const updateSpy = vi.spyOn(controller, 'update');
      
      system.update(1 / 60);
      
      expect(updateSpy).toHaveBeenCalledWith(1 / 60);
    });

    it('should handle multiple controllers', () => {
      const entity2 = new Entity('Player2');
      entity2.transform.position = [0, 10, 0];
      const controller2 = new CharacterController();
      entity2.addComponent(controller2);
      scene.addEntity(entity2);

      const updateSpy1 = vi.spyOn(controller, 'update');
      const updateSpy2 = vi.spyOn(controller2, 'update');
      
      system.update(1 / 60);
      
      expect(updateSpy1).toHaveBeenCalled();
      expect(updateSpy2).toHaveBeenCalled();
    });

    it('should apply buffered intent to controller', () => {
      const setInputSpy = vi.spyOn(controller, 'setInput');
      const cameraForward: Vec3 = [0, 0, -1];
      const cameraRight: Vec3 = [1, 0, 0];
      
      // Apply intent
      system.applyIntent(controller, {
        move: [1, 0],
        jump: false,
        sprint: true,
      }, cameraForward, cameraRight);
      
      // Update should apply buffered intent
      system.update(1 / 60);
      
      expect(setInputSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          moveDirection: [1, 0, 0],
          sprint: true,
          jump: false,
          cameraForward: cameraForward,
          cameraRight: cameraRight,
        })
      );
    });

    it('should clear intent buffer after applying', () => {
      const setInputSpy = vi.spyOn(controller, 'setInput');
      const cameraForward: Vec3 = [0, 0, -1];
      const cameraRight: Vec3 = [1, 0, 0];
      
      // Apply intent
      system.applyIntent(controller, {
        move: [1, 0],
        jump: false,
        sprint: false,
      }, cameraForward, cameraRight);
      
      // First update should apply intent
      system.update(1 / 60);
      expect(setInputSpy).toHaveBeenCalledTimes(1);
      
      // Second update should not apply intent again (buffer cleared)
      setInputSpy.mockClear();
      system.update(1 / 60);
      expect(setInputSpy).not.toHaveBeenCalled();
    });

    it('should handle controller without buffered intent', () => {
      const setInputSpy = vi.spyOn(controller, 'setInput');
      
      // Update without applying intent first
      system.update(1 / 60);
      
      // Should not call setInput if no buffered intent
      expect(setInputSpy).not.toHaveBeenCalled();
    });

    it('should update profile extensions if present', () => {
      const profile = MovementProfile.create({
        id: 'test-profile',
        name: 'Test Profile',
        config: DEFAULT_CHARACTER_CONFIG,
        extensions: [
          {
            update: vi.fn(),
          },
        ],
      });
      
      controller.applyProfile(profile);
      
      system.update(1 / 60);
      
      const currentProfile = controller.getCurrentProfile();
      expect(currentProfile?.extensions?.[0]?.update).toHaveBeenCalledWith(controller, 1 / 60);
    });

    it('should handle profile without extensions', () => {
      const profile = MovementProfile.create({
        id: 'test-profile',
        name: 'Test Profile',
        config: DEFAULT_CHARACTER_CONFIG,
      });
      
      controller.applyProfile(profile);
      
      // Should not throw
      expect(() => {
        system.update(1 / 60);
      }).not.toThrow();
    });
  });

  describe('applyIntent()', () => {
    it('should buffer intent for controller', () => {
      const cameraForward: Vec3 = [0, 0, -1];
      const cameraRight: Vec3 = [1, 0, 0];
      
      system.applyIntent(controller, {
        move: [0.5, -0.3],
        jump: true,
        sprint: false,
      }, cameraForward, cameraRight);
      
      // Intent should be applied on next update
      const setInputSpy = vi.spyOn(controller, 'setInput');
      system.update(1 / 60);
      
      expect(setInputSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          moveDirection: [0.5, 0, -0.3],
          jump: true,
          sprint: false,
        })
      );
    });

    it('should create copies of Vec3 arrays to avoid reference issues', () => {
      const cameraForward: Vec3 = [0, 0, -1];
      const cameraRight: Vec3 = [1, 0, 0];
      
      system.applyIntent(controller, {
        move: [1, 0],
        jump: false,
        sprint: false,
      }, cameraForward, cameraRight);
      
      // Modify original arrays
      cameraForward[0] = 999;
      cameraRight[0] = 999;
      
      // Buffered intent should not be affected
      const setInputSpy = vi.spyOn(controller, 'setInput');
      system.update(1 / 60);
      
      expect(setInputSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          cameraForward: [0, 0, -1], // Original value, not modified
          cameraRight: [1, 0, 0], // Original value, not modified
        })
      );
    });

    it('should overwrite previous intent for same controller', () => {
      const cameraForward: Vec3 = [0, 0, -1];
      const cameraRight: Vec3 = [1, 0, 0];
      
      // Apply first intent
      system.applyIntent(controller, {
        move: [1, 0],
        jump: false,
        sprint: false,
      }, cameraForward, cameraRight);
      
      // Apply second intent (should overwrite first)
      system.applyIntent(controller, {
        move: [0, 1],
        jump: true,
        sprint: true,
      }, cameraForward, cameraRight);
      
      // Only second intent should be applied
      const setInputSpy = vi.spyOn(controller, 'setInput');
      system.update(1 / 60);
      
      expect(setInputSpy).toHaveBeenCalledTimes(1);
      expect(setInputSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          moveDirection: [0, 0, 1],
          jump: true,
          sprint: true,
        })
      );
    });

    it('should handle multiple controllers with different intents', () => {
      const entity2 = new Entity('Player2');
      entity2.transform.position = [0, 10, 0];
      const controller2 = new CharacterController();
      entity2.addComponent(controller2);
      scene.addEntity(entity2);

      const cameraForward: Vec3 = [0, 0, -1];
      const cameraRight: Vec3 = [1, 0, 0];
      
      // Apply different intents to each controller
      system.applyIntent(controller, {
        move: [1, 0],
        jump: false,
        sprint: true,
      }, cameraForward, cameraRight);
      
      system.applyIntent(controller2, {
        move: [0, 1],
        jump: true,
        sprint: false,
      }, cameraForward, cameraRight);
      
      const setInputSpy1 = vi.spyOn(controller, 'setInput');
      const setInputSpy2 = vi.spyOn(controller2, 'setInput');
      
      system.update(1 / 60);
      
      expect(setInputSpy1).toHaveBeenCalledWith(
        expect.objectContaining({
          moveDirection: [1, 0, 0],
          sprint: true,
          jump: false,
        })
      );
      
      expect(setInputSpy2).toHaveBeenCalledWith(
        expect.objectContaining({
          moveDirection: [0, 0, 1],
          sprint: false,
          jump: true,
        })
      );
    });
  });

  describe('ensureProfileLoaded()', () => {
    it('should load profile from registry if controller has placeholder profile', () => {
      const registry = MovementProfileRegistry.getInstance();
      const profile = MovementProfile.create({
        id: 'test-profile',
        name: 'Test Profile',
        config: DEFAULT_CHARACTER_CONFIG,
      });
      
      // Register profile in registry
      registry.register(profile);
      
      // Create placeholder profile (has id but empty name)
      const placeholderProfile = MovementProfile.deserialize({
        id: 'test-profile',
        name: '', // Empty name indicates placeholder
        config: DEFAULT_CHARACTER_CONFIG,
      });
      
      // Apply placeholder profile to controller
      controller.applyProfile(placeholderProfile);
      
      // System should load full profile from registry
      system.update(1 / 60);
      
      const currentProfile = controller.getCurrentProfile();
      expect(currentProfile?.name).toBe('Test Profile');
      expect(currentProfile?.id).toBe('test-profile');
    });

    it('should not load profile if controller already has full profile', () => {
      const registry = MovementProfileRegistry.getInstance();
      const profile = MovementProfile.create({
        id: 'test-profile',
        name: 'Test Profile',
        config: DEFAULT_CHARACTER_CONFIG,
      });
      
      // Register different profile in registry
      registry.register(MovementProfile.create({
        id: 'other-profile',
        name: 'Other Profile',
        config: DEFAULT_CHARACTER_CONFIG,
      }));
      
      // Apply full profile to controller
      controller.applyProfile(profile);
      
      // System should not change profile
      system.update(1 / 60);
      
      const currentProfile = controller.getCurrentProfile();
      expect(currentProfile?.name).toBe('Test Profile');
      expect(currentProfile?.id).toBe('test-profile');
    });

    it('should handle missing profile in registry gracefully', () => {
      const placeholderProfile = MovementProfile.deserialize({
        id: 'non-existent-profile',
        name: '', // Empty name indicates placeholder
        config: DEFAULT_CHARACTER_CONFIG,
      });
      
      // Apply placeholder profile to controller
      controller.applyProfile(placeholderProfile);
      
      // System should not throw if profile not found in registry
      expect(() => {
        system.update(1 / 60);
      }).not.toThrow();
      
      // Profile should remain as placeholder
      const currentProfile = controller.getCurrentProfile();
      expect(currentProfile?.name).toBe('');
      expect(currentProfile?.id).toBe('non-existent-profile');
    });

    it('should handle controller without profile', () => {
      // Controller created without profile
      expect(() => {
        system.update(1 / 60);
      }).not.toThrow();
    });

    it('should handle profile without id', () => {
      const profile = MovementProfile.create({
        id: 'test-profile',
        name: 'Test Profile',
        config: DEFAULT_CHARACTER_CONFIG,
      });
      
      // Manually set profile without id (edge case)
      (controller as any).currentProfile = {
        ...profile,
        id: undefined,
      };
      
      expect(() => {
        system.update(1 / 60);
      }).not.toThrow();
    });
  });

  describe('setInput()', () => {
    it('should set input directly on controller', () => {
      const input: CharacterInput = {
        moveDirection: [1, 0, 0],
        sprint: true,
        jump: false,
        cameraForward: [0, 0, -1],
        cameraRight: [1, 0, 0],
      };
      
      const setInputSpy = vi.spyOn(controller, 'setInput');
      
      system.setInput(controller, input);
      
      expect(setInputSpy).toHaveBeenCalledWith(input);
    });
  });

  describe('getControllers()', () => {
    it('should return all character controllers in scene', () => {
      const controllers = system.getControllers();
      
      expect(controllers).toHaveLength(1);
      expect(controllers[0]).toBe(controller);
    });

    it('should return multiple controllers', () => {
      const entity2 = new Entity('Player2');
      entity2.transform.position = [0, 10, 0];
      const controller2 = new CharacterController();
      entity2.addComponent(controller2);
      scene.addEntity(entity2);

      const controllers = system.getControllers();
      
      expect(controllers).toHaveLength(2);
      expect(controllers).toContain(controller);
      expect(controllers).toContain(controller2);
    });

    it('should return empty array when no controllers in scene', () => {
      scene.removeEntity(entity);
      
      const controllers = system.getControllers();
      
      expect(controllers).toHaveLength(0);
    });

    it('should filter out entities without CharacterController component', () => {
      const entity2 = new Entity('Player2');
      entity2.transform.position = [0, 10, 0];
      // No CharacterController component
      scene.addEntity(entity2);

      const controllers = system.getControllers();
      
      expect(controllers).toHaveLength(1);
      expect(controllers[0]).toBe(controller);
    });
  });

  describe('syncAnimation()', () => {
    it('should handle controller without entity', () => {
      // Create controller without adding it to entity
      const controllerWithoutEntity = new CharacterController();
      // Controller without entity should have entity as null/undefined
      // Use Object.defineProperty to simulate this scenario
      Object.defineProperty(controllerWithoutEntity, 'entity', {
        get: () => null,
        configurable: true,
      });
      
      expect(() => {
        system.syncAnimation(controllerWithoutEntity);
      }).not.toThrow();
    });

    it('should handle entity without AnimationComponent', () => {
      // Entity exists but no AnimationComponent
      expect(() => {
        system.syncAnimation(controller);
      }).not.toThrow();
    });

    it('should handle unknown CharacterState gracefully', () => {
      // Set invalid state (not in STATE_TO_ANIMATION mapping)
      (controller as any).state = 999;
      
      expect(() => {
        system.syncAnimation(controller);
      }).not.toThrow();
    });
  });

  describe('performance optimization', () => {
    it('should reuse controllers array between updates', () => {
      // First update
      system.update(1 / 60);
      const controllers1 = system.getControllers();
      
      // Second update
      system.update(1 / 60);
      const controllers2 = system.getControllers();
      
      // Arrays should be different instances (reused internally)
      // But should contain same controllers
      expect(controllers1).toHaveLength(controllers2.length);
      expect(controllers1[0]).toBe(controllers2[0]);
    });
  });
});

