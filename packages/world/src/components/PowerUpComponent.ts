import { Component } from './Component.js';
import { registerComponent } from './registry.js';

export type PowerUpType = 'Speed' | 'Shield' | 'Health' | 'Damage';

export interface ActiveBuff {
  type: PowerUpType;
  value: number;
  duration: number;
  elapsed: number;
}

export interface PowerUpComponentJSON {
  buffs: ActiveBuff[];
}

/**
 * PowerUpComponent tracks active buffs on an entity.
 */
export class PowerUpComponent extends Component {
  static readonly type = 'PowerUp';

  /** Active buffs mapped by type */
  buffs: Map<PowerUpType, ActiveBuff> = new Map();

  getType(): string {
    return PowerUpComponent.type;
  }

  /**
   * Add or refresh a buff
   */
  addBuff(type: PowerUpType, value: number, duration: number): void {
    this.buffs.set(type, {
      type,
      value,
      duration,
      elapsed: 0
    });
  }

  /**
   * Remove a buff
   */
  removeBuff(type: PowerUpType): void {
    this.buffs.delete(type);
  }

  /**
   * Check if has buff
   */
  hasBuff(type: PowerUpType): boolean {
    return this.buffs.has(type);
  }

  /**
   * Get buff value
   */
  getBuffValue(type: PowerUpType): number | undefined {
    return this.buffs.get(type)?.value;
  }

  clone(): PowerUpComponent {
    const copy = new PowerUpComponent();
    for (const [type, buff] of this.buffs) {
      copy.buffs.set(type, { ...buff });
    }
    return copy;
  }

  toJSON(): PowerUpComponentJSON {
    return {
      buffs: Array.from(this.buffs.values())
    };
  }

  fromJSON(data: Partial<PowerUpComponentJSON>): void {
    this.buffs.clear();
    if (data.buffs) {
      for (const buff of data.buffs) {
        this.buffs.set(buff.type, { ...buff });
      }
    }
  }
}

registerComponent(PowerUpComponent.type, PowerUpComponent);

