/**
 * BlockBehaviorSystem - Applies gameplay effects from blocks (ice, slime, lava, poison)
 *
 * Tracks collisions between dynamic entities and blocks, applying:
 * - Friction multipliers (ice/slime)
 * - Movement speed multipliers (ice/slime)
 * - Damage over time (lava/poison)
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { PhysicsComponent, RigidbodyType } from '../components/PhysicsComponent.js';
import { CharacterController } from '../components/CharacterController.js';
import { HealthComponent } from '../components/HealthComponent.js';
import type { PhysicsSystem, CollisionEvent } from '../physics/PhysicsSystem.js';
// Lazy import to avoid circular dependency (blocks imports world types)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let getBlock: (id: string) => any = () => undefined;
try {
  // Dynamic require to break circular dependency during build
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  getBlock = require('@engine/blocks').getBlock;
} catch {
  // Fallback for build time - will work at runtime
}

/**
 * Tracks active effects for an entity
 */
interface ActiveEffects {
  /** Original friction value before applying block effects */
  originalFriction: number;
  /** Original restitution value before applying block effects */
  originalRestitution: number;
  /** Original move speed before applying block effects */
  originalMoveSpeed: number;
  /** Map of block entity -> last collision time (for detecting when collision ends) */
  activeBlocks: Map<Entity, number>;
  /** Last update time for damage ticks */
  lastDamageTime: number;
}

/**
 * BlockBehaviorSystem manages gameplay effects from blocks
 */
export class BlockBehaviorSystem {
  private readonly scene: Scene;
  private readonly physicsSystem: PhysicsSystem;

  /** Map of entity -> active effects */
  private readonly activeEffects = new Map<Entity, ActiveEffects>();

  /** Set of entities that should be processed each frame */
  private readonly dynamicEntities = new Set<Entity>();

  /** Damage tick interval in seconds */
  private readonly damageTickInterval = 0.1; // Apply damage every 0.1 seconds

  /** Time in seconds before considering collision ended (if no new collision detected) */
  private readonly collisionTimeout = 0.2; // 2 frames at 60fps

  /** Current time tracking */
  private currentTime = 0;

  constructor(scene: Scene, physicsSystem: PhysicsSystem) {
    this.scene = scene;
    this.physicsSystem = physicsSystem;

    // Subscribe to collision events
    this.physicsSystem.onCollision((event) => this.handleCollision(event));
  }

  /**
   * Update block behaviors (called each frame after physics)
   */
  update(deltaTime: number): void {
    this.currentTime += deltaTime;

    // Clean up effects for entities that no longer exist
    for (const entity of this.activeEffects.keys()) {
      if (!this.scene.findEntityById(entity.id)) {
        this.cleanupEffects(entity);
      }
    }

    // Process active effects
    for (const [entity, effects] of this.activeEffects.entries()) {
      if (!entity) continue;

      // Remove blocks that are no longer in collision (timeout expired)
      this.updateActiveBlocks(entity, effects);

      // Apply effects if there are active blocks
      if (effects.activeBlocks.size > 0) {
        this.applyEffects(entity, effects, deltaTime);
      } else {
        // No active blocks, cleanup effects
        this.cleanupEffects(entity);
      }
    }
  }

  /**
   * Handle collision event from physics system
   */
  private handleCollision(event: CollisionEvent): void {
    // Find which entity is dynamic and which is static (block)
    let dynamicEntity: Entity | null = null;
    let blockEntity: Entity | null = null;

    // Check entityA
    if (event.physicsA.rigidbodyType === RigidbodyType.Dynamic) {
      dynamicEntity = event.entityA;
      // Check if entityB is a static block
      if (event.physicsB.rigidbodyType === RigidbodyType.Static) {
        const blockId = event.entityB.userData?.blockId;
        if (blockId && typeof blockId === 'string' && getBlock(blockId)) {
          blockEntity = event.entityB;
        }
      }
    }

    // Check entityB
    if (!dynamicEntity && event.physicsB.rigidbodyType === RigidbodyType.Dynamic) {
      dynamicEntity = event.entityB;
      // Check if entityA is a static block
      if (event.physicsA.rigidbodyType === RigidbodyType.Static) {
        const blockId = event.entityA.userData?.blockId;
        if (blockId && typeof blockId === 'string' && getBlock(blockId)) {
          blockEntity = event.entityA;
        }
      }
    }

    // If we found a dynamic entity colliding with a block, track it
    if (dynamicEntity && blockEntity) {
      this.dynamicEntities.add(dynamicEntity);

      // Initialize effects if not already tracked
      if (!this.activeEffects.has(dynamicEntity)) {
        this.initializeEffects(dynamicEntity);
      }

      // Add/update block in active blocks with current time
      const effects = this.activeEffects.get(dynamicEntity);
      if (effects) {
        effects.activeBlocks.set(blockEntity, this.currentTime);
      }
    }
  }

  /**
   * Initialize effects tracking for an entity
   */
  private initializeEffects(entity: Entity): void {
    const physics = entity.getComponent(PhysicsComponent);
    const controller = entity.getComponent(CharacterController);

    const effects: ActiveEffects = {
      originalFriction: physics?.material.friction ?? 0.5,
      originalRestitution: physics?.material.restitution ?? 0.3,
      originalMoveSpeed: controller?.config.moveSpeed ?? 5.0,
      activeBlocks: new Map(),
      lastDamageTime: 0,
    };

    this.activeEffects.set(entity, effects);
  }

  /**
   * Update active blocks by checking current collisions
   * Removes blocks that are no longer in contact (timeout expired)
   */
  private updateActiveBlocks(entity: Entity, effects: ActiveEffects): void {
    const physics = entity.getComponent(PhysicsComponent);
    if (!physics || physics.rigidbodyType !== RigidbodyType.Dynamic) {
      return;
    }

    const blocksToRemove: Entity[] = [];

    // Check each active block for timeout
    for (const [blockEntity, lastCollisionTime] of effects.activeBlocks.entries()) {
      // Remove if block entity no longer exists
      if (!this.scene.findEntityById(blockEntity.id)) {
        blocksToRemove.push(blockEntity);
        continue;
      }

      // Remove if collision timeout expired (no new collision detected)
      const timeSinceLastCollision = this.currentTime - lastCollisionTime;
      if (timeSinceLastCollision > this.collisionTimeout) {
        blocksToRemove.push(blockEntity);
      }
    }

    // Remove timed out blocks
    for (const blockEntity of blocksToRemove) {
      effects.activeBlocks.delete(blockEntity);
    }
  }

  /**
   * Apply block effects to entity
   */
  private applyEffects(entity: Entity, effects: ActiveEffects, _deltaTime: number): void {
    const physics = entity.getComponent(PhysicsComponent);
    const controller = entity.getComponent(CharacterController);
    const health = entity.getComponent(HealthComponent);

    // Find the strongest effect from all active blocks
    let maxFrictionMultiplier = 1.0;
    let maxRestitutionMultiplier = 1.0;
    let maxSpeedMultiplier = 1.0;
    let maxDamagePerSecond = 0;

    for (const [blockEntity] of effects.activeBlocks) {
      const blockId = blockEntity.userData?.blockId;
      if (!blockId) continue;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const blockDef = typeof blockId === 'string' ? getBlock(blockId) : undefined;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!blockDef?.behavior) continue;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const behavior = blockDef.behavior;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (behavior.frictionMultiplier !== undefined) {
        // Use maximum friction multiplier (strongest effect)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        maxFrictionMultiplier = Math.max(maxFrictionMultiplier, behavior.frictionMultiplier);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (behavior.restitutionMultiplier !== undefined) {
        // Use maximum restitution multiplier (strongest bounce effect)

        maxRestitutionMultiplier = Math.max(
          maxRestitutionMultiplier,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          behavior.restitutionMultiplier
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (behavior.movementSpeedMultiplier !== undefined) {
        // For speed, multiply effects (slime 0.5 + ice 1.5 = 0.75)
        // This allows effects to stack naturally
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        maxSpeedMultiplier *= behavior.movementSpeedMultiplier;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (behavior.damagePerSecond !== undefined) {
        // Use maximum damage per second (strongest effect)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        maxDamagePerSecond = Math.max(maxDamagePerSecond, behavior.damagePerSecond);
      }
    }

    // Apply friction multiplier (reset to original if no effect)
    if (physics) {
      if (maxFrictionMultiplier !== 1.0) {
        physics.material.friction = effects.originalFriction * maxFrictionMultiplier;
      } else {
        physics.material.friction = effects.originalFriction;
      }

      // Apply restitution multiplier (reset to original if no effect)
      if (maxRestitutionMultiplier !== 1.0) {
        physics.material.restitution = effects.originalRestitution * maxRestitutionMultiplier;
      } else {
        physics.material.restitution = effects.originalRestitution;
      }
    }

    // Apply speed multiplier (reset to original if no effect)
    if (controller) {
      if (maxSpeedMultiplier !== 1.0) {
        // Apply multiplier to base speed
        const baseSpeed = effects.originalMoveSpeed;
        controller.config.moveSpeed = baseSpeed * maxSpeedMultiplier;
      } else {
        controller.config.moveSpeed = effects.originalMoveSpeed;
      }
    }

    // Apply damage over time
    if (health && maxDamagePerSecond > 0) {
      const timeSinceLastDamage = this.currentTime - effects.lastDamageTime;

      if (timeSinceLastDamage >= this.damageTickInterval) {
        const damageThisTick = maxDamagePerSecond * this.damageTickInterval;
        health.takeDamage(damageThisTick);
        effects.lastDamageTime = this.currentTime;
      }
    }
  }

  /**
   * Clean up effects and restore original values
   */
  private cleanupEffects(entity: Entity): void {
    const effects = this.activeEffects.get(entity);
    if (!effects) return;

    // Restore original friction and restitution
    const physics = entity.getComponent(PhysicsComponent);
    if (physics) {
      physics.material.friction = effects.originalFriction;
      physics.material.restitution = effects.originalRestitution;
    }

    // Restore original move speed
    const controller = entity.getComponent(CharacterController);
    if (controller) {
      controller.config.moveSpeed = effects.originalMoveSpeed;
    }

    // Remove from tracking
    this.activeEffects.delete(entity);
    this.dynamicEntities.delete(entity);
  }

  /**
   * Remove entity from tracking (called when entity is destroyed)
   */
  removeEntity(entity: Entity): void {
    this.cleanupEffects(entity);
  }
}
