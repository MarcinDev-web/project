/**
 * StatusEffectSystem - Manages status effects (DoT, HoT, buffs, debuffs)
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { StatusEffectComponent, type StatusEffect, type StatusEffectType } from '../components/StatusEffectComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';

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
export class StatusEffectSystem {
  private readonly scene: Scene;
  private readonly config: StatusEffectSystemConfig;
  private currentTime: number = 0;

  /** Track last damage tick time per entity (for DoT) */
  private readonly lastDamageTick: Map<string, number> = new Map();

  constructor(scene: Scene, config?: StatusEffectSystemConfig) {
    this.scene = scene;
    this.config = {
      enableAutoCleanup: config?.enableAutoCleanup ?? true,
      damageTickInterval: config?.damageTickInterval ?? 0.5, // Default: tick every 0.5 seconds
    };
  }

  /**
   * Update status effect system (called each frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!(deltaTime > 0)) return;

    this.currentTime += deltaTime;

    const entities = this.scene.queryEntities(StatusEffectComponent);

    for (const entity of entities) {
      const statusEffect = entity.getComponent(StatusEffectComponent);
      if (!statusEffect) continue;

      // Process all active effects
      const effects = statusEffect.getAllEffects();
      const effectsToRemove: string[] = [];

      for (const effect of effects) {
        // Check if effect has expired
        const elapsed = this.currentTime - effect.startTime;
        if (elapsed >= effect.duration) {
          effectsToRemove.push(effect.id);
          continue;
        }

        // Apply effect based on type
        this.applyEffect(entity, effect, elapsed);
      }

      // Remove expired effects
      if (this.config.enableAutoCleanup) {
        for (const effectId of effectsToRemove) {
          statusEffect.removeEffect(effectId);
        }
      }
    }
  }

  /**
   * Apply a status effect to an entity
   * @param entity - Target entity
   * @param effect - Effect to apply
   * @param elapsed - Time elapsed since effect started
   */
  private applyEffect(entity: Entity, effect: StatusEffect, elapsed: number): void {
    switch (effect.type) {
      case 'damage_over_time':
        this.applyDamageOverTime(entity, effect, elapsed);
        break;
      case 'heal_over_time':
        this.applyHealOverTime(entity, effect, elapsed);
        break;
      // Future effects can be added here:
      // case 'speed_boost':
      // case 'slow':
      //   this.applyMovementModifier(entity, effect);
      //   break;
      default:
        // Unknown effect type - ignore
        break;
    }
  }

  /**
   * Apply damage over time effect
   * @param entity - Target entity
   * @param effect - DoT effect
   * @param elapsed - Time elapsed since effect started
   */
  private applyDamageOverTime(entity: Entity, effect: StatusEffect, elapsed: number): void {
    const health = entity.getComponent(HealthComponent);
    if (!health || !health.isAlive()) return;

    const entityId = entity.id;
    const lastTick = this.lastDamageTick.get(entityId) ?? effect.startTime;
    const timeSinceLastTick = this.currentTime - lastTick;

    // Apply damage at intervals (not every frame for performance)
    if (timeSinceLastTick >= this.config.damageTickInterval!) {
      const damageThisTick = effect.strength * timeSinceLastTick;
      health.takeDamage(damageThisTick);
      this.lastDamageTick.set(entityId, this.currentTime);

      // Emit DoT tick event
      this.scene.events.emit('status_effect:dot_tick', {
        entity,
        effect,
        damage: damageThisTick,
        elapsed,
      });
    }
  }

  /**
   * Apply heal over time effect
   * @param entity - Target entity
   * @param effect - HoT effect
   * @param elapsed - Time elapsed since effect started
   */
  private applyHealOverTime(entity: Entity, effect: StatusEffect, elapsed: number): void {
    const health = entity.getComponent(HealthComponent);
    if (!health || !health.isAlive()) return;

    const entityId = entity.id;
    const lastTick = this.lastDamageTick.get(entityId) ?? effect.startTime;
    const timeSinceLastTick = this.currentTime - lastTick;

    // Apply healing at intervals
    if (timeSinceLastTick >= this.config.damageTickInterval!) {
      const healThisTick = effect.strength * timeSinceLastTick;
      health.heal(healThisTick);
      this.lastDamageTick.set(entityId, this.currentTime);

      // Emit HoT tick event
      this.scene.events.emit('status_effect:hot_tick', {
        entity,
        effect,
        healing: healThisTick,
        elapsed,
      });
    }
  }

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
  applyStatusEffect(
    entity: Entity,
    type: StatusEffectType,
    strength: number,
    duration: number,
    sourceId?: string,
    metadata?: Record<string, unknown>
  ): string | undefined {
    // Get or create StatusEffectComponent
    let statusEffect = entity.getComponent(StatusEffectComponent);
    if (!statusEffect) {
      statusEffect = new StatusEffectComponent();
      entity.addComponent(statusEffect);
    }

    // Generate unique effect ID
    const effectId = `${type}_${entity.id}_${this.currentTime}_${Math.random().toString(36).substring(2, 9)}`;

    const effect: StatusEffect = {
      id: effectId,
      type,
      startTime: this.currentTime,
      duration,
      strength,
      sourceId,
      metadata,
    };

    const applied = statusEffect.applyEffect(effect);
    if (!applied) return undefined;

    // Initialize damage tick tracking
    this.lastDamageTick.set(entity.id, this.currentTime);

    // Emit effect applied event
    this.scene.events.emit('status_effect:applied', {
      entity,
      effect,
    });

    return effectId;
  }

  /**
   * Remove a status effect from an entity
   * @param entity - Target entity
   * @param effectId - Effect ID to remove
   * @returns true if effect was removed
   */
  removeStatusEffect(entity: Entity, effectId: string): boolean {
    const statusEffect = entity.getComponent(StatusEffectComponent);
    if (!statusEffect) return false;

    const removed = statusEffect.removeEffect(effectId);
    if (removed) {
      // Clean up damage tick tracking if no DoT/HoT effects remain
      const hasDoTOrHoT = statusEffect.hasEffect('damage_over_time') || statusEffect.hasEffect('heal_over_time');
      if (!hasDoTOrHoT) {
        this.lastDamageTick.delete(entity.id);
      }

      // Emit effect removed event
      this.scene.events.emit('status_effect:removed', {
        entity,
        effectId,
      });
    }

    return removed;
  }

  /**
   * Remove all effects of a specific type from an entity
   * @param entity - Target entity
   * @param type - Effect type to remove
   * @returns Number of effects removed
   */
  removeEffectsByType(entity: Entity, type: StatusEffectType): number {
    const statusEffect = entity.getComponent(StatusEffectComponent);
    if (!statusEffect) return 0;

    const effects = statusEffect.getEffectsByType(type);
    let removed = 0;

    for (const effect of effects) {
      if (statusEffect.removeEffect(effect.id)) {
        removed++;
      }
    }

    // Clean up damage tick tracking if needed
    if (removed > 0) {
      const hasDoTOrHoT = statusEffect.hasEffect('damage_over_time') || statusEffect.hasEffect('heal_over_time');
      if (!hasDoTOrHoT) {
        this.lastDamageTick.delete(entity.id);
      }
    }

    return removed;
  }

  /**
   * Get current time (for external use)
   */
  getCurrentTime(): number {
    return this.currentTime;
  }

  /**
   * Cleanup resources (call when system is disposed)
   */
  dispose(): void {
    this.lastDamageTick.clear();
  }
}

