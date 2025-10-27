/**
 * PhysicsWorld - High-level API for physics simulation
 * Provides easy integration with the scene and entity system
 */
import type { Scene } from '../core/Scene';
import { PhysicsSystem, type PhysicsConfig, type CollisionEvent, type TriggerEvent } from './PhysicsSystem';
import { Entity } from '../core/Entity';
import { PhysicsComponent, RigidbodyType, type AnyCollider } from '../components/PhysicsComponent';
import { JointComponent } from '../components/JointComponent';
import type { Vec3 } from '@engine/core/math';
import { type Joint, type AnyJointConfig, JointType, type FixedJointConfig, type DistanceJointConfig, type SpringJointConfig, type HingeJointConfig, type BallSocketJointConfig, type SliderJointConfig } from './Joint';
import { PhysicsRaycast, type PhysicsRay, type RaycastHit, type RaycastOptions } from './PhysicsRaycast';
/**
 * PhysicsWorld manages physics simulation for a scene
 */
export declare class PhysicsWorld {
    private system;
    private scene;
    private isRunning;
    constructor(scene: Scene, config?: Partial<PhysicsConfig>);
    /**
     * Starts the physics simulation
     */
    start(): void;
    /**
     * Stops the physics simulation
     */
    stop(): void;
    /**
     * Pauses the physics simulation
     */
    pause(): void;
    /**
     * Resumes the physics simulation
     */
    resume(): void;
    /**
     * Updates the physics simulation (call this in your game loop)
     */
    update(deltaTime: number): void;
    /**
     * Adds physics to an entity with default settings
     */
    addPhysics(entity: Entity, options?: {
        type?: RigidbodyType;
        mass?: number;
        useGravity?: boolean;
        collider?: 'box' | 'sphere' | 'capsule';
    }): PhysicsComponent;
    /**
     * Removes physics from an entity
     */
    removePhysics(entity: Entity): void;
    /**
     * Applies a force to an entity
     */
    applyForce(entity: Entity, force: Vec3): void;
    /**
     * Applies an impulse to an entity (instantaneous velocity change)
     */
    applyImpulse(entity: Entity, impulse: Vec3): void;
    /**
     * Applies a torque to an entity (rotational force)
     */
    applyTorque(entity: Entity, torque: Vec3): void;
    /**
     * Sets the velocity of an entity
     */
    setVelocity(entity: Entity, velocity: Vec3): void;
    /**
     * Gets the velocity of an entity
     */
    getVelocity(entity: Entity): Vec3 | null;
    /**
     * Sets the angular velocity of an entity
     */
    setAngularVelocity(entity: Entity, angularVelocity: Vec3): void;
    /**
     * Gets the angular velocity of an entity
     */
    getAngularVelocity(entity: Entity): Vec3 | null;
    /**
     * Wakes up a sleeping rigidbody
     */
    wakeUp(entity: Entity): void;
    /**
     * Puts a rigidbody to sleep
     */
    sleep(entity: Entity): void;
    /**
     * Checks if an entity is awake
     */
    isAwake(entity: Entity): boolean;
    /**
     * Sets the gravity for the physics world
     */
    setGravity(gravity: Vec3): void;
    /**
     * Gets the current gravity
     */
    getGravity(): Vec3;
    /**
     * Updates the physics configuration
     */
    setConfig(config: Partial<PhysicsConfig>): void;
    /**
     * Gets the current physics configuration
     */
    getConfig(): PhysicsConfig;
    /**
     * Registers a collision event listener
     */
    onCollision(listener: (event: CollisionEvent) => void): void;
    /**
     * Registers a trigger enter event listener
     */
    onTriggerEnter(listener: (event: TriggerEvent) => void): void;
    /**
     * Registers a trigger exit event listener
     */
    onTriggerExit(listener: (event: TriggerEvent) => void): void;
    /**
     * Removes a collision event listener
     */
    removeCollisionListener(listener: (event: CollisionEvent) => void): void;
    /**
     * Gets all entities with physics components
     */
    getPhysicsEntities(): Entity[];
    /**
     * Gets the underlying physics system (for advanced usage)
     */
    getSystem(): PhysicsSystem;
    /**
     * Gets octree statistics (if spatial partitioning is enabled)
     */
    getOctreeStats(): {
        nodeCount: number;
        entityCount: number;
        maxDepth: number;
        avgEntitiesPerLeaf: number;
    } | null;
    /**
     * Forces a rebuild of the spatial partitioning octree
     */
    rebuildOctree(): void;
    /**
     * Enables or disables spatial partitioning
     */
    setSpatialPartitioning(enabled: boolean): void;
    /**
     * Helper: Creates a dynamic box
     */
    static createDynamicBox(scene: Scene, position: Vec3, size: Vec3, mass?: number): Entity;
    /**
     * Creates and adds a joint to connect two entities
     */
    addJoint(config: AnyJointConfig): Joint;
    /**
     * Removes a joint from the simulation
     */
    removeJoint(joint: Joint): void;
    /**
     * Gets all joints in the physics world
     */
    getAllJoints(): Joint[];
    /**
     * Creates a fixed joint between two entities
     */
    addFixedJoint(entityA: Entity, entityB: Entity, localAnchorA?: Vec3, localAnchorB?: Vec3, options?: {
        breakable?: boolean;
        breakForce?: number;
    }): Joint;
    /**
     * Creates a distance joint between two entities
     */
    addDistanceJoint(entityA: Entity, entityB: Entity, distance: number, localAnchorA?: Vec3, localAnchorB?: Vec3, options?: {
        minDistance?: number;
        maxDistance?: number;
        damping?: number;
    }): Joint;
    /**
     * Creates a spring joint between two entities
     */
    addSpringJoint(entityA: Entity, entityB: Entity, restLength: number, stiffness: number, damping: number, localAnchorA?: Vec3, localAnchorB?: Vec3, options?: {
        minDistance?: number;
        maxDistance?: number;
    }): Joint;
    /**
     * Creates a hinge joint between two entities
     */
    addHingeJoint(entityA: Entity, entityB: Entity, axisA: Vec3, axisB: Vec3, localAnchorA?: Vec3, localAnchorB?: Vec3, options?: {
        useLimits?: boolean;
        minAngle?: number;
        maxAngle?: number;
        useMotor?: boolean;
        motorSpeed?: number;
        maxMotorForce?: number;
    }): Joint;
    /**
     * Creates a ball socket joint between two entities
     */
    addBallSocketJoint(entityA: Entity, entityB: Entity, localAnchorA?: Vec3, localAnchorB?: Vec3, options?: {
        maxConeAngle?: number;
        twistAxis?: Vec3;
        maxTwistAngle?: number;
    }): Joint;
    /**
     * Creates a slider joint between two entities
     */
    addSliderJoint(entityA: Entity, entityB: Entity, axisA: Vec3, axisB: Vec3, localAnchorA?: Vec3, localAnchorB?: Vec3, options?: {
        useLimits?: boolean;
        minDistance?: number;
        maxDistance?: number;
        useMotor?: boolean;
        motorSpeed?: number;
        maxMotorForce?: number;
    }): Joint;
    /**
     * Casts a ray and returns the first hit
     */
    raycast(origin: Vec3, direction: Vec3, options?: RaycastOptions): RaycastHit | null;
    /**
     * Casts a ray and returns all hits
     */
    raycastAll(origin: Vec3, direction: Vec3, options?: RaycastOptions): RaycastHit[];
    /**
     * Creates a ray from origin and direction
     */
    createRay(origin: Vec3, direction: Vec3, maxDistance?: number): PhysicsRay;
    /**
     * Helper to normalize direction vector
     */
    private normalizeDirection;
    /**
     * Helper: Creates a static floor
     */
    static createStaticFloor(scene: Scene, position: Vec3, size: Vec3): Entity;
    /**
     * Helper: Creates a dynamic sphere
     */
    static createDynamicSphere(scene: Scene, position: Vec3, radius: number, mass?: number): Entity;
    /**
     * Helper: Creates a kinematic platform
     */
    static createKinematicPlatform(scene: Scene, position: Vec3, size: Vec3): Entity;
}
/**
 * Export main physics components and types
 */
export { PhysicsComponent, PhysicsSystem, RigidbodyType, JointComponent, JointType, PhysicsRaycast };
export type { PhysicsConfig, CollisionEvent, TriggerEvent, AnyCollider, Joint, AnyJointConfig, FixedJointConfig, DistanceJointConfig, SpringJointConfig, HingeJointConfig, BallSocketJointConfig, SliderJointConfig, PhysicsRay, RaycastHit, RaycastOptions, };
//# sourceMappingURL=PhysicsWorld.d.ts.map