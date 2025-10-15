import { describe, it, expect } from 'vitest';
import { LightComponent } from '../scene/components/LightComponent';
import { Entity } from '../scene/Entity';

describe('LightComponent', () => {
  it('creates with default values', () => {
    const light = new LightComponent();
    expect(light.lightType).toBe('directional');
    expect(light.color).toEqual([1, 1, 1]);
    expect(light.intensity).toBe(1.0);
    expect(light.enabled).toBe(true);
  });

  it('can be attached to entity', () => {
    const entity = new Entity('Light');
    const light = new LightComponent();
    light.lightType = 'point';
    light.color = [1, 0.5, 0];
    light.intensity = 2.0;

    entity.addComponent(light);

    const retrieved = entity.getComponent(LightComponent);
    expect(retrieved).toBe(light);
    expect(retrieved?.lightType).toBe('point');
    expect(retrieved?.intensity).toBe(2.0);
  });

  it('clones correctly', () => {
    const light = new LightComponent();
    light.lightType = 'spot';
    light.color = [0.5, 0.7, 1.0];
    light.intensity = 1.5;
    light.range = 15.0;
    light.direction = [0, -1, 0];
    light.enabled = false;

    const clone = light.clone();

    expect(clone).not.toBe(light);
    expect(clone.lightType).toBe('spot');
    expect(clone.color).toEqual([0.5, 0.7, 1.0]);
    expect(clone.color).not.toBe(light.color); // Different array
    expect(clone.intensity).toBe(1.5);
    expect(clone.range).toBe(15.0);
    expect(clone.direction).toEqual([0, -1, 0]);
    expect(clone.enabled).toBe(false);
  });

  it('serializes and deserializes', () => {
    const light = new LightComponent();
    light.lightType = 'point';
    light.color = [1, 0.8, 0.6];
    light.intensity = 2.5;
    light.range = 20.0;

    const json = light.toJSON();
    const restored = new LightComponent();
    restored.fromJSON(json);

    expect(restored.lightType).toBe('point');
    expect(restored.color).toEqual([1, 0.8, 0.6]);
    expect(restored.intensity).toBe(2.5);
    expect(restored.range).toBe(20.0);
  });

  it('supports directional light type', () => {
    const light = new LightComponent();
    light.lightType = 'directional';
    light.direction = [0.5, -0.7, 0.1];

    expect(light.lightType).toBe('directional');
    expect(light.direction).toEqual([0.5, -0.7, 0.1]);
  });

  it('supports point light type', () => {
    const light = new LightComponent();
    light.lightType = 'point';
    light.range = 25.0;

    expect(light.lightType).toBe('point');
    expect(light.range).toBe(25.0);
  });

  it('supports spot light type', () => {
    const light = new LightComponent();
    light.lightType = 'spot';
    light.innerConeAngle = Math.PI / 8;
    light.outerConeAngle = Math.PI / 4;

    expect(light.lightType).toBe('spot');
    expect(light.innerConeAngle).toBe(Math.PI / 8);
    expect(light.outerConeAngle).toBe(Math.PI / 4);
  });

  it('supports ambient light type', () => {
    const light = new LightComponent();
    light.lightType = 'ambient';
    light.color = [0.2, 0.2, 0.3];
    light.intensity = 0.3;

    expect(light.lightType).toBe('ambient');
    expect(light.color).toEqual([0.2, 0.2, 0.3]);
  });

  it('can be disabled', () => {
    const light = new LightComponent();
    expect(light.enabled).toBe(true);

    light.enabled = false;
    expect(light.enabled).toBe(false);
  });
});
