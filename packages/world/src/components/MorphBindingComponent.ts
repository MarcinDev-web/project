import { Component } from './Component';
import { registerComponent } from './registry';

export class MorphBindingComponent extends Component {
  static readonly type = 'MorphBinding';

  targetCount = 0;
  weights: Float32Array | null = null; // length = targetCount

  getType(): string {
    return MorphBindingComponent.type;
  }

  override clone(): MorphBindingComponent {
    const clone = new MorphBindingComponent();
    clone.targetCount = this.targetCount;
    clone.weights = this.weights ? new Float32Array(this.weights) : null;
    return clone;
  }
}

registerComponent(MorphBindingComponent.type, MorphBindingComponent);


