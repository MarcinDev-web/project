import type { Scene, Entity } from '@engine/world';
import { CheckpointComponent } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { distanceVec3, quatToEuler } from '@engine/core/math';
import { Logger } from '../utils/logger';

/**
 * Checkpoint activation result
 */
export interface CheckpointActivation {
  /** Checkpoint entity */
  entity: Entity;
  /** Spawn position */
  position: Vec3;
  /** Spawn rotation (yaw in radians) */
  rotation: number;
}

/**
 * CheckpointSystem manages checkpoint activation and respawn.
 * 
 * Features:
 * - Detects when player enters checkpoint activation radius
 * - Tracks the last activated checkpoint
 * - Provides spawn data for respawn at checkpoint
 */
export class CheckpointSystem {
  private activeCheckpoint: Entity | null = null;
  private scene: Scene | null = null;

  /**
   * Initialize the checkpoint system with a scene
   */
  initialize(scene: Scene): void {
    this.scene = scene;
    this.activeCheckpoint = null;
    Logger.debug('[CheckpointSystem] Initialized');
  }

  /**
   * Update checkpoint activation by checking player proximity to checkpoints
   * 
   * @param playerPosition - Current player position
   * @returns True if a checkpoint was activated this frame
   */
  update(playerPosition: Vec3): boolean {
    if (!this.scene) {
      return false;
    }

    const entities = this.scene.getAllEntities();
    let nearestCheckpoint: Entity | null = null;
    let nearestDistance = Infinity;

    // Find nearest checkpoint within activation radius
    for (const entity of entities) {
      const checkpoint = entity.getComponent(CheckpointComponent);
      if (!checkpoint) {
        continue;
      }

      const checkpointPosition = entity.transform.getWorldPosition();
      const distance = distanceVec3(playerPosition, checkpointPosition);

      // Check if within activation radius and is nearest
      if (distance <= checkpoint.activationRadius && distance < nearestDistance) {
        nearestCheckpoint = entity;
        nearestDistance = distance;
      }
    }

    // Activate nearest checkpoint if found and not already active
    if (nearestCheckpoint && nearestCheckpoint !== this.activeCheckpoint) {
      this.activateCheckpoint(nearestCheckpoint);
      return true;
    }

    return false;
  }

  /**
   * Activate a specific checkpoint
   */
  private activateCheckpoint(checkpoint: Entity): void {
    this.activeCheckpoint = checkpoint;
    const position = checkpoint.transform.getWorldPosition();
    Logger.debug('[CheckpointSystem] Checkpoint activated at', position);
  }

  /**
   * Get spawn data for the active checkpoint
   * 
   * @returns Checkpoint activation data or null if no checkpoint activated
   */
  getActiveCheckpoint(): CheckpointActivation | null {
    if (!this.activeCheckpoint) {
      return null;
    }

    const checkpoint = this.activeCheckpoint.getComponent(CheckpointComponent);
    if (!checkpoint) {
      return null;
    }

    const position = this.activeCheckpoint.transform.getWorldPosition();
    const rotation = checkpoint.rotation !== 0 
      ? checkpoint.rotation 
      : quatToEuler(this.activeCheckpoint.transform.rotation as any)[1]; // Use entity's Y rotation (yaw)

    return {
      entity: this.activeCheckpoint,
      position: [...position] as Vec3,
      rotation,
    };
  }

  /**
   * Get spawn data for respawn at the active checkpoint
   * Falls back to default spawn point if no checkpoint is active
   * 
   * @param defaultSpawn - Default spawn data (from SpawnPointSystem)
   * @returns Spawn data for respawn
   */
  getRespawnData(defaultSpawn: { position: Vec3; rotation: number }): { position: Vec3; rotation: number } {
    const checkpoint = this.getActiveCheckpoint();
    if (checkpoint) {
      return {
        position: checkpoint.position,
        rotation: checkpoint.rotation,
      };
    }

    // Fallback to default spawn
    return defaultSpawn;
  }

  /**
   * Clear active checkpoint (e.g., on level restart)
   */
  clear(): void {
    this.activeCheckpoint = null;
    Logger.debug('[CheckpointSystem] Cleared active checkpoint');
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.scene = null;
    this.activeCheckpoint = null;
  }
}

