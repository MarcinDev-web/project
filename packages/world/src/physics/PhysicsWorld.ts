/**
 * PhysicsWorld - High-level API for physics simulation
 * Provides easy integration with the scene and entity system
 */

import type { Scene } from '../core/Scene.js';
import {
  PhysicsSystem,
  type PhysicsConfig,
  type CollisionEvent,
  type TriggerEvent,
} from './PhysicsSystem.js';
import { Entity } from '../core/Entity.js';
import {
  PhysicsComponent,
  RigidbodyType,
} from '../components/PhysicsComponent.js';
import { Logger } from '@engine/core/utils';
import type { Vec3 } from '@engine/core/math';
import {
  type Joint,
  type AnyJointConfig,
} from './Joint.js';
import {
  type RaycastHit,
  type RaycastOptions,
} from './PhysicsRaycast.js';

/**
 * PhysicsWorld manages physics simulation for a scene
 */
export class PhysicsWorld {
  private system: PhysicsSystem;
  private scene: Scene;
  private isRunning: boolean = false;

  constructor(scene: Scene, config?: Partial<PhysicsConfig>) {
    this.scene = scene;
    this.system = new PhysicsSystem(scene, config);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const runtime = (scene as any).scriptRuntime;
    if (runtime) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      runtime.physicsWorld = this;
    }
  }

  /**
   * Get the scene currently simulated by this physics world.
   */
  getScene(): Scene {
    return this.scene;
  }

  /**
   * Starts the physics simulation
   */
  start(): void {
    this.isRunning = true;
  }

  /**
   * Stops the physics simulation
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Pauses the physics simulation
   */
  pause(): void {
    this.isRunning = false;
  }

  /**
   * Resumes the physics simulation
   */
  resume(): void {
    this.isRunning = true;
  }

  /**
   * Updates the physics simulation (call this in your game loop)
   */
  update(deltaTime: number): void {
    if (!this.isRunning) return;
    this.system.update(deltaTime);
  }

  /**
   * Adds physics to an entity with default settings
   */
  addPhysics(
    entity: Entity,
    options: {
      type?: RigidbodyType;
      mass?: number;
      useGravity?: boolean;
      collider?: 'box' | 'sphere' | 'capsule';
    } = {}
  ): PhysicsComponent {
    // Check if entity already has physics
    let physics = entity.getComponent(PhysicsComponent);
    if (physics) {
      Logger.warn(`Entity ${entity.name} already has PhysicsComponent`);
      return physics;
    }

    // Create new physics component
    physics = new PhysicsComponent();
    physics.rigidbodyType = options.type ?? RigidbodyType.Dynamic;
    physics.mass = options.mass ?? 1.0;
    physics.useGravity = options.useGravity ?? true;

    // Add default collider based on entity's mesh
    const colliderType = options.collider ?? 'box';
    const scale = entity.transform.scale;

    if (colliderType === 'box') {
      physics.addBoxCollider([scale[0], scale[1], scale[2]]);
    } else if (colliderType === 'sphere') {
      const radius = Math.max(scale[0], scale[1], scale[2]) / 2;
      physics.addSphereCollider(radius);
    } else if (colliderType === 'capsule') {
      const radius = Math.max(scale[0], scale[2]) / 2;
      const height = scale[1];
      physics.addCapsuleCollider(radius, height);
    }

    entity.addComponent(physics);
    return physics;
  }

  /**
   * Removes physics from an entity
   */
  removePhysics(entity: Entity): void {
    entity.removeComponent(PhysicsComponent);
  }

  /**
   * Applies a force to an entity
   */
  applyForce(entity: Entity, force: Vec3): void {
    const physics = entity.getComponent(PhysicsComponent);
    if (physics) {
      physics.addForce(force);
    }
  }

  /**
   * Applies an impulse to an entity (instantaneous velocity change)
   */
  applyImpulse(entity: Entity, impulse: Vec3): void {
    const physics = entity.getComponent(PhysicsComponent);
    if (physics) {
      physics.addImpulse(impulse);
    }
  }

  /**
   * Applies a torque to an entity (rotational force)
   */
  applyTorque(entity: Entity, torque: Vec3): void {
    const physics = entity.getComponent(PhysicsComponent);
    if (physics) {
      physics.addTorque(torque);
    }
  }

  /**
   * Sets the velocity of an entity
   */
  setVelocity(entity: Entity, velocity: Vec3): void {
    const physics = entity.getComponent(PhysicsComponent);
    if (physics) {
      physics.velocity = [...velocity] as Vec3;
      physics.wakeUp();
    }
  }

  /**
   * Gets the velocity of an entity
   */
  getVelocity(entity: Entity): Vec3 | null {
    const physics = entity.getComponent(PhysicsComponent);
    return physics ? ([...physics.velocity] as Vec3) : null;
  }

  /**
   * Sets the angular velocity of an entity
   */
  setAngularVelocity(entity: Entity, angularVelocity: Vec3): void {
    const physics = entity.getComponent(PhysicsComponent);
    if (physics) {
      physics.angularVelocity = [...angularVelocity] as Vec3;
      physics.wakeUp();
    }
  }

  /**
   * Gets the angular velocity of an entity
   */
  getAngularVelocity(entity: Entity): Vec3 | null {
    const physics = entity.getComponent(PhysicsComponent);
    return physics ? ([...physics.angularVelocity] as Vec3) : null;
  }

  /**
   * Wakes up a sleeping rigidbody
   */
  wakeUp(entity: Entity): void {
    const physics = entity.getComponent(PhysicsComponent);
    if (physics) {
      physics.wakeUp();
    }
  }

  /**
   * Puts a rigidbody to sleep
   */
  sleep(entity: Entity): void {
    const physics = entity.getComponent(PhysicsComponent);
    if (physics) {
      physics.sleep();
    }
  }

  /**
   * Checks if an entity is awake
   */
  isAwake(entity: Entity): boolean {
    const physics = entity.getComponent(PhysicsComponent);
    return physics ? physics.isAwake() : false;
  }

  /**
   * Sets the gravity for the physics world
   */
  setGravity(gravity: Vec3): void {
    this.system.setGravity(gravity);
  }

  /**
   * Gets the current gravity
   */
  getGravity(): Vec3 {
    return this.system.getGravity();
  }

  /**
   * Updates the physics configuration
   */
  setConfig(config: Partial<PhysicsConfig>): void {
    this.system.setConfig(config);
  }

  /**
   * Gets the current physics configuration
   */
  getConfig(): PhysicsConfig {
    return this.system.getConfig();
  }

  /**
   * Registers a collision event listener
   */
  onCollision(listener: (event: CollisionEvent) => void): void {
    this.system.onCollision(listener);
  }

  /**
   * Registers a trigger enter event listener
   */
  onTriggerEnter(listener: (event: TriggerEvent) => void): void {
    this.system.onTriggerEnter(listener);
  }

  /**
   * Registers a trigger exit event listener
   */
  onTriggerExit(listener: (event: TriggerEvent) => void): void {
    this.system.onTriggerExit(listener);
  }

  /**
   * Removes a collision event listener
   */
  removeCollisionListener(listener: (event: CollisionEvent) => void): void {
    this.system.removeCollisionListener(listener);
  }

  /**
   * Gets all entities with physics components
   */
  getPhysicsEntities(): Entity[] {
    return this.system.getPhysicsEntities();
  }

  /**
   * Gets the underlying physics system (for advanced usage)
   */
  getSystem(): PhysicsSystem {
    return this.system;
  }

  /**
   * Gets octree statistics (if spatial partitioning is enabled)
   */
  getOctreeStats() {
    return this.system.getOctreeStats();
  }

  /**
   * Forces a rebuild of the spatial partitioning octree
   */
  rebuildOctree(): void {
    this.system.rebuildOctree();
  }

  /**
   * Enables or disables spatial partitioning
   */
  setSpatialPartitioning(enabled: boolean): void {
    this.system.setSpatialPartitioning(enabled);
  }

  // ========== Joint Management ==========

  addJoint(config: AnyJointConfig): Joint {
    return this.system.addJoint(config);
  }

  removeJoint(joint: Joint): void {
    this.system.removeJoint(joint);
  }

  getAllJoints(): Joint[] {
    return this.system.getAllJoints();
  }

  addFixedJoint(
    entityA: Entity,
    entityB: Entity,
    localAnchorA?: Vec3,
    localAnchorB?: Vec3,
    options?: { breakable?: boolean; breakForce?: number }
  ): Joint {
    return this.system.addFixedJoint(entityA, entityB, localAnchorA, localAnchorB, options);
  }

  addDistanceJoint(
    entityA: Entity,
    entityB: Entity,
    distance: number,
    localAnchorA?: Vec3,
    localAnchorB?: Vec3,
    options?: { minDistance?: number; maxDistance?: number; damping?: number }
  ): Joint {
    return this.system.addDistanceJoint(entityA, entityB, distance, localAnchorA, localAnchorB, options);
  }

  addSpringJoint(
    entityA: Entity,
    entityB: Entity,
    restLength: number,
    stiffness: number,
    damping: number,
    localAnchorA?: Vec3,
    localAnchorB?: Vec3,
    options?: { minDistance?: number; maxDistance?: number }
  ): Joint {
    return this.system.addSpringJoint(entityA, entityB, restLength, stiffness, damping, localAnchorA, localAnchorB, options);
  }

  addHingeJoint(
    entityA: Entity,
    entityB: Entity,
    axisA: Vec3,
    axisB: Vec3,
    localAnchorA?: Vec3,
    localAnchorB?: Vec3,
    options?: {
      useLimits?: boolean;
      minAngle?: number;
      maxAngle?: number;
      useMotor?: boolean;
      motorSpeed?: number;
      maxMotorForce?: number;
    }
  ): Joint {
    return this.system.addHingeJoint(entityA, entityB, axisA, axisB, localAnchorA, localAnchorB, options);
  }

  addBallSocketJoint(
    entityA: Entity,
    entityB: Entity,
    localAnchorA?: Vec3,
    localAnchorB?: Vec3,
    options?: { maxConeAngle?: number; twistAxis?: Vec3; maxTwistAngle?: number }
  ): Joint {
    return this.system.addBallSocketJoint(entityA, entityB, localAnchorA, localAnchorB, options);
  }

  addSliderJoint(
    entityA: Entity,
    entityB: Entity,
    axisA: Vec3,
    axisB: Vec3,
    localAnchorA?: Vec3,
    localAnchorB?: Vec3,
    options?: {
      useLimits?: boolean;
      minDistance?: number;
      maxDistance?: number;
      useMotor?: boolean;
      motorSpeed?: number;
      maxMotorForce?: number;
    }
  ): Joint {
    return this.system.addSliderJoint(entityA, entityB, axisA, axisB, localAnchorA, localAnchorB, options);
  }

  // ========== Physics Raycasting ==========

  raycast(origin: Vec3, direction: Vec3, options?: RaycastOptions): RaycastHit | null {
    return this.system.raycast(origin, direction, options);
  }

  raycastAll(origin: Vec3, direction: Vec3, options?: RaycastOptions): RaycastHit[] {
    return this.system.raycastAll(origin, direction, options);
  }
}
