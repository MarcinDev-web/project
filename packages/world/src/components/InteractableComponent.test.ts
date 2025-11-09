import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractableComponent } from './InteractableComponent.js';
import { Entity } from '../core/Entity.js';

describe('InteractableComponent', () => {
  let component: InteractableComponent;
  let entity: Entity;

  beforeEach(() => {
    component = new InteractableComponent();
    entity = new Entity('test-entity');
  });

  describe('default values', () => {
    it('should have correct default values', () => {
      expect(component.enabled).toBe(true);
      expect(component.interactionRange).toBe(5.0);
      expect(component.promptText).toBe('Press E to interact');
      expect(component.cooldown).toBe(0);
      expect(component.cooldownRemaining).toBe(0);
    });
  });

  describe('lifecycle hooks', () => {
    it('should call onAttach when attached to entity', () => {
      const onAttachSpy = vi.spyOn(component as any, 'onAttach');
      component._attach(entity);
      expect(onAttachSpy).toHaveBeenCalled();
      expect(component.entity).toBe(entity);
    });

    it('should call onDetach when detached from entity', () => {
      component._attach(entity);
      const onDetachSpy = vi.spyOn(component as any, 'onDetach');
      component._detach();
      expect(onDetachSpy).toHaveBeenCalled();
      expect(component.entity).toBeNull();
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      component.enabled = false;
      component.interactionRange = 10.0;
      component.promptText = 'Custom prompt';
      component.cooldown = 2.5;

      const json = component.toJSON();
      expect(json).toEqual({
        enabled: false,
        interactionRange: 10.0,
        promptText: 'Custom prompt',
        cooldown: 2.5,
      });
    });

    it('should deserialize from JSON', () => {
      const json = {
        enabled: false,
        interactionRange: 10.0,
        promptText: 'Custom prompt',
        cooldown: 2.5,
      };

      component.fromJSON(json);
      expect(component.enabled).toBe(false);
      expect(component.interactionRange).toBe(10.0);
      expect(component.promptText).toBe('Custom prompt');
      expect(component.cooldown).toBe(2.5);
    });

    it('should handle partial JSON', () => {
      component.interactionRange = 10.0;
      component.fromJSON({ enabled: false });
      expect(component.enabled).toBe(false);
      expect(component.interactionRange).toBe(10.0); // Unchanged
    });

    it('should ignore invalid values in JSON', () => {
      component.interactionRange = 5.0;
      component.fromJSON({ interactionRange: -5 }); // Invalid
      expect(component.interactionRange).toBe(5.0); // Unchanged
    });
  });

  describe('clone', () => {
    it('should create a deep copy', () => {
      component.enabled = false;
      component.interactionRange = 10.0;
      component.promptText = 'Custom prompt';
      component.cooldown = 2.5;
      component.cooldownRemaining = 1.0;

      const clone = component.clone();
      expect(clone).not.toBe(component);
      expect(clone.enabled).toBe(component.enabled);
      expect(clone.interactionRange).toBe(component.interactionRange);
      expect(clone.promptText).toBe(component.promptText);
      expect(clone.cooldown).toBe(component.cooldown);
      expect(clone.cooldownRemaining).toBe(component.cooldownRemaining);
    });
  });

  describe('isAvailable', () => {
    it('should return true when enabled and not on cooldown', () => {
      component.enabled = true;
      component.cooldownRemaining = 0;
      expect(component.isAvailable()).toBe(true);
    });

    it('should return false when disabled', () => {
      component.enabled = false;
      component.cooldownRemaining = 0;
      expect(component.isAvailable()).toBe(false);
    });

    it('should return false when on cooldown', () => {
      component.enabled = true;
      component.cooldownRemaining = 1.0;
      expect(component.isAvailable()).toBe(false);
    });
  });

  describe('cooldown management', () => {
    it('should update cooldown timer', () => {
      component.cooldownRemaining = 2.0;
      component.updateCooldown(0.5);
      expect(component.cooldownRemaining).toBe(1.5);
    });

    it('should not go below zero', () => {
      component.cooldownRemaining = 0.3;
      component.updateCooldown(0.5);
      expect(component.cooldownRemaining).toBe(0);
    });

    it('should start cooldown', () => {
      component.cooldown = 2.5;
      component.startCooldown();
      expect(component.cooldownRemaining).toBe(2.5);
    });
  });
});

