import { Component } from './Component.js';
import { registerComponent } from './registry.js';

export interface ShieldComponentJSON {
  maxShield: number;
  currentShield: number;
  rechargeRate: number;
  rechargeDelay: number;
}

/**
 * ShieldComponent manages entity shield points.
 * Shields absorb damage before health.
 */
export class ShieldComponent extends Component {
  static readonly type = 'Shield';

  /** Maximum shield points */
  maxShield: number = 100;

  /** Current shield points */
  private _currentShield: number = 100;

  /** Shield recharge rate (points per second) */
  rechargeRate: number = 5;

  /** Delay before recharge starts after taking damage (seconds) */
  rechargeDelay: number = 3;

  /** Time since last damage taken (seconds) */
  lastDamageTime: number = -Infinity;

  /** Callback invoked when shield changes (current, max) */
  onShieldChanged?: (current: number, max: number) => void;

  /**
   * Get current shield
   */
  get currentShield(): number {
    return this._currentShield;
  }

  /**
   * Set current shield (clamped to [0, maxShield])
   */
  set currentShield(value: number) {
    const oldShield = this._currentShield;
    this._currentShield = Math.max(0, Math.min(value, this.maxShield));

    if (this._currentShield !== oldShield && this.onShieldChanged) {
      this.onShieldChanged(this._currentShield, this.maxShield);
    }
  }

  getType(): string {
    return ShieldComponent.type;
  }

  /**
   * Absorb damage with shield
   * @param amount - Amount of damage to absorb
   * @returns Remaining damage that shield couldn't absorb
   */
  absorbDamage(amount: number): number {
    if (amount <= 0) return 0;

    this.lastDamageTime = performance.now() / 1000; // Will be updated by system usually, but good to track

    if (this._currentShield >= amount) {
      this.currentShield -= amount;
      return 0;
    } else {
      const remaining = amount - this._currentShield;
      this.currentShield = 0;
      return remaining;
    }
  }

  /**
   * Reset shield to maximum
   */
  reset(): void {
    this.currentShield = this.maxShield;
    this.lastDamageTime = -Infinity;
  }

  clone(): ShieldComponent {
    const copy = new ShieldComponent();
    copy.maxShield = this.maxShield;
    copy._currentShield = this._currentShield;
    copy.rechargeRate = this.rechargeRate;
    copy.rechargeDelay = this.rechargeDelay;
    return copy;
  }

  toJSON(): ShieldComponentJSON {
    return {
      maxShield: this.maxShield,
      currentShield: this._currentShield,
      rechargeRate: this.rechargeRate,
      rechargeDelay: this.rechargeDelay,
    };
  }

  fromJSON(data: Partial<ShieldComponentJSON>): void {
    if (typeof data.maxShield === 'number') this.maxShield = data.maxShield;
    if (typeof data.currentShield === 'number') this._currentShield = data.currentShield;
    if (typeof data.rechargeRate === 'number') this.rechargeRate = data.rechargeRate;
    if (typeof data.rechargeDelay === 'number') this.rechargeDelay = data.rechargeDelay;
  }
}

registerComponent(ShieldComponent.type, ShieldComponent);

