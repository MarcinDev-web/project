import { describe, it, expect, beforeEach } from 'vitest';
import { JointComponent } from '@engine/world';
import { Entity } from '@engine/world';
import { PhysicsComponent, RigidbodyType } from '@engine/world';
import { createJoint, JointType, type FixedJointConfig } from '@engine/world/physics';

describe('JointComponent', () => {
  let entityA: Entity;
  let entityB: Entity;
  let component: JointComponent;

  beforeEach(() => {
    // Create two entities with physics
    entityA = new Entity('EntityA');
    entityA.transform.position = [0, 0, 0];
    const physicsA = new PhysicsComponent();
    physicsA.rigidbodyType = RigidbodyType.Dynamic;
    entityA.addComponent(physicsA);

    entityB = new Entity('EntityB');
    entityB.transform.position = [2, 0, 0];
    const physicsB = new PhysicsComponent();
    physicsB.rigidbodyType = RigidbodyType.Dynamic;
    entityB.addComponent(physicsB);

    component = new JointComponent();
  });

  describe('Initialization', () => {
    it('should initialize with empty joints array', () => {
      expect(component.joints).toEqual([]);
      expect(component.getJointCount()).toBe(0);
    });

    it('should have correct component type', () => {
      expect(component.getType()).toBe('JointComponent');
    });
  });

  describe('Adding Joints', () => {
    it('should add a joint', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      component.addJoint(joint);

      expect(component.getJointCount()).toBe(1);
      expect(component.joints[0]).toBe(joint);
    });

    it('should not add duplicate joints', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      component.addJoint(joint);
      component.addJoint(joint);

      expect(component.getJointCount()).toBe(1);
    });

    it('should add multiple different joints', () => {
      const config1: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const config2: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [1, 0, 0],
        localAnchorB: [1, 0, 0],
      };

      const joint1 = createJoint(config1);
      const joint2 = createJoint(config2);

      component.addJoint(joint1);
      component.addJoint(joint2);

      expect(component.getJointCount()).toBe(2);
    });
  });

  describe('Removing Joints', () => {
    it('should remove a joint by reference', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      component.addJoint(joint);

      const removed = component.removeJoint(joint);
      expect(removed).toBe(true);
      expect(component.getJointCount()).toBe(0);
    });

    it('should return false when removing non-existent joint', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      const removed = component.removeJoint(joint);
      expect(removed).toBe(false);
    });

    it('should remove a joint by ID', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      component.addJoint(joint);

      const removed = component.removeJointById(joint.getId());
      expect(removed).toBe(true);
      expect(component.getJointCount()).toBe(0);
    });

    it('should return false when removing by non-existent ID', () => {
      const removed = component.removeJointById('non-existent-id');
      expect(removed).toBe(false);
    });
  });

  describe('Querying Joints', () => {
    it('should get joint by ID', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      component.addJoint(joint);

      const found = component.getJointById(joint.getId());
      expect(found).toBe(joint);
    });

    it('should return undefined for non-existent ID', () => {
      const found = component.getJointById('non-existent-id');
      expect(found).toBeUndefined();
    });

    it('should get only enabled joints', () => {
      const config1: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const config2: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [1, 0, 0],
        localAnchorB: [1, 0, 0],
      };

      const joint1 = createJoint(config1);
      const joint2 = createJoint(config2);

      component.addJoint(joint1);
      component.addJoint(joint2);

      joint2.setEnabled(false);

      const enabled = component.getEnabledJoints();
      expect(enabled.length).toBe(1);
      expect(enabled[0]).toBe(joint1);
    });
  });

  describe('Broken Joints', () => {
    it('should remove broken joints', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        breakable: true,
        breakForce: 1.0,
      };

      const joint = createJoint(config);
      component.addJoint(joint);

      // Simulate joint breaking
      joint.state.broken = true;

      const broken = component.removeBrokenJoints();
      expect(broken.length).toBe(1);
      expect(broken[0]).toBe(joint);
      expect(component.getJointCount()).toBe(0);
    });

    it('should not remove non-broken joints', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      component.addJoint(joint);

      const broken = component.removeBrokenJoints();
      expect(broken.length).toBe(0);
      expect(component.getJointCount()).toBe(1);
    });
  });

  describe('Clear', () => {
    it('should clear all joints', () => {
      const config1: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const config2: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [1, 0, 0],
        localAnchorB: [1, 0, 0],
      };

      const joint1 = createJoint(config1);
      const joint2 = createJoint(config2);

      component.addJoint(joint1);
      component.addJoint(joint2);

      component.clear();
      expect(component.getJointCount()).toBe(0);
    });
  });

  describe('Clone', () => {
    it('should create a new empty component on clone', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      component.addJoint(joint);

      const cloned = component.clone();
      expect(cloned).toBeInstanceOf(JointComponent);
      expect(cloned.getJointCount()).toBe(0);
      expect(cloned).not.toBe(component);
    });
  });

  describe('Serialization', () => {
    it('should serialize joints', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      component.addJoint(joint);

      const serialized = component.serialize();
      expect(serialized.type).toBe('JointComponent');
      expect(serialized.joints).toBeDefined();
      expect(serialized.joints.length).toBe(1);
      expect(serialized.joints[0].id).toBe(joint.getId());
      expect(serialized.joints[0].config).toBeDefined();
      expect(serialized.joints[0].state).toBeDefined();
    });

    it('should deserialize to empty component', () => {
      const data = {
        type: 'JointComponent',
        joints: [],
      };

      const deserialized = JointComponent.deserialize(data);
      expect(deserialized).toBeInstanceOf(JointComponent);
      expect(deserialized.getJointCount()).toBe(0);
    });
  });
});

