/**
 * PlayerDetection - Helper for detecting player proximity in logic cubes.
 */

import type { Scene } from '@engine/world';
import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

/**
 * Provides player detection utilities for trigger cubes
 */
export class PlayerDetection {
  private scene: Scene;
  private playerEntity: Entity | null = null;
  private lastPlayerCheckTime = 0;
  private playerCheckInterval = 1000; // Check every second

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Sets the player entity explicitly
   */
  setPlayerEntity(entity: Entity | null): void {
    this.playerEntity = entity;
  }

  /**
   * Gets the player entity (if it exists)
   * Searches by name or tag if not set explicitly
   */
  getPlayerEntity(): Entity | null {
    // Return cached if available
    if (this.playerEntity) return this.playerEntity;

    // Periodically search for player entity
    const now = Date.now();
    if (now - this.lastPlayerCheckTime < this.playerCheckInterval) {
      return null;
    }
    this.lastPlayerCheckTime = now;

    // Search by common player names
    const playerNames = ['Player', 'player', 'MainPlayer', 'Character'];
    for (const name of playerNames) {
      const found = this.scene.findEntitiesByName(name)[0]; // Changed to findEntitiesByName
      if (found) {
        this.playerEntity = found;
        return found;
      }
    }

    // TODO: Search by CharacterController component when available
    // const entities = this.scene.queryEntities(CharacterController);
    // if (entities.length > 0) {
    //   this.playerEntity = entities[0];
    //   return entities[0];
    // }

    return null;
  }

  /**
   * Gets player position
   */
  getPlayerPosition(): Vec3 | null {
    const player = this.getPlayerEntity();
    if (!player) return null;

    return player.transform.position;
  }

  /**
   * Checks if player is within radius of a position
   */
  isPlayerNear(position: Vec3, radius: number): boolean {
    const playerPos = this.getPlayerPosition();
    if (!playerPos) return false;

    const dx = playerPos[0] - position[0];
    const dy = playerPos[1] - position[1];
    const dz = playerPos[2] - position[2];
    const distSq = dx * dx + dy * dy + dz * dz;

    return distSq <= radius * radius;
  }

  /**
   * Gets distance between player and position
   */
  getPlayerDistance(position: Vec3): number | null {
    const playerPos = this.getPlayerPosition();
    if (!playerPos) return null;

    const dx = playerPos[0] - position[0];
    const dy = playerPos[1] - position[1];
    const dz = playerPos[2] - position[2];

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Gets distance between player and entity
   */
  getPlayerDistanceToEntity(entity: Entity): number | null {
    return this.getPlayerDistance(entity.transform.position);
  }

  /**
   * Checks if player entered a radius since last check
   */
  checkPlayerEntered(position: Vec3, radius: number, wasInside: boolean): boolean {
    const isInside = this.isPlayerNear(position, radius);
    return !wasInside && isInside;
  }

  /**
   * Checks if player left a radius since last check
   */
  checkPlayerLeft(position: Vec3, radius: number, wasInside: boolean): boolean {
    const isInside = this.isPlayerNear(position, radius);
    return wasInside && !isInside;
  }

  /**
   * Gets all entities within radius of a position
   */
  getEntitiesInRadius(position: Vec3, radius: number): Entity[] {
    const result: Entity[] = [];
    const radiusSq = radius * radius;

    this.scene.traverse((entity: Entity) => {
      const entityPos = entity.transform.position;
      const dx = entityPos[0] - position[0];
      const dy = entityPos[1] - position[1];
      const dz = entityPos[2] - position[2];
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq <= radiusSq) {
        result.push(entity);
      }
    });

    return result;
  }

  /**
   * Gets closest entity to a position (within optional max distance)
   */
  getClosestEntity(position: Vec3, maxDistance?: number): Entity | null {
    let closest: Entity | null = null;
    let closestDistSq = maxDistance !== undefined ? maxDistance * maxDistance : Infinity;

    this.scene.traverse((entity: Entity) => {
      const entityPos = entity.transform.position;
      const dx = entityPos[0] - position[0];
      const dy = entityPos[1] - position[1];
      const dz = entityPos[2] - position[2];
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closest = entity;
      }
    });

    return closest;
  }

  /**
   * Checks if two positions are within range
   */
  static isInRange(pos1: Vec3, pos2: Vec3, range: number): boolean {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    const distSq = dx * dx + dy * dy + dz * dz;

    return distSq <= range * range;
  }

  /**
   * Calculates distance between two positions
   */
  static distance(pos1: Vec3, pos2: Vec3): number {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
