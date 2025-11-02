/**
 * InventorySystem - Manages weapon inventory and switching
 */
import type { Scene } from '../core/Scene';
import type { Entity } from '../core/Entity';
import { WeaponComponent } from '../components/WeaponComponent';
/**
 * Configuration for InventorySystem
 */
export interface InventorySystemConfig {
    /** Enable automatic weapon switching input handling */
    enableInputHandling?: boolean;
}
/**
 * InventorySystem manages weapon inventory and switching
 */
export declare class InventorySystem {
    private readonly scene;
    private currentTime;
    constructor(scene: Scene, _config?: InventorySystemConfig);
    /**
     * Update inventory system (called each frame)
     * @param deltaTime - Time since last frame in seconds
     */
    update(deltaTime: number): void;
    /**
     * Switch weapon for an entity
     * @param entity - Entity with InventoryComponent
     * @param weaponIndex - Index of weapon to switch to
     * @returns true if switch initiated successfully
     */
    switchWeapon(entity: Entity, weaponIndex: number): boolean;
    /**
     * Add weapon to inventory
     * @param entity - Entity with InventoryComponent
     * @param weapon - Weapon to add
     * @returns true if added successfully
     */
    addWeapon(entity: Entity, weapon: WeaponComponent): boolean;
    /**
     * Remove weapon from inventory
     * @param entity - Entity with InventoryComponent
     * @param weaponIndex - Index of weapon to remove
     * @returns Removed weapon, or undefined if index invalid
     */
    removeWeapon(entity: Entity, weaponIndex: number): WeaponComponent | undefined;
    /**
     * Get active weapon for entity (through inventory)
     * @param entity - Entity with InventoryComponent
     * @returns Active weapon, or undefined if none or inventory not found
     */
    getActiveWeapon(entity: Entity): WeaponComponent | undefined;
    /**
     * Check if entity can fire (has active weapon that can fire)
     * @param entity - Entity with InventoryComponent
     * @param currentTime - Current time in seconds
     * @returns true if can fire
     */
    canFire(entity: Entity, currentTime: number): boolean;
    /**
     * Get attachment modifiers from entity (helper method)
     * @param entity - Entity that may have AttachmentComponent
     * @returns Attachment modifiers or undefined
     */
    private getAttachmentModifiers;
    /**
     * Emit weapon switched event
     */
    private emitWeaponSwitched;
    /**
     * Emit inventory updated event
     */
    private emitInventoryUpdated;
    /**
     * Get current time (for external use)
     */
    getCurrentTime(): number;
}
//# sourceMappingURL=InventorySystem.d.ts.map