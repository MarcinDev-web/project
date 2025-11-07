import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene } from '../core/Scene.js';
import { WeaponSystem } from './WeaponSystem.js';
import { StatusEffectSystem } from './StatusEffectSystem.js';
import { WeaponComponent } from '../components/WeaponComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { StatusEffectComponent } from '../components/StatusEffectComponent.js';
import { CameraComponent } from '../components/CameraComponent.js';
import { ProjectileComponent } from '../components/ProjectileComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';

describe('WeaponSystem', () => {
  let scene: Scene;
  let weaponSystem: WeaponSystem;
  let weaponEntity: ReturnType<Scene['createEntity']>;
  let targetEntity: ReturnType<Scene['createEntity']>;

  beforeEach(() => {
    scene = new Scene('test-scene');
    weaponSystem = new WeaponSystem(scene);

    // Create weapon entity
    weaponEntity = scene.createEntity('weapon-holder');
    const weapon = new WeaponComponent({
      type: 'hitscan',
      damage: 25,
      fireRate: 10,
      ammo: 30,
      maxAmmo: 30,
    });
    weaponEntity.addComponent(weapon);
    weaponEntity.transform.position = [0, 0, 0];
    scene.addEntity(weaponEntity);

    // Create target entity with health
    targetEntity = scene.createEntity('target');
    const health = new HealthComponent();
    health.maxHealth = 100;
    health.currentHealth = 100;
    targetEntity.addComponent(health);
    targetEntity.meshBounds = {
      type: 'aabb',
      aabb: {
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
    };
    targetEntity.transform.position = [0, 0, -10];
    scene.addEntity(targetEntity);
  });

  describe('update', () => {
    it('should update reload timers', () => {
      const weapon = weaponEntity.getComponent(WeaponComponent)!;
      weapon.ammo = 10;
      weapon.startReload(0);

      weaponSystem.update(0.5);
      expect(weapon.isReloading).toBe(true);

      weaponSystem.update(2.0); // reloadDuration is 2.0
      expect(weapon.isReloading).toBe(false);
      expect(weapon.ammo).toBe(30);
    });
  });

  describe('fire - hitscan', () => {
    it('should fire hitscan weapon and damage target', () => {
      const weapon = weaponEntity.getComponent(WeaponComponent)!;
      const targetHealth = targetEntity.getComponent(HealthComponent)!;

      const initialHealth = targetHealth.currentHealth;
      const fired = weaponSystem.fire(weaponEntity, [0, 0, -1], [0, 0, 0]);

      expect(fired).toBe(true);
      expect(weapon.ammo).toBe(29);
      expect(targetHealth.currentHealth).toBeLessThan(initialHealth);
    });

    it('should not fire if weapon cannot fire', () => {
      const weapon = weaponEntity.getComponent(WeaponComponent)!;
      weapon.ammo = 0;

      const fired = weaponSystem.fire(weaponEntity);
      expect(fired).toBe(false);
      expect(weapon.ammo).toBe(0);
    });

    it('should emit fire event', () => {
      const eventSpy = vi.fn();
      scene.events.on('weapon:fire', eventSpy);

      weaponSystem.fire(weaponEntity, [0, 0, -1]);

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0]![0];
      expect(event.entity).toBe(weaponEntity);
      expect(event.weaponType).toBe('hitscan');
      expect(event.damage).toBe(25);
    });

    it('should use camera direction if available', () => {
      const cameraEntity = scene.createEntity('camera');
      const cameraComp = new CameraComponent();
      cameraComp.primary = true;
      cameraEntity.addComponent(cameraComp);
      cameraEntity.transform.position = [0, 0, 0];
      cameraEntity.transform.rotation = [0, 0, 0, 1];
      scene.addEntity(cameraEntity);
      scene.setPrimaryCamera(cameraEntity);

      const fired = weaponSystem.fire(weaponEntity);
      expect(fired).toBe(true);
    });

    it('should use entity transform forward if no camera', () => {
      weaponEntity.transform.rotation = [0, 0, 0, 1];
      const fired = weaponSystem.fire(weaponEntity);
      expect(fired).toBe(true);
    });

    it('should apply DoT effect with incendiary ammo', () => {
      const statusEffectSystem = new StatusEffectSystem(scene);
      const weaponSystemWithDoT = new WeaponSystem(scene, {
        statusEffectSystem,
      });

      const weapon = weaponEntity.getComponent(WeaponComponent)!;
      weapon.currentAmmoType = 'incendiary'; // Use incendiary ammo

      const targetHealth = targetEntity.getComponent(HealthComponent)!;
      const initialHealth = targetHealth.currentHealth;

      // Fire weapon
      weaponSystemWithDoT.fire(weaponEntity, [0, 0, -1], [0, 0, 0]);

      // Check that DoT effect was applied
      const statusEffect = targetEntity.getComponent(StatusEffectComponent);
      expect(statusEffect).toBeDefined();
      if (statusEffect) {
        expect(statusEffect.hasEffect('damage_over_time')).toBe(true);
      }

      // Update status effect system to apply DoT
      statusEffectSystem.update(0.5);
      expect(targetHealth.currentHealth).toBeLessThan(initialHealth);
    });

    it('should not apply DoT if status effect system is not provided', () => {
      const weapon = weaponEntity.getComponent(WeaponComponent)!;
      weapon.currentAmmoType = 'incendiary';

      const targetHealth = targetEntity.getComponent(HealthComponent)!;
      const initialHealth = targetHealth.currentHealth;

      // Fire weapon (without status effect system)
      weaponSystem.fire(weaponEntity, [0, 0, -1], [0, 0, 0]);

      // Check that DoT effect was NOT applied
      const statusEffect = targetEntity.getComponent(StatusEffectComponent);
      expect(statusEffect === null || statusEffect === undefined).toBe(true);

      // Health should still be damaged by initial hit
      expect(targetHealth.currentHealth).toBeLessThan(initialHealth);
    });
  });

  describe('fire - projectile', () => {
    beforeEach(() => {
      const weapon = weaponEntity.getComponent(WeaponComponent)!;
      weapon.type = 'projectile';
      weapon.projectileSpeed = 50;
      weapon.projectileLifetime = 3.0;
    });

    it('should spawn projectile entity', () => {
      const initialEntityCount = scene.entityCount;
      weaponSystem.fire(weaponEntity, [0, 0, -1], [0, 0, 0]);

      expect(scene.entityCount).toBe(initialEntityCount + 1);
    });

    it('should create projectile with correct components', () => {
      weaponSystem.fire(weaponEntity, [0, 0, -1], [0, 0, 0]);

      const projectiles = scene.queryEntities(ProjectileComponent);
      expect(projectiles.length).toBe(1);

      const projectile = projectiles[0]!;
      const projectileComp = projectile.getComponent(ProjectileComponent)!;
      const physics = projectile.getComponent(PhysicsComponent);

      expect(projectileComp).toBeDefined();
      expect(projectileComp.damage).toBe(25);
      expect(projectileComp.ownerId).toBe(weaponEntity.id);
      expect(physics).toBeDefined();
    });

    it('should emit projectile spawn event', () => {
      const eventSpy = vi.fn();
      scene.events.on('weapon:projectile:spawn', eventSpy);

      weaponSystem.fire(weaponEntity, [0, 0, -1]);

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0]![0];
      expect(event.owner).toBe(weaponEntity);
      expect(event.speed).toBe(50);
    });
  });

  describe('reload', () => {
    it('should start reload', () => {
      const weapon = weaponEntity.getComponent(WeaponComponent)!;
      weapon.ammo = 10;

      weaponSystem.reload(weaponEntity);

      expect(weapon.isReloading).toBe(true);
    });

    it('should emit reload event', () => {
      const weapon = weaponEntity.getComponent(WeaponComponent)!;
      weapon.ammo = 10;
      const eventSpy = vi.fn();
      scene.events.on('weapon:reload', eventSpy);

      weaponSystem.reload(weaponEntity);

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0]![0];
      expect(event.entity).toBe(weaponEntity);
      expect(event.oldAmmo).toBe(10);
    });

    it('should not reload if already full', () => {
      const weapon = weaponEntity.getComponent(WeaponComponent)!;
      weapon.ammo = weapon.maxAmmo;

      weaponSystem.reload(weaponEntity);

      expect(weapon.isReloading).toBe(false);
    });
  });

  describe('getCurrentTime', () => {
    it('should return current time', () => {
      weaponSystem.update(1.5);
      expect(weaponSystem.getCurrentTime()).toBe(1.5);

      weaponSystem.update(0.5);
      expect(weaponSystem.getCurrentTime()).toBe(2.0);
    });
  });
});
