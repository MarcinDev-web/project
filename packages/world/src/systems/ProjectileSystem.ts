/**
 * ProjectileSystem - Manages projectile entities (movement, collision, damage, cleanup)
 */

import type { Scene } from '../core/Scene';
import type { Entity } from '../core/Entity';
import { ProjectileComponent } from '../components/ProjectileComponent';
import { HealthComponent } from '../components/HealthComponent';
import type { PhysicsSystem, CollisionEvent } from '../physics/PhysicsSystem';
import type { ProjectileHitEvent } from '../types/weapon';
import type { Vec3 } from '@engine/core/math';

/**
 * Configuration for ProjectileSystem
 */
export interface ProjectileSystemConfig {
  /** Enable automatic cleanup of expired projectiles */
  enableAutoCleanup?: boolean;
}

/**
 * ProjectileSystem manages projectile lifecycle
 */
export class ProjectileSystem {
  private readonly scene: Scene;
  private readonly physicsSystem: PhysicsSystem | null;
  private readonly config: ProjectileSystemConfig;
  private currentTime: number = 0;

  /** Collision listener function reference */
  private collisionListener: ((event: CollisionEvent) => void) | null = null;

  constructor(
    scene: Scene,
    physicsSystem: PhysicsSystem | null = null,
    config?: ProjectileSystemConfig
  ) {
    this.scene = scene;
    this.physicsSystem = physicsSystem;
    this.config = {
      enableAutoCleanup: config?.enableAutoCleanup ?? true,
    };

    // Subscribe to collision events if physics system available
    if (this.physicsSystem) {
      this.subscribeToCollisions();
    }
  }

  /**
   * Update projectile system (called each frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!(deltaTime > 0)) return;

    this.currentTime += deltaTime;
    const entities = this.scene.queryEntities(ProjectileComponent);

    for (const entity of entities) {
      const projectile = entity.getComponent(ProjectileComponent);
      if (!projectile) continue;

      // Check if expired
      if (this.config.enableAutoCleanup && projectile.isExpired(this.currentTime)) {
        this.destroyProjectile(entity, projectile, 'expired');
        continue;
      }
    }
  }

  /**
   * Subscribe to collision events from physics system
   */
  private subscribeToCollisions(): void {
    if (!this.physicsSystem) return;

    this.collisionListener = (event: CollisionEvent) => {
      this.handleCollision(event);
    };
    
    this.physicsSystem.onCollision(this.collisionListener);
  }

  /**
   * Handle collision event from physics system
   */
  private handleCollision(event: CollisionEvent): void {
    // Check if one of the entities is a projectile
    const projectileA = event.entityA.getComponent(ProjectileComponent);
    const projectileB = event.entityB.getComponent(ProjectileComponent);

    if (projectileA) {
      this.onProjectileHit(event.entityA, projectileA, event.entityB, event.contactPoint, event.normal);
    } else if (projectileB) {
      this.onProjectileHit(event.entityB, projectileB, event.entityA, event.contactPoint, event.normal);
    }
  }

  /**
   * Handle projectile hit
   */
  private onProjectileHit(
    projectileEntity: Entity,
    projectile: ProjectileComponent,
    hitEntity: Entity,
    hitPoint: Vec3,
    hitNormal: Vec3
  ): void {
    // Don't hit the owner
    if (hitEntity.id === projectile.ownerId) {
      return;
    }

    // Apply damage to hit entity
    const health = hitEntity.getComponent(HealthComponent);
    let damageDealt = 0;
    
    if (health) {
      damageDealt = health.takeDamage(projectile.damage);
    }

    // Emit hit event
    const hitEvent: ProjectileHitEvent = {
      projectile: projectileEntity,
      hitEntity,
      hitPoint,
      hitNormal,
      damage: damageDealt,
      ownerId: projectile.ownerId,
    };
    this.scene.events.emit('projectile:hit', hitEvent);

    // Fire component callback
    if (projectile.onHit) {
      projectile.onHit(hitEntity.id, [...hitPoint] as [number, number, number]);
    }

    // Destroy projectile
    this.destroyProjectile(projectileEntity, projectile, 'hit');
  }

  /**
   * Destroy a projectile entity
   */
  private destroyProjectile(
    entity: Entity,
    projectile: ProjectileComponent,
    reason: 'expired' | 'hit'
  ): void {
    // Fire expire callback
    if (reason === 'expired' && projectile.onExpire) {
      projectile.onExpire();
    }

    // Emit destroy event
    this.scene.events.emit('projectile:destroy', {
      projectile: entity,
      reason,
    });

    // Remove from scene
    this.scene.removeEntity(entity);
  }

  /**
   * Dispose of the system (unsubscribe from events)
   */
  dispose(): void {
    if (this.collisionListener && this.physicsSystem) {
      this.physicsSystem.removeCollisionListener(this.collisionListener);
      this.collisionListener = null;
    }
  }

  /**
   * Get current time (for external use)
   */
  getCurrentTime(): number {
    return this.currentTime;
  }
}

