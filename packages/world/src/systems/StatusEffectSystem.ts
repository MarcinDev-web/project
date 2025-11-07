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

  /** Track last tick time per effect (supports DoT/HoT) */
  private readonly lastEffectTick: Map<string, number> = new Map();

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
        // Calculate elapsed time since effect started (may exceed duration if update is late)
        const elapsed = this.currentTime - effect.startTime;

        // Apply effect (internally clamps to effect duration)
        this.applyEffect(entity, effect, elapsed);

        if (elapsed >= effect.duration) {
          effectsToRemove.push(effect.id);
        }
      }

      // Remove expired effects
      if (this.config.enableAutoCleanup) {
        for (const effectId of effectsToRemove) {
          statusEffect.removeEffect(effectId);
          this.lastEffectTick.delete(effectId);
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

    const effectId = effect.id;
    const lastTick = this.lastEffectTick.get(effectId) ?? effect.startTime;
    const effectEndTime = effect.startTime + effect.duration;
    const clampedTime = Math.min(this.currentTime, effectEndTime);
    const timeSinceLastTick = clampedTime - lastTick;

    // Apply damage at intervals (not every frame for performance)
    if (timeSinceLastTick >= this.config.damageTickInterval!) {
      const damageThisTick = effect.strength * timeSinceLastTick;
      if (damageThisTick > 0) {
        health.takeDamage(damageThisTick);
      }
      this.lastEffectTick.set(effectId, clampedTime);

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

    const effectId = effect.id;
    const lastTick = this.lastEffectTick.get(effectId) ?? effect.startTime;
    const effectEndTime = effect.startTime + effect.duration;
    const clampedTime = Math.min(this.currentTime, effectEndTime);
    const timeSinceLastTick = clampedTime - lastTick;

    // Apply healing at intervals
    if (timeSinceLastTick >= this.config.damageTickInterval!) {
      const healThisTick = effect.strength * timeSinceLastTick;
      if (healThisTick > 0) {
        health.heal(healThisTick);
      }
      this.lastEffectTick.set(effectId, clampedTime);

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

    // Generate unique effect ID (non-deterministic IDs are acceptable for effect tracking)
    // eslint-disable-next-line no-restricted-syntax
    const effectId = `${type}_${entity.id}_${this.currentTime}_${Math.random().toString(36).substring(2, 9)}`;

    const shouldTrackTicks = type === 'damage_over_time' || type === 'heal_over_time';
    const existingEffect = shouldTrackTicks ? statusEffect.getEffectByType(type) : undefined;

    if (existingEffect) {
      this.lastEffectTick.delete(existingEffect.id);
    }

    const effect: StatusEffect = {
      id: effectId,
      type,
      startTime: this.currentTime,
      duration,
      strength,
      ...(sourceId !== undefined && { sourceId }),
      ...(metadata !== undefined && { metadata }),
    };

    const applied = statusEffect.applyEffect(effect);
    if (!applied) return undefined;

    // Initialize tick tracking for periodic effects
    if (shouldTrackTicks) {
      this.lastEffectTick.set(effectId, effect.startTime);
    }

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
      this.lastEffectTick.delete(effectId);

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
        this.lastEffectTick.delete(effect.id);
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
    this.lastEffectTick.clear();
  }
}

