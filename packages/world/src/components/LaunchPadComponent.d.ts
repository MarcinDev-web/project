import { Component } from './Component';
import type { Vec3 } from '@engine/core';
export interface LaunchPadComponentJSON {
    force?: number;
    direction?: [number, number, number];
}
/**
 * LaunchPadComponent - Launches player in a specific direction
 *
 * Usage:
 * - Place to launch players in a direction
 * - Useful for parkour and platforming
 */
export declare class LaunchPadComponent extends Component {
    static readonly type = "LaunchPad";
    /**
     * Launch force magnitude
     */
    force: number;
    /**
     * Launch direction (normalized)
     */
    direction: Vec3;
    /**
     * Activation radius in world units
     */
    activationRadius: number;
    /**
     * Cooldown period in milliseconds (0 = no cooldown)
     */
    cooldownMs: number;
    getType(): string;
    clone(): LaunchPadComponent;
    toJSON(): LaunchPadComponentJSON;
    static fromJSON(data: LaunchPadComponentJSON): LaunchPadComponent;
}
//# sourceMappingURL=LaunchPadComponent.d.ts.map