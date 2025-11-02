import { Component } from './Component';
import { registerComponent } from './registry';

export interface BouncePadComponentJSON {
  bounceForce?: number;
  minBounceVelocity?: number;
}

/**
 * BouncePadComponent - Bounces player upward with force
 *
 * Usage:
 * - Place for vertical jumping mechanics
 * - Automatically bounces players landing on it
 */
export class BouncePadComponent extends Component {
  static readonly type = 'BouncePad';

  /**
   * Bounce force applied upward
   */
  bounceForce = 15.0;

  /**
   * Minimum downward velocity to trigger bounce
   */
  minBounceVelocity = 0.5;

  getType(): string {
    return BouncePadComponent.type;
  }

  override clone(): BouncePadComponent {
    const clone = new BouncePadComponent();
    clone.bounceForce = this.bounceForce;
    clone.minBounceVelocity = this.minBounceVelocity;
    return clone;
  }

  override toJSON(): BouncePadComponentJSON {
    return {
      bounceForce: this.bounceForce,
      minBounceVelocity: this.minBounceVelocity,
    };
  }

  static fromJSON(data: BouncePadComponentJSON): BouncePadComponent {
    const component = new BouncePadComponent();
    if (typeof data.bounceForce === 'number') {
      component.bounceForce = data.bounceForce;
    }
    if (typeof data.minBounceVelocity === 'number') {
      component.minBounceVelocity = data.minBounceVelocity;
    }
    return component;
  }
}

registerComponent(BouncePadComponent.type, BouncePadComponent);

