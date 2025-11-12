import { Component } from './Component.js';
export declare class DurabilityComponent extends Component {
    static readonly type = "Durability";
    max: number;
    current: number;
    constructor(max?: number);
    degrade(amount: number): void;
    repair(amount: number): void;
    isBroken(): boolean;
    getType(): string;
    clone(): DurabilityComponent;
}
//# sourceMappingURL=DurabilityComponent.d.ts.map