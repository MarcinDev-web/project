import type { Entity } from '../core/Entity.js';
import type { Vec3 } from '@engine/core/math';
import { HealthComponent } from '../components/HealthComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';
import { CharacterController } from '../components/CharacterController.js';
import type { CheckpointSystem } from '../systems/CheckpointSystem.js';

export interface RespawnOptions {
  /** Default spawn position and rotation */
  defaultSpawn: { position: Vec3; rotation: number };
  /** Optional checkpoint system to use for spawn location */
  checkpointSystem?: CheckpointSystem;
}

export interface RespawnResult {
  position: Vec3;
  rotation: number;
}

/**
 * RespawnManager handles the logic of respawning an entity (player).
 * It determines the spawn location (checkpoint or default) and resets entity state.
 */
export class RespawnManager {
  constructor(private options: RespawnOptions) {}

  /**
   * Respawn the entity.
   * Resets health, physics, and moves the entity to the spawn point.
   * 
   * @param entity The entity to respawn
   * @returns The spawn position and rotation used
   */
  respawn(entity: Entity): RespawnResult {
    // Determine spawn location
    let spawnData = this.options.defaultSpawn;
    
    if (this.options.checkpointSystem) {
      spawnData = this.options.checkpointSystem.getRespawnData(this.options.defaultSpawn);
    }

    // Reset Health
    const health = entity.getComponent(HealthComponent);
    if (health) {
      health.currentHealth = health.maxHealth;
    }

    // Reset Physics (velocity)
    const physics = entity.getComponent(PhysicsComponent);
    if (physics) {
      physics.velocity = [0, 0, 0];
      physics.angularVelocity = [0, 0, 0];
    }

    // Teleport Entity
    const controller = entity.getComponent(CharacterController);
    if (controller) {
      controller.teleport(spawnData.position);
    } else {
      entity.transform.position = [...spawnData.position] as Vec3;
      entity.transform.setEulerAngles(0, spawnData.rotation, 0);
    }

    return {
      position: spawnData.position,
      rotation: spawnData.rotation,
    };
  }
}

