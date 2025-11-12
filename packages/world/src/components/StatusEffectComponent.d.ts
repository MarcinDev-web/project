import { Component } from './Component.js';
/**
 * Status effect type
 */
export type StatusEffectType = 'damage_over_time' | 'heal_over_time' | 'speed_boost' | 'slow';
/**
 * Status effect instance
 */
export interface StatusEffect {
    /** Unique ID for this effect instance */
    id: string;
    /** Effect type */
    type: StatusEffectType;
    /** Effect start time (in game time) */
    startTime: number;
    /** Effect duration in seconds */
    duration: number;
    /** Effect strength (damage per second for DoT, heal per second for HoT, etc.) */
    strength: number;
    /** Optional source entity ID (for tracking) */
    sourceId?: string;
    /** Optional metadata (for extensibility) */
    metadata?: Record<string, unknown>;
}
/**
 * StatusEffectComponent manages active status effects on an entity
 */
export declare class StatusEffectComponent extends Component {
    static readonly type = "StatusEffect";
    /** Active status effects */
    private effects;
    /** Callback invoked when an effect is applied */
    onEffectApplied?: (effect: StatusEffect) => void;
    /** Callback invoked when an effect expires or is removed */
    onEffectRemoved?: (effect: StatusEffect) => void;
    getType(): string;
    /**
     * Apply a status effect to this entity
     * If an effect of the same type already exists, it will be replaced
     * @param effect - Effect to apply
     * @returns true if effect was applied, false if already exists
     */
    applyEffect(effect: StatusEffect): boolean;
    /**
     * Remove a status effect by ID
     * @param effectId - Effect ID to remove
     * @returns true if effect was removed, false if not found
     */
    removeEffect(effectId: string): boolean;
    /**
     * Get effect by ID
     * @param effectId - Effect ID
     * @returns Effect or undefined
     */
    getEffect(effectId: string): StatusEffect | undefined;
    /**
     * Get effect by type (returns first matching effect)
     * @param type - Effect type
     * @returns Effect or undefined
     */
    getEffectByType(type: StatusEffectType): StatusEffect | undefined;
    /**
     * Get all active effects
     * @returns Array of active effects
     */
    getAllEffects(): StatusEffect[];
    /**
     * Get all effects of a specific type
     * @param type - Effect type
     * @returns Array of matching effects
     */
    getEffectsByType(type: StatusEffectType): StatusEffect[];
    /**
     * Check if entity has a specific effect type
     * @param type - Effect type
     * @returns true if effect is active
     */
    hasEffect(type: StatusEffectType): boolean;
    /**
     * Clear all effects
     */
    clearAll(): void;
    /**
     * Get number of active effects
     */
    getEffectCount(): number;
    clone(): StatusEffectComponent;
    toJSON(): {
        effects: StatusEffect[];
    };
    fromJSON(data: {
        effects?: StatusEffect[];
    }): void;
}
//# sourceMappingURL=StatusEffectComponent.d.ts.map