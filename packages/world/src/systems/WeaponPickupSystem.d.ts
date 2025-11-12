/**
 * WeaponPickupSystem - Handles weapon pickup from ground and spawn point weapon giving
 */
import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
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
export declare class WeaponPickupSystem {
    private readonly scene;
    private readonly pickupDistance;
    private readonly enableSpawnWeapons;
    private currentTime;
    /** Scratch vector for distance calculations */
    private readonly scratchVec1;
    private readonly scratchVec2;
    constructor(scene: Scene, config?: WeaponPickupSystemConfig);
    /**
     * Update weapon pickup system (called each frame)
     * @param deltaTime - Time since last frame in seconds
     */
    update(deltaTime: number): void;
    /**
     * Give weapon to player when they spawn at a spawn point
     * Call this when a player spawns at a spawn point
     * @param playerEntity - Player entity that just spawned
     * @param spawnPointEntity - Spawn point entity
     */
    giveWeaponOnSpawn(playerEntity: Entity, spawnPointEntity: Entity): void;
    /**
     * Try to pickup weapon from ground
     * @param playerEntity - Player entity trying to pickup
     * @param weaponEntity - Weapon entity on ground
     * @returns true if pickup was successful
     */
    pickupWeapon(playerEntity: Entity, weaponEntity: Entity): boolean;
    /**
     * Try to pickup nearest weapon within pickup distance
     * @param playerEntity - Player entity
     * @returns true if weapon was picked up
     */
    pickupNearestWeapon(playerEntity: Entity): boolean;
    /**
     * Respawn a weapon pickup
     * @param weaponEntity - Weapon entity to respawn
     * @param pickup - WeaponPickupComponent
     */
    private respawnWeapon;
    /**
     * Get current time (for external use)
     */
    getCurrentTime(): number;
}
//# sourceMappingURL=WeaponPickupSystem.d.ts.map