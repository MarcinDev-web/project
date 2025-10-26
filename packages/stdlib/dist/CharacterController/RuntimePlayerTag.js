import { Component } from '@engine/world';
import { registerComponent } from '@engine/world';
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