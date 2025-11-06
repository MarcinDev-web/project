/**
 * NpcBehaviorSystem - Manages NPC AI behaviors and orders
 *
 * Handles:
 * - Idle behavior (stand still)
 * - Patrol behavior (move between waypoints)
 * - Shoot player behavior (aim and fire at player)
 * - Follow player behavior (move towards player)
 * - Guard position behavior (patrol around a position)
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { NpcComponent } from '../components/NpcComponent.js';
import { CharacterController } from '../components/CharacterController.js';
import { WeaponComponent } from '../components/WeaponComponent.js';
import { RuntimePlayerTag } from '../components/RuntimePlayerTag.js';
import { WeaponSystem } from './WeaponSystem.js';
import type { Vec3 } from '@engine/core/math';
import {
  normalizeVec3Out,
  subtractVec3Out,
  distanceVec3,
  dotVec3,
  quatFromAxisAngleOut,
  type Quat,
} from '@engine/core/math';

/**
 * NpcBehaviorSystem manages NPC AI behaviors
 */
export class NpcBehaviorSystem {
  private readonly scene: Scene;
  private readonly weaponSystem: WeaponSystem;
  private currentTime: number = 0;

  /** Scratch vectors reused to avoid allocations */
  private readonly scratchVec1: Vec3 = [0, 0, 0];
  private readonly scratchVec2: Vec3 = [0, 0, 0];
  private readonly scratchVec3: Vec3 = [0, 0, 0];
  private readonly scratchQuat: Quat = [0, 0, 0, 1];

  /** Patrol state per NPC */
  private patrolState = new Map<
    Entity,
    {
      currentWaypointIndex: number;
      lastWaypointTime: number;
    }
  >();

  /** Last fire time per NPC (for shoot-player behavior) */
  private lastFireTime = new Map<Entity, number>();

  constructor(scene: Scene, weaponSystem: WeaponSystem) {
    this.scene = scene;
    this.weaponSystem = weaponSystem;
  }

  /**
   * Update all NPCs (called each frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!(deltaTime > 0)) return;

    this.currentTime += deltaTime;

    const npcEntities = this.scene.queryEntities(NpcComponent);
    const playerEntity = this.findPlayerEntity();

    for (const npcEntity of npcEntities) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const npc = npcEntity.getComponent(NpcComponent);
      if (!npc) continue;

      // Execute behavior based on type
      switch (npc.behavior) {
        case 'idle':
          this.handleIdle(npcEntity, npc);
          break;
        case 'patrol':
          this.handlePatrol(npcEntity, npc, deltaTime);
          break;
        case 'shoot-player':
          this.handleShootPlayer(npcEntity, npc, playerEntity, deltaTime);
          break;
        case 'follow-player':
          this.handleFollowPlayer(npcEntity, npc, playerEntity, deltaTime);
          break;
        case 'guard-position':
          this.handleGuardPosition(npcEntity, npc, deltaTime);
          break;
      }
    }

    // Cleanup state for removed entities
    this.cleanupRemovedEntities(npcEntities);
  }

  /**
   * Find the player entity (has RuntimePlayerTag)
   */
  private findPlayerEntity(): Entity | null {
    const playerEntities = this.scene.queryEntities(RuntimePlayerTag);
    return playerEntities.length > 0 ? playerEntities[0]! : null;
  }

  /**
   * Handle idle behavior (stand still)
   */
  private handleIdle(entity: Entity, npc: NpcComponent): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const controller = entity.getComponent(CharacterController);
    if (!controller) return;

    // Set zero movement input
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    controller.setInput({
      moveDirection: [0, 0, 0],
      sprint: false,
      jump: false,
    });
  }

  /**
   * Handle patrol behavior (move between waypoints)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handlePatrol(entity: Entity, npc: NpcComponent, deltaTime: number): void {
    if (npc.patrolWaypoints.length === 0) {
      // No waypoints, fall back to idle
      this.handleIdle(entity, npc);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const controller = entity.getComponent(CharacterController);
    if (!controller) return;

    // Initialize patrol state if needed
    if (!this.patrolState.has(entity)) {
      this.patrolState.set(entity, {
        currentWaypointIndex: 0,
        lastWaypointTime: this.currentTime,
      });
    }

    const state = this.patrolState.get(entity)!;
    const currentWaypoint = npc.patrolWaypoints[state.currentWaypointIndex]!;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const npcPos = entity.transform.position;

    // Calculate direction to waypoint
    subtractVec3Out(this.scratchVec1, currentWaypoint, npcPos);
    const distance = distanceVec3(npcPos, currentWaypoint);

    // Check if reached waypoint (within 0.5 units)
    if (distance < 0.5) {
      // Move to next waypoint
      state.currentWaypointIndex = (state.currentWaypointIndex + 1) % npc.patrolWaypoints.length;
      state.lastWaypointTime = this.currentTime;
    } else {
      // Move towards waypoint
      normalizeVec3Out(this.scratchVec1, this.scratchVec1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      controller.setInput({
        moveDirection: this.scratchVec1,
        sprint: false,
        jump: false,
      });

      // Rotate towards waypoint
      this.rotateTowardsDirection(entity, this.scratchVec1);
    }
  }

  /**
   * Handle shoot-player behavior (aim and fire at player)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleShootPlayer(
    entity: Entity,
    npc: NpcComponent,
    playerEntity: Entity | null,
    deltaTime: number
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const controller = entity.getComponent(CharacterController);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const weapon = entity.getComponent(WeaponComponent);

    if (!controller) return;

    if (!playerEntity) {
      // No player found, fall back to idle
      this.handleIdle(entity, npc);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const npcPos = entity.transform.position;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const playerPos = playerEntity.transform.position;

    // Calculate distance to player
    subtractVec3Out(this.scratchVec1, playerPos, npcPos);
    const distance = distanceVec3(npcPos, playerPos);

    // Check if player is in detection range
    if (distance > npc.detectionRange) {
      // Player too far, fall back to idle
      this.handleIdle(entity, npc);
      return;
    }

    // Rotate towards player
    normalizeVec3Out(this.scratchVec1, this.scratchVec1);
    this.rotateTowardsDirection(entity, this.scratchVec1);

    // Stop movement when shooting
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    controller.setInput({
      moveDirection: [0, 0, 0],
      sprint: false,
      jump: false,
    });

    // Fire weapon if available
    if (weapon) {
      const lastFire = this.lastFireTime.get(entity) ?? -Infinity;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const fireRate = weapon.fireRate;
      const timeBetweenShots = 1.0 / fireRate;

      if (this.currentTime - lastFire >= timeBetweenShots) {
        // Fire in direction of player
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.weaponSystem.fire(entity, this.scratchVec1, null);
        this.lastFireTime.set(entity, this.currentTime);
      }
    }
  }

  /**
   * Handle follow-player behavior (move towards player)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleFollowPlayer(
    entity: Entity,
    npc: NpcComponent,
    playerEntity: Entity | null,
    deltaTime: number
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const controller = entity.getComponent(CharacterController);
    if (!controller) return;

    if (!playerEntity) {
      // No player found, fall back to idle
      this.handleIdle(entity, npc);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const npcPos = entity.transform.position;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const playerPos = playerEntity.transform.position;

    // Calculate direction to player
    subtractVec3Out(this.scratchVec1, playerPos, npcPos);
    const distance = distanceVec3(npcPos, playerPos);

    // Stop if too close (within 2 units)
    if (distance < 2.0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      controller.setInput({
        moveDirection: [0, 0, 0],
        sprint: false,
        jump: false,
      });
      return;
    }

    // Move towards player
    normalizeVec3Out(this.scratchVec1, this.scratchVec1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    controller.setInput({
      moveDirection: this.scratchVec1,
      sprint: false,
      jump: false,
    });

    // Rotate towards player
    this.rotateTowardsDirection(entity, this.scratchVec1);
  }

  /**
   * Handle guard-position behavior (patrol around a position)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleGuardPosition(entity: Entity, npc: NpcComponent, deltaTime: number): void {
    if (!npc.guardPosition) {
      // No guard position, fall back to idle
      this.handleIdle(entity, npc);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const controller = entity.getComponent(CharacterController);
    if (!controller) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const npcPos = entity.transform.position;
    const guardPos = npc.guardPosition;

    // Calculate distance from guard position
    subtractVec3Out(this.scratchVec1, guardPos, npcPos);
    const distance = distanceVec3(npcPos, guardPos);

    // If too far from guard position, move back
    if (distance > npc.guardRadius) {
      normalizeVec3Out(this.scratchVec1, this.scratchVec1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      controller.setInput({
        moveDirection: this.scratchVec1,
        sprint: false,
        jump: false,
      });
      this.rotateTowardsDirection(entity, this.scratchVec1);
    } else {
      // Within guard radius, stand still and look around
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      controller.setInput({
        moveDirection: [0, 0, 0],
        sprint: false,
        jump: false,
      });
    }
  }

  /**
   * Rotate entity towards a direction
   */
  private rotateTowardsDirection(entity: Entity, direction: Vec3): void {
    // Calculate rotation to face direction (around Y axis)
    const forward: Vec3 = [0, 0, 1]; // Default forward
    const dot = dotVec3(forward, direction);
    const cross: Vec3 = [
      forward[1] * direction[2] - forward[2] * direction[1],
      forward[2] * direction[0] - forward[0] * direction[2],
      forward[0] * direction[1] - forward[1] * direction[0],
    ];

    // Calculate angle around Y axis
    const angle = Math.atan2(cross[1], dot);

    // Set rotation
    quatFromAxisAngleOut(this.scratchQuat, [0, 1, 0], angle);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    entity.transform.rotation[0] = this.scratchQuat[0]!;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    entity.transform.rotation[1] = this.scratchQuat[1]!;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    entity.transform.rotation[2] = this.scratchQuat[2]!;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    entity.transform.rotation[3] = this.scratchQuat[3]!;
  }

  /**
   * Cleanup state for removed entities
   */
  private cleanupRemovedEntities(activeEntities: Entity[]): void {
    const activeSet = new Set(activeEntities);

    // Cleanup patrol state
    for (const entity of this.patrolState.keys()) {
      if (!activeSet.has(entity)) {
        this.patrolState.delete(entity);
      }
    }

    // Cleanup fire time
    for (const entity of this.lastFireTime.keys()) {
      if (!activeSet.has(entity)) {
        this.lastFireTime.delete(entity);
      }
    }
  }
}
