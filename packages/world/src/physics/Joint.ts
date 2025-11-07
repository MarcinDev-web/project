import type { Entity } from '../core/Entity.js';
import {
  addVec3Out,
  subVec3Out,
  scaleVec3Out,
  dotVec3,
  crossVec3Out,
  lengthVec3,
  transformVec3ByQuatOut,
} from '@engine/core/math';
import { PhysicsComponent, RigidbodyType } from '../components/PhysicsComponent.js';

/**
 * Joint types available in the physics system
 */
export enum JointType {
  Fixed = 'Fixed',
  Distance = 'Distance',
  Hinge = 'Hinge',
  Spring = 'Spring',
  BallSocket = 'BallSocket',
  Slider = 'Slider',
}

/**
 * Base interface for all joint configurations
 */
import type { Vec3 } from '@engine/core/math';

export interface BaseJointConfig {
  /** Type of the joint */
  type: JointType;
  /** First entity (body A) */
  entityA: Entity;
  /** Second entity (body B) */
  entityB: Entity;
  /** Local anchor point on body A */
  localAnchorA: Vec3;
  /** Local anchor point on body B */
  localAnchorB: Vec3;
  /** Whether the joint should break under excessive force */
  breakable?: boolean;
  /** Maximum force before breaking (only used if breakable is true) */
  breakForce?: number;
  /** Whether the joint is enabled */
  enabled?: boolean;
}

/**
 * Fixed joint - rigidly connects two bodies
 */
export interface FixedJointConfig extends BaseJointConfig {
  type: JointType.Fixed;
}

/**
 * Distance joint - maintains a fixed distance between two bodies
 */
export interface DistanceJointConfig extends BaseJointConfig {
  type: JointType.Distance;
  /** Target distance to maintain */
  distance: number;
  /** Minimum distance (optional, for limits) */
  minDistance?: number;
  /** Maximum distance (optional, for limits) */
  maxDistance?: number;
  /** Damping factor (0-1) */
  damping?: number;
}

/**
 * Hinge joint - allows rotation around a single axis
 */
export interface HingeJointConfig extends BaseJointConfig {
  type: JointType.Hinge;
  /** Hinge axis in local space of body A */
  axisA: Vec3;
  /** Hinge axis in local space of body B */
  axisB: Vec3;
  /** Whether to use angle limits */
  useLimits?: boolean;
  /** Minimum angle in radians */
  minAngle?: number;
  /** Maximum angle in radians */
  maxAngle?: number;
  /** Whether to use motor */
  useMotor?: boolean;
  /** Target motor velocity (rad/s) */
  motorSpeed?: number;
  /** Maximum motor force */
  maxMotorForce?: number;
}

/**
 * Spring joint - connects two bodies with a spring force
 */
export interface SpringJointConfig extends BaseJointConfig {
  type: JointType.Spring;
  /** Rest length of the spring */
  restLength: number;
  /** Spring stiffness (higher = stiffer) */
  stiffness: number;
  /** Damping factor (higher = more damping) */
  damping: number;
  /** Minimum distance limit (optional) */
  minDistance?: number;
  /** Maximum distance limit (optional) */
  maxDistance?: number;
}

/**
 * Ball socket joint - allows free rotation around a point
 */
export interface BallSocketJointConfig extends BaseJointConfig {
  type: JointType.BallSocket;
  /** Maximum cone angle for angular limits (optional) */
  maxConeAngle?: number;
  /** Twist axis in local space (optional) */
  twistAxis?: Vec3;
  /** Maximum twist angle (optional) */
  maxTwistAngle?: number;
}

/**
 * Slider joint - allows movement along a single axis
 */
export interface SliderJointConfig extends BaseJointConfig {
  type: JointType.Slider;
  /** Slider axis in local space of body A */
  axisA: Vec3;
  /** Slider axis in local space of body B */
  axisB: Vec3;
  /** Whether to use distance limits */
  useLimits?: boolean;
  /** Minimum distance along axis */
  minDistance?: number;
  /** Maximum distance along axis */
  maxDistance?: number;
  /** Whether to use motor */
  useMotor?: boolean;
  /** Target motor velocity */
  motorSpeed?: number;
  /** Maximum motor force */
  maxMotorForce?: number;
}

/**
 * Union type for all joint configurations
 */
export type AnyJointConfig =
  | FixedJointConfig
  | DistanceJointConfig
  | HingeJointConfig
  | SpringJointConfig
  | BallSocketJointConfig
  | SliderJointConfig;

/**
 * Runtime state for joint constraints
 */
export interface JointState {
  /** Current constraint error/violation */
  error: number;
  /** Accumulated impulse for warm starting */
  accumulatedImpulse: number;
  /** Whether the joint is broken */
  broken: boolean;
  /** Current force magnitude on the joint */
  currentForce: number;
}

/**
 * Base class for all joint constraints
 */
export abstract class Joint {
  public config: AnyJointConfig;
  public state: JointState;
  protected id: string;

  constructor(config: AnyJointConfig) {
    this.config = config;
    this.state = {
      error: 0,
      accumulatedImpulse: 0,
      broken: false,
      currentForce: 0,
    };
    this.id = `joint_${Math.random().toString(36).substr(2, 9)}`;

    // Set defaults
    this.config.enabled = this.config.enabled ?? true;
    this.config.breakable = this.config.breakable ?? false;
    this.config.breakForce = this.config.breakForce ?? Infinity;
  }

  /**
   * Get the joint ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Check if the joint is enabled
   */
  isEnabled(): boolean {
    return (this.config.enabled ?? true) && !this.state.broken;
  }

  /**
   * Enable or disable the joint
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if the joint is broken
   */
  isBroken(): boolean {
    return this.state.broken;
  }

  /**
   * Reset the joint state
   */
  reset(): void {
    this.state.error = 0;
    this.state.accumulatedImpulse = 0;
    this.state.currentForce = 0;
  }

  /**
   * Get world space anchor point for body A
   */
  protected getWorldAnchorA(): Vec3 {
    const transform = this.config.entityA.transform;
    const TMP0: Vec3 = [0, 0, 0];
    const TMP1: Vec3 = [0, 0, 0];
    transformVec3ByQuatOut(TMP0, this.config.localAnchorA, transform.rotation);
    addVec3Out(TMP1, transform.position, TMP0);
    return [TMP1[0], TMP1[1], TMP1[2]];
  }

  /**
   * Get world space anchor point for body B
   */
  protected getWorldAnchorB(): Vec3 {
    const transform = this.config.entityB.transform;
    const TMP0: Vec3 = [0, 0, 0];
    const TMP1: Vec3 = [0, 0, 0];
    transformVec3ByQuatOut(TMP0, this.config.localAnchorB, transform.rotation);
    addVec3Out(TMP1, transform.position, TMP0);
    return [TMP1[0], TMP1[1], TMP1[2]];
  }

  /**
   * Get physics component for body A
   */
  protected getPhysicsA(): PhysicsComponent | null {
    return this.config.entityA.getComponent(PhysicsComponent) ?? null;
  }

  /**
   * Get physics component for body B
   */
  protected getPhysicsB(): PhysicsComponent | null {
    return this.config.entityB.getComponent(PhysicsComponent) ?? null;
  }

  /**
   * Apply impulse at a world space point to body A
   */
  protected applyImpulseA(impulse: Vec3, worldPoint: Vec3): void {
    const physics = this.getPhysicsA();
    if (!physics || physics.rigidbodyType !== RigidbodyType.Dynamic) return;

    // Linear impulse
    const TMP0: Vec3 = [0, 0, 0];
    scaleVec3Out(TMP0, impulse, 1 / physics.mass);
    addVec3Out(physics.velocity, physics.velocity, TMP0);

    // Angular impulse
    const TMP1: Vec3 = [0, 0, 0];
    const TMP2: Vec3 = [0, 0, 0];
    subVec3Out(TMP1, worldPoint, this.config.entityA.transform.position);
    crossVec3Out(TMP2, TMP1, impulse);
    scaleVec3Out(TMP2, TMP2, 1 / physics.mass);
    addVec3Out(physics.angularVelocity, physics.angularVelocity, TMP2);
  }

  /**
   * Apply impulse at a world space point to body B
   */
  protected applyImpulseB(impulse: Vec3, worldPoint: Vec3): void {
    const physics = this.getPhysicsB();
    if (!physics || physics.rigidbodyType !== RigidbodyType.Dynamic) return;

    // Linear impulse
    const TMP0: Vec3 = [0, 0, 0];
    scaleVec3Out(TMP0, impulse, 1 / physics.mass);
    addVec3Out(physics.velocity, physics.velocity, TMP0);

    // Angular impulse
    const TMP1: Vec3 = [0, 0, 0];
    const TMP2: Vec3 = [0, 0, 0];
    subVec3Out(TMP1, worldPoint, this.config.entityB.transform.position);
    crossVec3Out(TMP2, TMP1, impulse);
    scaleVec3Out(TMP2, TMP2, 1 / physics.mass);
    addVec3Out(physics.angularVelocity, physics.angularVelocity, TMP2);
  }

  /**
   * Solve the joint constraint for this frame
   * @param dt Time step
   */
  abstract solve(dt: number): void;

  /**
   * Get debug visualization data for the joint
   */
  abstract getDebugData(): {
    anchorA: Vec3;
    anchorB: Vec3;
    axis?: Vec3;
    error: number;
  };
}

/**
 * Fixed joint implementation - rigidly connects two bodies
 */
export class FixedJoint extends Joint {
  declare config: FixedJointConfig;

  constructor(config: FixedJointConfig) {
    super(config);
  }

  solve(dt: number): void {
    if (!this.isEnabled()) return;

    const anchorA = this.getWorldAnchorA();
    const anchorB = this.getWorldAnchorB();

    // Calculate position error
    const TMP0: Vec3 = [0, 0, 0];
    const error = subVec3Out(TMP0, anchorB, anchorA);
    const errorMag = lengthVec3(error);
    this.state.error = errorMag;

    // Check for breaking
    if (this.config.breakable && errorMag > this.config.breakForce!) {
      this.state.broken = true;
      return;
    }

    // Apply stronger corrective impulse to maintain fixed constraint
    if (errorMag > 1e-6) {
      const TMP1: Vec3 = [0, 0, 0];
      const direction = scaleVec3Out(TMP1, error, 1 / errorMag);
      const correction = scaleVec3Out(TMP1, direction, errorMag * 0.35); // stronger stabilization

      this.applyImpulseA(correction, anchorA);
      const TMP2: Vec3 = [0, 0, 0];
      this.applyImpulseB(scaleVec3Out(TMP2, correction, -1), anchorB);

      this.state.currentForce = (errorMag * 0.35) / dt;
    }
  }

  getDebugData() {
    return {
      anchorA: this.getWorldAnchorA(),
      anchorB: this.getWorldAnchorB(),
      error: this.state.error,
    };
  }
}

/**
 * Distance joint implementation - maintains a fixed distance
 */
export class DistanceJoint extends Joint {
  declare config: DistanceJointConfig;

  constructor(config: DistanceJointConfig) {
    super(config);
    this.config.damping = this.config.damping ?? 0.5;
  }

  solve(dt: number): void {
    if (!this.isEnabled()) return;

    const anchorA = this.getWorldAnchorA();
    const anchorB = this.getWorldAnchorB();

    const TMP0: Vec3 = [0, 0, 0];
    const delta = subVec3Out(TMP0, anchorB, anchorA);
    const currentDistance = lengthVec3(delta);

    // Calculate error
    let targetDistance = this.config.distance;
    if (this.config.minDistance !== undefined && currentDistance < this.config.minDistance) {
      targetDistance = this.config.minDistance;
    } else if (this.config.maxDistance !== undefined && currentDistance > this.config.maxDistance) {
      targetDistance = this.config.maxDistance;
    }

    const error = currentDistance - targetDistance;
    this.state.error = Math.abs(error);

    // Check for breaking
    if (this.config.breakable && Math.abs(error) > this.config.breakForce!) {
      this.state.broken = true;
      return;
    }

    if (currentDistance < 1e-6) return;

    const TMP1: Vec3 = [0, 0, 0];
    const direction = scaleVec3Out(TMP1, delta, 1 / currentDistance);

    // Calculate relative velocity along the constraint
    const physicsA = this.getPhysicsA();
    const physicsB = this.getPhysicsB();
    if (!physicsA || !physicsB) return;

    const TMP2: Vec3 = [0, 0, 0];
    const relativeVelocity = subVec3Out(TMP2, physicsB.velocity, physicsA.velocity);
    const velocityAlongConstraint = dotVec3(relativeVelocity, direction);

    // Calculate corrective impulse with damping
    const biasFactor = 0.2; // Baumgarte stabilization
    const bias = (biasFactor / dt) * error;
    const damping = this.config.damping! * velocityAlongConstraint;
    const totalImpulse = -(bias + damping);

    const TMP3: Vec3 = [0, 0, 0];
    const impulse = scaleVec3Out(TMP3, direction, totalImpulse);

    const TMP4: Vec3 = [0, 0, 0];
    this.applyImpulseA(scaleVec3Out(TMP4, impulse, -1), anchorA);
    this.applyImpulseB(impulse, anchorB);

    this.state.currentForce = Math.abs(totalImpulse) / dt;
  }

  getDebugData() {
    return {
      anchorA: this.getWorldAnchorA(),
      anchorB: this.getWorldAnchorB(),
      error: this.state.error,
    };
  }
}

/**
 * Spring joint implementation - connects with spring force
 */
export class SpringJoint extends Joint {
  declare config: SpringJointConfig;

  solve(dt: number): void {
    if (!this.isEnabled()) return;

    const anchorA = this.getWorldAnchorA();
    const anchorB = this.getWorldAnchorB();

    const TMP0: Vec3 = [0, 0, 0];
    const delta = subVec3Out(TMP0, anchorB, anchorA);
    const currentDistance = lengthVec3(delta);

    if (currentDistance < 1e-6) return;

    const TMP1: Vec3 = [0, 0, 0];
    const direction = scaleVec3Out(TMP1, delta, 1 / currentDistance);

    // Apply distance limits
    let limitedDistance = currentDistance;
    if (this.config.minDistance !== undefined && currentDistance < this.config.minDistance) {
      limitedDistance = this.config.minDistance;
    } else if (this.config.maxDistance !== undefined && currentDistance > this.config.maxDistance) {
      limitedDistance = this.config.maxDistance;
    }

    // Spring force: F = -k * (x - x0) where k is stiffness, x is current distance, x0 is rest length
    const extension = limitedDistance - this.config.restLength;
    this.state.error = Math.abs(extension);

    // Check for breaking
    const springForce = this.config.stiffness * Math.abs(extension);
    if (this.config.breakable && springForce > this.config.breakForce!) {
      this.state.broken = true;
      return;
    }

    const physicsA = this.getPhysicsA();
    const physicsB = this.getPhysicsB();
    if (!physicsA || !physicsB) return;

    // Calculate relative velocity for damping
    const TMP2: Vec3 = [0, 0, 0];
    const relativeVelocity = subVec3Out(TMP2, physicsB.velocity, physicsA.velocity);
    const velocityAlongSpring = dotVec3(relativeVelocity, direction);

    // Total force: spring force + damping force
    const dampingForce = this.config.damping * velocityAlongSpring;
    const totalForce = -(this.config.stiffness * extension + dampingForce);

    const TMP3: Vec3 = [0, 0, 0];
    const impulse = scaleVec3Out(TMP3, direction, totalForce * dt);

    const TMP4: Vec3 = [0, 0, 0];
    this.applyImpulseA(scaleVec3Out(TMP4, impulse, -1), anchorA);
    this.applyImpulseB(impulse, anchorB);

    this.state.currentForce = Math.abs(totalForce);
  }

  getDebugData() {
    return {
      anchorA: this.getWorldAnchorA(),
      anchorB: this.getWorldAnchorB(),
      error: this.state.error,
    };
  }
}

/**
 * Hinge joint implementation - allows rotation around an axis
 */
export class HingeJoint extends Joint {
  declare config: HingeJointConfig;
  private currentAngle: number = 0;

  constructor(config: HingeJointConfig) {
    super(config);
    this.config.useLimits = this.config.useLimits ?? false;
    this.config.minAngle = this.config.minAngle ?? -Math.PI;
    this.config.maxAngle = this.config.maxAngle ?? Math.PI;
    this.config.useMotor = this.config.useMotor ?? false;
    this.config.motorSpeed = this.config.motorSpeed ?? 0;
    this.config.maxMotorForce = this.config.maxMotorForce ?? 100;
  }

  solve(dt: number): void {
    if (!this.isEnabled()) return;

    const anchorA = this.getWorldAnchorA();
    const anchorB = this.getWorldAnchorB();

    // First, constrain position (keep anchors together)
    const TMP0: Vec3 = [0, 0, 0];
    const positionError = subVec3Out(TMP0, anchorB, anchorA);
    const errorMag = lengthVec3(positionError);
    this.state.error = errorMag;

    if (errorMag > 1e-6) {
      const TMP1: Vec3 = [0, 0, 0];
      const correction = scaleVec3Out(TMP1, positionError, 0.2); // Baumgarte stabilization
      this.applyImpulseA(correction, anchorA);
      {
        const TMP3B: Vec3 = [0, 0, 0];
        this.applyImpulseB(scaleVec3Out(TMP3B, correction, -1), anchorB);
      }
    }

    // Get world space hinge axes
    const worldAxisA: Vec3 = [0, 0, 0];
    const worldAxisB: Vec3 = [0, 0, 0];
    transformVec3ByQuatOut(worldAxisA, this.config.axisA, this.config.entityA.transform.rotation);
    transformVec3ByQuatOut(worldAxisB, this.config.axisB, this.config.entityB.transform.rotation);

    // Calculate angular error (axes should align)
    const TMP2: Vec3 = [0, 0, 0];
    const axisError = crossVec3Out(TMP2, worldAxisA, worldAxisB);
    const axisErrorMag = lengthVec3(axisError);

    if (axisErrorMag > 1e-6) {
      // Apply corrective angular impulse
      const TMP3: Vec3 = [0, 0, 0];
      const correction = scaleVec3Out(TMP3, axisError, 0.1);

      const physicsA = this.getPhysicsA();
      const physicsB = this.getPhysicsB();

      if (physicsA && physicsA.rigidbodyType === RigidbodyType.Dynamic) {
        addVec3Out(physicsA.angularVelocity, physicsA.angularVelocity, correction);
      }
      if (physicsB && physicsB.rigidbodyType === RigidbodyType.Dynamic) {
        subVec3Out(physicsB.angularVelocity, physicsB.angularVelocity, correction);
      }
    }

    // Handle angle limits
    if (this.config.useLimits) {
      // Simplified limit handling - would need proper angle calculation in production
      this.currentAngle =
        Math.atan2(worldAxisB[1], worldAxisB[0]) - Math.atan2(worldAxisA[1], worldAxisA[0]);

      if (this.currentAngle < this.config.minAngle!) {
        // Apply corrective impulse
        const physicsB = this.getPhysicsB();
        if (physicsB && physicsB.rigidbodyType === RigidbodyType.Dynamic) {
          const TMP4: Vec3 = [0, 0, 0];
          const correction = scaleVec3Out(TMP4, worldAxisA, 0.1);
          addVec3Out(physicsB.angularVelocity, physicsB.angularVelocity, correction);
        }
      } else if (this.currentAngle > this.config.maxAngle!) {
        const physicsB = this.getPhysicsB();
        if (physicsB && physicsB.rigidbodyType === RigidbodyType.Dynamic) {
          const TMP5: Vec3 = [0, 0, 0];
          const correction = scaleVec3Out(TMP5, worldAxisA, -0.1);
          addVec3Out(physicsB.angularVelocity, physicsB.angularVelocity, correction);
        }
      }
    }

    // Handle motor
    if (this.config.useMotor) {
      const physicsB = this.getPhysicsB();
      if (physicsB && physicsB.rigidbodyType === RigidbodyType.Dynamic) {
        const TMP6: Vec3 = [0, 0, 0];
        const TMP7: Vec3 = [0, 0, 0];
        const motorTorque = scaleVec3Out(TMP6, worldAxisA, this.config.motorSpeed! * dt);
        const clampedTorque = scaleVec3Out(
          TMP7,
          motorTorque,
          Math.min(1, this.config.maxMotorForce! / (lengthVec3(motorTorque) + 1e-6))
        );
        addVec3Out(physicsB.angularVelocity, physicsB.angularVelocity, clampedTorque);
      }
    }
  }

  getCurrentAngle(): number {
    return this.currentAngle;
  }

  getDebugData() {
    const worldAxisA: Vec3 = [0, 0, 0];
    transformVec3ByQuatOut(worldAxisA, this.config.axisA, this.config.entityA.transform.rotation);
    return {
      anchorA: this.getWorldAnchorA(),
      anchorB: this.getWorldAnchorB(),
      axis: worldAxisA,
      error: this.state.error,
    };
  }
}

/**
 * Ball socket joint implementation - free rotation around a point
 */
export class BallSocketJoint extends Joint {
  declare config: BallSocketJointConfig;

  solve(dt: number): void {
    if (!this.isEnabled()) return;

    const anchorA = this.getWorldAnchorA();
    const anchorB = this.getWorldAnchorB();

    // Constrain position only (keep anchors together)
    const TMP0: Vec3 = [0, 0, 0];
    const error = subVec3Out(TMP0, anchorB, anchorA);
    const errorMag = lengthVec3(error);
    this.state.error = errorMag;

    if (this.config.breakable && errorMag > this.config.breakForce!) {
      this.state.broken = true;
      return;
    }

    if (errorMag > 1e-6) {
      const TMP1: Vec3 = [0, 0, 0];
      const correction = scaleVec3Out(TMP1, error, 0.2); // Baumgarte stabilization
      this.applyImpulseA(correction, anchorA);
      {
        const TMPB: Vec3 = [0, 0, 0];
        this.applyImpulseB(scaleVec3Out(TMPB, correction, -1), anchorB);
      }

      this.state.currentForce = (errorMag * 0.2) / dt;
    }

    // Angular limits (cone and twist) - simplified implementation
    if (this.config.maxConeAngle !== undefined || this.config.maxTwistAngle !== undefined) {
      // Would need proper angular constraint solving for production use
      // This is a simplified placeholder
    }
  }

  getDebugData() {
    return {
      anchorA: this.getWorldAnchorA(),
      anchorB: this.getWorldAnchorB(),
      error: this.state.error,
    };
  }
}

/**
 * Slider joint implementation - movement along an axis
 */
export class SliderJoint extends Joint {
  declare config: SliderJointConfig;
  private currentDistance: number = 0;

  constructor(config: SliderJointConfig) {
    super(config);
    this.config.useLimits = this.config.useLimits ?? false;
    this.config.minDistance = this.config.minDistance ?? -Infinity;
    this.config.maxDistance = this.config.maxDistance ?? Infinity;
    this.config.useMotor = this.config.useMotor ?? false;
    this.config.motorSpeed = this.config.motorSpeed ?? 0;
    this.config.maxMotorForce = this.config.maxMotorForce ?? 100;
  }

  solve(dt: number): void {
    if (!this.isEnabled()) return;

    const anchorA = this.getWorldAnchorA();
    const anchorB = this.getWorldAnchorB();

    // Get world space slider axis
    const worldAxis: Vec3 = [0, 0, 0];
    transformVec3ByQuatOut(worldAxis, this.config.axisA, this.config.entityA.transform.rotation);
    const normalizedAxis: Vec3 = [0, 0, 0];
    // inline normalize: normalizedAxis = worldAxis / |worldAxis|
    {
      const len = Math.hypot(worldAxis[0], worldAxis[1], worldAxis[2]);
      if (len > 1e-6) {
        normalizedAxis[0] = worldAxis[0] / len;
        normalizedAxis[1] = worldAxis[1] / len;
        normalizedAxis[2] = worldAxis[2] / len;
      }
    }

    // Calculate distance along axis
    const TMP2: Vec3 = [0, 0, 0];
    const delta = subVec3Out(TMP2, anchorB, anchorA);
    this.currentDistance = dotVec3(delta, normalizedAxis);

    // Constrain perpendicular motion
    const TMP3: Vec3 = [0, 0, 0];
    const alongAxis = scaleVec3Out(TMP3, normalizedAxis, this.currentDistance);
    const TMP4: Vec3 = [0, 0, 0];
    const perpendicular = subVec3Out(TMP4, delta, alongAxis);
    const perpError = lengthVec3(perpendicular);
    this.state.error = perpError;

    if (perpError > 1e-6) {
      const TMP5: Vec3 = [0, 0, 0];
      const correction = scaleVec3Out(TMP5, perpendicular, 0.2);
      this.applyImpulseA(correction, anchorA);
      {
        const TMPB2: Vec3 = [0, 0, 0];
        this.applyImpulseB(scaleVec3Out(TMPB2, correction, -1), anchorB);
      }
    }

    // Handle distance limits
    if (this.config.useLimits) {
      if (this.currentDistance < this.config.minDistance!) {
        const TMP6: Vec3 = [0, 0, 0];
        const correction = scaleVec3Out(
          TMP6,
          normalizedAxis,
          (this.config.minDistance! - this.currentDistance) * 0.2
        );
        this.applyImpulseB(correction, anchorB);
      } else if (this.currentDistance > this.config.maxDistance!) {
        const TMP7: Vec3 = [0, 0, 0];
        const correction = scaleVec3Out(
          TMP7,
          normalizedAxis,
          (this.config.maxDistance! - this.currentDistance) * 0.2
        );
        this.applyImpulseB(correction, anchorB);
      }
    }

    // Handle motor
    if (this.config.useMotor) {
      const physicsB = this.getPhysicsB();
      if (physicsB && physicsB.rigidbodyType === RigidbodyType.Dynamic) {
        const motorForce = this.config.motorSpeed! * dt;
        const clampedForce = Math.max(
          -this.config.maxMotorForce!,
          Math.min(this.config.maxMotorForce!, motorForce)
        );
        const TMP8: Vec3 = [0, 0, 0];
        const motorImpulse = scaleVec3Out(TMP8, normalizedAxis, clampedForce);
        this.applyImpulseB(motorImpulse, anchorB);
      }
    }
  }

  getCurrentDistance(): number {
    return this.currentDistance;
  }

  getDebugData() {
    const worldAxis: Vec3 = [0, 0, 0];
    transformVec3ByQuatOut(worldAxis, this.config.axisA, this.config.entityA.transform.rotation);
    return {
      anchorA: this.getWorldAnchorA(),
      anchorB: this.getWorldAnchorB(),
      axis: worldAxis,
      error: this.state.error,
    };
  }
}

/**
 * Factory function to create joints
 */
export function createJoint(config: AnyJointConfig): Joint {
  switch (config.type) {
    case JointType.Fixed:
      return new FixedJoint(config);
    case JointType.Distance:
      return new DistanceJoint(config);
    case JointType.Spring:
      return new SpringJoint(config);
    case JointType.Hinge:
      return new HingeJoint(config);
    case JointType.BallSocket:
      return new BallSocketJoint(config);
    case JointType.Slider:
      return new SliderJoint(config);
    default:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      throw new Error(`Unknown joint type: ${(config as any).type}`);
  }
}
