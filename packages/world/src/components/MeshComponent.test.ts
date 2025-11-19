import { describe, it, expect } from 'vitest';
import { MeshComponent, SerializedMeshComponent } from './MeshComponent.js';

describe('MeshComponent', () => {
  it('clones and serializes mesh data', () => {
    const component = new MeshComponent();
    component.meshType = 'custom';
    const data = {
      vertices: new Float32Array([0, 1, 2]),
      indices: new Uint16Array([0, 1, 2]),
      normals: new Float32Array([0, 0, 1]),
      uvs: new Float32Array([0, 0]),
    };
    component.meshData = data;

    const clone = component.clone();
    expect(clone).not.toBe(component);
    expect(clone.meshType).toBe('custom');
    expect(clone.meshData).toEqual(data);
    expect(clone.meshData?.vertices).toBeInstanceOf(Float32Array);
    expect(clone.meshData?.indices).toBeInstanceOf(Uint16Array);

    const json = component.toJSON();
    // Verify JSON structure (arrays not typed arrays)
    expect(Array.isArray(json.meshData?.vertices)).toBe(true);
    expect(Array.isArray(json.meshData?.indices)).toBe(true);
    
    const restored = new MeshComponent();
    restored.fromJSON(json);

    expect(restored.meshType).toBe('custom');
    expect(restored.meshData).toEqual(data);
    expect(restored.meshData?.vertices).toBeInstanceOf(Float32Array);
  });

  it('handles primitive options', () => {
    const component = new MeshComponent();
    component.meshType = 'cylinder';
    component.options = {
      radius: 5,
      height: 10,
      segments: 32
    };

    const clone = component.clone();
    expect(clone.options).toEqual(component.options);
    expect(clone.options).not.toBe(component.options); // Deep copy

    const json = component.toJSON();
    const restored = new MeshComponent();
    restored.fromJSON(json);

    expect(restored.options).toEqual(component.options);
  });

  it('handles material asset ID', () => {
    const component = new MeshComponent();
    component.materialAssetId = 'mat-123';

    const clone = component.clone();
    expect(clone.materialAssetId).toBe('mat-123');

    const json = component.toJSON();
    expect(json.materialAssetId).toBe('mat-123');

    const restored = new MeshComponent();
    restored.fromJSON(json);
    expect(restored.materialAssetId).toBe('mat-123');
  });

  it('handles partial updates in fromJSON', () => {
    const component = new MeshComponent();
    component.meshType = 'cube';
    component.options = { size: [1, 1, 1] };

    // Update only material ID
    component.fromJSON({ 
      meshType: 'cube', // Required by type but logic checks existence
      materialAssetId: 'new-mat' 
    } as SerializedMeshComponent);

    expect(component.meshType).toBe('cube');
    expect(component.options).toEqual({ size: [1, 1, 1] });
    expect(component.materialAssetId).toBe('new-mat');
  });
});
