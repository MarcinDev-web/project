import { Component } from './Component';
import { registerComponent } from './registry';
export class RuntimePlayerTag extends Component {
    static type = 'RuntimePlayerTag';
    getType() {
        return RuntimePlayerTag.type;
    }
    clone() {
        return new RuntimePlayerTag();
    }
}
registerComponent(RuntimePlayerTag.type, RuntimePlayerTag);
//# sourceMappingURL=RuntimePlayerTag.js.map