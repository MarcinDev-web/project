/**
 * StatusEffectSystem - Manages status effects (DoT, HoT, buffs, debuffs)
 */
import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { type StatusEffectType } from '../components/StatusEffectComponent.js';
/**
 * Configuration for StatusEffectSystem
 */
export interface StatusEffectSystemConfig {
    /** Enable automatic cleanup of expired effects */
    enableAutoCleanup?: boolean;
    /** Damage tick interval in seconds (how often DoT applies damage) */
    damageTickInterval?: number;
}
/**
 * StatusEffectSystem manages status effect lifecycle and application
 */
export declare class StatusEffectSystem {
    private readonly scene;
    private readonly config;
    private currentTime;
    /** Track last tick time per effect (supports DoT/HoT) */
    private readonly lastEffectTick;
    constructor(scene: Scene, config?: StatusEffectSystemConfig);
    /**
     * Update status effect system (called each frame)
     * @param deltaTime - Time since last frame in seconds
     */
    update(deltaTime: number): void;
    /**
     * Apply a status effect to an entity
     * @param entity - Target entity
     * @param effect - Effect to apply
     * @param elapsed - Time elapsed since effect started
     */
    private applyEffect;
    /**
     * Apply damage over time effect
     * @param entity - Target entity
     * @param effect - DoT effect
     * @param elapsed - Time elapsed since effect started
     */
    private applyDamageOverTime;
    /**
     * Apply heal over time effect
     * @param entity - Target entity
     * @param effect - HoT effect
     * @param elapsed - Time elapsed since effect started
     */
    private applyHealOverTime;
    /**
     * Apply a status effect to an entity (public API)
     * @param entity - Target entity
     * @param type - Effect type
     * @param strength - Effect strength (damage/heal per second)
     * @param duration - Duration in seconds
     * @param sourceId - Optional source entity ID
     * @param metadata - Optional metadata
     * @returns Effect ID if applied, undefined if failed
     */
    applyStatusEffect(entity: Entity, type: StatusEffectType, strength: number, duration: number, sourceId?: string, metadata?: Record<string, unknown>): string | undefined;
    /**
     * Remove a status effect from an entity
     * @param entity - Target entity
     * @param effectId - Effect ID to remove
     * @returns true if effect was removed
     */
    removeStatusEffect(entity: Entity, effectId: string): boolean;
    /**
     * Remove all effects of a specific type from an entity
     * @param entity - Target entity
     * @param type - Effect type to remove
     * @returns Number of effects removed
     */
    removeEffectsByType(entity: Entity, type: StatusEffectType): number;
    /**
     * Get current time (for external use)
     */
    getCurrentTime(): number;
    /**
     * Cleanup resources (call when system is disposed)
     */
    dispose(): void;
}
//# sourceMappingURL=StatusEffectSystem.d.ts.map