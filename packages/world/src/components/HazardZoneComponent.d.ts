import { Component } from './Component.js';
export interface HazardZoneComponentJSON {
    damagePerSecond?: number;
    damageOnEnter?: number;
    killZone?: boolean;
}
/**
 * HazardZoneComponent - Damages or kills players in the zone
 *
 * Usage:
 * - Place on trigger zones or colliders
 * - Damages players who enter/stay in the zone
 * - Can be used for lava, spikes, etc.
 */
export declare class HazardZoneComponent extends Component {
    static readonly type = "HazardZone";
    /**
     * Damage per second while in zone (0 = only on enter)
     */
    damagePerSecond: number;
    /**
     * Instant damage on entering zone
     */
    damageOnEnter: number;
    /**
     * If true, instantly kills player on enter
     */
    killZone: boolean;
    getType(): string;
    clone(): HazardZoneComponent;
    toJSON(): HazardZoneComponentJSON;
    static fromJSON(data: HazardZoneComponentJSON): HazardZoneComponent;
}
//# sourceMappingURL=HazardZoneComponent.d.ts.map