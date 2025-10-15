import { describe, it, expect } from 'vitest';
import { MaterialComponent } from './MaterialComponent';

describe('MaterialComponent', () => {
  it('clones and serializes material data', () => {
    const component = new MaterialComponent();
    component.color = [0.1, 0.2, 0.3, 1];
    component.metallic = 0.5;
    component.roughness = 0.2;

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
