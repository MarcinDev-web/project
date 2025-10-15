import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '../scene/Scene';
import { Entity } from '../scene/Entity';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { PhysicsComponent, RigidbodyType } from '../scene/components/PhysicsComponent';
import { JointComponent } from '../scene/components/JointComponent';
import { JointType } from '../physics/Joint';

describe('Joint Integration Tests', () => {
  let scene: Scene;
  let physics: PhysicsWorld;

  beforeEach(() => {
    scene = new Scene();
    physics = new PhysicsWorld(scene, {
      gravity: [0, -9.81, 0],
      fixedTimestep: 1 / 60,
    });
  });

  describe('PhysicsWorld Joint API', () => {
    it('should add fixed joint between entities', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const joint = physics.addFixedJoint(entityA, entityB);
      expect(joint).toBeDefined();
      expect(joint.config.type).toBe(JointType.Fixed);

      // Both entities should now have joint components
      const jointCompA = entityA.getComponent(JointComponent) as JointComponent;
      const jointCompB = entityB.getComponent(JointComponent) as JointComponent;
      expect(jointCompA).toBeDefined();
      expect(jointCompB).toBeDefined();
      expect(jointCompA.getJointCount()).toBeGreaterThan(0);
      expect(jointCompB.getJointCount()).toBeGreaterThan(0);
    });

    it('should add distance joint', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const joint = physics.addDistanceJoint(entityA, entityB, 2.0);
      expect(joint).toBeDefined();
      expect(joint.config.type).toBe(JointType.Distance);
      expect((joint.config as any).distance).toBe(2.0);
    });

    it('should add spring joint', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const joint = physics.addSpringJoint(entityA, entityB, 2.0, 50, 0.5);
      expect(joint).toBeDefined();
      expect(joint.config.type).toBe(JointType.Spring);
      expect((joint.config as any).restLength).toBe(2.0);
      expect((joint.config as any).stiffness).toBe(50);
      expect((joint.config as any).damping).toBe(0.5);
    });

    it('should add hinge joint', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const joint = physics.addHingeJoint(entityA, entityB, [0, 1, 0], [0, 1, 0]);
      expect(joint).toBeDefined();
      expect(joint.config.type).toBe(JointType.Hinge);
    });

    it('should add ball socket joint', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const joint = physics.addBallSocketJoint(entityA, entityB);
      expect(joint).toBeDefined();
      expect(joint.config.type).toBe(JointType.BallSocket);
    });

    it('should add slider joint', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const joint = physics.addSliderJoint(entityA, entityB, [1, 0, 0], [1, 0, 0]);
      expect(joint).toBeDefined();
      expect(joint.config.type).toBe(JointType.Slider);
    });

    it('should remove joint', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const joint = physics.addFixedJoint(entityA, entityB);
      
      const jointCompA = entityA.getComponent(JointComponent) as JointComponent;
      const jointCompB = entityB.getComponent(JointComponent) as JointComponent;
      expect(jointCompA.getJointCount()).toBe(1);
      expect(jointCompB.getJointCount()).toBe(1);

      physics.removeJoint(joint);

      expect(jointCompA.getJointCount()).toBe(0);
      expect(jointCompB.getJointCount()).toBe(0);
    });

    it('should get all joints', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Dynamic;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      physics.addFixedJoint(entityA, entityB);
      physics.addDistanceJoint(entityA, entityB, 2.0);

      const allJoints = physics.getAllJoints();
      // Each joint is added to both entities, so we should have 4 references
      // (2 joints × 2 entities each)
      expect(allJoints.length).toBe(4);
    });
  });

  describe('Joint Physics Simulation', () => {
    it('should constrain entities with fixed joint', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Static;
      physicsA.mass = 10;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      physicsB.mass = 1;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      physics.addFixedJoint(entityA, entityB);
      physics.start();

      const initialDistance = Math.sqrt(
        (entityB.transform.position[0] - entityA.transform.position[0]) ** 2 +
        (entityB.transform.position[1] - entityA.transform.position[1]) ** 2 +
        (entityB.transform.position[2] - entityA.transform.position[2]) ** 2
      );

      // Simulate for a few frames
      for (let i = 0; i < 30; i++) {
        physics.update(1 / 60);
      }

      const finalDistance = Math.sqrt(
        (entityB.transform.position[0] - entityA.transform.position[0]) ** 2 +
        (entityB.transform.position[1] - entityA.transform.position[1]) ** 2 +
        (entityB.transform.position[2] - entityA.transform.position[2]) ** 2
      );

      // Distance should remain relatively constant (fixed joint)
      expect(Math.abs(finalDistance - initialDistance)).toBeLessThan(0.5);
    });

    it('should maintain distance with distance joint', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Static;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [1, 0, 0]; // Closer than target
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      physicsB.mass = 1;
      physicsB.useGravity = false;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const targetDistance = 2.0;
      physics.addDistanceJoint(entityA, entityB, targetDistance, [0, 0, 0], [0, 0, 0], {
        damping: 0.5,
      });
      physics.start();

      // Simulate
      for (let i = 0; i < 60; i++) {
        physics.update(1 / 60);
      }

      const finalDistance = Math.sqrt(
        entityB.transform.position[0] ** 2 +
        entityB.transform.position[1] ** 2 +
        entityB.transform.position[2] ** 2
      );

      // Should be pushed towards target distance
      expect(finalDistance).toBeGreaterThan(1.0);
    });

    it('should apply spring forces', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Static;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [1, 0, 0]; // Compressed spring
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      physicsB.mass = 1;
      physicsB.useGravity = false;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const restLength = 2.0;
      physics.addSpringJoint(entityA, entityB, restLength, 50, 0.5);
      physics.start();

      const initialX = entityB.transform.position[0];

      // Simulate - spring should push entity B away
      for (let i = 0; i < 10; i++) {
        physics.update(1 / 60);
      }

      const finalX = entityB.transform.position[0];

      // Entity B should have moved away (spring push)
      expect(finalX).toBeGreaterThan(initialX);
    });

    it('should break joint under excessive force', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Static;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      physicsB.mass = 1;
      physicsB.useGravity = false;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const joint = physics.addFixedJoint(entityA, entityB, [0, 0, 0], [0, 0, 0], {
        breakable: true,
        breakForce: 1.0,
      });
      physics.start();

      // Apply large force to break joint
      physicsB.addForce([1000, 0, 0]);

      // Simulate
      for (let i = 0; i < 10; i++) {
        physics.update(1 / 60);
      }

      // Joint should be broken
      expect(joint.isBroken()).toBe(true);
    });

    it('should clean up broken joints automatically', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Static;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      physicsB.mass = 1;
      physicsB.useGravity = false;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      physics.addFixedJoint(entityA, entityB, [0, 0, 0], [0, 0, 0], {
        breakable: true,
        breakForce: 1.0,
      });
      physics.start();

      const jointCompA = entityA.getComponent(JointComponent) as JointComponent;
      const jointCompB = entityB.getComponent(JointComponent) as JointComponent;

      expect(jointCompA.getJointCount()).toBe(1);
      expect(jointCompB.getJointCount()).toBe(1);

      // Apply large force to break joint
      physicsB.addForce([1000, 0, 0]);

      // Simulate
      for (let i = 0; i < 10; i++) {
        physics.update(1 / 60);
      }

      // Broken joints should be cleaned up
      expect(jointCompA.getJointCount()).toBe(0);
      expect(jointCompB.getJointCount()).toBe(0);
    });
  });

  describe('Complex Joint Scenarios', () => {
    it('should support chain of entities with distance joints', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Static;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [1, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      physicsB.mass = 1;
      physicsB.useGravity = false;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const entityC = new Entity('C');
      entityC.transform.position = [2, 0, 0];
      const physicsC = new PhysicsComponent();
      physicsC.rigidbodyType = RigidbodyType.Dynamic;
      physicsC.mass = 1;
      physicsC.useGravity = false;
      entityC.addComponent(physicsC);
      scene.addEntity(entityC);

      // Create chain: A -> B -> C
      physics.addDistanceJoint(entityA, entityB, 1.0);
      physics.addDistanceJoint(entityB, entityC, 1.0);
      physics.start();

      // Simulate
      for (let i = 0; i < 30; i++) {
        physics.update(1 / 60);
      }

      // All entities should still be relatively in a line
      expect(entityB.transform.position[0]).toBeGreaterThan(0);
      expect(entityC.transform.position[0]).toBeGreaterThan(entityB.transform.position[0]);
    });

    it('should support multiple joint types on same entity', () => {
      const entityA = new Entity('A');
      entityA.transform.position = [0, 0, 0];
      const physicsA = new PhysicsComponent();
      physicsA.rigidbodyType = RigidbodyType.Static;
      entityA.addComponent(physicsA);
      scene.addEntity(entityA);

      const entityB = new Entity('B');
      entityB.transform.position = [2, 0, 0];
      const physicsB = new PhysicsComponent();
      physicsB.rigidbodyType = RigidbodyType.Dynamic;
      physicsB.mass = 1;
      entityB.addComponent(physicsB);
      scene.addEntity(entityB);

      const entityC = new Entity('C');
      entityC.transform.position = [0, 2, 0];
      const physicsC = new PhysicsComponent();
      physicsC.rigidbodyType = RigidbodyType.Dynamic;
      physicsC.mass = 1;
      entityC.addComponent(physicsC);
      scene.addEntity(entityC);

      // Entity A has multiple joints
      physics.addDistanceJoint(entityA, entityB, 2.0);
      physics.addSpringJoint(entityA, entityC, 2.0, 50, 0.5);
      physics.start();

      const jointCompA = entityA.getComponent(JointComponent) as JointComponent;
      expect(jointCompA.getJointCount()).toBe(2);

      // Simulate
      for (let i = 0; i < 30; i++) {
        physics.update(1 / 60);
      }

      // Both joints should be active
      const enabledJoints = jointCompA.getEnabledJoints();
      expect(enabledJoints.length).toBe(2);
    });
  });
});

