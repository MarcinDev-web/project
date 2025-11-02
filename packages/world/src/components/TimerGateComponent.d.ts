import { Component } from './Component';
export interface TimerGateComponentJSON {
    timeLimit?: number;
    autoStart?: boolean;
}
/**
 * TimerGateComponent - Time trial gate that tracks elapsed time
 *
 * Usage:
 * - Place at start/finish points for time trials
 * - Tracks time between start and finish gates
 * - Can be manually started or auto-start on player enter
 */
export declare class TimerGateComponent extends Component {
    static readonly type = "TimerGate";
    /**
     * Time limit in milliseconds (0 = no limit)
     */
    timeLimit: number;
    /**
     * Auto-start timer when player enters gate
     */
    autoStart: boolean;
    /**
     * Gate type: 'start' or 'finish'
     */
    gateType: 'start' | 'finish';
    /**
     * Activation radius in world units
     */
    activationRadius: number;
    getType(): string;
    clone(): TimerGateComponent;
    toJSON(): TimerGateComponentJSON;
    static fromJSON(data: TimerGateComponentJSON): TimerGateComponent;
}
//# sourceMappingURL=TimerGateComponent.d.ts.map