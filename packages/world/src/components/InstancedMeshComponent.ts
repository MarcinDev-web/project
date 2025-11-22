import { Component } from './Component.js';
import { registerComponent } from './registry.js';
import type { MeshKind, CustomMeshData } from './MeshComponent.js';

export class InstancedMeshComponent extends Component {
  static readonly type = 'InstancedMesh';

  meshType: MeshKind = 'cube';
  meshData?: CustomMeshData;
  materialAssetId?: string;

  // Capacity and Count
  capacity: number = 1024;
  count: number = 0;
  
  // Instance Data Arrays
  offsetData: Float32Array;          // [x, y, z] * capacity
  rotationData: Float32Array;        // [x, y, z, w] * capacity
  scaleData: Float32Array;           // [x, y, z] * capacity
  colorData: Float32Array;           // [r, g, b, a] * capacity
  secondaryColorData: Float32Array;  // [r, g, b, a] * capacity
  emissiveColorData: Float32Array;   // [r, g, b, intensity] * capacity
  materialParamsData: Float32Array;  // [alpha, metallic, roughness, flags] * capacity
  materialIdData: Float32Array;      // [id] * capacity

  constructor(capacity = 1024) {
    super();
    this.capacity = capacity;
    this.offsetData = new Float32Array(capacity * 3);
    this.rotationData = new Float32Array(capacity * 4);
    this.scaleData = new Float32Array(capacity * 3);
    this.colorData = new Float32Array(capacity * 4);
    this.secondaryColorData = new Float32Array(capacity * 4);
    this.emissiveColorData = new Float32Array(capacity * 4);
    this.materialParamsData = new Float32Array(capacity * 4);
    this.materialIdData = new Float32Array(capacity);
  }

  resize(newCapacity: number) {
    this.capacity = newCapacity;
    
    const newOffset = new Float32Array(newCapacity * 3);
    const newRotation = new Float32Array(newCapacity * 4);
    const newScale = new Float32Array(newCapacity * 3);
    const newColor = new Float32Array(newCapacity * 4);
    const newSecondary = new Float32Array(newCapacity * 4);
    const newEmissive = new Float32Array(newCapacity * 4);
    const newParams = new Float32Array(newCapacity * 4);
    const newMatIds = new Float32Array(newCapacity);

    if (this.offsetData) {
      newOffset.set(this.offsetData.subarray(0, this.count * 3));
      newRotation.set(this.rotationData.subarray(0, this.count * 4));
      newScale.set(this.scaleData.subarray(0, this.count * 3));
      newColor.set(this.colorData.subarray(0, this.count * 4));
      newSecondary.set(this.secondaryColorData.subarray(0, this.count * 4));
      newEmissive.set(this.emissiveColorData.subarray(0, this.count * 4));
      newParams.set(this.materialParamsData.subarray(0, this.count * 4));
      newMatIds.set(this.materialIdData.subarray(0, this.count));
    }

    this.offsetData = newOffset;
    this.rotationData = newRotation;
    this.scaleData = newScale;
    this.colorData = newColor;
    this.secondaryColorData = newSecondary;
    this.emissiveColorData = newEmissive;
    this.materialParamsData = newParams;
    this.materialIdData = newMatIds;
  }

  addInstance(
    position: [number, number, number],
    rotation: [number, number, number, number],
    scale: [number, number, number],
    color: [number, number, number, number] = [1, 1, 1, 1]
  ): number {
    if (this.count >= this.capacity) {
      this.resize(this.capacity * 2);
    }

    const index = this.count;
    
    this.offsetData[index * 3 + 0] = position[0];
    this.offsetData[index * 3 + 1] = position[1];
    this.offsetData[index * 3 + 2] = position[2];

    this.rotationData[index * 4 + 0] = rotation[0];
    this.rotationData[index * 4 + 1] = rotation[1];
    this.rotationData[index * 4 + 2] = rotation[2];
    this.rotationData[index * 4 + 3] = rotation[3];

    this.scaleData[index * 3 + 0] = scale[0];
    this.scaleData[index * 3 + 1] = scale[1];
    this.scaleData[index * 3 + 2] = scale[2];

    this.colorData[index * 4 + 0] = color[0];
    this.colorData[index * 4 + 1] = color[1];
    this.colorData[index * 4 + 2] = color[2];
    this.colorData[index * 4 + 3] = color[3];

    // Defaults for others
    this.secondaryColorData[index * 4 + 0] = color[0];
    this.secondaryColorData[index * 4 + 1] = color[1];
    this.secondaryColorData[index * 4 + 2] = color[2];
    this.secondaryColorData[index * 4 + 3] = 1;
    
    this.emissiveColorData[index * 4 + 0] = 0;
    this.emissiveColorData[index * 4 + 1] = 0;
    this.emissiveColorData[index * 4 + 2] = 0;
    this.emissiveColorData[index * 4 + 3] = 0;

    this.materialParamsData[index * 4 + 0] = color[3]; // Alpha
    this.materialParamsData[index * 4 + 1] = 0; // Metallic
    this.materialParamsData[index * 4 + 2] = 1; // Roughness
    this.materialParamsData[index * 4 + 3] = 0; // Flags

    this.materialIdData[index] = 0;

    this.count++;
    return index;
  }
  
  removeInstance(index: number) {
    if (index < 0 || index >= this.count) return;

    const last = this.count - 1;
    if (index !== last) {
      this.offsetData.set(this.offsetData.subarray(last * 3, (last + 1) * 3), index * 3);
      this.rotationData.set(this.rotationData.subarray(last * 4, (last + 1) * 4), index * 4);
      this.scaleData.set(this.scaleData.subarray(last * 3, (last + 1) * 3), index * 3);
      this.colorData.set(this.colorData.subarray(last * 4, (last + 1) * 4), index * 4);
      this.secondaryColorData.set(this.secondaryColorData.subarray(last * 4, (last + 1) * 4), index * 4);
      this.emissiveColorData.set(this.emissiveColorData.subarray(last * 4, (last + 1) * 4), index * 4);
      this.materialParamsData.set(this.materialParamsData.subarray(last * 4, (last + 1) * 4), index * 4);
      this.materialIdData[index] = this.materialIdData[last] || 0;
    }
    
    this.count--;
  }

  getType(): string {
    return InstancedMeshComponent.type;
  }
  
  clone(): InstancedMeshComponent {
     const clone = new InstancedMeshComponent(this.capacity);
     clone.meshType = this.meshType;
     if (this.meshData) clone.meshData = this.meshData;
     clone.count = this.count;
     if (this.materialAssetId) clone.materialAssetId = this.materialAssetId;
     
     clone.offsetData.set(this.offsetData);
     clone.rotationData.set(this.rotationData);
     clone.scaleData.set(this.scaleData);
     clone.colorData.set(this.colorData);
     clone.secondaryColorData.set(this.secondaryColorData);
     clone.emissiveColorData.set(this.emissiveColorData);
     clone.materialParamsData.set(this.materialParamsData);
     clone.materialIdData.set(this.materialIdData);
     
     return clone;
  }

  toJSON() {
    return {
      meshType: this.meshType,
      meshData: this.meshData,
      materialAssetId: this.materialAssetId,
      count: this.count,
      capacity: this.capacity,
      offsetData: Array.from(this.offsetData.subarray(0, this.count * 3)),
      rotationData: Array.from(this.rotationData.subarray(0, this.count * 4)),
      scaleData: Array.from(this.scaleData.subarray(0, this.count * 3)),
      colorData: Array.from(this.colorData.subarray(0, this.count * 4)),
      secondaryColorData: Array.from(this.secondaryColorData.subarray(0, this.count * 4)),
      emissiveColorData: Array.from(this.emissiveColorData.subarray(0, this.count * 4)),
      materialParamsData: Array.from(this.materialParamsData.subarray(0, this.count * 4)),
      materialIdData: Array.from(this.materialIdData.subarray(0, this.count))
    };
  }
  
  fromJSON(data: any) {
    this.meshType = data.meshType;
    this.meshData = data.meshData;
    this.materialAssetId = data.materialAssetId;
    this.count = data.count;
    this.resize(data.capacity);
    
    this.offsetData.set(data.offsetData);
    this.rotationData.set(data.rotationData);
    this.scaleData.set(data.scaleData);
    this.colorData.set(data.colorData);
    this.secondaryColorData.set(data.secondaryColorData);
    this.emissiveColorData.set(data.emissiveColorData);
    this.materialParamsData.set(data.materialParamsData);
    this.materialIdData.set(data.materialIdData);
  }
}

registerComponent(InstancedMeshComponent.type, InstancedMeshComponent);

