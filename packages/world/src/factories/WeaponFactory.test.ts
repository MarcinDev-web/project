import { describe, it, expect } from 'vitest';
import { createWeapon, createCustomWeapon } from './WeaponFactory.js';
import { WeaponComponent } from '../components/WeaponComponent.js';

describe('WeaponFactory', () => {
  describe('createWeapon', () => {
    it('should create weapon from rifle preset', () => {
      const weapon = createWeapon('rifle');
      expect(weapon).toBeInstanceOf(WeaponComponent);
      expect(weapon.type).toBe('hitscan');
      expect(weapon.damage).toBeGreaterThan(0);
      expect(weapon.fireRate).toBeGreaterThan(0);
      expect(weapon.weaponPreset).toBe('rifle'); // Preset is set by factory
    });

    it('should create weapon from shotgun preset', () => {
      const weapon = createWeapon('shotgun');
      expect(weapon.type).toBe('projectile');
      expect(weapon.projectileSpeed).toBeGreaterThan(0);
    });

    it('should accept attachment IDs (even if not applied yet)', () => {
      const weapon = createWeapon('rifle', ['red_dot']);
      expect(weapon).toBeInstanceOf(WeaponComponent);
    });
  });

  describe('createCustomWeapon', () => {
    it('should create custom weapon with specified stats', () => {
      const weapon = createCustomWeapon({
        damage: 50,
        fireRate: 5,
        range: 200,
      });
      expect(weapon.damage).toBe(50);
      expect(weapon.fireRate).toBe(5);
      expect(weapon.range).toBe(200);
    });

    it('should use defaults for unspecified stats', () => {
      const weapon = createCustomWeapon({
        damage: 100,
      });
      expect(weapon.damage).toBe(100);
      expect(weapon.fireRate).toBe(10); // Default
    });
  });
});
