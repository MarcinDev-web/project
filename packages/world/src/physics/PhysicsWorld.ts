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
  type AnyCollider,
} from '../components/PhysicsComponent.js';
import { Logger } from '@engine/core/utils';
import { JointComponent } from '../components/JointComponent.js';
import type { Vec3 } from '@engine/core/math';
import {
  createJoint,
  type Joint,
  type AnyJointConfig,
  JointType,
  type FixedJointConfig,
  type DistanceJointConfig,
  type SpringJointConfig,
  type HingeJointConfig,
  type BallSocketJointConfig,
  type SliderJointConfig,
} from './Joint.js';
import {
  PhysicsRaycast,
  type PhysicsRay,
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
    const runtime = scene.scriptRuntime;
    if (runtime) {
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
    return this.scene.queryEntities(PhysicsComponent);
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

  /**
   * Helper: Creates a dynamic box
   */
  static createDynamicBox(scene: Scene, position: Vec3, size: Vec3, mass = 1.0): Entity {
    const entity = new Entity('DynamicBox');
    entity.transform.position = [...position] as Vec3;
    entity.transform.scale = [...size] as Vec3;

    const physics = new PhysicsComponent();
    physics.rigidbodyType = RigidbodyType.Dynamic;
    physics.mass = mass;
    physics.useGravity = true;
    physics.addBoxCollider([size[0], size[1], size[2]]);

    entity.addComponent(physics);
    scene.addEntity(entity);

    return entity;
  }

  // ========== Joint Management ==========

  /**
   * Creates and adds a joint to connect two entities
   */
  addJoint(config: AnyJointConfig): Joint {
    const joint = createJoint(config);

    // Ensure both entities have JointComponents
    let jointCompA = config.entityA.getComponent(JointComponent) as JointComponent;
    if (!jointCompA) {
      jointCompA = new JointComponent();
      config.entityA.addComponent(jointCompA);
    }

    let jointCompB = config.entityB.getComponent(JointComponent) as JointComponent;
    if (!jointCompB) {
      jointCompB = new JointComponent();
      config.entityB.addComponent(jointCompB);
    }

    // Add joint to both entities
    jointCompA.addJoint(joint);
    jointCompB.addJoint(joint);

    return joint;
  }

  /**
   * Removes a joint from the simulation
   */
  removeJoint(joint: Joint): void {
    const jointCompA = joint.config.entityA.getComponent(JointComponent) as JointComponent;
    const jointCompB = joint.config.entityB.getComponent(JointComponent) as JointComponent;

    if (jointCompA) {
      jointCompA.removeJoint(joint);
    }

    if (jointCompB) {
      jointCompB.removeJoint(joint);
    }
  }

  /**
   * Gets all joints in the physics world
   */
  getAllJoints(): Joint[] {
    return this.system.getAllJoints();
  }

  /**
   * Creates a fixed joint between two entities
   */
  addFixedJoint(
    entityA: Entity,
    entityB: Entity,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options: { breakable?: boolean; breakForce?: number } = {}
  ): Joint {
    const config: FixedJointConfig = {
      type: JointType.Fixed,
      entityA,
      entityB,
      localAnchorA,
      localAnchorB,
      ...options,
    };
    return this.addJoint(config);
  }

  /**
   * Creates a distance joint between two entities
   */
  addDistanceJoint(
    entityA: Entity,
    entityB: Entity,
    distance: number,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options: { minDistance?: number; maxDistance?: number; damping?: number } = {}
  ): Joint {
    const config: DistanceJointConfig = {
      type: JointType.Distance,
      entityA,
      entityB,
      localAnchorA,
      localAnchorB,
      distance,
      ...options,
    };
    return this.addJoint(config);
  }

  /**
   * Creates a spring joint between two entities
   */
  addSpringJoint(
    entityA: Entity,
    entityB: Entity,
    restLength: number,
    stiffness: number,
    damping: number,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options: { minDistance?: number; maxDistance?: number } = {}
  ): Joint {
    const config: SpringJointConfig = {
      type: JointType.Spring,
      entityA,
      entityB,
      localAnchorA,
      localAnchorB,
      restLength,
      stiffness,
      damping,
      ...options,
    };
    return this.addJoint(config);
  }

  /**
   * Creates a hinge joint between two entities
   */
  addHingeJoint(
    entityA: Entity,
    entityB: Entity,
    axisA: Vec3,
    axisB: Vec3,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options: {
      useLimits?: boolean;
      minAngle?: number;
      maxAngle?: number;
      useMotor?: boolean;
      motorSpeed?: number;
      maxMotorForce?: number;
    } = {}
  ): Joint {
    const config: HingeJointConfig = {
      type: JointType.Hinge,
      entityA,
      entityB,
      localAnchorA,
      localAnchorB,
      axisA,
      axisB,
      ...options,
    };
    return this.addJoint(config);
  }

  /**
   * Creates a ball socket joint between two entities
   */
  addBallSocketJoint(
    entityA: Entity,
    entityB: Entity,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options: { maxConeAngle?: number; twistAxis?: Vec3; maxTwistAngle?: number } = {}
  ): Joint {
    const config: BallSocketJointConfig = {
      type: JointType.BallSocket,
      entityA,
      entityB,
      localAnchorA,
      localAnchorB,
      ...options,
    };
    return this.addJoint(config);
  }

  /**
   * Creates a slider joint between two entities
   */
  addSliderJoint(
    entityA: Entity,
    entityB: Entity,
    axisA: Vec3,
    axisB: Vec3,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options: {
      useLimits?: boolean;
      minDistance?: number;
      maxDistance?: number;
      useMotor?: boolean;
      motorSpeed?: number;
      maxMotorForce?: number;
    } = {}
  ): Joint {
    const config: SliderJointConfig = {
      type: JointType.Slider,
      entityA,
      entityB,
      localAnchorA,
      localAnchorB,
      axisA,
      axisB,
      ...options,
    };
    return this.addJoint(config);
  }

  // ========== Physics Raycasting ==========

  /**
   * Casts a ray and returns the first hit
   */
  raycast(origin: Vec3, direction: Vec3, options: RaycastOptions = {}): RaycastHit | null {
    const ray: PhysicsRay = {
      origin,
      direction: this.normalizeDirection(direction),
      ...(options.maxDistance !== undefined && { maxDistance: options.maxDistance }),
    };

    const entities = this.scene.queryEntities(PhysicsComponent);
    let closestHit: RaycastHit | null = null;

    for (const entity of entities) {
      // Skip ignored entities
      if (options.ignoreEntities && options.ignoreEntities.includes(entity)) {
        continue;
      }

      const hit = PhysicsRaycast.raycastEntity(ray, entity, options.hitTriggers ?? false);

      if (hit && (!closestHit || hit.distance < closestHit.distance)) {
        closestHit = hit;
      }
    }

    return closestHit;
  }

  /**
   * Casts a ray and returns all hits
   */
  raycastAll(origin: Vec3, direction: Vec3, options: RaycastOptions = {}): RaycastHit[] {
    const ray: PhysicsRay = {
      origin,
      direction: this.normalizeDirection(direction),
      ...(options.maxDistance !== undefined && { maxDistance: options.maxDistance }),
    };

    const entities = this.scene.queryEntities(PhysicsComponent);
    const hits: RaycastHit[] = [];

    for (const entity of entities) {
      // Skip ignored entities
      if (options.ignoreEntities && options.ignoreEntities.includes(entity)) {
        continue;
      }

      const hit = PhysicsRaycast.raycastEntity(ray, entity, options.hitTriggers ?? false);

      if (hit) {
        hits.push(hit);
      }
    }

    // Sort by distance
    hits.sort((a, b) => a.distance - b.distance);

    return hits;
  }

  /**
   * Creates a ray from origin and direction
   */
  createRay(origin: Vec3, direction: Vec3, maxDistance?: number): PhysicsRay {
    return {
      origin: [...origin] as Vec3,
      direction: this.normalizeDirection(direction),
      ...(maxDistance !== undefined && { maxDistance }),
    };
  }

  /**
   * Helper to normalize direction vector
   */
  private normalizeDirection(direction: Vec3): Vec3 {
    const length = Math.sqrt(
      direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2]
    );

    if (length < 1e-6) {
      return [0, 0, 1]; // Default direction
    }

    return [direction[0] / length, direction[1] / length, direction[2] / length];
  }

  // ========== Static Helper Methods ==========

  /**
   * Helper: Creates a static floor
   */
  static createStaticFloor(scene: Scene, position: Vec3, size: Vec3): Entity {
    const entity = new Entity('StaticFloor');
    entity.transform.position = [...position] as Vec3;
    entity.transform.scale = [...size] as Vec3;

    const physics = new PhysicsComponent();
    physics.rigidbodyType = RigidbodyType.Static;
    physics.useGravity = false;
    physics.addBoxCollider([size[0], size[1], size[2]]);

    entity.addComponent(physics);
    scene.addEntity(entity);

    return entity;
  }

  /**
   * Helper: Creates a dynamic sphere
   */
  static createDynamicSphere(scene: Scene, position: Vec3, radius: number, mass = 1.0): Entity {
    const entity = new Entity('DynamicSphere');
    entity.transform.position = [...position] as Vec3;
    entity.transform.scale = [radius * 2, radius * 2, radius * 2];

    const physics = new PhysicsComponent();
    physics.rigidbodyType = RigidbodyType.Dynamic;
    physics.mass = mass;
    physics.useGravity = true;
    physics.addSphereCollider(radius);

    entity.addComponent(physics);
    scene.addEntity(entity);

    return entity;
  }

  /**
   * Helper: Creates a kinematic platform
   */
  static createKinematicPlatform(scene: Scene, position: Vec3, size: Vec3): Entity {
    const entity = new Entity('KinematicPlatform');
    entity.transform.position = [...position] as Vec3;
    entity.transform.scale = [...size] as Vec3;

    const physics = new PhysicsComponent();
    physics.rigidbodyType = RigidbodyType.Kinematic;
    physics.useGravity = false;
    physics.addBoxCollider([size[0], size[1], size[2]]);

    entity.addComponent(physics);
    scene.addEntity(entity);

    return entity;
  }
}

/**
 * Export main physics components and types
 */
export {
  PhysicsComponent,
  PhysicsSystem,
  RigidbodyType,
  JointComponent,
  JointType,
  PhysicsRaycast,
};
export type {
  PhysicsConfig,
  CollisionEvent,
  TriggerEvent,
  AnyCollider,
  Joint,
  AnyJointConfig,
  FixedJointConfig,
  DistanceJointConfig,
  SpringJointConfig,
  HingeJointConfig,
  BallSocketJointConfig,
  SliderJointConfig,
  PhysicsRay,
  RaycastHit,
  RaycastOptions,
};
