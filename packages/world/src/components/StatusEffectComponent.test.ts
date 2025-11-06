import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene } from '../core/Scene.js';
import { StatusEffectComponent } from './StatusEffectComponent.js';

describe('StatusEffectComponent', () => {
  let scene: Scene;
  let entity: ReturnType<Scene['createEntity']>;
  let component: StatusEffectComponent;

  beforeEach(() => {
    scene = new Scene('test-scene');
    entity = scene.createEntity('test-entity');
    component = new StatusEffectComponent();
    entity.addComponent(component);
    scene.addEntity(entity);
  });

  describe('applyEffect', () => {
    it('should apply a new effect', () => {
      const effect = {
        id: 'test-dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      const applied = component.applyEffect(effect);
      expect(applied).toBe(true);
      expect(component.getEffectCount()).toBe(1);
      expect(component.getEffect('test-dot-1')).toBeDefined();
    });

    it('should replace existing effect of same type', () => {
      const effect1 = {
        id: 'dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      const effect2 = {
        id: 'dot-2',
        type: 'damage_over_time' as const,
        startTime: 1,
        duration: 5.0,
        strength: 20,
      };

      component.applyEffect(effect1);
      expect(component.getEffectCount()).toBe(1);

      component.applyEffect(effect2);
      expect(component.getEffectCount()).toBe(1); // Still only one DoT
      expect(component.getEffect('dot-1')).toBeUndefined(); // Old effect removed
      expect(component.getEffect('dot-2')).toBeDefined(); // New effect added
    });

    it('should allow multiple different effect types', () => {
      const dotEffect = {
        id: 'dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      const hotEffect = {
        id: 'hot-1',
        type: 'heal_over_time' as const,
        startTime: 0,
        duration: 2.0,
        strength: 5,
      };

      component.applyEffect(dotEffect);
      component.applyEffect(hotEffect);

      expect(component.getEffectCount()).toBe(2);
      expect(component.hasEffect('damage_over_time')).toBe(true);
      expect(component.hasEffect('heal_over_time')).toBe(true);
    });

    it('should not apply same effect twice', () => {
      const effect = {
        id: 'test-dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      component.applyEffect(effect);
      const applied = component.applyEffect(effect);
      expect(applied).toBe(false);
      expect(component.getEffectCount()).toBe(1);
    });

    it('should call onEffectApplied callback', () => {
      const callback = vi.fn();
      component.onEffectApplied = callback;

      const effect = {
        id: 'test-dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      component.applyEffect(effect);
      expect(callback).toHaveBeenCalledWith(effect);
    });
  });

  describe('removeEffect', () => {
    it('should remove effect by ID', () => {
      const effect = {
        id: 'test-dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      component.applyEffect(effect);
      expect(component.getEffectCount()).toBe(1);

      const removed = component.removeEffect('test-dot-1');
      expect(removed).toBe(true);
      expect(component.getEffectCount()).toBe(0);
    });

    it('should return false if effect not found', () => {
      const removed = component.removeEffect('nonexistent');
      expect(removed).toBe(false);
    });

    it('should call onEffectRemoved callback', () => {
      const callback = vi.fn();
      component.onEffectRemoved = callback;

      const effect = {
        id: 'test-dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      component.applyEffect(effect);
      component.removeEffect('test-dot-1');

      expect(callback).toHaveBeenCalledWith(effect);
    });
  });

  describe('getEffectByType', () => {
    it('should return effect of specific type', () => {
      const dotEffect = {
        id: 'dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      component.applyEffect(dotEffect);
      const found = component.getEffectByType('damage_over_time');
      expect(found).toBeDefined();
      expect(found?.id).toBe('dot-1');
    });

    it('should return undefined if effect type not found', () => {
      const found = component.getEffectByType('damage_over_time');
      expect(found).toBeUndefined();
    });
  });

  describe('getEffectsByType', () => {
    it('should return all effects of specific type', () => {
      const dot1 = {
        id: 'dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      const dot2 = {
        id: 'dot-2',
        type: 'damage_over_time' as const,
        startTime: 1,
        duration: 2.0,
        strength: 15,
      };

      // Note: applyEffect replaces same type, so we need to manually add
      component.applyEffect(dot1);
      // Since applyEffect replaces, we'll test with different types
      const hot = {
        id: 'hot-1',
        type: 'heal_over_time' as const,
        startTime: 0,
        duration: 2.0,
        strength: 5,
      };
      component.applyEffect(hot);

      const dotEffects = component.getEffectsByType('damage_over_time');
      expect(dotEffects.length).toBe(1);
      expect(dotEffects[0]?.id).toBe('dot-1');
    });
  });

  describe('hasEffect', () => {
    it('should return true if effect type exists', () => {
      const effect = {
        id: 'dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      component.applyEffect(effect);
      expect(component.hasEffect('damage_over_time')).toBe(true);
    });

    it('should return false if effect type does not exist', () => {
      expect(component.hasEffect('damage_over_time')).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should remove all effects', () => {
      const dotEffect = {
        id: 'dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      const hotEffect = {
        id: 'hot-1',
        type: 'heal_over_time' as const,
        startTime: 0,
        duration: 2.0,
        strength: 5,
      };

      component.applyEffect(dotEffect);
      component.applyEffect(hotEffect);
      expect(component.getEffectCount()).toBe(2);

      component.clearAll();
      expect(component.getEffectCount()).toBe(0);
    });

    it('should call onEffectRemoved for each effect', () => {
      const callback = vi.fn();
      component.onEffectRemoved = callback;

      const dotEffect = {
        id: 'dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      const hotEffect = {
        id: 'hot-1',
        type: 'heal_over_time' as const,
        startTime: 0,
        duration: 2.0,
        strength: 5,
      };

      component.applyEffect(dotEffect);
      component.applyEffect(hotEffect);

      component.clearAll();
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('clone', () => {
    it('should create a deep copy', () => {
      const effect = {
        id: 'dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
        sourceId: 'source-1',
      };

      component.applyEffect(effect);
      const cloned = component.clone();

      expect(cloned.getEffectCount()).toBe(1);
      const clonedEffect = cloned.getEffect('dot-1');
      expect(clonedEffect).toBeDefined();
      expect(clonedEffect?.strength).toBe(10);
      expect(clonedEffect?.sourceId).toBe('source-1');
    });

    it('should not clone callbacks', () => {
      component.onEffectApplied = vi.fn();
      const cloned = component.clone();

      expect(cloned.onEffectApplied).toBeUndefined();
    });
  });

  describe('toJSON / fromJSON', () => {
    it('should serialize and deserialize effects', () => {
      const dotEffect = {
        id: 'dot-1',
        type: 'damage_over_time' as const,
        startTime: 0,
        duration: 3.0,
        strength: 10,
      };

      component.applyEffect(dotEffect);

      const json = component.toJSON();
      expect(json.effects).toBeDefined();
      expect(json.effects.length).toBe(1);
      expect(json.effects[0]?.id).toBe('dot-1');

      // Create new component and deserialize
      const newComponent = new StatusEffectComponent();
      newComponent.fromJSON(json);

      expect(newComponent.getEffectCount()).toBe(1);
      const effect = newComponent.getEffect('dot-1');
      expect(effect?.strength).toBe(10);
      expect(effect?.duration).toBe(3.0);
    });
  });
});

