import { describe, it, expect, vi } from 'vitest';
import { Component } from './Component';
import { registerComponent, getComponentConstructor } from './registry';
import { MaterialComponent } from './MaterialComponent';
import { MeshComponent } from './MeshComponent';

class TestComponent extends Component {
  getType(): string {
    return 'Test';
  }

  clone(): Component {
    return new TestComponent();
  }

  protected onAttach(): void {
    // noop
  }

  protected onDetach(): void {
    // noop
  }
}

describe('Component base class', () => {
  it('calls lifecycle hooks on attach/detach', () => {
    const component = new TestComponent();
    const onAttachSpy = vi.spyOn(component as any, 'onAttach');
    const onDetachSpy = vi.spyOn(component as any, 'onDetach');

    component._attach({} as any);
    component._detach();

    expect(onAttachSpy).toHaveBeenCalled();
    expect(onDetachSpy).toHaveBeenCalled();
  });
});

describe('Component registry', () => {
  it('registers and resolves component constructors', () => {
    const type = `Test_${Math.random().toString(16).slice(2)}`;
    registerComponent(type, TestComponent);
    expect(getComponentConstructor(type)).toBe(TestComponent);
  });
});

describe('MaterialComponent', () => {
  it('clones and serializes material properties', () => {
    const component = new MaterialComponent();
    component.color = [0.2, 0.4, 0.6, 1];
    component.metallic = 0.75;
    component.roughness = 0.25;

    const clone = component.clone();
    expect(clone).not.toBe(component);
    expect(clone.color).toEqual(component.color);
    expect(clone.metallic).toBe(component.metallic);
    expect(clone.roughness).toBe(component.roughness);

    const json = component.toJSON();
    const restored = new MaterialComponent();
    restored.fromJSON(json);

    expect(restored.color).toEqual(component.color);
    expect(restored.metallic).toBe(component.metallic);
    expect(restored.roughness).toBe(component.roughness);
  });
});

describe('MeshComponent', () => {
  it('clones and restores mesh data', () => {
    const component = new MeshComponent();
    component.meshType = 'custom';
    component.meshData = {
      vertices: new Float32Array([0, 1, 2]),
      indices: new Uint16Array([0, 1, 2]),
    };

    const clone = component.clone();
    expect(clone).not.toBe(component);
    expect(clone.meshType).toBe('custom');
    expect(clone.meshData).toEqual(component.meshData);

    const json = component.toJSON();
    const restored = new MeshComponent();
    restored.fromJSON(json);

    expect(restored.meshType).toBe('custom');
    expect(restored.meshData).toEqual(component.meshData);
  });
});
