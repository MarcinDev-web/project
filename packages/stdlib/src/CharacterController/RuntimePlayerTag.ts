import { Component } from '@engine/world';
import { registerComponent } from '@engine/world';

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
