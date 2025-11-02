import { Component } from './Component';
import { registerComponent } from './registry';

/**
 * HealthComponent manages entity health and damage/healing
 */
export class HealthComponent extends Component {
  static readonly type = 'Health';

  /** Maximum health */
  maxHealth: number = 100;

  /** Current health */
  private _currentHealth: number = 100;

  /** Callback invoked when entity dies (health reaches 0) */
  onDeath?: () => void;

  /** Callback invoked when health changes (current, max) */
  onHealthChanged?: (current: number, max: number) => void;

  /**
   * Get current health
   */
  get currentHealth(): number {
    return this._currentHealth;
  }

  /**
   * Set current health (clamped to [0, maxHealth])
   */
  set currentHealth(value: number) {
    const oldHealth = this._currentHealth;
    this._currentHealth = Math.max(0, Math.min(value, this.maxHealth));

    // Fire health changed callback
    if (this._currentHealth !== oldHealth && this.onHealthChanged) {
      this.onHealthChanged(this._currentHealth, this.maxHealth);
    }

    // Fire death callback if health reached 0
    if (this._currentHealth === 0 && oldHealth > 0 && this.onDeath) {
      this.onDeath();
    }
  }

  getType(): string {
    return HealthComponent.type;
  }

  /**
   * Apply damage to this entity
   * @param amount - Amount of damage to apply
   * @returns Actual damage dealt (may be less if health would go below 0)
   */
  takeDamage(amount: number): number {
    if (amount <= 0 || !this.isAlive()) return 0;

    const oldHealth = this._currentHealth;
    this.currentHealth = this._currentHealth - amount;
    return oldHealth - this._currentHealth;
  }

  /**
   * Heal this entity
   * @param amount - Amount of health to restore
   * @returns Actual healing done (may be less if health would exceed maxHealth)
   */
  heal(amount: number): number {
    if (amount <= 0 || !this.isAlive()) return 0;

    const oldHealth = this._currentHealth;
    this.currentHealth = this._currentHealth + amount;
    return this._currentHealth - oldHealth;
  }

  /**
   * Check if entity is alive
   */
  isAlive(): boolean {
    return this._currentHealth > 0;
  }

  /**
   * Get health as percentage (0-1)
   */
  getHealthPercent(): number {
    return this.maxHealth > 0 ? this._currentHealth / this.maxHealth : 0;
  }

  /**
   * Reset health to maximum
   */
  reset(): void {
    this.currentHealth = this.maxHealth;
  }

  clone(): HealthComponent {
    const copy = new HealthComponent();
    copy.maxHealth = this.maxHealth;
    copy._currentHealth = this._currentHealth;
    // Callbacks are not cloned (entity-specific)
    return copy;
  }

  toJSON(): {
    maxHealth: number;
    currentHealth: number;
  } {
    return {
      maxHealth: this.maxHealth,
      currentHealth: this._currentHealth,
    };
  }

  fromJSON(data: {
    maxHealth?: number;
    currentHealth?: number;
  }): void {
    if (typeof data.maxHealth === 'number') {
      this.maxHealth = data.maxHealth;
    }
    if (typeof data.currentHealth === 'number') {
      this._currentHealth = Math.max(0, Math.min(data.currentHealth, this.maxHealth));
    } else {
      // If only maxHealth is set, set current to max
      this._currentHealth = this.maxHealth;
    }
  }
}

registerComponent(HealthComponent.type, HealthComponent);

