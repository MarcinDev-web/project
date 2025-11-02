/**
 * MovingPlatformSystem - Handles moving platform logic
 */

import type { Scene } from '../core/Scene';
import type { Entity } from '../core/Entity';
import { MovingPlatformComponent } from '../components/MovingPlatformComponent';
import type { Vec3 } from '@engine/core';
import { lengthVec3, subVec3, normalizeVec3, scaleVec3, addVec3 } from '@engine/core/math';

/**
 * System that updates moving platforms
 */
export class MovingPlatformSystem {
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Update all moving platforms (call each frame)
   */
  update(deltaTime: number): void {
    for (const entity of this.scene.getAllEntities()) {
      const platform = entity.getComponent(MovingPlatformComponent);
      if (!platform || platform.waypoints.length < 2) continue;

      this.updatePlatform(entity, platform, deltaTime);
    }
  }

  private updatePlatform(
    entity: Entity,
    platform: MovingPlatformComponent,
    deltaTime: number
  ): void {
    const currentWaypoint = platform.waypoints[platform.currentWaypointIndex];
    if (!currentWaypoint) return;

    const transform = entity.transform;
    const currentPos: Vec3 = [transform.position[0], transform.position[1], transform.position[2]];

    // Check if reached waypoint
    const distance = lengthVec3(subVec3(currentWaypoint, currentPos));
    const moveDistance = platform.speed * deltaTime;

    if (distance <= moveDistance) {
      // Reached waypoint, move to next
      transform.position = [...currentWaypoint] as Vec3;

      // Advance to next waypoint
      platform.currentWaypointIndex++;
      if (platform.currentWaypointIndex >= platform.waypoints.length) {
        if (platform.loop) {
          platform.currentWaypointIndex = 0;
        } else {
          // Reverse direction
          platform.currentWaypointIndex = platform.waypoints.length - 2;
        }
      }
    } else {
      // Move towards waypoint
      const direction = normalizeVec3(subVec3(currentWaypoint, currentPos));
      const move = scaleVec3(direction, moveDistance);
      const newPos = addVec3(currentPos, move);
      transform.position = [...newPos] as Vec3;
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // No cleanup needed
  }
}

