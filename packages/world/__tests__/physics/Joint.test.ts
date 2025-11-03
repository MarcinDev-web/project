import { describe, it, expect, beforeEach } from 'vitest';
import {
  FixedJoint,
  DistanceJoint,
  SpringJoint,
  HingeJoint,
  BallSocketJoint,
  SliderJoint,
  JointType,
  createJoint,
  type FixedJointConfig,
  type DistanceJointConfig,
  type SpringJointConfig,
  type HingeJointConfig,
  type BallSocketJointConfig,
  type SliderJointConfig,
} from '@engine/world/physics';
import { Entity } from '@engine/world';
import { PhysicsComponent, RigidbodyType } from '@engine/world';

describe.skip('Joint System', () => {
  let entityA: Entity;
  let entityB: Entity;

  beforeEach(() => {
    // Create two entities with physics components
    entityA = new Entity('EntityA');
    entityA.transform.position = [0, 0, 0];

    const physicsA = new PhysicsComponent();
    physicsA.rigidbodyType = RigidbodyType.Dynamic;
    physicsA.mass = 1.0;
    entityA.addComponent(physicsA);

    entityB = new Entity('EntityB');
    entityB.transform.position = [2, 0, 0];

    const physicsB = new PhysicsComponent();
    physicsB.rigidbodyType = RigidbodyType.Dynamic;
    physicsB.mass = 1.0;
    entityB.addComponent(physicsB);
  });

  describe('Joint Factory', () => {
    it('should create fixed joint', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      expect(joint).toBeInstanceOf(FixedJoint);
      expect(joint.config.type).toBe(JointType.Fixed);
    });

    it('should create distance joint', () => {
      const config: DistanceJointConfig = {
        type: JointType.Distance,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        distance: 2.0,
      };

      const joint = createJoint(config);
      expect(joint).toBeInstanceOf(DistanceJoint);
      expect(joint.config.type).toBe(JointType.Distance);
    });

    it('should create spring joint', () => {
      const config: SpringJointConfig = {
        type: JointType.Spring,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        restLength: 2.0,
        stiffness: 50,
        damping: 0.5,
      };

      const joint = createJoint(config);
      expect(joint).toBeInstanceOf(SpringJoint);
      expect(joint.config.type).toBe(JointType.Spring);
    });

    it('should create hinge joint', () => {
      const config: HingeJointConfig = {
        type: JointType.Hinge,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        axisA: [0, 1, 0],
        axisB: [0, 1, 0],
      };

      const joint = createJoint(config);
      expect(joint).toBeInstanceOf(HingeJoint);
      expect(joint.config.type).toBe(JointType.Hinge);
    });

    it('should create ball socket joint', () => {
      const config: BallSocketJointConfig = {
        type: JointType.BallSocket,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = createJoint(config);
      expect(joint).toBeInstanceOf(BallSocketJoint);
      expect(joint.config.type).toBe(JointType.BallSocket);
    });

    it('should create slider joint', () => {
      const config: SliderJointConfig = {
        type: JointType.Slider,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        axisA: [1, 0, 0],
        axisB: [1, 0, 0],
      };

      const joint = createJoint(config);
      expect(joint).toBeInstanceOf(SliderJoint);
      expect(joint.config.type).toBe(JointType.Slider);
    });
  });

  describe('FixedJoint', () => {
    it('should initialize with correct defaults', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = new FixedJoint(config);
      expect(joint.isEnabled()).toBe(true);
      expect(joint.isBroken()).toBe(false);
      expect(joint.state.error).toBe(0);
    });

    it('should solve to keep entities at fixed positions', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = new FixedJoint(config);
      
      // Move entity B away
      entityB.transform.position = [5, 0, 0];

      // Solve should apply corrective impulses
      joint.solve(1 / 60);

      const physicsB = entityB.getComponent(PhysicsComponent) as PhysicsComponent;
      
      // Velocity should be affected by the constraint
      const velocityMag = Math.sqrt(
        physicsB.velocity[0] ** 2 +
        physicsB.velocity[1] ** 2 +
        physicsB.velocity[2] ** 2
      );
      expect(velocityMag).toBeGreaterThan(0);
    });

    it('should break under excessive force', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        breakable: true,
        breakForce: 1.0,
      };

      const joint = new FixedJoint(config);
      
      // Move entity B very far away
      entityB.transform.position = [10, 0, 0];

      joint.solve(1 / 60);
      expect(joint.isBroken()).toBe(true);
    });

    it('should provide debug data', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = new FixedJoint(config);
      const debug = joint.getDebugData();

      expect(debug.anchorA).toBeDefined();
      expect(debug.anchorB).toBeDefined();
      expect(debug.error).toBeDefined();
    });
  });

  describe('DistanceJoint', () => {
    it('should maintain target distance', () => {
      const config: DistanceJointConfig = {
        type: JointType.Distance,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        distance: 2.0,
      };

      const joint = new DistanceJoint(config);
      
      // Move entities closer together
      entityB.transform.position = [1, 0, 0];

      joint.solve(1 / 60);

      const physicsB = entityB.getComponent(PhysicsComponent) as PhysicsComponent;
      
      // Should apply impulse to separate them
      expect(physicsB.velocity[0]).not.toBe(0);
    });

    it('should respect min/max distance limits', () => {
      const config: DistanceJointConfig = {
        type: JointType.Distance,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        distance: 2.0,
        minDistance: 1.0,
        maxDistance: 3.0,
      };

      const joint = new DistanceJoint(config);
      expect(joint.config.minDistance).toBe(1.0);
      expect(joint.config.maxDistance).toBe(3.0);
    });

    it('should apply damping', () => {
      const config: DistanceJointConfig = {
        type: JointType.Distance,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        distance: 2.0,
        damping: 0.8,
      };

      const joint = new DistanceJoint(config);
      expect(joint.config.damping).toBe(0.8);
    });
  });

  describe('SpringJoint', () => {
    it('should apply spring force based on extension', () => {
      const config: SpringJointConfig = {
        type: JointType.Spring,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        restLength: 2.0,
        stiffness: 50,
        damping: 0.5,
      };

      const joint = new SpringJoint(config);
      
      // Compress the spring
      entityB.transform.position = [1, 0, 0];

      joint.solve(1 / 60);

      const physicsB = entityB.getComponent(PhysicsComponent) as PhysicsComponent;
      
      // Spring should push them apart
      expect(physicsB.velocity[0]).toBeGreaterThan(0);
    });

    it('should apply damping force', () => {
      const config: SpringJointConfig = {
        type: JointType.Spring,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        restLength: 2.0,
        stiffness: 50,
        damping: 2.0,
      };

      const joint = new SpringJoint(config);
      
      // Give entity B some velocity
      const physicsB = entityB.getComponent(PhysicsComponent) as PhysicsComponent;
      physicsB.velocity = [10, 0, 0];

      joint.solve(1 / 60);

      // Damping should have reduced velocity
      expect(Math.abs(physicsB.velocity[0])).toBeLessThan(10);
    });

    it('should respect distance limits', () => {
      const config: SpringJointConfig = {
        type: JointType.Spring,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        restLength: 2.0,
        stiffness: 50,
        damping: 0.5,
        minDistance: 1.0,
        maxDistance: 5.0,
      };

      const joint = new SpringJoint(config);
      expect(joint.config.minDistance).toBe(1.0);
      expect(joint.config.maxDistance).toBe(5.0);
    });
  });

  describe('HingeJoint', () => {
    it('should initialize with correct defaults', () => {
      const config: HingeJointConfig = {
        type: JointType.Hinge,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        axisA: [0, 1, 0],
        axisB: [0, 1, 0],
      };

      const joint = new HingeJoint(config);
      expect(joint.config.useLimits).toBe(false);
      expect(joint.config.useMotor).toBe(false);
    });

    it('should constrain position', () => {
      const config: HingeJointConfig = {
        type: JointType.Hinge,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        axisA: [0, 1, 0],
        axisB: [0, 1, 0],
      };

      const joint = new HingeJoint(config);
      
      // Move entity B away
      entityB.transform.position = [5, 0, 0];

      joint.solve(1 / 60);

      const physicsB = entityB.getComponent(PhysicsComponent) as PhysicsComponent;
      
      // Should apply corrective impulse
      const velocityMag = Math.sqrt(
        physicsB.velocity[0] ** 2 +
        physicsB.velocity[1] ** 2 +
        physicsB.velocity[2] ** 2
      );
      expect(velocityMag).toBeGreaterThan(0);
    });

    it('should support angle limits', () => {
      const config: HingeJointConfig = {
        type: JointType.Hinge,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        axisA: [0, 1, 0],
        axisB: [0, 1, 0],
        useLimits: true,
        minAngle: -Math.PI / 4,
        maxAngle: Math.PI / 4,
      };

      const joint = new HingeJoint(config);
      expect(joint.config.useLimits).toBe(true);
      expect(joint.config.minAngle).toBe(-Math.PI / 4);
      expect(joint.config.maxAngle).toBe(Math.PI / 4);
    });

    it('should support motor', () => {
      const config: HingeJointConfig = {
        type: JointType.Hinge,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        axisA: [0, 1, 0],
        axisB: [0, 1, 0],
        useMotor: true,
        motorSpeed: 2.0,
        maxMotorForce: 100,
      };

      const joint = new HingeJoint(config);
      expect(joint.config.useMotor).toBe(true);
      expect(joint.config.motorSpeed).toBe(2.0);
      expect(joint.config.maxMotorForce).toBe(100);
    });
  });

  describe('BallSocketJoint', () => {
    it('should constrain position but allow rotation', () => {
      const config: BallSocketJointConfig = {
        type: JointType.BallSocket,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = new BallSocketJoint(config);
      
      // Move entity B away
      entityB.transform.position = [3, 0, 0];

      joint.solve(1 / 60);

      const physicsB = entityB.getComponent(PhysicsComponent) as PhysicsComponent;
      
      // Should apply positional constraint
      const velocityMag = Math.sqrt(
        physicsB.velocity[0] ** 2 +
        physicsB.velocity[1] ** 2 +
        physicsB.velocity[2] ** 2
      );
      expect(velocityMag).toBeGreaterThan(0);
    });

    it('should support angular limits', () => {
      const config: BallSocketJointConfig = {
        type: JointType.BallSocket,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        maxConeAngle: Math.PI / 4,
        twistAxis: [1, 0, 0],
        maxTwistAngle: Math.PI / 6,
      };

      const joint = new BallSocketJoint(config);
      expect(joint.config.maxConeAngle).toBe(Math.PI / 4);
      expect(joint.config.maxTwistAngle).toBe(Math.PI / 6);
    });
  });

  describe('SliderJoint', () => {
    it('should allow movement along axis', () => {
      const config: SliderJointConfig = {
        type: JointType.Slider,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        axisA: [1, 0, 0],
        axisB: [1, 0, 0],
      };

      const joint = new SliderJoint(config);
      
      // Move entity B perpendicular to axis
      entityB.transform.position = [2, 2, 0];

      joint.solve(1 / 60);

      const physicsB = entityB.getComponent(PhysicsComponent) as PhysicsComponent;
      
      // Should constrain perpendicular motion
      expect(physicsB.velocity[1]).not.toBe(0);
    });

    it('should support distance limits', () => {
      const config: SliderJointConfig = {
        type: JointType.Slider,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        axisA: [1, 0, 0],
        axisB: [1, 0, 0],
        useLimits: true,
        minDistance: -1.0,
        maxDistance: 3.0,
      };

      const joint = new SliderJoint(config);
      expect(joint.config.useLimits).toBe(true);
      expect(joint.config.minDistance).toBe(-1.0);
      expect(joint.config.maxDistance).toBe(3.0);
    });

    it('should support motor', () => {
      const config: SliderJointConfig = {
        type: JointType.Slider,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
        axisA: [1, 0, 0],
        axisB: [1, 0, 0],
        useMotor: true,
        motorSpeed: 1.0,
        maxMotorForce: 50,
      };

      const joint = new SliderJoint(config);
      expect(joint.config.useMotor).toBe(true);
      expect(joint.config.motorSpeed).toBe(1.0);
      expect(joint.config.maxMotorForce).toBe(50);
    });
  });

  describe('Joint State Management', () => {
    it('should enable and disable joints', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = new FixedJoint(config);
      expect(joint.isEnabled()).toBe(true);

      joint.setEnabled(false);
      expect(joint.isEnabled()).toBe(false);

      joint.setEnabled(true);
      expect(joint.isEnabled()).toBe(true);
    });

    it('should reset joint state', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint = new FixedJoint(config);
      
      // Modify state
      joint.state.error = 10;
      joint.state.accumulatedImpulse = 5;
      joint.state.currentForce = 3;

      joint.reset();

      expect(joint.state.error).toBe(0);
      expect(joint.state.accumulatedImpulse).toBe(0);
      expect(joint.state.currentForce).toBe(0);
    });

    it('should have unique IDs', () => {
      const config: FixedJointConfig = {
        type: JointType.Fixed,
        entityA,
        entityB,
        localAnchorA: [0, 0, 0],
        localAnchorB: [0, 0, 0],
      };

      const joint1 = new FixedJoint(config);
      const joint2 = new FixedJoint(config);

      expect(joint1.getId()).not.toBe(joint2.getId());
    });
  });
});


