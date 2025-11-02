import { Component } from './Component';
import type { AmmoType } from '../types/weapon';
/**
 * Ammo component data
 */
export interface AmmoComponentData {
    /** Initial ammo counts per type */
    ammoCounts?: Record<AmmoType, number>;
}
/**
 * AmmoComponent manages ammunition inventory for different ammo types
 */
export declare class AmmoComponent extends Component {
    static readonly type = "Ammo";
    /** Map of ammo type to count */
    private ammoCounts;
    constructor(data?: AmmoComponentData);
    getType(): string;
    /**
     * Get ammo count for a specific type
     * @param type - Ammo type
     * @returns Ammo count (0 if not set)
     */
    getAmmoCount(type: AmmoType): number;
    /**
     * Add ammo of a specific type
     * @param type - Ammo type
     * @param amount - Amount to add
     * @returns New total count
     */
    addAmmo(type: AmmoType, amount: number): number;
    /**
     * Consume ammo of a specific type
     * @param type - Ammo type
     * @param amount - Amount to consume
     * @returns Actual amount consumed (may be less if insufficient ammo)
     */
    consumeAmmo(type: AmmoType, amount: number): number;
    /**
     * Set ammo count for a specific type
     * @param type - Ammo type
     * @param count - New count
     */
    setAmmoCount(type: AmmoType, count: number): void;
    /**
     * Get total ammo count across all types
     * @returns Total ammo count
     */
    getTotalAmmoCount(): number;
    /**
     * Get all ammo types with non-zero counts
     * @returns Array of ammo types that have ammo
     */
    getAvailableTypes(): AmmoType[];
    /**
     * Check if has ammo of a specific type
     * @param type - Ammo type
     */
    hasAmmo(type: AmmoType): boolean;
    /**
     * Clear all ammo
     */
    clear(): void;
    clone(): AmmoComponent;
    toJSON(): {
        ammoCounts: Record<string, number>;
    };
    fromJSON(data: {
        ammoCounts?: Record<string, number>;
    }): void;
}
//# sourceMappingURL=AmmoComponent.d.ts.map