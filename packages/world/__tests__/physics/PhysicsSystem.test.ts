import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem, DEFAULT_PHYSICS_CONFIG } from '@engine/world/physics';
import { PhysicsComponent, RigidbodyType } from '@engine/world';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';

describe.skip('PhysicsSystem', () => {
  let scene: Scene;
  let physics: PhysicsSystem;

  beforeEach(() => {
    scene = new Scene('TestScene');
    physics = new PhysicsSystem(scene);
  });

  describe('initialization', () => {
    it('should create with default config', () => {
      expect(physics.getGravity()).toEqual(DEFAULT_PHYSICS_CONFIG.gravity);
      expect(physics.getConfig().solverIterations).toBe(DEFAULT_PHYSICS_CONFIG.solverIterations);
    });

    it('should create with custom config', () => {
      const customPhysics = new PhysicsSystem(scene, {
        gravity: [0, -20, 0],
        solverIterations: 10,
      });

      expect(customPhysics.getGravity()).toEqual([0, -20, 0]);
      expect(customPhysics.getConfig().solverIterations).toBe(10);
    });
  });

  describe('gravity', () => {
    it('should apply gravity to dynamic entities', () => {
      const entity = new Entity('TestEntity');
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Dynamic;
      physicsComp.mass = 1.0;
      physicsComp.useGravity = true;
      entity.addComponent(physicsComp);
      scene.addEntity(entity);

      const initialY = entity.transform.position[1];

      // Run physics simulation multiple times to see effect
      for (let i = 0; i < 10; i++) {
        physics.update(1 / 60);
      }

      // Object should have moved down due to gravity
      expect(entity.transform.position[1]).toBeLessThan(initialY);
    });

    it('should not apply gravity when useGravity is false', () => {
      const entity = new Entity('TestEntity');
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Dynamic;
      physicsComp.mass = 1.0;
      physicsComp.useGravity = false;
      entity.addComponent(physicsComp);
      scene.addEntity(entity);

      const initialPosition = [...entity.transform.position];

      physics.update(1 / 60);

      // Position should not change (no forces applied)
      expect(entity.transform.position).toEqual(initialPosition);
    });

    it('should not apply gravity to static entities', () => {
      const entity = new Entity('TestEntity');
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.useGravity = true;
      entity.addComponent(physicsComp);
      scene.addEntity(entity);

      const initialPosition = [...entity.transform.position];

      physics.update(1 / 60);

      expect(entity.transform.position).toEqual(initialPosition);
    });
  });

  describe('forces', () => {
    it('should apply forces to dynamic entities', () => {
      const entity = new Entity('TestEntity');
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Dynamic;
      physicsComp.mass = 1.0;
      physicsComp.useGravity = false;
      entity.addComponent(physicsComp);
      scene.addEntity(entity);

      const initialX = entity.transform.position[0];

      // Apply force over multiple frames
      for (let i = 0; i < 10; i++) {
        physicsComp.addForce([100, 0, 0]);
        physics.update(1 / 60);
      }

      // Entity should have moved to the right
      expect(entity.transform.position[0]).toBeGreaterThan(initialX);
    });

    it('should accumulate multiple forces', () => {
      const entity = new Entity('TestEntity');
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Dynamic;
      physicsComp.mass = 1.0;
      physicsComp.useGravity = false;
      entity.addComponent(physicsComp);
      scene.addEntity(entity);

      physicsComp.addForce([50, 0, 0]);
      physicsComp.addForce([50, 0, 0]);

      physics.update(1 / 60);

      // Should apply combined force
      expect(physicsComp.velocity[0]).toBeGreaterThan(0);
    });
  });

  describe('impulses', () => {
    it('should apply impulse immediately', () => {
      const entity = new Entity('TestEntity');
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Dynamic;
      physicsComp.mass = 2.0;
      physicsComp.useGravity = false;
      entity.addComponent(physicsComp);
      scene.addEntity(entity);

      physicsComp.addImpulse([20, 0, 0]);

      // Impulse is applied immediately to velocity
      expect(physicsComp.velocity[0]).toBe(10); // impulse / mass = 20 / 2
    });
  });

  describe('collision detection', () => {
    it('should detect collision between two boxes', () => {
      const entityA = new Entity('BoxA');
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      physicsA.addBoxCollider([1, 1, 1]);
      entityA.addComponent(physicsA);
      entityA.transform.position = [0, 0, 0];
      scene.addEntity(entityA);

      const entityB = new Entity('BoxB');
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      physicsB.addBoxCollider([1, 1, 1]);
      entityB.addComponent(physicsB);
      entityB.transform.position = [0.5, 0, 0]; // Overlapping
      scene.addEntity(entityB);

      let collisionDetected = false;
      physics.onCollision(() => {
        collisionDetected = true;
      });

      physics.update(1 / 60);

      expect(collisionDetected).toBe(true);
    });

    it('should not detect collision between separated objects', () => {
      const entityA = new Entity('BoxA');
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      physicsA.addBoxCollider([1, 1, 1]);
      entityA.addComponent(physicsA);
      entityA.transform.position = [0, 0, 0];
      scene.addEntity(entityA);

      const entityB = new Entity('BoxB');
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      physicsB.addBoxCollider([1, 1, 1]);
      entityB.addComponent(physicsB);
      entityB.transform.position = [10, 0, 0]; // Far away
      scene.addEntity(entityB);

      let collisionDetected = false;
      physics.onCollision(() => {
        collisionDetected = true;
      });

      physics.update(1 / 60);

      expect(collisionDetected).toBe(false);
    });

    it('should skip collisions between two static objects', () => {
      const entityA = new Entity('StaticA');
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Static;
      physicsA.addBoxCollider([1, 1, 1]);
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('StaticB');
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Static;
      physicsB.addBoxCollider([1, 1, 1]);
      entityB.addComponent(physicsB);
      entityB.transform.position = [0.5, 0, 0];
      scene.addEntity(entityB);

      let collisionDetected = false;
      physics.onCollision(() => {
        collisionDetected = true;
      });

      physics.update(1 / 60);

      // Static-static collisions are skipped
      expect(collisionDetected).toBe(false);
    });
  });

  describe('collision resolution', () => {
    it('should separate overlapping objects', () => {
      const entityA = new Entity('BoxA');
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      physicsA.useGravity = false;
      physicsA.addBoxCollider([1, 1, 1]);
      entityA.addComponent(physicsA);
      entityA.transform.position = [0, 0, 0];
      scene.addEntity(entityA);

      const entityB = new Entity('BoxB');
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      physicsB.useGravity = false;
      physicsB.addBoxCollider([1, 1, 1]);
      entityB.addComponent(physicsB);
      entityB.transform.position = [0.2, 0, 0]; // Overlapping
      scene.addEntity(entityB);

      const initialDistance = Math.abs(
        entityB.transform.position[0] - entityA.transform.position[0]
      );

      // Run physics several times
      for (let i = 0; i < 30; i++) {
        physics.update(1 / 60);
      }

      const finalDistance = Math.abs(
        entityB.transform.position[0] - entityA.transform.position[0]
      );

      // Objects should be pushed apart
      expect(finalDistance).toBeGreaterThan(initialDistance);
    });

    it('should bounce objects on collision with restitution', () => {
      const entityA = new Entity('BoxA');
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      physicsA.useGravity = false;
      physicsA.velocity = [5, 0, 0]; // Moving right
      physicsA.material.restitution = 1.0; // Perfectly elastic
      physicsA.addBoxCollider([1, 1, 1]);
      entityA.addComponent(physicsA);
      entityA.transform.position = [0, 0, 0];
      scene.addEntity(entityA);

      const entityB = new Entity('BoxB');
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Static;
      physicsB.addBoxCollider([1, 1, 1]);
      entityB.addComponent(physicsB);
      entityB.transform.position = [2, 0, 0];
      scene.addEntity(entityB);

      // Run physics to detect collision
      physics.update(1 / 60);

      // Velocity should have reversed or decreased
      expect(physicsA.velocity[0]).toBeLessThan(5);
    });
  });

  describe('trigger events', () => {
    it('should fire trigger enter event', () => {
      const triggerEntity = new Entity('Trigger');
      const triggerPhysics = new PhysicsComponent();
      triggerPhysics.rigidbodyType = RigidbodyType.Static;
      triggerPhysics.addBoxCollider([2, 2, 2], [0, 0, 0], true); // Trigger collider
      triggerEntity.addComponent(triggerPhysics);
      triggerEntity.transform.position = [0, 0, 0];
      scene.addEntity(triggerEntity);

      const dynamicEntity = new Entity('Dynamic');
      const dynamicPhysics = new PhysicsComponent();
      dynamicPhysics.rigidbodyType = RigidbodyType.Dynamic;
      dynamicPhysics.useGravity = false;
      dynamicPhysics.addBoxCollider([1, 1, 1]);
      dynamicEntity.addComponent(dynamicPhysics);
      dynamicEntity.transform.position = [5, 0, 0]; // Start far away
      scene.addEntity(dynamicEntity);

      let triggerEntered = false;
      physics.onTriggerEnter(() => {
        triggerEntered = true;
      });

      // Move dynamic entity into trigger
      dynamicEntity.transform.position = [0, 0, 0];
      physics.update(1 / 60);

      expect(triggerEntered).toBe(true);
    });

    it('should fire trigger exit event', () => {
      const triggerEntity = new Entity('Trigger');
      const triggerPhysics = new PhysicsComponent();
      triggerPhysics.rigidbodyType = RigidbodyType.Static;
      triggerPhysics.addBoxCollider([2, 2, 2], [0, 0, 0], true);
      triggerEntity.addComponent(triggerPhysics);
      triggerEntity.transform.position = [0, 0, 0];
      scene.addEntity(triggerEntity);

      const dynamicEntity = new Entity('Dynamic');
      const dynamicPhysics = new PhysicsComponent();
      dynamicPhysics.rigidbodyType = RigidbodyType.Dynamic;
      dynamicPhysics.useGravity = false;
      dynamicPhysics.addBoxCollider([1, 1, 1]);
      dynamicEntity.addComponent(dynamicPhysics);
      dynamicEntity.transform.position = [0, 0, 0]; // Start inside
      scene.addEntity(dynamicEntity);

      // First update to register the trigger
      physics.update(1 / 60);

      let triggerExited = false;
      physics.onTriggerExit(() => {
        triggerExited = true;
      });

      // Move out of trigger
      dynamicEntity.transform.position = [10, 0, 0];
      physics.update(1 / 60);

      expect(triggerExited).toBe(true);
    });
  });

  describe('drag', () => {
    it('should apply linear drag to slow down objects', () => {
      const entity = new Entity('TestEntity');
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Dynamic;
      physicsComp.mass = 1.0;
      physicsComp.useGravity = false;
      physicsComp.velocity = [10, 0, 0];
      physicsComp.linearDrag = 1.0; // High drag
      entity.addComponent(physicsComp);
      scene.addEntity(entity);

      const initialSpeed = physicsComp.velocity[0];

      physics.update(1 / 60);

      // Velocity should have decreased
      expect(physicsComp.velocity[0]).toBeLessThan(initialSpeed);
      expect(physicsComp.velocity[0]).toBeGreaterThan(0);
    });

    it('should apply angular drag to slow down rotation', () => {
      const entity = new Entity('TestEntity');
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Dynamic;
      physicsComp.mass = 1.0;
      physicsComp.useGravity = false;
      physicsComp.angularVelocity = [5, 0, 0];
      physicsComp.angularDrag = 1.0;
      entity.addComponent(physicsComp);
      scene.addEntity(entity);

      const initialAngularSpeed = physicsComp.angularVelocity[0];

      physics.update(1 / 60);

      expect(physicsComp.angularVelocity[0]).toBeLessThan(initialAngularSpeed);
      expect(physicsComp.angularVelocity[0]).toBeGreaterThan(0);
    });
  });

  describe('constraints', () => {
    it('should freeze position on constrained axes', () => {
      const entity = new Entity('TestEntity');
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Dynamic;
      physicsComp.mass = 1.0;
      physicsComp.useGravity = true;
      physicsComp.freezePositionY = true; // Freeze Y axis
      entity.addComponent(physicsComp);
      scene.addEntity(entity);

      const initialY = entity.transform.position[1];

      // Run physics multiple times
      for (let i = 0; i < 10; i++) {
        physics.update(1 / 60);
      }

      // Y position should not change despite gravity
      expect(entity.transform.position[1]).toBe(initialY);
    });
  });

  describe('sleep/wake', () => {
    it('should put objects to sleep when velocity is low', () => {
      const entity = new Entity('TestEntity');
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Dynamic;
      physicsComp.mass = 1.0;
      physicsComp.useGravity = false;
      physicsComp.velocity = [0.001, 0, 0]; // Very low velocity
      physicsComp.sleepThreshold = 0.01;
      entity.addComponent(physicsComp);
      scene.addEntity(entity);

      expect(physicsComp.isAwake()).toBe(true);

      // Run physics long enough to trigger sleep
      for (let i = 0; i < 100; i++) {
        physics.update(1 / 60);
      }

      expect(physicsComp.isAwake()).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should allow updating gravity', () => {
      physics.setGravity([0, -20, 0]);
      expect(physics.getGravity()).toEqual([0, -20, 0]);
    });

    it('should allow updating config', () => {
      physics.setConfig({ solverIterations: 20 });
      expect(physics.getConfig().solverIterations).toBe(20);
    });
  });
});


