import { describe, it, expect, beforeEach } from 'vitest';
import {
  PhysicsComponent,
  RigidbodyType,
  ColliderShape,
  DEFAULT_PHYSICS_MATERIAL,
} from '@engine/world';
import { Entity } from '@engine/world';

describe('PhysicsComponent', () => {
  let entity: Entity;
  let physics: PhysicsComponent;

  beforeEach(() => {
    entity = new Entity('TestEntity');
    physics = new PhysicsComponent();
    entity.addComponent(physics);
  });

  describe('initialization', () => {
    it('should create with default values', () => {
      expect(physics.rigidbodyType).toBe(RigidbodyType.Dynamic);
      expect(physics.mass).toBe(1.0);
      expect(physics.velocity).toEqual([0, 0, 0]);
      expect(physics.angularVelocity).toEqual([0, 0, 0]);
      expect(physics.useGravity).toBe(true);
      expect(physics.colliders).toEqual([]);
      expect(physics.isAwake()).toBe(true);
    });

    it('should have correct component type', () => {
      expect(physics.getType()).toBe('Physics');
      expect(PhysicsComponent.type).toBe('Physics');
    });

    it('should initialize with default physics material', () => {
      expect(physics.material).toEqual(DEFAULT_PHYSICS_MATERIAL);
      expect(physics.material.friction).toBe(0.5);
      expect(physics.material.restitution).toBe(0.3);
      expect(physics.material.density).toBe(1.0);
    });
  });

  describe('colliders', () => {
    it('should add box collider', () => {
      const collider = physics.addBoxCollider([1, 2, 3]);
      
      expect(collider.shape).toBe(ColliderShape.Box);
      expect(collider.size).toEqual([1, 2, 3]);
      expect(collider.center).toEqual([0, 0, 0]);
      expect(collider.isTrigger).toBe(false);
      expect(physics.colliders.length).toBe(1);
    });

    it('should add sphere collider', () => {
      const collider = physics.addSphereCollider(2.5);
      
      expect(collider.shape).toBe(ColliderShape.Sphere);
      expect(collider.radius).toBe(2.5);
      expect(collider.center).toEqual([0, 0, 0]);
      expect(collider.isTrigger).toBe(false);
      expect(physics.colliders.length).toBe(1);
    });

    it('should add capsule collider', () => {
      const collider = physics.addCapsuleCollider(1.0, 3.0);
      
      expect(collider.shape).toBe(ColliderShape.Capsule);
      expect(collider.radius).toBe(1.0);
      expect(collider.height).toBe(3.0);
      expect(collider.center).toEqual([0, 0, 0]);
      expect(collider.isTrigger).toBe(false);
      expect(physics.colliders.length).toBe(1);
    });

    it('should add collider with custom center', () => {
      const collider = physics.addBoxCollider([1, 1, 1], [0.5, 1.0, 0.5]);
      
      expect(collider.center).toEqual([0.5, 1.0, 0.5]);
    });

    it('should add trigger collider', () => {
      const collider = physics.addSphereCollider(1.0, [0, 0, 0], true);
      
      expect(collider.isTrigger).toBe(true);
    });

    it('should add multiple colliders', () => {
      physics.addBoxCollider([1, 1, 1]);
      physics.addSphereCollider(0.5);
      physics.addCapsuleCollider(0.3, 1.5);
      
      expect(physics.colliders.length).toBe(3);
    });

    it('should clear all colliders', () => {
      physics.addBoxCollider([1, 1, 1]);
      physics.addSphereCollider(0.5);
      
      physics.clearColliders();
      
      expect(physics.colliders.length).toBe(0);
    });
  });

  describe('forces and impulses', () => {
    it('should accumulate forces', () => {
      physics.addForce([10, 0, 0]);
      physics.addForce([0, 5, 0]);
      
      const force = physics.consumeForce();
      expect(force).toEqual([10, 5, 0]);
    });

    it('should clear force after consuming', () => {
      physics.addForce([10, 0, 0]);
      physics.consumeForce();
      
      const force = physics.consumeForce();
      expect(force).toEqual([0, 0, 0]);
    });

    it('should apply impulse to velocity', () => {
      physics.mass = 2.0;
      physics.addImpulse([20, 0, 0]);
      
      expect(physics.velocity).toEqual([10, 0, 0]); // impulse / mass
    });

    it('should not apply force to static bodies', () => {
      physics.rigidbodyType = RigidbodyType.Static;
      physics.addForce([10, 0, 0]);
      
      const force = physics.consumeForce();
      expect(force).toEqual([0, 0, 0]);
    });

    it('should accumulate torques', () => {
      physics.addTorque([1, 2, 3]);
      physics.addTorque([3, 2, 1]);
      
      const torque = physics.consumeTorque();
      expect(torque).toEqual([4, 4, 4]);
    });
  });

  describe('rigidbody types', () => {
    it('should set dynamic rigidbody', () => {
      physics.rigidbodyType = RigidbodyType.Dynamic;
      expect(physics.getInverseMass()).toBeGreaterThan(0);
    });

    it('should set static rigidbody', () => {
      physics.rigidbodyType = RigidbodyType.Static;
      expect(physics.getInverseMass()).toBe(0);
    });

    it('should set kinematic rigidbody', () => {
      physics.rigidbodyType = RigidbodyType.Kinematic;
      expect(physics.getInverseMass()).toBe(0);
    });

    it('should return zero inverse mass for zero mass', () => {
      physics.mass = 0;
      expect(physics.getInverseMass()).toBe(0);
    });
  });

  describe('sleep/wake system', () => {
    it('should start awake', () => {
      expect(physics.isAwake()).toBe(true);
    });

    it('should wake up when force is applied', () => {
      physics.sleep();
      expect(physics.isAwake()).toBe(false);
      
      physics.addForce([1, 0, 0]);
      expect(physics.isAwake()).toBe(true);
    });

    it('should wake up when impulse is applied', () => {
      physics.sleep();
      physics.addImpulse([1, 0, 0]);
      
      expect(physics.isAwake()).toBe(true);
    });

    it('should clear velocity when sleeping', () => {
      physics.velocity = [1, 2, 3];
      physics.angularVelocity = [0.5, 0.5, 0.5];
      
      physics.sleep();
      
      expect(physics.velocity).toEqual([0, 0, 0]);
      expect(physics.angularVelocity).toEqual([0, 0, 0]);
    });

    it('should update sleep state based on velocity threshold', () => {
      physics.velocity = [0.005, 0, 0]; // Below threshold
      physics.updateSleepState(0.5);
      
      expect(physics.isAwake()).toBe(true); // Still awake initially
      
      // Advance more time
      physics.updateSleepState(0.6);
      expect(physics.isAwake()).toBe(false); // Should sleep after 1 second
    });

    it('should reset sleep timer on high velocity', () => {
      physics.velocity = [0.005, 0, 0];
      physics.updateSleepState(0.5);
      
      physics.velocity = [1.0, 0, 0]; // High velocity
      physics.updateSleepState(0.016);
      
      expect(physics.isAwake()).toBe(true);
    });
  });

  describe('constraints', () => {
    it('should have no constraints by default', () => {
      expect(physics.freezePositionX).toBe(false);
      expect(physics.freezePositionY).toBe(false);
      expect(physics.freezePositionZ).toBe(false);
      expect(physics.freezeRotationX).toBe(false);
      expect(physics.freezeRotationY).toBe(false);
      expect(physics.freezeRotationZ).toBe(false);
    });

    it('should allow setting position constraints', () => {
      physics.freezePositionX = true;
      physics.freezePositionY = true;
      
      expect(physics.freezePositionX).toBe(true);
      expect(physics.freezePositionY).toBe(true);
      expect(physics.freezePositionZ).toBe(false);
    });

    it('should allow setting rotation constraints', () => {
      physics.freezeRotationY = true;
      
      expect(physics.freezeRotationY).toBe(true);
      expect(physics.freezeRotationX).toBe(false);
      expect(physics.freezeRotationZ).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      physics.mass = 5.0;
      physics.velocity = [1, 2, 3];
      physics.addBoxCollider([2, 2, 2]);
      
      const json = physics.toJSON();
      
      expect(json).toHaveProperty('mass', 5.0);
      expect(json).toHaveProperty('velocity');
      expect(json).toHaveProperty('colliders');
    });

    it('should deserialize from JSON', () => {
      const data = {
        rigidbodyType: RigidbodyType.Static,
        mass: 10.0,
        velocity: [5, 6, 7],
        angularVelocity: [1, 1, 1],
        useGravity: false,
        linearDrag: 0.1,
        colliders: [
          {
            shape: ColliderShape.Box,
            size: [3, 3, 3],
            center: [0, 0, 0],
            isTrigger: false,
            friction: 0.5,
            restitution: 0.3,
          },
        ],
      };
      
      physics.fromJSON(data);
      
      expect(physics.rigidbodyType).toBe(RigidbodyType.Static);
      expect(physics.mass).toBe(10.0);
      expect(physics.velocity).toEqual([5, 6, 7]);
      expect(physics.angularVelocity).toEqual([1, 1, 1]);
      expect(physics.useGravity).toBe(false);
      expect(physics.linearDrag).toBe(0.1);
      expect(physics.colliders.length).toBe(1);
    });
  });

  describe('cloning', () => {
    it('should create a deep clone', () => {
      physics.mass = 3.0;
      physics.velocity = [1, 2, 3];
      physics.addBoxCollider([1, 1, 1]);
      physics.freezePositionY = true;
      
      const clone = physics.clone();
      
      expect(clone).not.toBe(physics);
      expect(clone.mass).toBe(3.0);
      expect(clone.velocity).toEqual([1, 2, 3]);
      expect(clone.colliders.length).toBe(1);
      expect(clone.freezePositionY).toBe(true);
      
      // Modify original shouldn't affect clone
      physics.velocity[0] = 100;
      expect(clone.velocity[0]).toBe(1);
    });
  });

  describe('material properties', () => {
    it('should update material properties', () => {
      physics.material.friction = 0.8;
      physics.material.restitution = 0.9;
      physics.material.density = 2.0;
      
      expect(physics.material.friction).toBe(0.8);
      expect(physics.material.restitution).toBe(0.9);
      expect(physics.material.density).toBe(2.0);
    });

    it('should apply material properties to new colliders', () => {
      physics.material.friction = 0.7;
      physics.material.restitution = 0.6;
      
      const collider = physics.addBoxCollider([1, 1, 1]);
      
      expect(collider.friction).toBe(0.7);
      expect(collider.restitution).toBe(0.6);
    });
  });
});

