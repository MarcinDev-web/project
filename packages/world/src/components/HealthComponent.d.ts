import { Component } from './Component.js';
/**
 * HealthComponent manages entity health and damage/healing
 */
export declare class HealthComponent extends Component {
    static readonly type = "Health";
    /** Maximum health */
    maxHealth: number;
    /** Current health */
    private _currentHealth;
    /** Callback invoked when entity dies (health reaches 0) */
    onDeath?: () => void;
    /** Callback invoked when health changes (current, max) */
    onHealthChanged?: (current: number, max: number) => void;
    /**
     * Get current health
     */
    get currentHealth(): number;
    /**
     * Set current health (clamped to [0, maxHealth])
     */
    set currentHealth(value: number);
    getType(): string;
    /**
     * Apply damage to this entity
     * @param amount - Amount of damage to apply
     * @returns Actual damage dealt (may be less if health would go below 0)
     */
    takeDamage(amount: number): number;
    /**
     * Heal this entity
     * @param amount - Amount of health to restore
     * @returns Actual healing done (may be less if health would exceed maxHealth)
     */
    heal(amount: number): number;
    /**
     * Check if entity is alive
     */
    isAlive(): boolean;
    /**
     * Get health as percentage (0-1)
     */
    getHealthPercent(): number;
    /**
     * Reset health to maximum
     */
    reset(): void;
    clone(): HealthComponent;
    toJSON(): {
        maxHealth: number;
        currentHealth: number;
    };
    fromJSON(data: {
        maxHealth?: number;
        currentHealth?: number;
    }): void;
}
//# sourceMappingURL=HealthComponent.d.ts.map