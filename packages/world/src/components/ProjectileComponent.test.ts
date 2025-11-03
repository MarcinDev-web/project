import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectileComponent } from './ProjectileComponent.js';

describe('ProjectileComponent', () => {
  let projectile: ProjectileComponent;

  beforeEach(() => {
    projectile = new ProjectileComponent();
  });

  describe('constructor', () => {
    it('should create with default values', () => {
      expect(projectile.damage).toBe(25);
      expect(projectile.speed).toBe(50);
      expect(projectile.lifetime).toBe(3.0);
      expect(projectile.ownerId).toBe('');
      expect(projectile.spawnTime).toBe(0);
    });

    it('should create with custom data', () => {
      const custom = new ProjectileComponent({
        damage: 50,
        speed: 75,
        lifetime: 5.0,
        ownerId: 'player-123',
      });

      expect(custom.damage).toBe(50);
      expect(custom.speed).toBe(75);
      expect(custom.lifetime).toBe(5.0);
      expect(custom.ownerId).toBe('player-123');
    });
  });

  describe('isExpired', () => {
    it('should return false if not expired', () => {
      projectile.spawnTime = 0;
      expect(projectile.isExpired(2.0)).toBe(false);
    });

    it('should return true if expired', () => {
      projectile.spawnTime = 0;
      projectile.lifetime = 3.0;
      expect(projectile.isExpired(3.0)).toBe(true);
      expect(projectile.isExpired(4.0)).toBe(true);
    });
  });

  describe('getRemainingLifetime', () => {
    it('should return correct remaining time', () => {
      projectile.spawnTime = 0;
      projectile.lifetime = 5.0;
      
      expect(projectile.getRemainingLifetime(2.0)).toBe(3.0);
      expect(projectile.getRemainingLifetime(5.0)).toBe(0);
      expect(projectile.getRemainingLifetime(6.0)).toBe(0);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      projectile.damage = 50;
      projectile.speed = 75;
      projectile.lifetime = 5.0;
      projectile.ownerId = 'player-123';
      projectile.spawnTime = 10.0;
      
      const json = projectile.toJSON();

      expect(json.damage).toBe(50);
      expect(json.speed).toBe(75);
      expect(json.lifetime).toBe(5.0);
      expect(json.ownerId).toBe('player-123');
      expect(json.spawnTime).toBe(10.0);
    });

    it('should deserialize from JSON', () => {
      const data = {
        damage: 40,
        speed: 60,
        lifetime: 4.0,
        ownerId: 'enemy-456',
        spawnTime: 5.0,
      };
      
      projectile.fromJSON(data);

      expect(projectile.damage).toBe(40);
      expect(projectile.speed).toBe(60);
      expect(projectile.lifetime).toBe(4.0);
      expect(projectile.ownerId).toBe('enemy-456');
      expect(projectile.spawnTime).toBe(5.0);
    });

    it('should clone component', () => {
      projectile.damage = 50;
      projectile.speed = 75;
      projectile.ownerId = 'player-123';
      projectile.spawnTime = 10.0;

      const clone = projectile.clone();
      expect(clone.damage).toBe(projectile.damage);
      expect(clone.speed).toBe(projectile.speed);
      expect(clone.ownerId).toBe(projectile.ownerId);
      expect(clone.spawnTime).toBe(projectile.spawnTime);
      // Callbacks should not be cloned
      expect(clone.onHit).toBeUndefined();
    });
  });
});

