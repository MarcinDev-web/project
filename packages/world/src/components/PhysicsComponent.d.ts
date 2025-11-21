import { Component } from './Component.js';
import type { Vec3 } from '@engine/core/math';
import type { Mat3 } from '@engine/core/math';
/**
 * Rigidbody types determine how physics affects the object
 */
export declare enum RigidbodyType {
    /** Static objects don't move but can collide with dynamic objects */
    Static = "static",
    /** Dynamic objects are fully simulated with physics */
    Dynamic = "dynamic",
    /** Kinematic objects can be moved programmatically but aren't affected by forces */
    Kinematic = "kinematic"
}
/**
 * Collider shape types
 */
export declare enum ColliderShape {
    Box = "box",
    Sphere = "sphere",
    Capsule = "capsule"
}
/**
 * Base collider interface
 */
export interface Collider {
    /** Shape type */
    shape: ColliderShape;
    /** Center offset relative to entity position */
    center: Vec3;
    /** Whether this collider triggers collision events without physical response */
    isTrigger: boolean;
    /** Friction coefficient (0 = frictionless, 1 = high friction) */
    friction: number;
    /** Bounciness/restitution (0 = no bounce, 1 = perfectly elastic) */
    restitution: number;
}
/**
 * Box collider with size dimensions
 */
export interface BoxCollider extends Collider {
    shape: ColliderShape.Box;
    /** Half extents (half width, half height, half depth) */
    size: Vec3;
}
/**
 * Sphere collider with radius
 */
export interface SphereCollider extends Collider {
    shape: ColliderShape.Sphere;
    /** Sphere radius */
    radius: number;
}
/**
 * Capsule collider with radius and height
 */
export interface CapsuleCollider extends Collider {
    shape: ColliderShape.Capsule;
    /** Capsule radius */
    radius: number;
    /** Total height including hemispheres */
    height: number;
}
/**
 * Union type for all collider types
 */
export type AnyCollider = BoxCollider | SphereCollider | CapsuleCollider;
/**
 * Contact point information for collision resolution
 */
export interface ContactPoint {
    /** World position of contact */
    position: Vec3;
    /** Contact normal pointing from A to B */
    normal: Vec3;
    /** Penetration depth */
    depth: number;
}
/**
 * Physics material properties
 */
export interface PhysicsMaterial {
    /** Friction coefficient */
    friction: number;
    /** Bounciness (restitution) */
    restitution: number;
    /** Density (for mass calculation) */
    density: number;
}
/**
 * Default physics material
 */
export declare const DEFAULT_PHYSICS_MATERIAL: PhysicsMaterial;
/**
 * PhysicsComponent provides rigidbody simulation and collision detection.
 * Can be attached to entities to make them participate in physics simulation.
 */
export declare class PhysicsComponent extends Component {
    static readonly type = "Physics";
    /** Rigidbody type */
    rigidbodyType: RigidbodyType;
    /** Mass in kilograms (ignored for static/kinematic) */
    mass: number;
    /** Linear velocity [x, y, z] in units/second */
    velocity: Vec3;
    /** Angular velocity [x, y, z] in radians/second */
    angularVelocity: Vec3;
    /** Linear drag coefficient (air resistance) */
    linearDrag: number;
    /** Angular drag coefficient (rotation damping) */
    angularDrag: number;
    /** Whether gravity affects this rigidbody */
    useGravity: boolean;
    /** Whether the rigidbody is kinematic (not affected by forces) */
    isKinematic: boolean;
    /** Constraints on movement axes */
    freezePositionX: boolean;
    freezePositionY: boolean;
    freezePositionZ: boolean;
    /** Constraints on rotation axes */
    freezeRotationX: boolean;
    freezeRotationY: boolean;
    freezeRotationZ: boolean;
    /** Colliders attached to this physics body */
    colliders: AnyCollider[];
    /** Physics material properties */
    material: PhysicsMaterial;
    /** Whether this body is awake (actively simulated) */
    private _isAwake;
    /** Internal Rapier ID (for RapierPhysicsSystem) */
    _rapierId: number;
    /** Sleep threshold - if velocity is below this, body may sleep */
    sleepThreshold: number;
    /** Time body has been below sleep threshold */
    private _sleepTimer;
    /** Accumulated forces to be applied this frame */
    private _accumulatedForce;
    /** Accumulated torques to be applied this frame */
    private _accumulatedTorque;
    /** Local-space inverse inertia tensor (diagonal) */
    private _inverseInertiaTensorLocal;
    /** Local-space inverse inertia tensor without freeze constraints (diagonal) */
    private _inverseInertiaTensorLocalBase;
    /** Flag indicating inertia needs recomputation */
    private _inertiaDirty;
    /** Cached values to detect changes */
    private _lastMassForInertia;
    private _lastScaleForInertia;
    getType(): string;
    /**
     * Adds a box collider to this physics body
     */
    addBoxCollider(size: Vec3, center?: Vec3, isTrigger?: boolean): BoxCollider;
    /**
     * Adds a sphere collider to this physics body
     */
    addSphereCollider(radius: number, center?: Vec3, isTrigger?: boolean): SphereCollider;
    /**
     * Adds a capsule collider to this physics body
     */
    addCapsuleCollider(radius: number, height: number, center?: Vec3, isTrigger?: boolean): CapsuleCollider;
    /**
     * Removes all colliders
     */
    clearColliders(): void;
    /**
     * Applies a force to the rigidbody
     */
    addForce(force: Vec3): void;
    /**
     * Applies a torque to the rigidbody
     */
    addTorque(torque: Vec3): void;
    /**
     * Applies an impulse (instantaneous velocity change)
     */
    addImpulse(impulse: Vec3): void;
    /** Marks the inertia tensor as dirty (recomputed lazily). */
    markInertiaDirty(): void;
    /** Ensures local inertia tensors are up-to-date with current mass, scale and colliders. */
    private ensureInertiaUpToDate;
    /** Returns the world-space inverse inertia tensor Mat3 for the current rotation. */
    getWorldInverseInertiaTensor(): Mat3;
    /**
     * Gets accumulated force and clears it
     */
    consumeForce(): Vec3;
    /**
     * Gets accumulated torque and clears it
     */
    consumeTorque(): Vec3;
    /**
     * Wakes up the rigidbody (makes it active)
     */
    wakeUp(): void;
    /**
     * Puts the rigidbody to sleep (stops simulation)
     */
    sleep(): void;
    /**
     * Checks if rigidbody is awake
     */
    isAwake(): boolean;
    /**
     * Updates sleep state based on velocity
     */
    updateSleepState(deltaTime: number): void;
    /**
     * Gets the inverse mass (0 for static/kinematic bodies)
     */
    getInverseMass(): number;
    clone(): PhysicsComponent;
    toJSON(): Record<string, unknown>;
    fromJSON(data: Record<string, unknown>): void;
}
//# sourceMappingURL=PhysicsComponent.d.ts.map