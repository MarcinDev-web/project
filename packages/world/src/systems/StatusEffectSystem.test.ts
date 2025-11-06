import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene } from '../core/Scene.js';
import { StatusEffectSystem } from './StatusEffectSystem.js';
import { StatusEffectComponent } from '../components/StatusEffectComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';

describe('StatusEffectSystem', () => {
  let scene: Scene;
  let statusEffectSystem: StatusEffectSystem;
  let targetEntity: ReturnType<Scene['createEntity']>;

  beforeEach(() => {
    scene = new Scene('test-scene');
    statusEffectSystem = new StatusEffectSystem(scene, {
      damageTickInterval: 0.5, // 0.5 second ticks for testing
    });

    // Create target entity with health
    targetEntity = scene.createEntity('target');
    const health = new HealthComponent();
    health.maxHealth = 100;
    health.currentHealth = 100;
    targetEntity.addComponent(health);
    scene.addEntity(targetEntity);
  });

  describe('update', () => {
    it('should apply damage over time', () => {
      const health = targetEntity.getComponent(HealthComponent)!;
      const initialHealth = health.currentHealth;

      // Apply DoT: 10 damage per second for 2 seconds
      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 10, 2.0);

      // Update for 0.5 seconds (first tick)
      statusEffectSystem.update(0.5);
      expect(health.currentHealth).toBeLessThan(initialHealth);
      expect(health.currentHealth).toBeGreaterThan(initialHealth - 10);

      // Update for another 0.5 seconds (second tick)
      statusEffectSystem.update(0.5);
      expect(health.currentHealth).toBeLessThan(initialHealth - 5);

      // Update for 1 second more (should have applied ~10 damage total)
      statusEffectSystem.update(1.0);
      expect(health.currentHealth).toBeLessThan(initialHealth - 10);
    });

    it('should remove expired effects', () => {
      const health = targetEntity.getComponent(HealthComponent)!;
      const initialHealth = health.currentHealth;

      // Apply DoT for 1 second
      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 10, 1.0);

      // Update past expiration
      statusEffectSystem.update(1.5);

      const statusEffect = targetEntity.getComponent(StatusEffectComponent);
      expect(statusEffect?.getEffectCount()).toBe(0);

      // Health should have been damaged
      expect(health.currentHealth).toBeLessThan(initialHealth);
    });

    it('should apply heal over time', () => {
      const health = targetEntity.getComponent(HealthComponent)!;
      health.currentHealth = 50; // Start with 50 health

      // Apply HoT: 5 heal per second for 2 seconds
      statusEffectSystem.applyStatusEffect(targetEntity, 'heal_over_time', 5, 2.0);

      // Update for 1 second
      statusEffectSystem.update(1.0);
      expect(health.currentHealth).toBeGreaterThan(50);
      expect(health.currentHealth).toBeLessThanOrEqual(55); // Should have healed ~5
    });

    it('should not damage dead entities', () => {
      const health = targetEntity.getComponent(HealthComponent)!;
      health.currentHealth = 0; // Entity is dead

      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 10, 2.0);
      statusEffectSystem.update(1.0);

      expect(health.currentHealth).toBe(0);
    });

    it('should not heal dead entities', () => {
      const health = targetEntity.getComponent(HealthComponent)!;
      health.currentHealth = 0; // Entity is dead

      statusEffectSystem.applyStatusEffect(targetEntity, 'heal_over_time', 10, 2.0);
      statusEffectSystem.update(1.0);

      expect(health.currentHealth).toBe(0);
    });
  });

  describe('applyStatusEffect', () => {
    it('should create StatusEffectComponent if it does not exist', () => {
      expect(targetEntity.getComponent(StatusEffectComponent)).toBeUndefined();

      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 10, 2.0);

      const statusEffect = targetEntity.getComponent(StatusEffectComponent);
      expect(statusEffect).toBeDefined();
      expect(statusEffect?.getEffectCount()).toBe(1);
    });

    it('should return effect ID when applied', () => {
      const effectId = statusEffectSystem.applyStatusEffect(
        targetEntity,
        'damage_over_time',
        10,
        2.0
      );
      expect(effectId).toBeDefined();
      expect(typeof effectId).toBe('string');
    });

    it('should replace existing effect of same type', () => {
      const firstId = statusEffectSystem.applyStatusEffect(
        targetEntity,
        'damage_over_time',
        10,
        2.0
      );
      const secondId = statusEffectSystem.applyStatusEffect(
        targetEntity,
        'damage_over_time',
        20,
        3.0
      );

      expect(firstId).not.toBe(secondId);

      const statusEffect = targetEntity.getComponent(StatusEffectComponent)!;
      expect(statusEffect.getEffectCount()).toBe(1); // Only one DoT effect

      const effect = statusEffect.getEffectByType('damage_over_time');
      expect(effect?.strength).toBe(20); // New effect replaced old one
      expect(effect?.duration).toBe(3.0);
    });

    it('should allow multiple different effect types', () => {
      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 10, 2.0);
      statusEffectSystem.applyStatusEffect(targetEntity, 'heal_over_time', 5, 2.0);

      const statusEffect = targetEntity.getComponent(StatusEffectComponent)!;
      expect(statusEffect.getEffectCount()).toBe(2);
    });

    it('should emit effect applied event', () => {
      const eventSpy = vi.fn();
      scene.events.on('status_effect:applied', eventSpy);

      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 10, 2.0);

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0]![0];
      expect(event.entity).toBe(targetEntity);
      expect(event.effect.type).toBe('damage_over_time');
    });
  });

  describe('removeStatusEffect', () => {
    it('should remove effect by ID', () => {
      const effectId = statusEffectSystem.applyStatusEffect(
        targetEntity,
        'damage_over_time',
        10,
        2.0
      )!;

      const statusEffect = targetEntity.getComponent(StatusEffectComponent)!;
      expect(statusEffect.getEffectCount()).toBe(1);

      const removed = statusEffectSystem.removeStatusEffect(targetEntity, effectId);
      expect(removed).toBe(true);
      expect(statusEffect.getEffectCount()).toBe(0);
    });

    it('should return false if effect not found', () => {
      const removed = statusEffectSystem.removeStatusEffect(targetEntity, 'nonexistent_id');
      expect(removed).toBe(false);
    });

    it('should emit effect removed event', () => {
      const effectId = statusEffectSystem.applyStatusEffect(
        targetEntity,
        'damage_over_time',
        10,
        2.0
      )!;

      const eventSpy = vi.fn();
      scene.events.on('status_effect:removed', eventSpy);

      statusEffectSystem.removeStatusEffect(targetEntity, effectId);

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0]![0];
      expect(event.entity).toBe(targetEntity);
      expect(event.effectId).toBe(effectId);
    });
  });

  describe('removeEffectsByType', () => {
    it('should remove all effects of specific type', () => {
      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 10, 2.0);
      statusEffectSystem.applyStatusEffect(targetEntity, 'heal_over_time', 5, 2.0);

      const statusEffect = targetEntity.getComponent(StatusEffectComponent)!;
      expect(statusEffect.getEffectCount()).toBe(2);

      const removed = statusEffectSystem.removeEffectsByType(targetEntity, 'damage_over_time');
      expect(removed).toBe(1);
      expect(statusEffect.getEffectCount()).toBe(1);
      expect(statusEffect.hasEffect('heal_over_time')).toBe(true);
    });

    it('should return 0 if no effects of type exist', () => {
      const removed = statusEffectSystem.removeEffectsByType(targetEntity, 'damage_over_time');
      expect(removed).toBe(0);
    });
  });

  describe('getCurrentTime', () => {
    it('should return current time', () => {
      expect(statusEffectSystem.getCurrentTime()).toBe(0);

      statusEffectSystem.update(1.5);
      expect(statusEffectSystem.getCurrentTime()).toBe(1.5);

      statusEffectSystem.update(0.5);
      expect(statusEffectSystem.getCurrentTime()).toBe(2.0);
    });
  });

  describe('dispose', () => {
    it('should cleanup resources', () => {
      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 10, 2.0);
      statusEffectSystem.update(0.5);

      statusEffectSystem.dispose();

      // System should still work after dispose (just clears internal tracking)
      statusEffectSystem.update(0.5);
      const health = targetEntity.getComponent(HealthComponent)!;
      expect(health.currentHealth).toBeLessThan(100);
    });
  });

  describe('integration with WeaponSystem DoT', () => {
    it('should handle multiple DoT applications correctly', () => {
      const health = targetEntity.getComponent(HealthComponent)!;
      const initialHealth = health.currentHealth;

      // Apply DoT multiple times (should replace, not stack)
      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 10, 1.0);
      statusEffectSystem.update(0.3);
      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 20, 1.0); // Replace with stronger DoT
      statusEffectSystem.update(0.5);

      // Should have taken damage from the stronger DoT
      expect(health.currentHealth).toBeLessThan(initialHealth);
    });

    it('should emit DoT tick events', () => {
      const eventSpy = vi.fn();
      scene.events.on('status_effect:dot_tick', eventSpy);

      statusEffectSystem.applyStatusEffect(targetEntity, 'damage_over_time', 10, 2.0);
      statusEffectSystem.update(0.5); // First tick

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0]![0];
      expect(event.entity).toBe(targetEntity);
      expect(event.effect.type).toBe('damage_over_time');
      expect(event.damage).toBeGreaterThan(0);
    });
  });
});

