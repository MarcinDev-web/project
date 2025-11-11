/**
 * WeaponPickupSystem - Handles weapon pickup from ground and spawn point weapon giving
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { WeaponPickupComponent } from '../components/WeaponPickupComponent.js';
import { WeaponComponent } from '../components/WeaponComponent.js';
import { InventoryComponent } from '../components/InventoryComponent.js';
import { SpawnPointComponent } from '../components/SpawnPointComponent.js';
import { setupPvPLoadout, setupWeaponEntity } from '../utils/weaponHelpers.js';
import type { Vec3 } from '@engine/core/math';
import { distanceVec3 } from '@engine/core/math';

/**
 * Configuration for WeaponPickupSystem
 */
export interface WeaponPickupSystemConfig {
  /** Pickup distance (default: 2.0) */
  pickupDistance?: number;
  /** Enable automatic weapon giving on spawn (default: true) */
  enableSpawnWeapons?: boolean;
}

/**
 * WeaponPickupSystem manages weapon pickup and spawn point weapon giving
 */
export class WeaponPickupSystem {
  private readonly scene: Scene;
  private readonly pickupDistance: number;
  private readonly enableSpawnWeapons: boolean;
  private currentTime: number = 0;

  /** Scratch vector for distance calculations */
  private readonly scratchVec1: Vec3 = [0, 0, 0];
  private readonly scratchVec2: Vec3 = [0, 0, 0];

  constructor(scene: Scene, config?: WeaponPickupSystemConfig) {
    this.scene = scene;
    this.pickupDistance = config?.pickupDistance ?? 2.0;
    this.enableSpawnWeapons = config?.enableSpawnWeapons ?? true;
  }

  /**
   * Update weapon pickup system (called each frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!(deltaTime > 0)) return;

    this.currentTime += deltaTime;

    // Update weapon pickups (respawn logic)
    const pickups = this.scene.queryEntities(WeaponPickupComponent);
    for (const pickupEntity of pickups) {
      const pickup = pickupEntity.getComponent(WeaponPickupComponent);
      if (!pickup) continue;

      // Check if weapon should respawn
      if (!pickup.canBePickedUp && pickup.autoRespawn) {
        const timeSincePickup = this.currentTime - pickup.pickedUpAt;
        if (timeSincePickup >= pickup.respawnTime) {
          this.respawnWeapon(pickupEntity, pickup);
        }
      }
    }
  }

  /**
   * Give weapon to player when they spawn at a spawn point
   * Call this when a player spawns at a spawn point
   * @param playerEntity - Player entity that just spawned
   * @param spawnPointEntity - Spawn point entity
   */
  giveWeaponOnSpawn(playerEntity: Entity, spawnPointEntity: Entity): void {
    if (!this.enableSpawnWeapons) return;

    const spawnPoint = spawnPointEntity.getComponent(SpawnPointComponent);
    if (!spawnPoint || !spawnPoint.giveWeaponOnSpawn) return;

    // Check if player already has weapon/inventory
    const existingInventory = playerEntity.getComponent(InventoryComponent);
    const existingWeapon = playerEntity.getComponent(WeaponComponent);
    if (existingInventory || existingWeapon) {
      // Player already has weapon, don't override
      return;
    }

    // Give PvP loadout if requested
    if (spawnPoint.givePvPLoadout) {
      setupPvPLoadout(playerEntity);
      this.scene.events.emit('weapon:spawn:given', {
        player: playerEntity,
        spawnPoint: spawnPointEntity,
        type: 'pvp_loadout',
      });
      return;
    }

    // Give single weapon if preset specified
    if (spawnPoint.weaponPreset) {
      setupWeaponEntity(playerEntity, spawnPoint.weaponPreset);
      this.scene.events.emit('weapon:spawn:given', {
        player: playerEntity,
        spawnPoint: spawnPointEntity,
        type: 'weapon',
        weaponPreset: spawnPoint.weaponPreset,
      });
    }
  }

  /**
   * Try to pickup weapon from ground
   * @param playerEntity - Player entity trying to pickup
   * @param weaponEntity - Weapon entity on ground
   * @returns true if pickup was successful
   */
  pickupWeapon(playerEntity: Entity, weaponEntity: Entity): boolean {
    const pickup = weaponEntity.getComponent(WeaponPickupComponent);
    if (!pickup || !pickup.canBePickedUp) {
      return false;
    }

    // Check distance
    const playerPos = playerEntity.transform.getWorldPosition();
    const weaponPos = weaponEntity.transform.getWorldPosition();
    
    this.scratchVec1[0] = playerPos[0];
    this.scratchVec1[1] = playerPos[1];
    this.scratchVec1[2] = playerPos[2];
    
    this.scratchVec2[0] = weaponPos[0];
    this.scratchVec2[1] = weaponPos[1];
    this.scratchVec2[2] = weaponPos[2];

    const dist = distanceVec3(this.scratchVec1, this.scratchVec2);
    if (dist > this.pickupDistance) {
      return false;
    }

    // Get weapon component (either existing or create from preset)
    let weapon: WeaponComponent | null = weaponEntity.getComponent(WeaponComponent) ?? null;
    
    if (!weapon && pickup.weaponPreset) {
      // Create weapon from preset
      weapon = setupWeaponEntity(playerEntity, pickup.weaponPreset);
    } else if (weapon) {
      // Transfer existing weapon to player
      weaponEntity.removeComponent(WeaponComponent);
      playerEntity.addComponent(weapon);
    } else {
      // No weapon to pickup
      return false;
    }

    // Check if player has inventory
    let inventory = playerEntity.getComponent(InventoryComponent);
    if (inventory) {
      // Add to inventory
      inventory.addWeapon(weapon);
    } else {
      // Player doesn't have inventory, just add weapon directly
      // (weapon is already added above)
    }

    // Handle pickup (hide weapon, start respawn timer if needed)
    if (pickup.autoRespawn) {
      pickup.canBePickedUp = false;
      pickup.pickedUpAt = this.currentTime;
      // Hide weapon entity (you might want to add a MeshComponent visibility toggle)
      weaponEntity.transform.scale = [0, 0, 0];
    } else {
      // Remove weapon entity completely
      this.scene.removeEntity(weaponEntity);
    }

    // Emit pickup event
    this.scene.events.emit('weapon:pickup', {
      player: playerEntity,
      weapon: weaponEntity,
      weaponPreset: pickup.weaponPreset,
    });

    return true;
  }

  /**
   * Try to pickup nearest weapon within pickup distance
   * @param playerEntity - Player entity
   * @returns true if weapon was picked up
   */
  pickupNearestWeapon(playerEntity: Entity): boolean {
    const pickups = this.scene.queryEntities(WeaponPickupComponent);
    const playerPos = playerEntity.transform.getWorldPosition();
    
    this.scratchVec1[0] = playerPos[0];
    this.scratchVec1[1] = playerPos[1];
    this.scratchVec1[2] = playerPos[2];

    let nearestEntity: Entity | null = null;
    let nearestDist = this.pickupDistance;

    for (const pickupEntity of pickups) {
      const pickup = pickupEntity.getComponent(WeaponPickupComponent);
      if (!pickup || !pickup.canBePickedUp) continue;

      const weaponPos = pickupEntity.transform.getWorldPosition();
      this.scratchVec2[0] = weaponPos[0];
      this.scratchVec2[1] = weaponPos[1];
      this.scratchVec2[2] = weaponPos[2];

      const dist = distanceVec3(this.scratchVec1, this.scratchVec2);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEntity = pickupEntity;
      }
    }

    if (nearestEntity) {
      return this.pickupWeapon(playerEntity, nearestEntity);
    }

    return false;
  }

  /**
   * Respawn a weapon pickup
   * @param weaponEntity - Weapon entity to respawn
   * @param pickup - WeaponPickupComponent
   */
  private respawnWeapon(weaponEntity: Entity, pickup: WeaponPickupComponent): void {
    pickup.canBePickedUp = true;
    pickup.pickedUpAt = -Infinity;
    
    // Restore weapon entity visibility
    weaponEntity.transform.scale = [1, 1, 1];

    // Recreate weapon if needed
    if (pickup.weaponPreset && !weaponEntity.getComponent(WeaponComponent)) {
      setupWeaponEntity(weaponEntity, pickup.weaponPreset);
    }

    this.scene.events.emit('weapon:respawn', {
      weapon: weaponEntity,
      weaponPreset: pickup.weaponPreset,
    });
  }

  /**
   * Get current time (for external use)
   */
  getCurrentTime(): number {
    return this.currentTime;
  }
}

