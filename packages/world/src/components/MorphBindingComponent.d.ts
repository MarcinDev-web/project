import { Component } from './Component';
export declare class MorphBindingComponent extends Component {
    static readonly type = "MorphBinding";
    targetCount: number;
    weights: Float32Array | null;
    getType(): string;
    clone(): MorphBindingComponent;
}
//# sourceMappingURL=MorphBindingComponent.d.ts.map