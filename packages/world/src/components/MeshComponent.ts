import { Component } from './Component.js';
import { registerComponent } from './registry.js';

export type MeshKind = 'cube' | 'sphere' | 'custom' | 'avatar_torso' | 'terrain';

export interface CustomMeshData {
  vertices?: Float32Array | Uint8Array;
  indices?: Uint16Array;
  // Extend with normals/uvs as needed
}

export class MeshComponent extends Component {
  static readonly type = 'Mesh';

  meshType: MeshKind = 'cube';
  meshData?: CustomMeshData;

  getType(): string {
    return MeshComponent.type;
  }

  clone(): MeshComponent {
    const clone = new MeshComponent();
    clone.meshType = this.meshType;
    // Shallow copy is sufficient for stateless data references
    if (this.meshData) {
      clone.meshData = { ...this.meshData };
    }
    return clone;
  }

  toJSON(): { meshType: MeshKind; meshData?: CustomMeshData } {
    return {
      meshType: this.meshType,
      ...(this.meshData ? { meshData: this.meshData } : {}),
    };
  }

  fromJSON(data: { meshType?: MeshKind; meshData?: CustomMeshData }): void {
    if (data.meshType) this.meshType = data.meshType;
    if (data.meshData) this.meshData = data.meshData;
  }
}

registerComponent(MeshComponent.type, MeshComponent);
