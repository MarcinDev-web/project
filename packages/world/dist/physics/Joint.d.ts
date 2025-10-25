import type { Entity } from '../core/Entity';
import { PhysicsComponent } from '../components/PhysicsComponent';
/**
 * Joint types available in the physics system
 */
export declare enum JointType {
    Fixed = "Fixed",
    Distance = "Distance",
    Hinge = "Hinge",
    Spring = "Spring",
    BallSocket = "BallSocket",
    Slider = "Slider"
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
export type AnyJointConfig = FixedJointConfig | DistanceJointConfig | HingeJointConfig | SpringJointConfig | BallSocketJointConfig | SliderJointConfig;
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
export declare abstract class Joint {
    config: AnyJointConfig;
    state: JointState;
    protected id: string;
    constructor(config: AnyJointConfig);
    /**
     * Get the joint ID
     */
    getId(): string;
    /**
     * Check if the joint is enabled
     */
    isEnabled(): boolean;
    /**
     * Enable or disable the joint
     */
    setEnabled(enabled: boolean): void;
    /**
     * Check if the joint is broken
     */
    isBroken(): boolean;
    /**
     * Reset the joint state
     */
    reset(): void;
    /**
     * Get world space anchor point for body A
     */
    protected getWorldAnchorA(): Vec3;
    /**
     * Get world space anchor point for body B
     */
    protected getWorldAnchorB(): Vec3;
    /**
     * Get physics component for body A
     */
    protected getPhysicsA(): PhysicsComponent | null;
    /**
     * Get physics component for body B
     */
    protected getPhysicsB(): PhysicsComponent | null;
    /**
     * Apply impulse at a world space point to body A
     */
    protected applyImpulseA(impulse: Vec3, worldPoint: Vec3): void;
    /**
     * Apply impulse at a world space point to body B
     */
    protected applyImpulseB(impulse: Vec3, worldPoint: Vec3): void;
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
export declare class FixedJoint extends Joint {
    config: FixedJointConfig;
    constructor(config: FixedJointConfig);
    solve(dt: number): void;
    getDebugData(): {
        anchorA: Vec3;
        anchorB: Vec3;
        error: number;
    };
}
/**
 * Distance joint implementation - maintains a fixed distance
 */
export declare class DistanceJoint extends Joint {
    config: DistanceJointConfig;
    constructor(config: DistanceJointConfig);
    solve(dt: number): void;
    getDebugData(): {
        anchorA: Vec3;
        anchorB: Vec3;
        error: number;
    };
}
/**
 * Spring joint implementation - connects with spring force
 */
export declare class SpringJoint extends Joint {
    config: SpringJointConfig;
    solve(dt: number): void;
    getDebugData(): {
        anchorA: Vec3;
        anchorB: Vec3;
        error: number;
    };
}
/**
 * Hinge joint implementation - allows rotation around an axis
 */
export declare class HingeJoint extends Joint {
    config: HingeJointConfig;
    private currentAngle;
    constructor(config: HingeJointConfig);
    solve(dt: number): void;
    getCurrentAngle(): number;
    getDebugData(): {
        anchorA: Vec3;
        anchorB: Vec3;
        axis: Vec3;
        error: number;
    };
}
/**
 * Ball socket joint implementation - free rotation around a point
 */
export declare class BallSocketJoint extends Joint {
    config: BallSocketJointConfig;
    solve(dt: number): void;
    getDebugData(): {
        anchorA: Vec3;
        anchorB: Vec3;
        error: number;
    };
}
/**
 * Slider joint implementation - movement along an axis
 */
export declare class SliderJoint extends Joint {
    config: SliderJointConfig;
    private currentDistance;
    constructor(config: SliderJointConfig);
    solve(dt: number): void;
    getCurrentDistance(): number;
    getDebugData(): {
        anchorA: Vec3;
        anchorB: Vec3;
        axis: Vec3;
        error: number;
    };
}
/**
 * Factory function to create joints
 */
export declare function createJoint(config: AnyJointConfig): Joint;
//# sourceMappingURL=Joint.d.ts.map