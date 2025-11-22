/**
 * ParkourSystem - Handles interactive parkour blocks (launch pads, bounce pads, etc.)
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { LaunchPadComponent } from '../components/LaunchPadComponent.js';
import { BouncePadComponent } from '../components/BouncePadComponent.js';
import { SpeedZoneComponent } from '../components/SpeedZoneComponent.js';
import { CharacterController } from '../components/CharacterController.js';
import type { Vec3 } from '@engine/core/math';
import { lengthVec3, normalizeVec3, scaleVec3, addVec3 } from '@engine/core/math';

interface ActiveLaunchPad {
  entity: Entity;
  lastActivation: number;
}

/**
 * System that handles parkour mechanics
 */
export class ParkourSystem {
  private readonly scene: Scene;
  private readonly activeLaunchPads = new Map<Entity, ActiveLaunchPad>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Update parkour systems (call each frame)
   */
  update(deltaTime: number): void {
    // Handle launch pads
    this.updateLaunchPads(deltaTime);

    // Check for launch pad interactions
    // This assumes we want to check all players against all launch pads
    // O(Players * Pads) complexity, usually fine
    const players = this.scene.queryEntities(CharacterController);
    const pads = this.scene.queryEntities(LaunchPadComponent);
    
    for (const player of players) {
      // Use world position
      const playerPos = player.transform.position;
      for (const pad of pads) {
        this.handleLaunchPad(player, pad, playerPos);
      }
    }

    // Handle bounce pads (handled in collision callbacks)
    // Handle speed zones (handled in collision callbacks)
    // Handle moving platforms (handled by MovingPlatformSystem)
  }

  /**
   * Check and handle launch pad activation
   */
  handleLaunchPad(playerEntity: Entity, launchPadEntity: Entity, playerPos: Vec3): void {
    const launchPad = launchPadEntity.getComponent(LaunchPadComponent);
    if (!launchPad) return;

    const padPos = launchPadEntity.transform.position;
    const distance = lengthVec3([
      playerPos[0] - padPos[0],
      playerPos[1] - padPos[1],
      playerPos[2] - padPos[2],
    ]);

    if (distance > launchPad.activationRadius) return;

    // Check cooldown
    const active = this.activeLaunchPads.get(launchPadEntity);
    const now = Date.now();
    if (active && now - active.lastActivation < launchPad.cooldownMs) {
      return;
    }

    // Apply launch force
    const controller = playerEntity.getComponent(CharacterController);
    if (controller) {
      const direction = normalizeVec3([...launchPad.direction] as Vec3);
      const force = scaleVec3(direction, launchPad.force);
      // Apply velocity boost (add to existing velocity)
      controller.velocity = addVec3(controller.velocity, force);
    }

    // Record activation
    this.activeLaunchPads.set(launchPadEntity, {
      entity: launchPadEntity,
      lastActivation: now,
    });
  }

  /**
   * Handle bounce pad (called from collision detection)
   */
  handleBouncePad(playerEntity: Entity, bouncePadEntity: Entity, velocity: Vec3): void {
    const bouncePad = bouncePadEntity.getComponent(BouncePadComponent);
    if (!bouncePad) return;

    // Check if player is moving downward fast enough
    if (velocity[1] > -bouncePad.minBounceVelocity) return;

    const controller = playerEntity.getComponent(CharacterController);
    if (controller) {
      // Apply upward bounce force
      controller.velocity = [velocity[0], bouncePad.bounceForce, velocity[2]];
    }
  }

  /**
   * Handle speed zone (called when player enters)
   */
  handleSpeedZone(playerEntity: Entity, speedZoneEntity: Entity): void {
    const speedZone = speedZoneEntity.getComponent(SpeedZoneComponent);
    if (!speedZone) return;

    const controller = playerEntity.getComponent(CharacterController);
    if (controller) {
      // Apply speed multiplier using dedicated method
      controller.setSpeedMultiplier(speedZone.speedMultiplier);

      // Apply directional boost if specified
      if (speedZone.direction) {
        const direction = normalizeVec3([...speedZone.direction] as Vec3);
        const boost = scaleVec3(direction, speedZone.boostForce);
        controller.velocity = addVec3(controller.velocity, boost);
      }
    }
  }

  /**
   * Remove speed zone effect (called when player exits)
   */
  removeSpeedZone(playerEntity: Entity): void {
    const controller = playerEntity.getComponent(CharacterController);
    if (controller) {
      // Restore original moveSpeed using dedicated method
      controller.resetSpeedMultiplier();
    }
  }

  private updateLaunchPads(_deltaTime: number): void {
    // Clean up old activation records (optional, for memory management)
    // Could remove entries older than X seconds
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.activeLaunchPads.clear();
  }
}
