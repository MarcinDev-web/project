import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../../src/core/Entity';
import { HealthComponent } from '../../src/components/HealthComponent';

describe('HealthComponent', () => {
  let entity: Entity;
  let health: HealthComponent;

  beforeEach(() => {
    entity = new Entity();
    health = new HealthComponent();
    entity.addComponent(health);
  });

  describe('initialization', () => {
    it('should initialize with default health', () => {
      expect(health.maxHealth).toBe(100);
      expect(health.currentHealth).toBe(100);
      expect(health.isAlive()).toBe(true);
      expect(health.getHealthPercent()).toBe(1.0);
    });

    it('should initialize with custom max health', () => {
      const customHealth = new HealthComponent();
      customHealth.maxHealth = 200;
      customHealth.currentHealth = 200;
      expect(customHealth.maxHealth).toBe(200);
      expect(customHealth.currentHealth).toBe(200);
    });
  });

  describe('takeDamage', () => {
    it('should reduce health by damage amount', () => {
      health.takeDamage(30);
      expect(health.currentHealth).toBe(70);
      expect(health.isAlive()).toBe(true);
    });

    it('should not reduce health below 0', () => {
      health.takeDamage(150);
      expect(health.currentHealth).toBe(0);
      expect(health.isAlive()).toBe(false);
    });

    it('should return actual damage dealt', () => {
      const damage = health.takeDamage(30);
      expect(damage).toBe(30);

      const overkill = health.takeDamage(100);
      expect(overkill).toBe(70); // Only 70 damage was possible
    });

    it('should not deal damage if entity is already dead', () => {
      health.currentHealth = 0;
      const damage = health.takeDamage(10);
      expect(damage).toBe(0);
      expect(health.currentHealth).toBe(0);
    });

    it('should not deal damage if amount is negative or zero', () => {
      const damage = health.takeDamage(-10);
      expect(damage).toBe(0);
      expect(health.currentHealth).toBe(100);

      const zeroDamage = health.takeDamage(0);
      expect(zeroDamage).toBe(0);
      expect(health.currentHealth).toBe(100);
    });

    it('should fire onHealthChanged callback', () => {
      const onHealthChanged = vi.fn();
      health.onHealthChanged = onHealthChanged;

      health.takeDamage(25);
      expect(onHealthChanged).toHaveBeenCalledWith(75, 100);
    });

    it('should fire onDeath callback when health reaches 0', () => {
      const onDeath = vi.fn();
      health.onDeath = onDeath;

      health.takeDamage(100);
      expect(onDeath).toHaveBeenCalled();
      expect(health.currentHealth).toBe(0);
    });
  });

  describe('heal', () => {
    it('should increase health by heal amount', () => {
      health.currentHealth = 50;
      health.heal(30);
      expect(health.currentHealth).toBe(80);
    });

    it('should not increase health above maxHealth', () => {
      health.currentHealth = 90;
      health.heal(30);
      expect(health.currentHealth).toBe(100);
    });

    it('should return actual healing done', () => {
      health.currentHealth = 80;
      const healed = health.heal(30);
      expect(healed).toBe(20); // Only 20 healing was possible
    });

    it('should not heal if entity is dead', () => {
      health.currentHealth = 0;
      const healed = health.heal(10);
      expect(healed).toBe(0);
      expect(health.currentHealth).toBe(0);
    });

    it('should not heal if amount is negative or zero', () => {
      health.currentHealth = 50;
      const healed = health.heal(-10);
      expect(healed).toBe(0);
      expect(health.currentHealth).toBe(50);

      const zeroHeal = health.heal(0);
      expect(zeroHeal).toBe(0);
      expect(health.currentHealth).toBe(50);
    });

    it('should fire onHealthChanged callback', () => {
      health.currentHealth = 50;
      const onHealthChanged = vi.fn();
      health.onHealthChanged = onHealthChanged;

      health.heal(25);
      expect(onHealthChanged).toHaveBeenCalledWith(75, 100);
    });
  });

  describe('isAlive', () => {
    it('should return true when health > 0', () => {
      health.currentHealth = 1;
      expect(health.isAlive()).toBe(true);
    });

    it('should return false when health is 0', () => {
      health.currentHealth = 0;
      expect(health.isAlive()).toBe(false);
    });
  });

  describe('getHealthPercent', () => {
    it('should return 1.0 when at full health', () => {
      health.currentHealth = 100;
      expect(health.getHealthPercent()).toBe(1.0);
    });

    it('should return 0.5 when at half health', () => {
      health.currentHealth = 50;
      expect(health.getHealthPercent()).toBe(0.5);
    });

    it('should return 0.0 when at zero health', () => {
      health.currentHealth = 0;
      expect(health.getHealthPercent()).toBe(0.0);
    });

    it('should handle custom max health', () => {
      health.maxHealth = 200;
      health.currentHealth = 100;
      expect(health.getHealthPercent()).toBe(0.5);
    });

    it('should return 0 if maxHealth is 0', () => {
      health.maxHealth = 0;
      health.currentHealth = 0;
      expect(health.getHealthPercent()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should restore health to maximum', () => {
      health.currentHealth = 30;
      health.reset();
      expect(health.currentHealth).toBe(100);
    });
  });

  describe('clone', () => {
    it('should create a deep copy', () => {
      health.maxHealth = 150;
      health.currentHealth = 75;
      health.onDeath = () => {};
      health.onHealthChanged = () => {};

      const clone = health.clone();

      expect(clone.maxHealth).toBe(150);
      expect(clone.currentHealth).toBe(75);
      // Callbacks should not be cloned (entity-specific)
      expect(clone.onDeath).toBeUndefined();
      expect(clone.onHealthChanged).toBeUndefined();
    });
  });

  describe('toJSON', () => {
    it('should serialize health state', () => {
      health.maxHealth = 150;
      health.currentHealth = 75;
      const json = health.toJSON();

      expect(json).toEqual({
        maxHealth: 150,
        currentHealth: 75,
      });
    });
  });

  describe('fromJSON', () => {
    it('should deserialize health state', () => {
      const newHealth = new HealthComponent();
      newHealth.fromJSON({
        maxHealth: 200,
        currentHealth: 150,
      });

      expect(newHealth.maxHealth).toBe(200);
      expect(newHealth.currentHealth).toBe(150);
    });

    it('should clamp currentHealth to maxHealth when deserializing', () => {
      const newHealth = new HealthComponent();
      newHealth.fromJSON({
        maxHealth: 100,
        currentHealth: 150, // Should be clamped to 100
      });

      expect(newHealth.currentHealth).toBe(100);
    });

    it('should set currentHealth to maxHealth if not provided', () => {
      const newHealth = new HealthComponent();
      newHealth.fromJSON({
        maxHealth: 200,
      });

      expect(newHealth.currentHealth).toBe(200);
    });
  });
});

