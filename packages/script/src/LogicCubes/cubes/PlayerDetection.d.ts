/**
 * PlayerDetection - Helper for detecting player proximity in logic cubes.
 */
import type { Scene } from '@engine/world';
import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
/**
 * Provides player detection utilities for trigger cubes
 */
export declare class PlayerDetection {
    private scene;
    private playerEntity;
    private lastPlayerCheckTime;
    private playerCheckInterval;
    constructor(scene: Scene);
    /**
     * Sets the player entity explicitly
     */
    setPlayerEntity(entity: Entity | null): void;
    /**
     * Gets the player entity (if it exists)
     * Searches by name or tag if not set explicitly
     */
    getPlayerEntity(): Entity | null;
    /**
     * Gets player position
     */
    getPlayerPosition(): Vec3 | null;
    /**
     * Checks if player is within radius of a position
     */
    isPlayerNear(position: Vec3, radius: number): boolean;
    /**
     * Gets distance between player and position
     */
    getPlayerDistance(position: Vec3): number | null;
    /**
     * Gets distance between player and entity
     */
    getPlayerDistanceToEntity(entity: Entity): number | null;
    /**
     * Checks if player entered a radius since last check
     */
    checkPlayerEntered(position: Vec3, radius: number, wasInside: boolean): boolean;
    /**
     * Checks if player left a radius since last check
     */
    checkPlayerLeft(position: Vec3, radius: number, wasInside: boolean): boolean;
    /**
     * Gets all entities within radius of a position
     */
    getEntitiesInRadius(position: Vec3, radius: number): Entity[];
    /**
     * Gets closest entity to a position (within optional max distance)
     */
    getClosestEntity(position: Vec3, maxDistance?: number): Entity | null;
    /**
     * Checks if two positions are within range
     */
    static isInRange(pos1: Vec3, pos2: Vec3, range: number): boolean;
    /**
     * Calculates distance between two positions
     */
    static distance(pos1: Vec3, pos2: Vec3): number;
}
//# sourceMappingURL=PlayerDetection.d.ts.map