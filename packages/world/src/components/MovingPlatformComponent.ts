import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { Vec3 } from '@engine/core/math';

export interface MovingPlatformComponentJSON {
  waypoints?: Array<[number, number, number]>;
  speed?: number;
  loop?: boolean;
}

/**
 * MovingPlatformComponent - Platform that moves between waypoints
 *
 * Usage:
 * - Place on platform entities
 * - Define waypoints for the platform to move between
 * - Useful for moving obstacles or elevators
 */
export class MovingPlatformComponent extends Component {
  static readonly type = 'MovingPlatform';

  /**
   * Waypoints to move between (world positions)
   */
  waypoints: Vec3[] = [];

  /**
   * Movement speed in units per second
   */
  speed = 2.0;

  /**
   * Whether to loop back to first waypoint
   */
  loop = true;

  /**
   * Current waypoint index
   */
  currentWaypointIndex = 0;

  getType(): string {
    return MovingPlatformComponent.type;
  }

  override clone(): MovingPlatformComponent {
    const clone = new MovingPlatformComponent();
    clone.waypoints = this.waypoints.map((w) => [...w] as Vec3);
    clone.speed = this.speed;
    clone.loop = this.loop;
    clone.currentWaypointIndex = this.currentWaypointIndex;
    return clone;
  }

  override toJSON(): MovingPlatformComponentJSON {
    return {
      waypoints: this.waypoints.map((w) => [w[0], w[1], w[2]] as [number, number, number]),
      speed: this.speed,
      loop: this.loop,
    };
  }

  static fromJSON(data: MovingPlatformComponentJSON): MovingPlatformComponent {
    const component = new MovingPlatformComponent();
    if (Array.isArray(data.waypoints)) {
      component.waypoints = data.waypoints.map((w) => w as Vec3);
    }
    if (typeof data.speed === 'number') {
      component.speed = data.speed;
    }
    if (typeof data.loop === 'boolean') {
      component.loop = data.loop;
    }
    return component;
  }
}

registerComponent(MovingPlatformComponent.type, MovingPlatformComponent);
