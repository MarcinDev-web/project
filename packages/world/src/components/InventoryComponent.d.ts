import { Component } from './Component.js';
import { WeaponComponent } from './WeaponComponent.js';
/**
 * Inventory component data
 */
export interface InventoryComponentData {
    /** Maximum number of weapons that can be carried */
    maxWeapons?: number;
    /** Initial weapons (will be cloned) */
    initialWeapons?: WeaponComponent[];
}
/**
 * InventoryComponent manages weapon inventory and active weapon selection
 */
export declare class InventoryComponent extends Component {
    static readonly type = "Inventory";
    /** Maximum number of weapons */
    maxWeapons: number;
    /** List of weapons in inventory */
    private weapons;
    /** Index of currently active weapon (-1 if none) */
    private activeWeaponIndex;
    /** Time when weapon switch started */
    private switchStartTime;
    /** Weapon switch duration in seconds */
    switchDuration: number;
    /** Whether currently switching weapons */
    get isSwitching(): boolean;
    constructor(data?: InventoryComponentData);
    getType(): string;
    /**
     * Add a weapon to inventory
     * @param weapon - Weapon to add (will be cloned)
     * @returns true if added successfully, false if inventory is full
     */
    addWeapon(weapon: WeaponComponent): boolean;
    /**
     * Remove weapon at index
     * @param index - Weapon index to remove
     * @returns Removed weapon, or undefined if index invalid
     */
    removeWeapon(index: number): WeaponComponent | undefined;
    /**
     * Switch to weapon at index
     * @param index - Weapon index to switch to
     * @param currentTime - Current time in seconds
     * @returns true if switch initiated successfully
     */
    switchWeapon(index: number, currentTime: number): boolean;
    /**
     * Update weapon switch state (called each frame)
     * @param currentTime - Current time in seconds
     * @returns true if switch just completed
     */
    updateSwitch(currentTime: number): boolean;
    /**
     * Get active weapon
     * @returns Active weapon, or undefined if none
     */
    getActiveWeapon(): WeaponComponent | undefined;
    /**
     * Get weapon at index
     * @param index - Weapon index
     * @returns Weapon, or undefined if index invalid
     */
    getWeapon(index: number): WeaponComponent | undefined;
    /**
     * Get all weapons
     * @returns Array of all weapons
     */
    getAllWeapons(): WeaponComponent[];
    /**
     * Get active weapon index
     * @returns Active weapon index (-1 if none)
     */
    getActiveWeaponIndex(): number;
    /**
     * Get number of weapons in inventory
     */
    getWeaponCount(): number;
    /**
     * Check if inventory is full
     */
    isFull(): boolean;
    /**
     * Clear all weapons
     */
    clear(): void;
    clone(): InventoryComponent;
    toJSON(): {
        maxWeapons: number;
        switchDuration: number;
        activeWeaponIndex: number;
        weapons: Array<ReturnType<WeaponComponent['toJSON']>>;
    };
    fromJSON(data: {
        maxWeapons?: number;
        switchDuration?: number;
        activeWeaponIndex?: number;
        weapons?: Array<Parameters<WeaponComponent['fromJSON']>[0]>;
    }): void;
}
//# sourceMappingURL=InventoryComponent.d.ts.map