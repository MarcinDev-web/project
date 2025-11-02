import { Component } from './Component';
export type MeshKind = 'cube' | 'sphere' | 'custom' | 'avatar_torso' | 'terrain';
export interface CustomMeshData {
    vertices?: Float32Array | Uint8Array;
    indices?: Uint16Array;
}
export declare class MeshComponent extends Component {
    static readonly type = "Mesh";
    meshType: MeshKind;
    meshData?: CustomMeshData;
    getType(): string;
    clone(): MeshComponent;
    toJSON(): {
        meshType: MeshKind;
        meshData?: CustomMeshData;
    };
    fromJSON(data: {
        meshType?: MeshKind;
        meshData?: CustomMeshData;
    }): void;
}
//# sourceMappingURL=MeshComponent.d.ts.map