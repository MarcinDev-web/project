import { Component } from './Component.js';
import { registerComponent } from './registry.js';

export class RuntimePlayerTag extends Component {
  static readonly type = 'RuntimePlayerTag';

  getType(): string {
    return RuntimePlayerTag.type;
  }

  clone(): RuntimePlayerTag {
    return new RuntimePlayerTag();
  }
}

registerComponent(RuntimePlayerTag.type, RuntimePlayerTag);


