import { describe, it, expect } from 'vitest';
import { MeshComponent } from './MeshComponent.js';

describe('MeshComponent', () => {
  it('clones and serializes mesh data', () => {
    const component = new MeshComponent();
    component.meshType = 'custom';
    const data = {
      vertices: new Float32Array([0, 1, 2]),
      indices: new Uint16Array([0, 1, 2]),
    };
    component.meshData = data;

    const clone = component.clone();
    expect(clone).not.toBe(component);
    expect(clone.meshType).toBe('custom');
    expect(clone.meshData).toEqual(data);

    const json = component.toJSON();
    const restored = new MeshComponent();
    restored.fromJSON(json);

    expect(restored.meshType).toBe('custom');
    expect(restored.meshData).toEqual(data);
  });
});
