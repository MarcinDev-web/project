import { Component } from './Component.js';
import { registerComponent } from './registry.js';

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
export class StatusEffectComponent extends Component {
  static readonly type = 'StatusEffect';

  /** Active status effects */
  private effects: Map<string, StatusEffect> = new Map();

  /** Callback invoked when an effect is applied */
  onEffectApplied?: (effect: StatusEffect) => void;

  /** Callback invoked when an effect expires or is removed */
  onEffectRemoved?: (effect: StatusEffect) => void;

  getType(): string {
    return StatusEffectComponent.type;
  }

  /**
   * Apply a status effect to this entity
   * If an effect of the same type already exists, it will be replaced
   * @param effect - Effect to apply
   * @returns true if effect was applied, false if already exists
   */
  applyEffect(effect: StatusEffect): boolean {
    // Check if effect of this type already exists
    const existing = this.getEffectByType(effect.type);
    if (existing && existing.id === effect.id) {
      return false; // Same effect already exists
    }

    // Remove existing effect of same type (stacking not supported by default)
    if (existing) {
      this.removeEffect(existing.id);
    }

    this.effects.set(effect.id, effect);

    if (this.onEffectApplied) {
      this.onEffectApplied(effect);
    }

    return true;
  }

  /**
   * Remove a status effect by ID
   * @param effectId - Effect ID to remove
   * @returns true if effect was removed, false if not found
   */
  removeEffect(effectId: string): boolean {
    const effect = this.effects.get(effectId);
    if (!effect) return false;

    this.effects.delete(effectId);

    if (this.onEffectRemoved) {
      this.onEffectRemoved(effect);
    }

    return true;
  }

  /**
   * Get effect by ID
   * @param effectId - Effect ID
   * @returns Effect or undefined
   */
  getEffect(effectId: string): StatusEffect | undefined {
    return this.effects.get(effectId);
  }

  /**
   * Get effect by type (returns first matching effect)
   * @param type - Effect type
   * @returns Effect or undefined
   */
  getEffectByType(type: StatusEffectType): StatusEffect | undefined {
    for (const effect of this.effects.values()) {
      if (effect.type === type) {
        return effect;
      }
    }
    return undefined;
  }

  /**
   * Get all active effects
   * @returns Array of active effects
   */
  getAllEffects(): StatusEffect[] {
    return Array.from(this.effects.values());
  }

  /**
   * Get all effects of a specific type
   * @param type - Effect type
   * @returns Array of matching effects
   */
  getEffectsByType(type: StatusEffectType): StatusEffect[] {
    return Array.from(this.effects.values()).filter((e) => e.type === type);
  }

  /**
   * Check if entity has a specific effect type
   * @param type - Effect type
   * @returns true if effect is active
   */
  hasEffect(type: StatusEffectType): boolean {
    return this.getEffectByType(type) !== undefined;
  }

  /**
   * Clear all effects
   */
  clearAll(): void {
    const effects = Array.from(this.effects.values());
    this.effects.clear();

    if (this.onEffectRemoved) {
      for (const effect of effects) {
        this.onEffectRemoved(effect);
      }
    }
  }

  /**
   * Get number of active effects
   */
  getEffectCount(): number {
    return this.effects.size;
  }

  clone(): StatusEffectComponent {
    const copy = new StatusEffectComponent();
    // Deep clone effects
    for (const effect of this.effects.values()) {
      copy.effects.set(effect.id, { ...effect });
    }
    // Callbacks are not cloned (entity-specific)
    return copy;
  }

  toJSON(): {
    effects: StatusEffect[];
  } {
    return {
      effects: Array.from(this.effects.values()),
    };
  }

  fromJSON(data: { effects?: StatusEffect[] }): void {
    this.effects.clear();
    if (Array.isArray(data.effects)) {
      for (const effect of data.effects) {
        this.effects.set(effect.id, { ...effect });
      }
    }
  }
}

registerComponent(StatusEffectComponent.type, StatusEffectComponent);

