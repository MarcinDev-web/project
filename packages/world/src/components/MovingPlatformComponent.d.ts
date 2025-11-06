import { Component } from './Component.js';
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
export declare class MovingPlatformComponent extends Component {
    static readonly type = "MovingPlatform";
    /**
     * Waypoints to move between (world positions)
     */
    waypoints: Vec3[];
    /**
     * Movement speed in units per second
     */
    speed: number;
    /**
     * Whether to loop back to first waypoint
     */
    loop: boolean;
    /**
     * Current waypoint index
     */
    currentWaypointIndex: number;
    getType(): string;
    clone(): MovingPlatformComponent;
    toJSON(): MovingPlatformComponentJSON;
    static fromJSON(data: MovingPlatformComponentJSON): MovingPlatformComponent;
}
//# sourceMappingURL=MovingPlatformComponent.d.ts.map