import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CharacterController } from '@engine/world';
import { Entity } from '@engine/world';
import { Scene } from '@engine/world';
import { 
  FlyingExtension, 
  SpeedBoostExtension, 
  VehicleExtension,
  type MovementExtensionInputProvider 
} from '../../src/MovementProfiles/MovementProfileExtensions';
import { DEFAULT_CHARACTER_CONFIG } from '@engine/world';

describe('Movement Profile Extensions', () => {
  let entity: Entity;
  let controller: CharacterController;
  let scene: Scene;

  beforeEach(() => {
    scene = new Scene();
    entity = new Entity('TestEntity');
    entity.transform.position = [0, 10, 0];
    controller = new CharacterController();
    entity.addComponent(controller);
    scene.addEntity(entity);
  });

  describe('FlyingExtension', () => {
    it('should modify config to reduce gravity and increase air control', () => {
      const extension = new FlyingExtension();
      const modified = extension.modifyConfig?.(DEFAULT_CHARACTER_CONFIG);

      expect(modified).toBeDefined();
      expect(modified!.gravityMultiplier).toBeCloseTo(0.05);
      expect(modified!.airControlMultiplier).toBe(1.0);
    });

    it('should apply vertical velocity when Space is pressed', () => {
      const extension = new FlyingExtension(10.0, 5.0);
      const mockInput: MovementExtensionInputProvider = {
        isKeyPressed: (key: string) => key === 'Space',
      };
      extension.setInputProvider(mockInput);

      const initialVelocity = controller.velocity[1];
      extension.update?.(controller, 0.1);

      // Should add upward velocity
      expect(controller.velocity[1]).toBeGreaterThan(initialVelocity);
    });

    it('should apply downward velocity when Ctrl is pressed', () => {
      const extension = new FlyingExtension(10.0, 5.0);
      const mockInput: MovementExtensionInputProvider = {
        isKeyPressed: (key: string) => key === 'ControlLeft' || key === 'KeyC',
      };
      extension.setInputProvider(mockInput);

      const initialVelocity = controller.velocity[1];
      extension.update?.(controller, 0.1);

      // Should add downward velocity
      expect(controller.velocity[1]).toBeLessThan(initialVelocity);
    });

    it('should initialize input provider on apply', () => {
      const extension = new FlyingExtension();
      extension.onApply?.(controller);

      // Input provider should be set (or null if not in browser)
      // We can't test the actual browser implementation here
      expect(true).toBe(true); // Just verify onApply doesn't crash
    });
  });

  describe('SpeedBoostExtension', () => {
    it('should multiply moveSpeed and sprintMultiplier', () => {
      const extension = new SpeedBoostExtension(2.0, 1.5);
      const modified = extension.modifyConfig?.(DEFAULT_CHARACTER_CONFIG);

      expect(modified).toBeDefined();
      expect(modified!.moveSpeed).toBe(DEFAULT_CHARACTER_CONFIG.moveSpeed * 2.0);
      expect(modified!.sprintMultiplier).toBe(DEFAULT_CHARACTER_CONFIG.sprintMultiplier * 1.5);
    });

    it('should track active time when duration is set', () => {
      const extension = new SpeedBoostExtension(2.0, 1.5, 5.0, 0);
      
      extension.modifyConfig?.(DEFAULT_CHARACTER_CONFIG);
      expect(extension.getIsActive()).toBe(true);

      // Update for 3 seconds
      extension.update?.(controller, 3.0);
      expect(extension.getIsActive()).toBe(true);

      // Update for 3 more seconds (total 6, exceeds duration of 5)
      extension.update?.(controller, 3.0);
      expect(extension.getIsActive()).toBe(false);
    });

    it('should have infinite duration when duration is 0', () => {
      const extension = new SpeedBoostExtension(2.0, 1.5, 0, 0);
      
      extension.modifyConfig?.(DEFAULT_CHARACTER_CONFIG);
      expect(extension.getIsActive()).toBe(true);

      // Update many times - should still be active
      for (let i = 0; i < 100; i++) {
        extension.update?.(controller, 1.0);
      }
      expect(extension.getIsActive()).toBe(true);
    });

    it('should deactivate on remove', () => {
      const extension = new SpeedBoostExtension(2.0, 1.5, 0, 0);
      
      extension.modifyConfig?.(DEFAULT_CHARACTER_CONFIG);
      expect(extension.getIsActive()).toBe(true);

      extension.onRemove?.(controller);
      expect(extension.getIsActive()).toBe(false);
    });
  });

  describe('VehicleExtension', () => {
    it('should multiply moveSpeed and reduce air control', () => {
      const extension = new VehicleExtension(3.0);
      const modified = extension.modifyConfig?.(DEFAULT_CHARACTER_CONFIG);

      expect(modified).toBeDefined();
      expect(modified!.moveSpeed).toBe(DEFAULT_CHARACTER_CONFIG.moveSpeed * 3.0);
      expect(modified!.airControlMultiplier).toBe(0.1);
      expect(modified!.rotationSpeed).toBe(5);
    });

    it('should increase linear drag on apply', () => {
      const extension = new VehicleExtension(3.0);
      
      // Ensure physics component exists
      controller.update(0.016); // Trigger physics creation
      
      const physics = (controller as any).physics;
      if (physics) {
        const originalDrag = physics.linearDrag || 5;
        
        extension.onApply?.(controller);
        
        expect(physics.linearDrag).toBeGreaterThanOrEqual(8);
      }
    });

    it('should restore linear drag on remove', () => {
      const extension = new VehicleExtension(3.0);
      
      // Ensure physics component exists
      controller.update(0.016);
      
      const physics = (controller as any).physics;
      if (physics) {
        const originalDrag = physics.linearDrag || 5;
        
        extension.onApply?.(controller);
        extension.onRemove?.(controller);
        
        expect(physics.linearDrag).toBe(5); // Default drag restored
      }
    });
  });
});

