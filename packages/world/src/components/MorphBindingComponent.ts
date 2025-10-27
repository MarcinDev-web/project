import { Component, registerComponent } from './Component';

export class MorphBindingComponent extends Component {
  static readonly type = 'MorphBinding';

  targetCount = 0;
  weights: Float32Array | null = null; // length = targetCount

  getType(): string {
    return MorphBindingComponent.type;
  }
}

registerComponent(MorphBindingComponent.type, MorphBindingComponent);


