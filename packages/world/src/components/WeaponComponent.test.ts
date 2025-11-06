import { describe, it, expect, beforeEach } from 'vitest';
import { WeaponComponent } from './WeaponComponent.js';

describe('WeaponComponent', () => {
  let weapon: WeaponComponent;

  beforeEach(() => {
    weapon = new WeaponComponent();
  });

  describe('constructor', () => {
    it('should create with default values', () => {
      expect(weapon.type).toBe('hitscan');
      expect(weapon.damage).toBe(25);
      expect(weapon.fireRate).toBe(10);
      expect(weapon.range).toBe(100);
      expect(weapon.spread).toBe(0.02);
      expect(weapon.ammo).toBe(30);
      expect(weapon.maxAmmo).toBe(30);
      expect(weapon.reloadDuration).toBe(2.0);
    });

    it('should create with custom data', () => {
      const custom = new WeaponComponent({
        type: 'projectile',
        damage: 50,
        fireRate: 2,
        range: 200,
        spread: 0.05,
        ammo: 10,
        maxAmmo: 20,
        projectileSpeed: 75,
        projectileLifetime: 5,
      });

      expect(custom.type).toBe('projectile');
      expect(custom.damage).toBe(50);
      expect(custom.fireRate).toBe(2);
      expect(custom.range).toBe(200);
      expect(custom.spread).toBe(0.05);
      expect(custom.ammo).toBe(10);
      expect(custom.maxAmmo).toBe(20);
      expect(custom.projectileSpeed).toBe(75);
      expect(custom.projectileLifetime).toBe(5);
    });
  });

  describe('ammo management', () => {
    it('should clamp ammo to maxAmmo', () => {
      weapon.ammo = 100;
      expect(weapon.ammo).toBe(30); // maxAmmo
    });

    it('should clamp ammo to 0 minimum', () => {
      weapon.ammo = -10;
      expect(weapon.ammo).toBe(0);
    });

    it('should fire onOutOfAmmo callback when ammo reaches 0', () => {
      let callbackFired = false;
      weapon.onOutOfAmmo = () => {
        callbackFired = true;
      };

      weapon.ammo = 5;
      weapon.ammo = 0;
      expect(callbackFired).toBe(true);
    });
  });

  describe('canFire', () => {
    it('should return false if reloading', () => {
      weapon.ammo = 10;
      weapon.startReload(0);
      // Check immediately after starting reload
      expect(weapon.isReloading).toBe(true);
      expect(weapon.canFire(0.5)).toBe(false);
      // After reload completes, should be able to fire
      weapon.updateReload(2.0);
      expect(weapon.isReloading).toBe(false);
      expect(weapon.canFire(3)).toBe(true);
    });

    it('should return false if no ammo', () => {
      weapon.ammo = 0;
      expect(weapon.canFire(0)).toBe(false);
    });

    it('should return false if cooldown not ready', () => {
      weapon.fire(0);
      expect(weapon.canFire(0.05)).toBe(false); // fireRate = 10, so min time = 0.1s
    });

    it('should return true if can fire', () => {
      expect(weapon.canFire(0)).toBe(true);
    });
  });

  describe('fire', () => {
    it('should decrease ammo on fire', () => {
      const initialAmmo = weapon.ammo;
      weapon.fire(0);
      expect(weapon.ammo).toBe(initialAmmo - 1);
    });

    it('should return false if cannot fire', () => {
      weapon.ammo = 0;
      expect(weapon.fire(0)).toBe(false);
    });

    it('should update last fire time', () => {
      weapon.fire(5.0);
      expect(weapon.getTimeSinceLastFire(5.1)).toBeCloseTo(0.1, 2);
    });

    it('should not call onFire callback directly (only through WeaponSystem)', () => {
      // Note: onFire callback is not called by WeaponComponent.fire()
      // It's intended to be called by WeaponSystem after successful fire
      let fired = false;
      weapon.onFire = () => {
        fired = true;
      };
      weapon.fire(0);
      // Callback is not called by component itself
      expect(fired).toBe(false);
      expect(weapon.ammo).toBeLessThan(30); // But ammo is decreased
    });
  });

  describe('reload', () => {
    it('should start reloading', () => {
      weapon.ammo = 10;
      weapon.startReload(0);
      expect(weapon.isReloading).toBe(true);
    });

    it('should not reload if already full', () => {
      weapon.ammo = weapon.maxAmmo;
      weapon.startReload(0);
      expect(weapon.isReloading).toBe(false);
    });

    it('should call onReload callback', () => {
      let reloadCalled = false;
      weapon.onReload = () => {
        reloadCalled = true;
      };
      weapon.ammo = 10;
      weapon.startReload(0);
      expect(reloadCalled).toBe(true);
    });

    it('should complete reload after duration', () => {
      weapon.ammo = 10;
      weapon.startReload(0);
      weapon.updateReload(weapon.reloadDuration);
      expect(weapon.ammo).toBe(weapon.maxAmmo);
      expect(weapon.isReloading).toBe(false);
    });

    it('should call onReloadComplete callback', () => {
      let completeCalled = false;
      weapon.onReloadComplete = () => {
        completeCalled = true;
      };
      weapon.ammo = 10;
      weapon.startReload(0);
      weapon.updateReload(weapon.reloadDuration);
      expect(completeCalled).toBe(true);
    });

    it('should cancel reload', () => {
      weapon.startReload(0);
      weapon.cancelReload();
      expect(weapon.isReloading).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      weapon.type = 'projectile';
      weapon.damage = 50;
      weapon.ammo = 15;
      const json = weapon.toJSON();

      expect(json.type).toBe('projectile');
      expect(json.damage).toBe(50);
      expect(json.ammo).toBe(15);
    });

    it('should deserialize from JSON', () => {
      const data = {
        type: 'hitscan' as const,
        damage: 30,
        ammo: 20,
        maxAmmo: 25,
      };
      weapon.fromJSON(data);

      expect(weapon.type).toBe('hitscan');
      expect(weapon.damage).toBe(30);
      expect(weapon.ammo).toBe(20);
      expect(weapon.maxAmmo).toBe(25);
    });

    it('should clone component', () => {
      weapon.type = 'projectile';
      weapon.damage = 50;
      weapon.ammo = 10;

      const clone = weapon.clone();
      expect(clone.type).toBe(weapon.type);
      expect(clone.damage).toBe(weapon.damage);
      expect(clone.ammo).toBe(weapon.ammo);
      // Callbacks should not be cloned
      expect(clone.onFire).toBeUndefined();
    });
  });
});
