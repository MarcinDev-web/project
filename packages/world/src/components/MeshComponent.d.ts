import { Component } from './Component.js';
import type { AABB } from '../physics/BoundingVolume.js';
export type MeshKind = 'none' | 'cube' | 'box' | 'sphere' | 'cylinder' | 'plane' | 'capsule' | 'capsule_y' | 'custom' | 'avatar_torso' | 'terrain';
export interface CustomMeshData {
    vertices: Float32Array;
    indices?: Uint16Array | Uint32Array;
    normals?: Float32Array;
    uvs?: Float32Array;
}
export interface PrimitiveOptions {
    size?: [number, number, number];
    radius?: number;
    height?: number;
    segments?: number;
    width?: number;
    depth?: number;
}
export interface SerializedCustomMeshData {
    vertices: number[];
    indices?: number[];
    normals?: number[];
    uvs?: number[];
}
export interface SerializedMeshComponent {
    meshType: MeshKind;
    meshData?: SerializedCustomMeshData;
    options?: PrimitiveOptions;
    materialAssetId?: string;
    localAABB?: {
        min: number[];
        max: number[];
    };
}
export declare class MeshComponent extends Component {
    static readonly type = "Mesh";
    meshType: MeshKind;
    meshData?: CustomMeshData;
    options: PrimitiveOptions;
    materialAssetId?: string;
    localAABB?: AABB;
    getType(): string;
    clone(): MeshComponent;
    toJSON(): SerializedMeshComponent;
    fromJSON(data: SerializedMeshComponent): void;
}
//# sourceMappingURL=MeshComponent.d.ts.map