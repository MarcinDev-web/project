import { Component } from './Component.js';
import { registerComponent } from './registry.js';

export interface TimerGateComponentJSON {
  timeLimit?: number; // Time limit in milliseconds
  autoStart?: boolean; // Start automatically when player enters
}

/**
 * TimerGateComponent - Time trial gate that tracks elapsed time
 *
 * Usage:
 * - Place at start/finish points for time trials
 * - Tracks time between start and finish gates
 * - Can be manually started or auto-start on player enter
 */
export class TimerGateComponent extends Component {
  static readonly type = 'TimerGate';

  /**
   * Time limit in milliseconds (0 = no limit)
   */
  timeLimit = 0;

  /**
   * Auto-start timer when player enters gate
   */
  autoStart = false;

  /**
   * Gate type: 'start' or 'finish'
   */
  gateType: 'start' | 'finish' = 'start';

  /**
   * Activation radius in world units
   */
  activationRadius = 2.0;

  getType(): string {
    return TimerGateComponent.type;
  }

  override clone(): TimerGateComponent {
    const clone = new TimerGateComponent();
    clone.timeLimit = this.timeLimit;
    clone.autoStart = this.autoStart;
    clone.gateType = this.gateType;
    clone.activationRadius = this.activationRadius;
    return clone;
  }

  override toJSON(): TimerGateComponentJSON {
    return {
      timeLimit: this.timeLimit,
      autoStart: this.autoStart,
    };
  }

  static fromJSON(data: TimerGateComponentJSON): TimerGateComponent {
    const component = new TimerGateComponent();
    if (typeof data.timeLimit === 'number') {
      component.timeLimit = data.timeLimit;
    }
    if (typeof data.autoStart === 'boolean') {
      component.autoStart = data.autoStart;
    }
    return component;
  }
}

registerComponent(TimerGateComponent.type, TimerGateComponent);
