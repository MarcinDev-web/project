import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { PhysicsComponent, RigidbodyType } from '@engine/world';

describe('PhysicsWorld', () => {
  let scene: Scene;
  let world: PhysicsWorld;

  beforeEach(() => {
    scene = new Scene('TestScene');
    world = new PhysicsWorld(scene);
  });

  describe('initialization', () => {
    it('should create physics world', () => {
      expect(world).toBeDefined();
      expect(world.getGravity()).toEqual([0, -9.81, 0]);
    });

    it('should create with custom config', () => {
      const customWorld = new PhysicsWorld(scene, {
        gravity: [0, -20, 0],
      });

      expect(customWorld.getGravity()).toEqual([0, -20, 0]);
    });
  });

  describe('start/stop', () => {
    it('should start and stop physics simulation', () => {
      world.start();
      world.stop();
      // No error should occur
      expect(true).toBe(true);
    });

    it('should not update when stopped', () => {
      const entity = new Entity('TestEntity');
      world.addPhysics(entity, { useGravity: true });
      scene.addEntity(entity);

      world.stop();
      const initialY = entity.transform.position[1];

      world.update(1 / 60);

      // Position should not change when stopped
      expect(entity.transform.position[1]).toBe(initialY);
    });

    it('should update when started', () => {
      const entity = new Entity('TestEntity');
      world.addPhysics(entity, { type: RigidbodyType.Dynamic, useGravity: true });
      scene.addEntity(entity);

      world.start();
      const initialY = entity.transform.position[1];

      world.update(1 / 60);

      // Position should change when started
      expect(entity.transform.position[1]).not.toBe(initialY);
    });
  });

  describe('addPhysics', () => {
    it('should add physics component to entity', () => {
      const entity = new Entity('TestEntity');
      const physics = world.addPhysics(entity);

      expect(physics).toBeDefined();
      expect(entity.getComponent(PhysicsComponent)).toBe(physics);
    });

    it('should add physics with default box collider', () => {
      const entity = new Entity('TestEntity');
      entity.transform.scale = [2, 3, 4];

      const physics = world.addPhysics(entity);

      expect(physics.colliders.length).toBe(1);
      expect(physics.colliders[0]?.shape).toBe('box');
    });

    it('should add physics with sphere collider', () => {
      const entity = new Entity('TestEntity');
      const physics = world.addPhysics(entity, { collider: 'sphere' });

      expect(physics.colliders.length).toBe(1);
      expect(physics.colliders[0]?.shape).toBe('sphere');
    });

    it('should add physics with capsule collider', () => {
      const entity = new Entity('TestEntity');
      const physics = world.addPhysics(entity, { collider: 'capsule' });

      expect(physics.colliders.length).toBe(1);
      expect(physics.colliders[0]?.shape).toBe('capsule');
    });

    it('should add physics with custom settings', () => {
      const entity = new Entity('TestEntity');
      const physics = world.addPhysics(entity, {
        type: RigidbodyType.Static,
        mass: 5.0,
        useGravity: false,
      });

      expect(physics.rigidbodyType).toBe(RigidbodyType.Static);
      expect(physics.mass).toBe(5.0);
      expect(physics.useGravity).toBe(false);
    });

    it('should not add duplicate physics component', () => {
      const entity = new Entity('TestEntity');
      const physics1 = world.addPhysics(entity);
      const physics2 = world.addPhysics(entity);

      expect(physics1).toBe(physics2);
      expect(entity.getComponentTypes().filter((t) => t.type === 'Physics').length).toBe(1);
    });
  });

  describe('removePhysics', () => {
    it('should remove physics component from entity', () => {
      const entity = new Entity('TestEntity');
      world.addPhysics(entity);

      world.removePhysics(entity);

      expect(entity.getComponent(PhysicsComponent)).toBeNull();
    });
  });

  describe('force application', () => {
    it('should apply force to entity', () => {
      const entity = new Entity('TestEntity');
      world.addPhysics(entity, { useGravity: false });
      scene.addEntity(entity);

      world.applyForce(entity, [100, 0, 0]);
      world.start();

      const initialX = entity.transform.position[0];
      world.update(1 / 60);

      expect(entity.transform.position[0]).toBeGreaterThan(initialX);
    });

    it('should apply impulse to entity', () => {
      const entity = new Entity('TestEntity');
      world.addPhysics(entity, { mass: 2.0 });

      world.applyImpulse(entity, [20, 0, 0]);

      const velocity = world.getVelocity(entity);
      expect(velocity).toEqual([10, 0, 0]); // impulse / mass
    });

    it('should apply torque to entity', () => {
      const entity = new Entity('TestEntity');
      world.addPhysics(entity, { useGravity: false });

      world.applyTorque(entity, [0, 5, 0]);

      const angularVel = world.getAngularVelocity(entity);
      expect(angularVel).not.toBeNull();
    });
  });

  describe('velocity control', () => {
    it('should set and get velocity', () => {
      const entity = new Entity('TestEntity');
      world.addPhysics(entity);

      world.setVelocity(entity, [5, 10, 15]);
      const velocity = world.getVelocity(entity);

      expect(velocity).toEqual([5, 10, 15]);
    });

    it('should set and get angular velocity', () => {
      const entity = new Entity('TestEntity');
      world.addPhysics(entity);

      world.setAngularVelocity(entity, [1, 2, 3]);
      const angularVel = world.getAngularVelocity(entity);

      expect(angularVel).toEqual([1, 2, 3]);
    });

    it('should return null for entities without physics', () => {
      const entity = new Entity('TestEntity');

      const velocity = world.getVelocity(entity);
      expect(velocity).toBeNull();
    });
  });

  describe('sleep/wake control', () => {
    it('should wake up entity', () => {
      const entity = new Entity('TestEntity');
      const physics = world.addPhysics(entity);
      physics.sleep();

      expect(world.isAwake(entity)).toBe(false);

      world.wakeUp(entity);

      expect(world.isAwake(entity)).toBe(true);
    });

    it('should put entity to sleep', () => {
      const entity = new Entity('TestEntity');
      world.addPhysics(entity);

      expect(world.isAwake(entity)).toBe(true);

      world.sleep(entity);

      expect(world.isAwake(entity)).toBe(false);
    });
  });

  describe('event listeners', () => {
    it('should register collision listener', () => {
      let collisionFired = false;

      world.onCollision(() => {
        collisionFired = true;
      });

      const entityA = new Entity('A');
      world.addPhysics(entityA);
      entityA.transform.position = [0, 0, 0];
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      world.addPhysics(entityB);
      entityB.transform.position = [0.5, 0, 0]; // Overlapping
      scene.addEntity(entityB);

      world.start();
      world.update(1 / 60);

      expect(collisionFired).toBe(true);
    });

    it('should register trigger enter listener', () => {
      let triggerFired = false;

      world.onTriggerEnter(() => {
        triggerFired = true;
      });

      const trigger = new Entity('Trigger');
      const triggerPhysics = world.addPhysics(trigger, { type: RigidbodyType.Static });
      triggerPhysics.clearColliders();
      triggerPhysics.addBoxCollider([2, 2, 2], [0, 0, 0], true);
      trigger.transform.position = [0, 0, 0];
      scene.addEntity(trigger);

      const dynamic = new Entity('Dynamic');
      world.addPhysics(dynamic, { useGravity: false });
      dynamic.transform.position = [0, 0, 0];
      scene.addEntity(dynamic);

      world.start();
      world.update(1 / 60);

      expect(triggerFired).toBe(true);
    });
  });

  describe('helper methods', () => {
    it('should create dynamic box', () => {
      const box = PhysicsWorld.createDynamicBox(scene, [0, 5, 0], [1, 1, 1], 2.0);

      expect(box).toBeDefined();
      expect(box.transform.position).toEqual([0, 5, 0]);
      expect(box.transform.scale).toEqual([1, 1, 1]);

      const physics = box.getComponent(PhysicsComponent);
      expect(physics).not.toBeNull();
      expect(physics?.rigidbodyType).toBe(RigidbodyType.Dynamic);
      expect(physics?.mass).toBe(2.0);
      expect(physics?.colliders.length).toBe(1);
    });

    it('should create static floor', () => {
      const floor = PhysicsWorld.createStaticFloor(scene, [0, -5, 0], [10, 1, 10]);

      expect(floor).toBeDefined();
      expect(floor.transform.position).toEqual([0, -5, 0]);

      const physics = floor.getComponent(PhysicsComponent);
      expect(physics?.rigidbodyType).toBe(RigidbodyType.Static);
      expect(physics?.useGravity).toBe(false);
    });

    it('should create dynamic sphere', () => {
      const sphere = PhysicsWorld.createDynamicSphere(scene, [0, 10, 0], 2.0, 3.0);

      expect(sphere).toBeDefined();

      const physics = sphere.getComponent(PhysicsComponent);
      expect(physics?.rigidbodyType).toBe(RigidbodyType.Dynamic);
      expect(physics?.mass).toBe(3.0);
      expect(physics?.colliders[0]?.shape).toBe('sphere');
    });

    it('should create kinematic platform', () => {
      const platform = PhysicsWorld.createKinematicPlatform(scene, [0, 0, 0], [5, 1, 5]);

      expect(platform).toBeDefined();

      const physics = platform.getComponent(PhysicsComponent);
      expect(physics?.rigidbodyType).toBe(RigidbodyType.Kinematic);
      expect(physics?.useGravity).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should update gravity', () => {
      world.setGravity([0, -5, 0]);

      expect(world.getGravity()).toEqual([0, -5, 0]);
    });

    it('should update config', () => {
      world.setConfig({ solverIterations: 15 });

      const config = world.getConfig();
      expect(config.solverIterations).toBe(15);
    });
  });

  describe('query methods', () => {
    it('should get all physics entities', () => {
      const entity1 = new Entity('Entity1');
      world.addPhysics(entity1);
      scene.addEntity(entity1);

      const entity2 = new Entity('Entity2');
      world.addPhysics(entity2);
      scene.addEntity(entity2);

      const entity3 = new Entity('Entity3');
      scene.addEntity(entity3); // No physics

      const physicsEntities = world.getPhysicsEntities();

      expect(physicsEntities.length).toBe(2);
      expect(physicsEntities).toContain(entity1);
      expect(physicsEntities).toContain(entity2);
      expect(physicsEntities).not.toContain(entity3);
    });
  });

  describe('integration test', () => {
    it('should simulate falling box hitting floor', () => {
      world.start();

      // Create floor
      const floor = PhysicsWorld.createStaticFloor(scene, [0, -5, 0], [10, 1, 10]);

      // Create falling box
      const box = PhysicsWorld.createDynamicBox(scene, [0, 5, 0], [1, 1, 1], 1.0);

      let collisionOccurred = false;
      world.onCollision(() => {
        collisionOccurred = true;
      });

      // Simulate for 2 seconds
      for (let i = 0; i < 120; i++) {
        world.update(1 / 60);
      }

      // Box should have fallen and collided with floor
      expect(collisionOccurred).toBe(true);
      expect(box.transform.position[1]).toBeLessThan(5);
      expect(box.transform.position[1]).toBeGreaterThan(-5);
    });
  });
});

