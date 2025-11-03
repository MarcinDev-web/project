import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene } from '../core/Scene.js';
import { ProjectileSystem } from './ProjectileSystem.js';
import { ProjectileComponent } from '../components/ProjectileComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';
import type { PhysicsSystem } from '../physics/PhysicsSystem.js';
import type { CollisionEvent } from '../physics/PhysicsSystem.js';

describe('ProjectileSystem', () => {
  let scene: Scene;
  let projectileSystem: ProjectileSystem;
  let mockPhysicsSystem: PhysicsSystem;
  let ownerEntity: ReturnType<Scene['createEntity']>;
  let targetEntity: ReturnType<Scene['createEntity']>;

  beforeEach(() => {
    scene = new Scene('test-scene');

    // Mock PhysicsSystem
    mockPhysicsSystem = {
      onCollision: vi.fn((listener: (event: CollisionEvent) => void) => {
        // Store listener for manual triggering
        (mockPhysicsSystem as any)._collisionListener = listener;
        return () => {}; // Return unsubscribe function
      }),
      removeCollisionListener: vi.fn(),
    } as unknown as PhysicsSystem;

    projectileSystem = new ProjectileSystem(scene, mockPhysicsSystem);

    // Create owner entity
    ownerEntity = scene.createEntity('owner');
    scene.addEntity(ownerEntity);

    // Create target entity with health
    targetEntity = scene.createEntity('target');
    const health = new HealthComponent();
    health.maxHealth = 100;
    health.currentHealth = 100;
    targetEntity.addComponent(health);
    scene.addEntity(targetEntity);
  });

  describe('constructor', () => {
    it('should subscribe to collision events if physics system available', () => {
      expect(mockPhysicsSystem.onCollision).toHaveBeenCalled();
    });

    it('should work without physics system', () => {
      const system = new ProjectileSystem(scene, null);
      expect(system).toBeDefined();
    });
  });

  describe('update', () => {
    it('should cleanup expired projectiles', () => {
      const projectile = scene.createEntity('projectile');
      const projectileComp = new ProjectileComponent({
        damage: 25,
        lifetime: 2.0,
        ownerId: ownerEntity.id,
      });
      projectileComp.spawnTime = 0;
      projectile.addComponent(projectileComp);
      scene.addEntity(projectile);

      projectileSystem.update(1.0);
      expect(scene.findEntityById(projectile.id)).toBeDefined();

      projectileSystem.update(2.0); // Total 3.0 seconds
      expect(scene.findEntityById(projectile.id)).toBeNull();
    });

    it('should not cleanup non-expired projectiles', () => {
      const projectile = scene.createEntity('projectile');
      const projectileComp = new ProjectileComponent({
        damage: 25,
        lifetime: 5.0,
        ownerId: ownerEntity.id,
      });
      projectileComp.spawnTime = 0;
      projectile.addComponent(projectileComp);
      scene.addEntity(projectile);

      projectileSystem.update(2.0);
      expect(scene.findEntityById(projectile.id)).toBeDefined();
    });

    it('should emit destroy event for expired projectiles', () => {
      const projectile = scene.createEntity('projectile');
      const projectileComp = new ProjectileComponent({
        damage: 25,
        lifetime: 1.0,
        ownerId: ownerEntity.id,
      });
      projectileComp.spawnTime = 0;
      projectile.addComponent(projectileComp);
      scene.addEntity(projectile);

      const eventSpy = vi.fn();
      scene.events.on('projectile:destroy', eventSpy);

      projectileSystem.update(2.0);

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0]![0];
      expect(event.projectile).toBe(projectile);
      expect(event.reason).toBe('expired');
    });
  });

  describe('collision handling', () => {
    it('should apply damage on collision', () => {
      const projectile = scene.createEntity('projectile');
      const projectileComp = new ProjectileComponent({
        damage: 50,
        ownerId: ownerEntity.id,
      });
      projectile.addComponent(projectileComp);
      scene.addEntity(projectile);

      const targetHealth = targetEntity.getComponent(HealthComponent)!;
      const initialHealth = targetHealth.currentHealth;

      // Simulate collision
      const collisionEvent: CollisionEvent = {
        entityA: projectile,
        entityB: targetEntity,
        physicsA: {} as PhysicsComponent,
        physicsB: {} as PhysicsComponent,
        normal: [0, 0, 1],
        depth: 0.1,
        contactPoint: [0, 0, -10],
      };

      const listener = (mockPhysicsSystem as any)._collisionListener;
      if (listener) {
        listener(collisionEvent);
      }

      expect(targetHealth.currentHealth).toBeLessThan(initialHealth);
      expect(targetHealth.currentHealth).toBe(initialHealth - 50);
    });

    it('should not hit owner entity', () => {
      const projectile = scene.createEntity('projectile');
      const projectileComp = new ProjectileComponent({
        damage: 50,
        ownerId: ownerEntity.id,
      });
      projectile.addComponent(projectileComp);
      scene.addEntity(projectile);

      const ownerHealth = new HealthComponent();
      ownerHealth.maxHealth = 100;
      ownerHealth.currentHealth = 100;
      ownerEntity.addComponent(ownerHealth);

      const collisionEvent: CollisionEvent = {
        entityA: projectile,
        entityB: ownerEntity,
        physicsA: {} as PhysicsComponent,
        physicsB: {} as PhysicsComponent,
        normal: [0, 0, 1],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      const listener = (mockPhysicsSystem as any)._collisionListener;
      if (listener) {
        listener(collisionEvent);
      }

      expect(ownerHealth.currentHealth).toBe(100); // Should not take damage
    });

    it('should emit hit event on collision', () => {
      const projectile = scene.createEntity('projectile');
      const projectileComp = new ProjectileComponent({
        damage: 50,
        ownerId: ownerEntity.id,
      });
      projectile.addComponent(projectileComp);
      scene.addEntity(projectile);

      const eventSpy = vi.fn();
      scene.events.on('projectile:hit', eventSpy);

      const collisionEvent: CollisionEvent = {
        entityA: projectile,
        entityB: targetEntity,
        physicsA: {} as PhysicsComponent,
        physicsB: {} as PhysicsComponent,
        normal: [0, 0, 1],
        depth: 0.1,
        contactPoint: [0, 0, -10],
      };

      const listener = (mockPhysicsSystem as any)._collisionListener;
      if (listener) {
        listener(collisionEvent);
      }

      expect(eventSpy).toHaveBeenCalled();
      const event = eventSpy.mock.calls[0]![0];
      expect(event.projectile).toBe(projectile);
      expect(event.hitEntity).toBe(targetEntity);
      expect(event.damage).toBe(50);
    });

    it('should destroy projectile after hit', () => {
      const projectile = scene.createEntity('projectile');
      const projectileComp = new ProjectileComponent({
        damage: 50,
        ownerId: ownerEntity.id,
      });
      projectile.addComponent(projectileComp);
      scene.addEntity(projectile);

      const collisionEvent: CollisionEvent = {
        entityA: projectile,
        entityB: targetEntity,
        physicsA: {} as PhysicsComponent,
        physicsB: {} as PhysicsComponent,
        normal: [0, 0, 1],
        depth: 0.1,
        contactPoint: [0, 0, -10],
      };

      const listener = (mockPhysicsSystem as any)._collisionListener;
      if (listener) {
        listener(collisionEvent);
      }

      expect(scene.findEntityById(projectile.id)).toBeNull();
    });

    it('should handle collision with entity without health', () => {
      const projectile = scene.createEntity('projectile');
      const projectileComp = new ProjectileComponent({
        damage: 50,
        ownerId: ownerEntity.id,
      });
      projectile.addComponent(projectileComp);
      scene.addEntity(projectile);

      const wallEntity = scene.createEntity('wall');
      scene.addEntity(wallEntity);

      const collisionEvent: CollisionEvent = {
        entityA: projectile,
        entityB: wallEntity,
        physicsA: {} as PhysicsComponent,
        physicsB: {} as PhysicsComponent,
        normal: [0, 0, 1],
        depth: 0.1,
        contactPoint: [0, 0, -10],
      };

      const listener = (mockPhysicsSystem as any)._collisionListener;
      if (listener) {
        // Should not throw
        expect(() => listener(collisionEvent)).not.toThrow();
      }

      // Projectile should still be destroyed
      expect(scene.findEntityById(projectile.id)).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should unsubscribe from collision events', () => {
      projectileSystem.dispose();
      expect(mockPhysicsSystem.removeCollisionListener).toHaveBeenCalled();
    });

    it('should handle dispose without physics system', () => {
      const system = new ProjectileSystem(scene, null);
      expect(() => system.dispose()).not.toThrow();
    });
  });

  describe('getCurrentTime', () => {
    it('should return current time', () => {
      projectileSystem.update(1.5);
      expect(projectileSystem.getCurrentTime()).toBe(1.5);

      projectileSystem.update(0.5);
      expect(projectileSystem.getCurrentTime()).toBe(2.0);
    });
  });
});

