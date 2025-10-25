import { Component } from './Component';
import { registerComponent } from './registry';
export class MeshComponent extends Component {
    static type = 'Mesh';
    meshType = 'cube';
    meshData;
    getType() {
        return MeshComponent.type;
    }
    clone() {
        const clone = new MeshComponent();
        clone.meshType = this.meshType;
        // Shallow copy is sufficient for stateless data references
        if (this.meshData) {
            clone.meshData = { ...this.meshData };
        }
        return clone;
    }
    toJSON() {
        return {
            meshType: this.meshType,
            ...(this.meshData ? { meshData: this.meshData } : {}),
        };
    }
    fromJSON(data) {
        if (data.meshType)
            this.meshType = data.meshType;
        if (data.meshData)
            this.meshData = data.meshData;
    }
}
registerComponent(MeshComponent.type, MeshComponent);
//# sourceMappingURL=MeshComponent.js.map