/**
 * WeaponSystem - Manages weapon firing, hit-scan, and projectile spawning
 */
import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import type { Vec3 } from '@engine/core/math';
/**
 * Configuration for WeaponSystem
 */
export interface WeaponSystemConfig {
    /** Enable automatic fire input handling */
    enableInputHandling?: boolean;
    /** Default projectile mesh/material prefab (for projectile weapons) */
    defaultProjectilePrefab?: {
        mesh?: string;
        material?: string;
        scale?: Vec3;
    };
}
/**
 * WeaponSystem manages weapon firing logic
 */
export declare class WeaponSystem {
    private readonly scene;
    private readonly raycaster;
    private currentTime;
    /** Scratch vectors reused to avoid allocations */
    private readonly scratchVec1;
    private readonly scratchVec2;
    private readonly scratchQuat;
    constructor(scene: Scene, _config?: WeaponSystemConfig);
    /**
     * Update weapon system (called each frame)
     * @param deltaTime - Time since last frame in seconds
     */
    update(deltaTime: number): void;
    /**
     * Fire a weapon from an entity
     * Supports both direct WeaponComponent and InventoryComponent
     * @param entity - Entity with WeaponComponent or InventoryComponent
     * @param direction - Fire direction (will be normalized, can be null to use camera/transform forward)
     * @param origin - Fire origin (optional, defaults to entity transform position)
     * @returns true if fire was successful
     */
    fire(entity: Entity, direction?: Vec3 | null, origin?: Vec3 | null): boolean;
    /**
     * Internal method to fire a specific weapon
     * @param entity - Entity firing the weapon
     * @param weapon - Weapon component to fire
     * @param direction - Fire direction
     * @param origin - Fire origin
     * @returns true if fire was successful
     */
    private fireWeapon;
    /**
     * Get attachment modifiers from entity (helper method)
     * @param entity - Entity that may have AttachmentComponent
     * @returns Attachment modifiers or undefined
     */
    private getAttachmentModifiers;
    /**
     * Start reloading a weapon
     * Supports both direct WeaponComponent and InventoryComponent
     * @param entity - Entity with WeaponComponent or InventoryComponent
     */
    reload(entity: Entity): void;
    /**
     * Fire hitscan weapon (instant raycast)
     * @param entity - Entity firing the weapon
     * @param weapon - Weapon component
     * @param origin - Fire origin
     * @param direction - Fire direction
     * @param damage - Effective damage (with attachments and ammo modifiers)
     * @param ammoEffects - Ammo type effects
     */
    private fireHitscan;
    /**
     * Fire projectile weapon (spawn projectile entity)
     * @param entity - Entity firing the weapon
     * @param weapon - Weapon component
     * @param origin - Fire origin
     * @param direction - Fire direction (already has spread applied)
     * @param damage - Effective damage
     * @param ammoEffects - Ammo type effects
     * @param attachmentModifiers - Attachment modifiers for projectile speed
     */
    private fireProjectile;
    /**
     * Apply spread (random angle deviation) to direction vector
     */
    private applySpread;
    /**
     * Get current time (for external use)
     */
    getCurrentTime(): number;
}
//# sourceMappingURL=WeaponSystem.d.ts.map