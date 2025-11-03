import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { AmmoType } from '../types/weapon.js';

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
export class AmmoComponent extends Component {
  static readonly type = 'Ammo';

  /** Map of ammo type to count */
  private ammoCounts: Map<AmmoType, number> = new Map();

  constructor(data?: AmmoComponentData) {
    super();
    if (data?.ammoCounts) {
      for (const [type, count] of Object.entries(data.ammoCounts)) {
        this.ammoCounts.set(type as AmmoType, count);
      }
    }
  }

  getType(): string {
    return AmmoComponent.type;
  }

  /**
   * Get ammo count for a specific type
   * @param type - Ammo type
   * @returns Ammo count (0 if not set)
   */
  getAmmoCount(type: AmmoType): number {
    return this.ammoCounts.get(type) ?? 0;
  }

  /**
   * Add ammo of a specific type
   * @param type - Ammo type
   * @param amount - Amount to add
   * @returns New total count
   */
  addAmmo(type: AmmoType, amount: number): number {
    if (amount <= 0) return this.getAmmoCount(type);
    
    const current = this.getAmmoCount(type);
    const newCount = current + amount;
    this.ammoCounts.set(type, newCount);
    return newCount;
  }

  /**
   * Consume ammo of a specific type
   * @param type - Ammo type
   * @param amount - Amount to consume
   * @returns Actual amount consumed (may be less if insufficient ammo)
   */
  consumeAmmo(type: AmmoType, amount: number): number {
    if (amount <= 0) return 0;
    
    const current = this.getAmmoCount(type);
    const consumed = Math.min(amount, current);
    const remaining = current - consumed;
    
    if (remaining > 0) {
      this.ammoCounts.set(type, remaining);
    } else {
      this.ammoCounts.delete(type);
    }
    
    return consumed;
  }

  /**
   * Set ammo count for a specific type
   * @param type - Ammo type
   * @param count - New count
   */
  setAmmoCount(type: AmmoType, count: number): void {
    if (count > 0) {
      this.ammoCounts.set(type, count);
    } else {
      this.ammoCounts.delete(type);
    }
  }

  /**
   * Get total ammo count across all types
   * @returns Total ammo count
   */
  getTotalAmmoCount(): number {
    let total = 0;
    for (const count of this.ammoCounts.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Get all ammo types with non-zero counts
   * @returns Array of ammo types that have ammo
   */
  getAvailableTypes(): AmmoType[] {
    return Array.from(this.ammoCounts.keys()).filter((type) => this.getAmmoCount(type) > 0);
  }

  /**
   * Check if has ammo of a specific type
   * @param type - Ammo type
   */
  hasAmmo(type: AmmoType): boolean {
    return this.getAmmoCount(type) > 0;
  }

  /**
   * Clear all ammo
   */
  clear(): void {
    this.ammoCounts.clear();
  }

  clone(): AmmoComponent {
    const copy = new AmmoComponent();
    // Deep copy ammo counts
    for (const [type, count] of this.ammoCounts.entries()) {
      copy.ammoCounts.set(type, count);
    }
    return copy;
  }

  toJSON(): {
    ammoCounts: Record<string, number>;
  } {
    const ammoCounts: Record<string, number> = {};
    for (const [type, count] of this.ammoCounts.entries()) {
      ammoCounts[type] = count;
    }
    return { ammoCounts };
  }

  fromJSON(data: {
    ammoCounts?: Record<string, number>;
  }): void {
    this.ammoCounts.clear();
    if (data.ammoCounts) {
      for (const [type, count] of Object.entries(data.ammoCounts)) {
        if (count > 0) {
          this.ammoCounts.set(type as AmmoType, count);
        }
      }
    }
  }
}

registerComponent(AmmoComponent.type, AmmoComponent);
