/**
 * PhysicsSystem - Main physics simulation system
 * Handles gravity, forces, velocity integration, and collision resolution
 */
import type { Scene } from '../core/Scene';
import type { Entity } from '../core/Entity';
import { PhysicsComponent } from '../components/PhysicsComponent';
import type { Vec3 } from '@engine/core/math';
import { type OctreeConfig } from './Octree';
import type { Joint } from './Joint';
/**
 * Collision event data
 */
export interface CollisionEvent {
    /** First entity in collision */
    entityA: Entity;
    /** Second entity in collision */
    entityB: Entity;
    /** Physics component of first entity */
    physicsA: PhysicsComponent;
    /** Physics component of second entity */
    physicsB: PhysicsComponent;
    /** Contact normal pointing from A to B */
    normal: Vec3;
    /** Penetration depth */
    depth: number;
    /** Contact point in world space */
    contactPoint: Vec3;
}
/**
 * Trigger event data (for trigger colliders that don't have physical response)
 */
export interface TriggerEvent {
    /** Entity with trigger collider */
    triggerEntity: Entity;
    /** Other entity that entered/exited trigger */
    otherEntity: Entity;
}
/**
 * Physics simulation configuration
 */
export interface PhysicsConfig {
    /** Gravity vector (default: [0, -9.81, 0]) */
    gravity: Vec3;
    /** Maximum number of collision solver iterations per frame */
    solverIterations: number;
    /** Fixed timestep for physics simulation in seconds */
    fixedTimestep: number;
    /** Maximum substeps per frame to prevent spiral of death */
    maxSubsteps: number;
    /** Enable spatial partitioning (octree) for broad phase (default: true) */
    useSpatialPartitioning: boolean;
    /** Octree configuration (only used if useSpatialPartitioning is true) */
    octreeConfig?: Partial<OctreeConfig>;
    /** World bounds for octree (default: auto-calculated) */
    worldBounds?: {
        min: Vec3;
        max: Vec3;
    };
}
/**
 * Default physics configuration
 */
export declare const DEFAULT_PHYSICS_CONFIG: PhysicsConfig;
/**
 * PhysicsSystem manages physics simulation for all entities with PhysicsComponent
 */
export declare class PhysicsSystem {
    private scene;
    private config;
    private accumulator;
    /** Collision event listeners */
    private collisionListeners;
    /** Trigger enter event listeners */
    private triggerEnterListeners;
    /** Trigger exit event listeners */
    private triggerExitListeners;
    /** Track previous frame's overlapping triggers */
    private previousTriggers;
    /** Scratch set reused each frame for current triggers */
    private currentTriggersScratch;
    /** Octree for spatial partitioning (broad phase) */
    private octree;
    /** Flag to rebuild octree next frame */
    private needsOctreeRebuild;
    /** Scratch arrays reused across frames to avoid allocations */
    private pairsScratch;
    private collisionsScratch;
    /** Scratch transforms reused for collision checks to avoid object churn */
    private readonly transformAPosition;
    private readonly transformARotation;
    private readonly transformAScale;
    private readonly transformBPosition;
    private readonly transformBRotation;
    private readonly transformBScale;
    private readonly colliderTransformA;
    private readonly colliderTransformB;
    /** Scratch temporaries for quaternion/axis math */
    private readonly tmpAxis;
    private readonly tmpQuatA;
    private readonly tmpQuatB;
    /** Pool of CollisionEvent wrappers to reduce per-frame allocations */
    private readonly collisionEventPool;
    constructor(scene: Scene, config?: Partial<PhysicsConfig>);
    /**
     * Updates the physics simulation by deltaTime
     * Uses fixed timestep with accumulator for stability
     */
    update(deltaTime: number): void;
    /**
     * Fixed timestep physics update
     */
    private fixedUpdate;
    private runScriptFixedUpdate;
    /**
     * Gets all entities with physics components
     */
    private getPhysicsEntities;
    /**
     * Integrates forces to update velocities (first integration step)
     */
    private integrateForces;
    /**
     * Integrates velocities to update positions and rotations (second integration step)
     */
    private integrateVelocities;
    /**
     * Detects all collisions between physics entities
     */
    private detectCollisions;
    private getBroadPhasePairsBruteForceInto;
    /**
     * Updates the octree with current entity positions
     */
    private updateOctree;
    /**
     * Forces a rebuild of the octree next frame
     */
    rebuildOctree(): void;
    /**
     * Resolves a collision using impulse-based method
     */
    private resolveCollision;
    /**
     * Applies friction to collision
     */
    private applyFriction;
    /**
     * Handles trigger collider enter/exit events
     */
    private handleTriggers;
    /**
     * Solves all joint constraints
     */
    private solveJoints;
    /**
  
     * Gets all joints in the scene
     */
    getAllJoints(): Joint[];
    /**
     * Fires collision event to all listeners
     */
    private fireCollisionEvent;
    /**
     * Fires trigger enter event to all listeners
     */
    private fireTriggerEnterEvent;
    /**
     * Fires trigger exit event to all listeners
     */
    private fireTriggerExitEvent;
    /**
     * Adds a collision event listener
     */
    onCollision(listener: (event: CollisionEvent) => void): void;
    /**
     * Adds a trigger enter event listener
     */
    onTriggerEnter(listener: (event: TriggerEvent) => void): void;
    /**
     * Adds a trigger exit event listener
     */
    onTriggerExit(listener: (event: TriggerEvent) => void): void;
    /**
     * Removes a collision event listener
     */
    removeCollisionListener(listener: (event: CollisionEvent) => void): void;
    /**
     * Sets the gravity vector
     */
    setGravity(gravity: Vec3): void;
    /**
     * Gets the current gravity vector
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
     * Gets octree statistics (if spatial partitioning is enabled)
     */
    getOctreeStats(): {
        nodeCount: number;
        entityCount: number;
        maxDepth: number;
        avgEntitiesPerLeaf: number;
    } | null;
    /**
     * Enables or disables spatial partitioning
     */
    setSpatialPartitioning(enabled: boolean): void;
}
//# sourceMappingURL=PhysicsSystem.d.ts.map