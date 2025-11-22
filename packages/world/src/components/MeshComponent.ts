import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { AABB } from '../physics/BoundingVolume.js';

export type MeshKind =
  | 'none'
  | 'cube'
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'plane'
  | 'capsule'
  | 'capsule_y' // Legacy/Specific
  | 'custom'
  | 'avatar_torso'
  | 'terrain';

export interface CustomMeshData {
  vertices: Float32Array;
  indices?: Uint16Array | Uint32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
}

export interface PrimitiveOptions {
  size?: [number, number, number]; // for cube
  radius?: number; // for sphere, cylinder, capsule
  height?: number; // for cylinder, capsule
  segments?: number; // for tessellation control
  width?: number; // for plane
  depth?: number; // for plane
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
  localAABB?: { min: number[]; max: number[] };
}

export class MeshComponent extends Component {
  static readonly type = 'Mesh';

  meshType: MeshKind = 'none';
  meshData?: CustomMeshData;
  options: PrimitiveOptions = {};
  materialAssetId?: string;
  localAABB?: AABB;

  getType(): string {
    return MeshComponent.type;
  }

  clone(): MeshComponent {
    const clone = new MeshComponent();
    clone.meshType = this.meshType;
    
    if (this.meshData) {
      clone.meshData = {
        vertices: new Float32Array(this.meshData.vertices),
        ...(this.meshData.indices && {
          indices:
            this.meshData.indices instanceof Uint32Array
              ? new Uint32Array(this.meshData.indices)
              : new Uint16Array(this.meshData.indices),
        }),
        ...(this.meshData.normals && { normals: new Float32Array(this.meshData.normals) }),
        ...(this.meshData.uvs && { uvs: new Float32Array(this.meshData.uvs) }),
      };
    }

    clone.options = { ...this.options };
    if (this.materialAssetId !== undefined) {
      clone.materialAssetId = this.materialAssetId;
    }
    
    if (this.localAABB) {
      clone.localAABB = {
        min: [...this.localAABB.min],
        max: [...this.localAABB.max],
      };
    }

    return clone;
  }

  toJSON(): SerializedMeshComponent {
    const result: SerializedMeshComponent = {
      meshType: this.meshType,
      options: { ...this.options },
    };

    if (this.materialAssetId) {
      result.materialAssetId = this.materialAssetId;
    }

    if (this.localAABB) {
      result.localAABB = {
        min: [...this.localAABB.min],
        max: [...this.localAABB.max],
      };
    }

    if (this.meshData) {
      result.meshData = {
        vertices: Array.from(this.meshData.vertices),
        ...(this.meshData.indices && { indices: Array.from(this.meshData.indices) }),
        ...(this.meshData.normals && { normals: Array.from(this.meshData.normals) }),
        ...(this.meshData.uvs && { uvs: Array.from(this.meshData.uvs) }),
      };
    }

    return result;
  }

  fromJSON(data: SerializedMeshComponent): void {
    if (data.meshType) this.meshType = data.meshType;
    if (data.options) this.options = { ...data.options };
    if (data.materialAssetId) this.materialAssetId = data.materialAssetId;

    if (data.localAABB) {
      this.localAABB = {
        min: [data.localAABB.min[0] ?? 0, data.localAABB.min[1] ?? 0, data.localAABB.min[2] ?? 0],
        max: [data.localAABB.max[0] ?? 0, data.localAABB.max[1] ?? 0, data.localAABB.max[2] ?? 0],
      };
    }

    if (data.meshData) {
      this.meshData = {
        vertices: new Float32Array(data.meshData.vertices),
        ...(data.meshData.indices && { indices: new Uint16Array(data.meshData.indices) }), // Defaulting to Uint16Array for compatibility, could check max value
        ...(data.meshData.normals && { normals: new Float32Array(data.meshData.normals) }),
        ...(data.meshData.uvs && { uvs: new Float32Array(data.meshData.uvs) }),
      };
    }
  }
}

registerComponent(MeshComponent.type, MeshComponent);
