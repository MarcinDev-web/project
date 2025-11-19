import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { PowerUpType } from './PowerUpComponent.js';

export interface PowerUpPickupComponentJSON {
  type: PowerUpType;
  value: number;
  duration: number;
  respawnTime: number;
  isAvailable: boolean;
  cooldown: number;
}

/**
 * PowerUpPickupComponent marks an entity as a collectible power-up.
 */
export class PowerUpPickupComponent extends Component {
  static readonly type = 'PowerUpPickup';

  /** Type of power-up */
  type: PowerUpType = 'Health';

  /** Value (amount of health/shield or speed multiplier) */
  value: number = 0;

  /** Duration of effect in seconds (0 for instant) */
  duration: number = 0;

  /** Time to respawn after pickup (seconds) */
  respawnTime: number = 10;

  /** Whether pickup is currently available */
  isAvailable: boolean = true;

  /** Current cooldown timer */
  cooldown: number = 0;

  constructor(config?: Partial<PowerUpPickupComponentJSON>) {
    super();
    if (config) {
      if (config.type) this.type = config.type;
      if (config.value !== undefined) this.value = config.value;
      if (config.duration !== undefined) this.duration = config.duration;
      if (config.respawnTime !== undefined) this.respawnTime = config.respawnTime;
      if (config.isAvailable !== undefined) this.isAvailable = config.isAvailable;
      if (config.cooldown !== undefined) this.cooldown = config.cooldown;
    }
  }

  getType(): string {
    return PowerUpPickupComponent.type;
  }

  clone(): PowerUpPickupComponent {
    return new PowerUpPickupComponent({
      type: this.type,
      value: this.value,
      duration: this.duration,
      respawnTime: this.respawnTime,
      isAvailable: this.isAvailable,
      cooldown: this.cooldown
    });
  }

  toJSON(): PowerUpPickupComponentJSON {
    return {
      type: this.type,
      value: this.value,
      duration: this.duration,
      respawnTime: this.respawnTime,
      isAvailable: this.isAvailable,
      cooldown: this.cooldown
    };
  }

  fromJSON(data: Partial<PowerUpPickupComponentJSON>): void {
    if (data.type) this.type = data.type;
    if (data.value !== undefined) this.value = data.value;
    if (data.duration !== undefined) this.duration = data.duration;
    if (data.respawnTime !== undefined) this.respawnTime = data.respawnTime;
    if (data.isAvailable !== undefined) this.isAvailable = data.isAvailable;
    if (data.cooldown !== undefined) this.cooldown = data.cooldown;
  }
}

registerComponent(PowerUpPickupComponent.type, PowerUpPickupComponent);

