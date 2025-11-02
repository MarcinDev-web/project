import { describe, it, expect } from 'vitest';
import { WaterComponent } from './WaterComponent';

describe('WaterComponent', () => {
  it('has correct default values', () => {
    const component = new WaterComponent();
    expect(component.size).toEqual([10, 10]);
    expect(component.waveSpeed).toBe(1.0);
    expect(component.waveHeight).toBe(0.3);
    expect(component.waveFrequency).toBe(1.0);
    expect(component.waveDirection).toEqual([1, 0]);
    expect(component.waterColor).toEqual([0.2, 0.5, 0.8, 0.7]);
    expect(component.foamColor).toEqual([1.0, 1.0, 1.0, 0.9]);
    expect(component.foamThreshold).toBe(0.7);
    expect(component.transparency).toBe(0.3);
    expect(component.refractionStrength).toBe(0.1);
    expect(component.reflectionStrength).toBe(0.8);
    expect(component.causticsEnabled).toBe(true);
    expect(component.enabled).toBe(true);
  });

  it('clones correctly', () => {
    const component = new WaterComponent();
    component.size = [20, 30];
    component.waveHeight = 0.5;
    component.enabled = false;

    const clone = component.clone();
    expect(clone).not.toBe(component);
    expect(clone.size).toEqual([20, 30]);
    expect(clone.waveHeight).toBe(0.5);
    expect(clone.enabled).toBe(false);
    // Ensure arrays are cloned (not references)
    expect(clone.size).not.toBe(component.size);
    expect(clone.waterColor).not.toBe(component.waterColor);
  });

  it('serializes and deserializes correctly', () => {
    const component = new WaterComponent();
    component.size = [15, 25];
    component.waveSpeed = 2.0;
    component.waveHeight = 0.4;
    component.waveFrequency = 1.5;
    component.waveDirection = [0.707, 0.707];
    component.waterColor = [0.1, 0.3, 0.6, 0.8];
    component.foamColor = [0.9, 0.9, 0.9, 1.0];
    component.foamThreshold = 0.8;
    component.transparency = 0.4;
    component.refractionStrength = 0.15;
    component.reflectionStrength = 0.9;
    component.causticsEnabled = false;
    component.enabled = false;

    const json = component.toJSON();
    const restored = new WaterComponent();
    restored.fromJSON(json);

    expect(restored.size).toEqual([15, 25]);
    expect(restored.waveSpeed).toBe(2.0);
    expect(restored.waveHeight).toBe(0.4);
    expect(restored.waveFrequency).toBe(1.5);
    expect(restored.waveDirection[0]).toBeCloseTo(0.707, 2);
    expect(restored.waveDirection[1]).toBeCloseTo(0.707, 2);
    expect(restored.waterColor).toEqual([0.1, 0.3, 0.6, 0.8]);
    expect(restored.foamColor).toEqual([0.9, 0.9, 0.9, 1.0]);
    expect(restored.foamThreshold).toBe(0.8);
    expect(restored.transparency).toBe(0.4);
    expect(restored.refractionStrength).toBe(0.15);
    expect(restored.reflectionStrength).toBe(0.9);
    expect(restored.causticsEnabled).toBe(false);
    expect(restored.enabled).toBe(false);
  });

  it('normalizes wave direction', () => {
    const component = new WaterComponent();
    component.waveDirection = [3, 4]; // Should normalize to [0.6, 0.8]
    component.normalizeWaveDirection();
    
    const len = Math.sqrt(
      component.waveDirection[0] * component.waveDirection[0] +
        component.waveDirection[1] * component.waveDirection[1]
    );
    expect(len).toBeCloseTo(1.0, 5);
  });

  it('handles invalid values in fromJSON gracefully', () => {
    const component = new WaterComponent();
    component.fromJSON({
      size: [5, 5], // Valid Vec2
      waveHeight: -1, // Invalid: negative
      waveFrequency: 0, // Invalid: too small
      foamThreshold: 1.5, // Invalid: > 1
      transparency: -0.5, // Invalid: negative
      reflectionStrength: 2.0, // Invalid: > 1
    });

    // Should clamp/validate values
    expect(component.size).toEqual([10, 10]); // Keeps default
    expect(component.waveHeight).toBeGreaterThanOrEqual(0);
    expect(component.waveFrequency).toBeGreaterThan(0.001);
    expect(component.foamThreshold).toBeLessThanOrEqual(1.0);
    expect(component.transparency).toBeGreaterThanOrEqual(0);
    expect(component.reflectionStrength).toBeLessThanOrEqual(1.0);
  });

  it('has correct type', () => {
    const component = new WaterComponent();
    expect(component.getType()).toBe('Water');
  });
});

