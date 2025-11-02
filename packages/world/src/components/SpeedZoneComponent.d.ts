import { Component } from './Component';
import type { Vec3 } from '@engine/core';
export interface SpeedZoneComponentJSON {
    speedMultiplier?: number;
    direction?: [number, number, number];
}
/**
 * SpeedZoneComponent - Modifies player movement speed/direction
 *
 * Usage:
 * - Place on trigger zones to boost player speed
 * - Can apply directional boosts or speed multipliers
 */
export declare class SpeedZoneComponent extends Component {
    static readonly type = "SpeedZone";
    /**
     * Speed multiplier (1.0 = normal, 2.0 = double speed)
     */
    speedMultiplier: number;
    /**
     * Optional directional boost (if set, applies force in this direction)
     */
    direction?: Vec3;
    /**
     * Boost force magnitude (if direction is set)
     */
    boostForce: number;
    getType(): string;
    clone(): SpeedZoneComponent;
    toJSON(): SpeedZoneComponentJSON;
    static fromJSON(data: SpeedZoneComponentJSON): SpeedZoneComponent;
}
//# sourceMappingURL=SpeedZoneComponent.d.ts.map