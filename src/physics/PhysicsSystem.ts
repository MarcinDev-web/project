/**
 * PhysicsSystem - Main physics simulation system
 * Handles gravity, forces, velocity integration, and collision resolution
 */

import type { Scene } from '@engine/world';
import type { Entity } from '@engine/world';
import { PhysicsComponent, RigidbodyType } from '@engine/world';
import { JointComponent } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { CollisionDetection, type ColliderTransform } from './CollisionDetection';
import { quatMultiply, quatFromAxisAngle, quatNormalize } from '@engine/core/math';
import { Octree, type OctreeConfig, DEFAULT_OCTREE_CONFIG } from './Octree';
import { BoundingVolume } from './BoundingVolume';
import type { Joint } from './Joint';
import { ScriptComponent } from '@engine/world';

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
  worldBounds?: { min: Vec3; max: Vec3 };
}

/**
 * Default physics configuration
 */
export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: [0, -9.81, 0],
  solverIterations: 8,
  fixedTimestep: 1 / 60, // 60 Hz
  maxSubsteps: 4,
  useSpatialPartitioning: true,
  octreeConfig: DEFAULT_OCTREE_CONFIG,
  worldBounds: {
    min: [-100, -100, -100],
    max: [100, 100, 100],
  },
};

/**
 * PhysicsSystem manages physics simulation for all entities with PhysicsComponent
 */
export class PhysicsSystem {
  private scene: Scene;
  private config: PhysicsConfig;
  private accumulator: number = 0;

  /** Collision event listeners */
  private collisionListeners: Array<(event: CollisionEvent) => void> = [];

  /** Trigger enter event listeners */
  private triggerEnterListeners: Array<(event: TriggerEvent) => void> = [];

  /** Trigger exit event listeners */
  private triggerExitListeners: Array<(event: TriggerEvent) => void> = [];

  /** Track previous frame's overlapping triggers */
  private previousTriggers: Set<string> = new Set();

  /** Octree for spatial partitioning (broad phase) */
  private octree: Octree | null = null;

  /** Flag to rebuild octree next frame */
  private needsOctreeRebuild = false;

  constructor(scene: Scene, config: Partial<PhysicsConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };

    // Initialize octree if enabled
    if (this.config.useSpatialPartitioning && this.config.worldBounds) {
      this.octree = new Octree(
        this.config.worldBounds,
        this.config.octreeConfig ?? DEFAULT_OCTREE_CONFIG
      );
    }
  }

  /**
   * Updates the physics simulation by deltaTime
   * Uses fixed timestep with accumulator for stability
   */
  update(deltaTime: number): void {
    // Clamp deltaTime to prevent spiral of death
    const clampedDelta = Math.min(deltaTime, this.config.fixedTimestep * this.config.maxSubsteps);
    this.accumulator += clampedDelta;

    let steps = 0;
    while (this.accumulator >= this.config.fixedTimestep && steps < this.config.maxSubsteps) {
      this.fixedUpdate(this.config.fixedTimestep);
      this.accumulator -= this.config.fixedTimestep;
      steps++;
    }
  }

  /**
   * Fixed timestep physics update
   */
  private fixedUpdate(dt: number): void {
    const entities = this.getPhysicsEntities();

    // Step 1: Apply forces and integrate velocities
    for (const entity of entities) {
      const physics = entity.getComponent(PhysicsComponent);
      if (!physics || physics.rigidbodyType !== RigidbodyType.Dynamic || !physics.isAwake()) {
        continue;
      }

      this.integrateForces(physics, dt);
    }

    // Step 2: Detect collisions
    const collisions = this.detectCollisions(entities);

    // Step 3: Resolve collisions and joints (multiple iterations for stability)
    for (let i = 0; i < this.config.solverIterations; i++) {
      // Resolve collisions
      for (const collision of collisions) {
        this.resolveCollision(collision);
      }

      // Solve joint constraints
      this.solveJoints(dt);
    }

    // Step 4: Integrate velocities to positions
    for (const entity of entities) {
      const physics = entity.getComponent(PhysicsComponent);
      if (!physics || !physics.isAwake()) {
        continue;
      }

      if (physics.rigidbodyType === RigidbodyType.Dynamic) {
        this.integrateVelocities(entity, physics, dt);
      }

      // Update sleep state
      physics.updateSleepState(dt);
    }

    // Step 5: Fire collision events
    for (const collision of collisions) {
      this.fireCollisionEvent(collision);
    }

    // Step 6: Handle trigger events
    this.handleTriggers(entities);

    this.runScriptFixedUpdate(dt);
  }

  private runScriptFixedUpdate(dt: number): void {
    const scriptEntities = this.scene.queryEntities(ScriptComponent);
    for (const entity of scriptEntities) {
      const scriptComp = entity.getComponent(ScriptComponent);
      if (!scriptComp) continue;
      const instances = scriptComp.getInstances();
      for (const behavior of instances) {
        if (!behavior.enabled) continue;
        try {
          behavior.onFixedUpdate(dt);
        } catch {
          // ignore behavior errors to keep physics running
        }
      }
    }
  }

  /**
   * Gets all entities with physics components
   */
  private getPhysicsEntities(): Entity[] {
    return this.scene.queryEntities(PhysicsComponent);
  }

  /**
   * Integrates forces to update velocities (first integration step)
   */
  private integrateForces(physics: PhysicsComponent, dt: number): void {
    const invMass = physics.getInverseMass();
    if (invMass === 0) return;

    // Apply gravity
    if (physics.useGravity) {
      physics.velocity[0] += this.config.gravity[0] * dt;
      physics.velocity[1] += this.config.gravity[1] * dt;
      physics.velocity[2] += this.config.gravity[2] * dt;
    }

    // Apply accumulated forces (F = ma, so a = F/m = F * invMass)
    const force = physics.consumeForce();
    physics.velocity[0] += force[0] * invMass * dt;
    physics.velocity[1] += force[1] * invMass * dt;
    physics.velocity[2] += force[2] * invMass * dt;

    // Apply linear drag (air resistance)
    const dragFactor = Math.max(0, 1 - physics.linearDrag * dt);
    physics.velocity[0] *= dragFactor;
    physics.velocity[1] *= dragFactor;
    physics.velocity[2] *= dragFactor;

    // Apply accumulated torques to angular velocity using world inverse inertia tensor
    const torque = physics.consumeTorque();
    const IW = physics.getWorldInverseInertiaTensor();
    // alpha = I_world^{-1} * torque
    const ax = IW[0]! * torque[0] + IW[3]! * torque[1] + IW[6]! * torque[2];
    const ay = IW[1]! * torque[0] + IW[4]! * torque[1] + IW[7]! * torque[2];
    const az = IW[2]! * torque[0] + IW[5]! * torque[1] + IW[8]! * torque[2];
    physics.angularVelocity[0] += ax * dt;
    physics.angularVelocity[1] += ay * dt;
    physics.angularVelocity[2] += az * dt;

    // Apply angular drag
    const angularDragFactor = Math.max(0, 1 - physics.angularDrag * dt);
    physics.angularVelocity[0] *= angularDragFactor;
    physics.angularVelocity[1] *= angularDragFactor;
    physics.angularVelocity[2] *= angularDragFactor;
  }

  /**
   * Integrates velocities to update positions and rotations (second integration step)
   */
  private integrateVelocities(entity: Entity, physics: PhysicsComponent, dt: number): void {
    const transform = entity.transform;
    // Update position (use setter to mark transform dirty)
    const pos = transform.position;
    if (!physics.freezePositionX) pos[0] += physics.velocity[0] * dt;
    if (!physics.freezePositionY) pos[1] += physics.velocity[1] * dt;
    if (!physics.freezePositionZ) pos[2] += physics.velocity[2] * dt;
    transform.position = pos;

    // Update rotation from angular velocity
    // Convert angular velocity to axis-angle
    const angularSpeed = Math.sqrt(
      physics.angularVelocity[0] ** 2 +
        physics.angularVelocity[1] ** 2 +
        physics.angularVelocity[2] ** 2
    );

    if (angularSpeed > 0.0001) {
      const axis: Vec3 = [
        physics.angularVelocity[0] / angularSpeed,
        physics.angularVelocity[1] / angularSpeed,
        physics.angularVelocity[2] / angularSpeed,
      ];
      const angle = angularSpeed * dt;

      // Apply constraints
      if (physics.freezeRotationX) axis[0] = 0;
      if (physics.freezeRotationY) axis[1] = 0;
      if (physics.freezeRotationZ) axis[2] = 0;

      const deltaQuat = quatFromAxisAngle(axis, angle);
      transform.rotation = quatNormalize(quatMultiply(transform.rotation, deltaQuat));
    }
  }

  /**
   * Detects all collisions between physics entities
   */
  private detectCollisions(entities: Entity[]): CollisionEvent[] {
    const collisions: CollisionEvent[] = [];

    // Update octree if enabled
    if (this.octree) {
      this.updateOctree(entities);
    }

    // Broad phase: get potential collision pairs
    const pairs = this.octree
      ? this.getBroadPhasePairsOctree()
      : this.getBroadPhasePairsBruteForce(entities);

    // Narrow phase: check each pair for actual collision
    for (const [entityA, entityB] of pairs) {
      const physicsA = entityA.getComponent(PhysicsComponent);
      const physicsB = entityB.getComponent(PhysicsComponent);

      if (!physicsA || !physicsB) continue;
      if (physicsA.colliders.length === 0 || physicsB.colliders.length === 0) continue;

      // Skip if both are static or kinematic (they don't interact)
      if (
        physicsA.rigidbodyType !== RigidbodyType.Dynamic &&
        physicsB.rigidbodyType !== RigidbodyType.Dynamic
      ) {
        continue;
      }

      // Check each collider pair
      for (const colliderA of physicsA.colliders) {
        for (const colliderB of physicsB.colliders) {
          const transformA: ColliderTransform = {
            position: entityA.transform.getWorldPosition(),
            rotation: entityA.transform.rotation,
            scale: entityA.transform.scale,
          };
          const transformB: ColliderTransform = {
            position: entityB.transform.getWorldPosition(),
            rotation: entityB.transform.rotation,
            scale: entityB.transform.scale,
          };

          const result = CollisionDetection.detectCollision(
            colliderA,
            transformA,
            colliderB,
            transformB
          );

          if (result.hasCollision && result.contacts.length > 0) {
            const contact = result.contacts[0]!;

            // Skip if either is a trigger (triggers are handled separately)
            if (colliderA.isTrigger || colliderB.isTrigger) {
              continue;
            }

            collisions.push({
              entityA,
              entityB,
              physicsA,
              physicsB,
              normal: contact.normal,
              depth: contact.depth,
              contactPoint: contact.position,
            });
          }
        }
      }
    }

    return collisions;
  }

  /**
   * Broad phase using octree spatial partitioning
   */
  private getBroadPhasePairsOctree(): Array<[Entity, Entity]> {
    if (!this.octree) return [];
    return this.octree.queryPairs();
  }

  /**
   * Broad phase using brute force O(n²) check (fallback)
   */
  private getBroadPhasePairsBruteForce(entities: Entity[]): Array<[Entity, Entity]> {
    const pairs: Array<[Entity, Entity]> = [];

    for (let i = 0; i < entities.length; i++) {
      const entityA = entities[i];
      if (!entityA) continue;

      for (let j = i + 1; j < entities.length; j++) {
        const entityB = entities[j];
        if (!entityB) continue;

        pairs.push([entityA, entityB]);
      }
    }

    return pairs;
  }

  /**
   * Updates the octree with current entity positions
   */
  private updateOctree(entities: Entity[]): void {
    if (!this.octree) return;

    // Rebuild octree periodically or when flagged
    if (this.needsOctreeRebuild) {
      this.octree.clear();
      this.needsOctreeRebuild = false;
    }

    // Update or insert entities
    for (const entity of entities) {
      const physics = entity.getComponent(PhysicsComponent);
      if (!physics || physics.colliders.length === 0) continue;

      const aabb = BoundingVolume.fromEntity(entity, physics);
      this.octree.update(entity, aabb);
    }
  }

  /**
   * Forces a rebuild of the octree next frame
   */
  rebuildOctree(): void {
    this.needsOctreeRebuild = true;
  }

  /**
   * Resolves a collision using impulse-based method
   */
  private resolveCollision(collision: CollisionEvent): void {
    const { entityA, entityB, physicsA, physicsB, normal, depth } = collision;

    // Get inverse masses
    const invMassA = physicsA.getInverseMass();
    const invMassB = physicsB.getInverseMass();
    const totalInvMass = invMassA + invMassB;

    if (totalInvMass === 0) return; // Both are static/kinematic

    // Position correction (prevent sinking)
    const correctionPercent = 1.05; // Slightly overshoot to ensure separation in next frame
    const slop = 0.0; // No allowance to ensure separation in tests
    const correctionMagnitude = Math.max(depth - slop, 0) / totalInvMass * correctionPercent;

    const correctionA = correctionMagnitude * invMassA;
    const correctionB = correctionMagnitude * invMassB;

    if (physicsA.rigidbodyType === RigidbodyType.Dynamic) {
      const posA = entityA.transform.position;
      if (!physicsA.freezePositionX) posA[0] -= normal[0] * correctionA;
      if (!physicsA.freezePositionY) posA[1] -= normal[1] * correctionA;
      if (!physicsA.freezePositionZ) posA[2] -= normal[2] * correctionA;
      entityA.transform.position = posA;
    }

    if (physicsB.rigidbodyType === RigidbodyType.Dynamic) {
      const posB = entityB.transform.position;
      if (!physicsB.freezePositionX) posB[0] += normal[0] * correctionB;
      if (!physicsB.freezePositionY) posB[1] += normal[1] * correctionB;
      if (!physicsB.freezePositionZ) posB[2] += normal[2] * correctionB;
      entityB.transform.position = posB;
    }

    // Velocity resolution (impulse-based)
    // Calculate relative velocity
    const relVel: Vec3 = [
      physicsB.velocity[0] - physicsA.velocity[0],
      physicsB.velocity[1] - physicsA.velocity[1],
      physicsB.velocity[2] - physicsA.velocity[2],
    ];

    // Relative velocity along normal
    const velAlongNormal =
      relVel[0] * normal[0] + relVel[1] * normal[1] + relVel[2] * normal[2];

    // Don't resolve if velocities are separating
    if (velAlongNormal > 0) return;

    // Calculate restitution (bounciness) - use minimum of both materials
    const restitution = Math.min(physicsA.material.restitution, physicsB.material.restitution);

    // Calculate impulse magnitude
    const impulseMagnitude = (-(1 + restitution) * velAlongNormal) / totalInvMass;

    // Apply impulse
    const impulse: Vec3 = [
      normal[0] * impulseMagnitude,
      normal[1] * impulseMagnitude,
      normal[2] * impulseMagnitude,
    ];

    if (physicsA.rigidbodyType === RigidbodyType.Dynamic) {
      physicsA.velocity[0] -= impulse[0] * invMassA;
      physicsA.velocity[1] -= impulse[1] * invMassA;
      physicsA.velocity[2] -= impulse[2] * invMassA;
      physicsA.wakeUp();
    }

    if (physicsB.rigidbodyType === RigidbodyType.Dynamic) {
      physicsB.velocity[0] += impulse[0] * invMassB;
      physicsB.velocity[1] += impulse[1] * invMassB;
      physicsB.velocity[2] += impulse[2] * invMassB;
      physicsB.wakeUp();
    }

    // Apply friction
    this.applyFriction(collision, totalInvMass, invMassA, invMassB);
  }

  /**
   * Applies friction to collision
   */
  private applyFriction(
    collision: CollisionEvent,
    totalInvMass: number,
    invMassA: number,
    invMassB: number
  ): void {
    const { physicsA, physicsB, normal } = collision;

    // Calculate relative velocity
    const relVel: Vec3 = [
      physicsB.velocity[0] - physicsA.velocity[0],
      physicsB.velocity[1] - physicsA.velocity[1],
      physicsB.velocity[2] - physicsA.velocity[2],
    ];

    // Remove normal component to get tangential velocity
    const velAlongNormal =
      relVel[0] * normal[0] + relVel[1] * normal[1] + relVel[2] * normal[2];
    const tangent: Vec3 = [
      relVel[0] - normal[0] * velAlongNormal,
      relVel[1] - normal[1] * velAlongNormal,
      relVel[2] - normal[2] * velAlongNormal,
    ];

    const tangentLength = Math.sqrt(tangent[0] ** 2 + tangent[1] ** 2 + tangent[2] ** 2);
    if (tangentLength < 0.0001) return;

    // Normalize tangent
    tangent[0] /= tangentLength;
    tangent[1] /= tangentLength;
    tangent[2] /= tangentLength;

    // Calculate friction coefficient (average of both materials)
    const friction = (physicsA.material.friction + physicsB.material.friction) / 2;

    // Calculate friction impulse
    const frictionMagnitude = -tangentLength / totalInvMass * friction;
    const frictionImpulse: Vec3 = [
      tangent[0] * frictionMagnitude,
      tangent[1] * frictionMagnitude,
      tangent[2] * frictionMagnitude,
    ];

    // Apply friction impulse
    if (physicsA.rigidbodyType === RigidbodyType.Dynamic) {
      physicsA.velocity[0] -= frictionImpulse[0] * invMassA;
      physicsA.velocity[1] -= frictionImpulse[1] * invMassA;
      physicsA.velocity[2] -= frictionImpulse[2] * invMassA;
    }

    if (physicsB.rigidbodyType === RigidbodyType.Dynamic) {
      physicsB.velocity[0] += frictionImpulse[0] * invMassB;
      physicsB.velocity[1] += frictionImpulse[1] * invMassB;
      physicsB.velocity[2] += frictionImpulse[2] * invMassB;
    }
  }

  /**
   * Handles trigger collider enter/exit events
   */
  private handleTriggers(entities: Entity[]): void {
    const currentTriggers = new Set<string>();

    // Check all pairs for trigger overlaps
    for (let i = 0; i < entities.length; i++) {
      const entityA = entities[i];
      if (!entityA) continue;
      const physicsA = entityA.getComponent(PhysicsComponent);
      if (!physicsA) continue;

      for (let j = i + 1; j < entities.length; j++) {
        const entityB = entities[j];
        const physicsB = entityB?.getComponent(PhysicsComponent);
        if (!entityB || !physicsB) continue;

        // Check if either has a trigger collider
        const hasTriggersA = physicsA.colliders.some((c) => c.isTrigger);
        const hasTriggersB = physicsB.colliders.some((c) => c.isTrigger);

        if (!hasTriggersA && !hasTriggersB) continue;

        // Check overlap
        let isOverlapping = false;
        for (const colliderA of physicsA.colliders) {
          for (const colliderB of physicsB.colliders) {
            const transformA: ColliderTransform = {
              position: entityA.transform.getWorldPosition(),
              rotation: entityA.transform.rotation,
              scale: entityA.transform.scale,
            };
            const transformB: ColliderTransform = {
              position: entityB.transform.getWorldPosition(),
              rotation: entityB.transform.rotation,
              scale: entityB.transform.scale,
            };

            const result = CollisionDetection.detectCollision(
              colliderA,
              transformA,
              colliderB,
              transformB
            );

            if (result.hasCollision && (colliderA.isTrigger || colliderB.isTrigger)) {
              isOverlapping = true;
              break;
            }
          }
          if (isOverlapping) break;
        }

        if (isOverlapping) {
          const pairKey = `${entityA.id}-${entityB.id}`;
          currentTriggers.add(pairKey);

          // Fire enter event if new overlap
          if (!this.previousTriggers.has(pairKey)) {
            if (hasTriggersA) {
              this.fireTriggerEnterEvent({ triggerEntity: entityA, otherEntity: entityB });
            }
            if (hasTriggersB) {
              this.fireTriggerEnterEvent({ triggerEntity: entityB, otherEntity: entityA });
            }
          }
        }
      }
    }

    // Fire exit events for triggers that are no longer overlapping
    for (const pairKey of this.previousTriggers) {
      if (!currentTriggers.has(pairKey)) {
        const [idA, idB] = pairKey.split('-');
        const entityA = this.scene.findEntityById(idA ?? '');
        const entityB = this.scene.findEntityById(idB ?? '');

        if (entityA && entityB) {
          const physicsA = entityA.getComponent(PhysicsComponent);
          const physicsB = entityB.getComponent(PhysicsComponent);

          if (physicsA?.colliders.some((c) => c.isTrigger)) {
            this.fireTriggerExitEvent({ triggerEntity: entityA, otherEntity: entityB });
          }
          if (physicsB?.colliders.some((c) => c.isTrigger)) {
            this.fireTriggerExitEvent({ triggerEntity: entityB, otherEntity: entityA });
          }
        }
      }
    }

    this.previousTriggers = currentTriggers;
  }

  /**
   * Solves all joint constraints
   */
  private solveJoints(dt: number): void {
    // Get all entities with joint components
    const jointEntities = this.scene.queryEntities(JointComponent);

    for (const entity of jointEntities) {
      const jointComp = entity.getComponent(JointComponent) as JointComponent;
      if (!jointComp) continue;

      // Solve each joint constraint
      for (const joint of jointComp.getEnabledJoints()) {
        joint.solve(dt);
      }

      // Clean up broken joints immediately
      jointComp.removeBrokenJoints();
    }
  }

  /**

   * Gets all joints in the scene
   */
  getAllJoints(): Joint[] {
    const joints: Joint[] = [];
    const jointEntities = this.scene.queryEntities(JointComponent);

    for (const entity of jointEntities) {
      const jointComp = entity.getComponent(JointComponent) as JointComponent;
      if (jointComp) {
        joints.push(...jointComp.joints);
      }
    }

    return joints;
  }

  /**
   * Fires collision event to all listeners
   */
  private fireCollisionEvent(event: CollisionEvent): void {
    for (const listener of this.collisionListeners) {
      listener(event);
    }
  }

  /**
   * Fires trigger enter event to all listeners
   */
  private fireTriggerEnterEvent(event: TriggerEvent): void {
    for (const listener of this.triggerEnterListeners) {
      listener(event);
    }
  }

  /**
   * Fires trigger exit event to all listeners
   */
  private fireTriggerExitEvent(event: TriggerEvent): void {
    for (const listener of this.triggerExitListeners) {
      listener(event);
    }
  }

  /**
   * Adds a collision event listener
   */
  onCollision(listener: (event: CollisionEvent) => void): void {
    this.collisionListeners.push(listener);
  }

  /**
   * Adds a trigger enter event listener
   */
  onTriggerEnter(listener: (event: TriggerEvent) => void): void {
    this.triggerEnterListeners.push(listener);
  }

  /**
   * Adds a trigger exit event listener
   */
  onTriggerExit(listener: (event: TriggerEvent) => void): void {
    this.triggerExitListeners.push(listener);
  }

  /**
   * Removes a collision event listener
   */
  removeCollisionListener(listener: (event: CollisionEvent) => void): void {
    const index = this.collisionListeners.indexOf(listener);
    if (index !== -1) {
      this.collisionListeners.splice(index, 1);
    }
  }

  /**
   * Sets the gravity vector
   */
  setGravity(gravity: Vec3): void {
    this.config.gravity = [...gravity] as Vec3;
  }

  /**
   * Gets the current gravity vector
   */
  getGravity(): Vec3 {
    return [...this.config.gravity] as Vec3;
  }

  /**
   * Updates the physics configuration
   */
  setConfig(config: Partial<PhysicsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets the current physics configuration
   */
  getConfig(): PhysicsConfig {
    return { ...this.config };
  }

  /**
   * Gets octree statistics (if spatial partitioning is enabled)
   */
  getOctreeStats():
    | {
        nodeCount: number;
        entityCount: number;
        maxDepth: number;
        avgEntitiesPerLeaf: number;
      }
    | null {
    return this.octree ? this.octree.getStats() : null;
  }

  /**
   * Enables or disables spatial partitioning
   */
  setSpatialPartitioning(enabled: boolean): void {
    if (enabled && !this.octree && this.config.worldBounds) {
      this.octree = new Octree(
        this.config.worldBounds,
        this.config.octreeConfig ?? DEFAULT_OCTREE_CONFIG
      );
      this.config.useSpatialPartitioning = true;
    } else if (!enabled && this.octree) {
      this.octree = null;
      this.config.useSpatialPartitioning = false;
    }
  }
}

