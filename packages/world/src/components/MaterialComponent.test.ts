import { describe, it, expect } from 'vitest';
import { MaterialComponent } from './MaterialComponent.js';

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

  it('syncs opacity with primaryColor alpha', () => {
    const component = new MaterialComponent();
    
    // Set opacity via setter
    component.opacity = 0.5;
    expect(component.primaryColor[3]).toBe(0.5);
    expect(component.opacity).toBe(0.5);

    // Set opacity via primaryColor
    component.primaryColor = [1, 0, 0, 0.8];
    expect(component.opacity).toBe(0.8);
  });

  it('preserves alphaMode when changing opacity', () => {
    const component = new MaterialComponent();
    component.alphaMode = 'mask';
    
    // Changing opacity should NOT change alphaMode to 'blend' automatically
    component.opacity = 0.5;
    expect(component.alphaMode).toBe('mask');
    
    // But flags should update to include TRANSPARENT because opacity < 1
    expect((component.flags & MaterialComponent.FLAG_TRANSPARENT) !== 0).toBe(true);
  });

  it('clamps materialId correctly', () => {
    const component = new MaterialComponent();
    
    component.materialId = -5;
    expect(component.materialId).toBe(0);

    component.materialId = 100;
    expect(component.materialId).toBe(MaterialComponent.MAX_MATERIAL_ID);

    component.materialId = 5.5;
    expect(component.materialId).toBe(5);
  });

  it('handles legacy JSON with color and opacity', () => {
    const component = new MaterialComponent();
    component.fromJSON({
      color: [0, 1, 0, 1],
      opacity: 0.5
    });

    expect(component.primaryColor).toEqual([0, 1, 0, 0.5]);
    expect(component.opacity).toBe(0.5);
  });

  it('updates flags correctly', () => {
    const component = new MaterialComponent();
    
    // Emissive flag
    component.emissiveColor = [1, 0, 0, 1];
    component.emissiveIntensity = 1;
    expect((component.flags & MaterialComponent.FLAG_EMISSIVE) !== 0).toBe(true);

    component.emissiveIntensity = 0;
    expect((component.flags & MaterialComponent.FLAG_EMISSIVE) !== 0).toBe(false);

    // Transparent flag
    component.opacity = 1;
    component.alphaMode = 'opaque';
    expect((component.flags & MaterialComponent.FLAG_TRANSPARENT) !== 0).toBe(false);

    component.opacity = 0.9;
    expect((component.flags & MaterialComponent.FLAG_TRANSPARENT) !== 0).toBe(true);
    
    component.opacity = 1;
    component.alphaMode = 'blend';
    expect((component.flags & MaterialComponent.FLAG_TRANSPARENT) !== 0).toBe(true);
  });
});
