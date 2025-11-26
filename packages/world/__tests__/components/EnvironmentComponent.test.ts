import { describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentComponent } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

describe('EnvironmentComponent', () => {
  let component: EnvironmentComponent;

  beforeEach(() => {
    component = new EnvironmentComponent();
  });

  describe('Construction and Type', () => {
    it('should have correct type identifier', () => {
      expect(component.getType()).toBe('Environment');
      expect(EnvironmentComponent.type).toBe('Environment');
    });

    it('should initialize with default values', () => {
      expect(component.skyboxType).toBe('procedural-sky');
      expect(component.skyColor).toEqual([0.2, 0.33, 0.62]);
      expect(component.horizonColor).toEqual([0.32, 0.45, 0.68]);
      expect(component.groundColor).toEqual([0.08, 0.1, 0.16]);
      expect(component.sunDirection).toEqual([0.3, 0.7, 0.5]);
      expect(component.sunColor).toEqual([1.05, 1.0, 0.9]);
      expect(component.sunIntensity).toBe(1.1);
      expect(component.fogMode).toBe('none');
      expect(component.fogColor).toEqual([0.7, 0.8, 0.9]);
      expect(component.fogNear).toBe(10.0);
      expect(component.fogFar).toBe(100.0);
      expect(component.fogDensity).toBe(0.02);
      expect(component.ambientIntensity).toBe(0.35);
      expect(component.exposure).toBe(1.0);
      expect(component.enabled).toBe(true);
      expect(component.cloudsEnabled).toBe(true);
      expect(component.cloudDensity).toBe(0.55);
      expect(component.cloudSpeed).toBe(0.04);
      expect(component.visualPreset).toBeUndefined();
    });
  });

  describe('Skybox Types', () => {
    it('should support solid skybox type', () => {
      component.skyboxType = 'solid';
      expect(component.skyboxType).toBe('solid');
    });

    it('should support gradient skybox type', () => {
      component.skyboxType = 'gradient';
      expect(component.skyboxType).toBe('gradient');
    });

    it('should support procedural-sky type', () => {
      component.skyboxType = 'procedural-sky';
      expect(component.skyboxType).toBe('procedural-sky');
    });

    it('should support cubemap type', () => {
      component.skyboxType = 'cubemap';
      expect(component.skyboxType).toBe('cubemap');
    });

    it('should support physical-sky type', () => {
      component.skyboxType = 'physical-sky';
      expect(component.skyboxType).toBe('physical-sky');
    });
  });

  describe('Physical Sky Parameters (Rayleigh/Mie)', () => {
    it('should initialize with default atmospheric values', () => {
      expect(component.rayleigh).toBe(2.0);
      expect(component.turbidity).toBe(4.0);
      expect(component.mieCoefficient).toBe(0.005);
      expect(component.mieDirectionalG).toBe(0.8);
    });

    it('should allow setting rayleigh coefficient', () => {
      component.rayleigh = 3.5;
      expect(component.rayleigh).toBe(3.5);
    });

    it('should allow setting turbidity', () => {
      component.turbidity = 8.0;
      expect(component.turbidity).toBe(8.0);
    });

    it('should allow setting mie coefficient', () => {
      component.mieCoefficient = 0.01;
      expect(component.mieCoefficient).toBe(0.01);
    });

    it('should allow setting mie directional G', () => {
      component.mieDirectionalG = 0.5;
      expect(component.mieDirectionalG).toBe(0.5);
    });

    it('should handle extreme rayleigh values', () => {
      component.rayleigh = 0;
      expect(component.rayleigh).toBe(0);
      component.rayleigh = 10;
      expect(component.rayleigh).toBe(10);
    });

    it('should handle mieDirectionalG range', () => {
      component.mieDirectionalG = -1;
      expect(component.mieDirectionalG).toBe(-1);
      component.mieDirectionalG = 1;
      expect(component.mieDirectionalG).toBe(1);
    });
  });

  describe('Sun Direction Normalization', () => {
    it('should normalize sun direction', () => {
      component.sunDirection = [1, 1, 1];
      component.normalizeSunDirection();

      const length = Math.sqrt(
        component.sunDirection[0] ** 2 +
          component.sunDirection[1] ** 2 +
          component.sunDirection[2] ** 2
      );
      expect(length).toBeCloseTo(1.0, 5);
    });

    it('should handle zero vector by setting to default upward direction', () => {
      component.sunDirection = [0, 0, 0];
      component.normalizeSunDirection();

      expect(component.sunDirection).toEqual([0, 1, 0]);
    });

    it('should handle very small vectors', () => {
      component.sunDirection = [0.00001, 0, 0];
      component.normalizeSunDirection();

      expect(component.sunDirection).toEqual([0, 1, 0]);
    });
  });

  describe('Time of Day', () => {
    it('should set sunrise at 6am', () => {
      component.setTimeOfDay(6);
      expect(component.sunDirection[1]).toBeCloseTo(0, 1); // Horizon
    });

    it('should set noon at 12pm with sun at zenith', () => {
      component.setTimeOfDay(12);
      expect(component.sunDirection[1]).toBeGreaterThan(0.8); // High elevation
      expect(component.sunIntensity).toBe(1.1);
    });

    it('should set sunset at 18pm', () => {
      component.setTimeOfDay(18);
      expect(component.sunDirection[1]).toBeCloseTo(0, 1); // Horizon
    });

    it('should set night colors at midnight', () => {
      component.setTimeOfDay(0);
      expect(component.skyColor[0]).toBeLessThan(0.1);
      expect(component.skyColor[1]).toBeLessThan(0.1);
      expect(component.skyColor[2]).toBeLessThan(0.1);
      expect(component.sunIntensity).toBe(0.0);
    });

    it('should set dawn colors at 7am', () => {
      component.setTimeOfDay(7);
      expect(component.horizonColor[0]).toBeGreaterThanOrEqual(0.5); // Reddish
      expect(component.sunIntensity).toBeGreaterThan(0);
      expect(component.sunIntensity).toBeLessThan(1.0);
    });

    it('should set dusk colors at 19pm', () => {
      component.setTimeOfDay(19);
      expect(component.horizonColor[0]).toBeGreaterThanOrEqual(0.5); // Reddish
      expect(component.sunIntensity).toBeGreaterThan(0);
      expect(component.sunIntensity).toBeLessThan(1.0);
    });

    it('should set day colors during daytime', () => {
      component.setTimeOfDay(14); // 2pm
      expect(component.skyColor).toEqual([0.2, 0.33, 0.62]);
      expect(component.horizonColor).toEqual([0.32, 0.45, 0.68]);
      expect(component.sunIntensity).toBe(1.1);
    });

    it('should handle 24-hour wrap around', () => {
      component.setTimeOfDay(25); // Should be same as 1am
      expect(component.sunIntensity).toBe(0.0); // Night
    });

    it('should handle negative hours', () => {
      component.setTimeOfDay(-1); // Should be same as 23pm
      expect(component.sunIntensity).toBe(0.0); // Night
    });
  });

  describe('Fog Modes', () => {
    it('should support no fog', () => {
      component.fogMode = 'none';
      expect(component.fogMode).toBe('none');
    });

    it('should support linear fog', () => {
      component.fogMode = 'linear';
      component.fogNear = 5.0;
      component.fogFar = 50.0;
      expect(component.fogMode).toBe('linear');
      expect(component.fogNear).toBe(5.0);
      expect(component.fogFar).toBe(50.0);
    });

    it('should support exponential fog', () => {
      component.fogMode = 'exponential';
      component.fogDensity = 0.05;
      expect(component.fogMode).toBe('exponential');
      expect(component.fogDensity).toBe(0.05);
    });

    it('should support exponential-squared fog', () => {
      component.fogMode = 'exponential-squared';
      component.fogDensity = 0.03;
      expect(component.fogMode).toBe('exponential-squared');
      expect(component.fogDensity).toBe(0.03);
    });
  });

  describe('Color Properties', () => {
    it('should allow setting sky color', () => {
      const newColor: Vec3 = [0.2, 0.4, 0.8];
      component.skyColor = newColor;
      expect(component.skyColor).toEqual(newColor);
    });

    it('should allow setting horizon color', () => {
      const newColor: Vec3 = [1.0, 0.5, 0.3];
      component.horizonColor = newColor;
      expect(component.horizonColor).toEqual(newColor);
    });

    it('should allow setting ground color', () => {
      const newColor: Vec3 = [0.1, 0.2, 0.15];
      component.groundColor = newColor;
      expect(component.groundColor).toEqual(newColor);
    });

    it('should allow setting sun color', () => {
      const newColor: Vec3 = [1.0, 0.8, 0.6];
      component.sunColor = newColor;
      expect(component.sunColor).toEqual(newColor);
    });

    it('should allow setting fog color', () => {
      const newColor: Vec3 = [0.5, 0.6, 0.7];
      component.fogColor = newColor;
      expect(component.fogColor).toEqual(newColor);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      component.skyboxType = 'gradient';
      component.skyColor = [0.1, 0.2, 0.3];
      component.sunIntensity = 0.8;
      component.fogMode = 'linear';
      component.enabled = true;

      const json = component.toJSON();

      expect(json.skyboxType).toBe('gradient');
      expect(json.skyColor).toEqual([0.1, 0.2, 0.3]);
      expect(json.sunIntensity).toBe(0.8);
      expect(json.fogMode).toBe('linear');
      expect(json.enabled).toBe(true);
    });

    it('should serialize all color properties', () => {
      const json = component.toJSON();

      expect(json.skyColor).toBeDefined();
      expect(json.horizonColor).toBeDefined();
      expect(json.groundColor).toBeDefined();
      expect(json.sunColor).toBeDefined();
      expect(json.fogColor).toBeDefined();
    });

    it('should serialize fog properties', () => {
      component.fogMode = 'exponential';
      component.fogNear = 15.0;
      component.fogFar = 200.0;
      component.fogDensity = 0.04;

      const json = component.toJSON();

      expect(json.fogMode).toBe('exponential');
      expect(json.fogNear).toBe(15.0);
      expect(json.fogFar).toBe(200.0);
      expect(json.fogDensity).toBe(0.04);
    });

    it('should serialize physical sky parameters', () => {
      component.skyboxType = 'physical-sky';
      component.rayleigh = 3.0;
      component.turbidity = 6.0;
      component.mieCoefficient = 0.008;
      component.mieDirectionalG = 0.6;

      const json = component.toJSON();

      expect(json.skyboxType).toBe('physical-sky');
      expect(json.rayleigh).toBe(3.0);
      expect(json.turbidity).toBe(6.0);
      expect(json.mieCoefficient).toBe(0.008);
      expect(json.mieDirectionalG).toBe(0.6);
    });
  });

  describe('Deserialization', () => {
    it('should deserialize from JSON', () => {
      const data = {
        skyboxType: 'solid' as const,
        skyColor: [0.5, 0.5, 0.5] as Vec3,
        horizonColor: [0.6, 0.6, 0.6] as Vec3,
        sunIntensity: 0.7,
        fogMode: 'exponential' as const,
        fogDensity: 0.03,
        enabled: false,
      };

      component.fromJSON(data);

      expect(component.skyboxType).toBe('solid');
      expect(component.skyColor).toEqual([0.5, 0.5, 0.5]);
      expect(component.horizonColor).toEqual([0.6, 0.6, 0.6]);
      expect(component.sunIntensity).toBe(0.7);
      expect(component.fogMode).toBe('exponential');
      expect(component.fogDensity).toBe(0.03);
      expect(component.enabled).toBe(false);
    });

    it('should handle partial data', () => {
      const originalSkyColor = [...component.skyColor];
      const data = {
        sunIntensity: 0.5,
      };

      component.fromJSON(data);

      expect(component.sunIntensity).toBe(0.5);
      expect(component.skyColor).toEqual(originalSkyColor); // Unchanged
    });

    it('should validate array lengths for colors', () => {
      const originalColor = [...component.skyColor];
      const data = {
        skyColor: [0.5, 0.5], // Invalid: only 2 elements
      };

      component.fromJSON(data as never);

      expect(component.skyColor).toEqual(originalColor); // Should remain unchanged
    });

    it('should deserialize physical sky parameters', () => {
      const data = {
        skyboxType: 'physical-sky' as const,
        rayleigh: 2.5,
        turbidity: 5.0,
        mieCoefficient: 0.006,
        mieDirectionalG: 0.7,
      };

      component.fromJSON(data);

      expect(component.skyboxType).toBe('physical-sky');
      expect(component.rayleigh).toBe(2.5);
      expect(component.turbidity).toBe(5.0);
      expect(component.mieCoefficient).toBe(0.006);
      expect(component.mieDirectionalG).toBe(0.7);
    });

    it('should clamp physical sky parameters from JSON', () => {
      const data = {
        rayleigh: 15.0, // Should clamp to 10
        turbidity: 25.0, // Should clamp to 20
        mieCoefficient: 0.2, // Should clamp to 0.1
        mieDirectionalG: 2.0, // Should clamp to 1
      };

      component.fromJSON(data);

      expect(component.rayleigh).toBe(10);
      expect(component.turbidity).toBe(20);
      expect(component.mieCoefficient).toBe(0.1);
      expect(component.mieDirectionalG).toBe(1);
    });
  });

  describe('Clone', () => {
    it('should create a deep copy', () => {
      component.skyboxType = 'gradient';
      component.skyColor = [0.1, 0.2, 0.3];
      component.sunDirection = [0.5, 0.5, 0.5];
      component.fogMode = 'linear';
      component.enabled = false;

      const clone = component.clone();

      expect(clone).not.toBe(component);
      expect(clone.skyboxType).toBe(component.skyboxType);
      expect(clone.skyColor).toEqual(component.skyColor);
      expect(clone.skyColor).not.toBe(component.skyColor); // Different array
      expect(clone.sunDirection).toEqual(component.sunDirection);
      expect(clone.sunDirection).not.toBe(component.sunDirection); // Different array
      expect(clone.fogMode).toBe(component.fogMode);
      expect(clone.enabled).toBe(component.enabled);
    });

    it('should clone all vector properties independently', () => {
      const clone = component.clone();

      component.skyColor[0] = 999;
      component.horizonColor[1] = 999;
      component.groundColor[2] = 999;
      component.sunDirection[0] = 999;
      component.sunColor[1] = 999;
      component.fogColor[2] = 999;

      expect(clone.skyColor[0]).not.toBe(999);
      expect(clone.horizonColor[1]).not.toBe(999);
      expect(clone.groundColor[2]).not.toBe(999);
      expect(clone.sunDirection[0]).not.toBe(999);
      expect(clone.sunColor[1]).not.toBe(999);
      expect(clone.fogColor[2]).not.toBe(999);
    });

    it('should clone physical sky parameters', () => {
      component.skyboxType = 'physical-sky';
      component.rayleigh = 3.5;
      component.turbidity = 7.0;
      component.mieCoefficient = 0.009;
      component.mieDirectionalG = 0.65;

      const clone = component.clone();

      expect(clone.skyboxType).toBe('physical-sky');
      expect(clone.rayleigh).toBe(3.5);
      expect(clone.turbidity).toBe(7.0);
      expect(clone.mieCoefficient).toBe(0.009);
      expect(clone.mieDirectionalG).toBe(0.65);
    });
  });

  describe('Round-trip Serialization', () => {
    it('should survive round-trip serialization', () => {
      component.skyboxType = 'procedural-sky';
      component.skyColor = [0.2, 0.3, 0.4];
      component.horizonColor = [0.5, 0.6, 0.7];
      component.groundColor = [0.1, 0.15, 0.2];
      component.sunDirection = [0.3, 0.8, 0.4];
      component.sunColor = [1.0, 0.9, 0.85];
      component.sunIntensity = 0.9;
      component.fogMode = 'exponential';
      component.fogColor = [0.8, 0.85, 0.9];
      component.fogNear = 20.0;
      component.fogFar = 150.0;
      component.fogDensity = 0.025;
      component.ambientIntensity = 0.4;
      component.exposure = 1.2;
      component.enabled = false;

      const json = component.toJSON();
      const newComponent = new EnvironmentComponent();
      newComponent.fromJSON(json);

      expect(newComponent.skyboxType).toBe(component.skyboxType);
      expect(newComponent.skyColor).toEqual(component.skyColor);
      expect(newComponent.horizonColor).toEqual(component.horizonColor);
      expect(newComponent.groundColor).toEqual(component.groundColor);
      expect(newComponent.sunDirection[0]).toBeCloseTo(component.sunDirection[0]!, 12);
      expect(newComponent.sunDirection[1]).toBeCloseTo(component.sunDirection[1]!, 12);
      expect(newComponent.sunDirection[2]).toBeCloseTo(component.sunDirection[2]!, 12);
      expect(newComponent.sunColor).toEqual(component.sunColor);
      expect(newComponent.sunIntensity).toBe(component.sunIntensity);
      expect(newComponent.fogMode).toBe(component.fogMode);
      expect(newComponent.fogColor).toEqual(component.fogColor);
      expect(newComponent.fogNear).toBe(component.fogNear);
      expect(newComponent.fogFar).toBe(component.fogFar);
      expect(newComponent.fogDensity).toBe(component.fogDensity);
      expect(newComponent.ambientIntensity).toBe(component.ambientIntensity);
      expect(newComponent.exposure).toBe(component.exposure);
      expect(newComponent.enabled).toBe(component.enabled);
    });
  });

  describe('Ambient Intensity', () => {
    it('should allow setting ambient intensity', () => {
      component.ambientIntensity = 0.5;
      expect(component.ambientIntensity).toBe(0.5);
    });

    it('should support zero ambient light', () => {
      component.ambientIntensity = 0.0;
      expect(component.ambientIntensity).toBe(0.0);
    });

    it('should support high ambient light', () => {
      component.ambientIntensity = 1.5;
      expect(component.ambientIntensity).toBe(1.5);
    });
  });

  describe('Exposure', () => {
    it('should allow setting exposure', () => {
      component.exposure = 2.0;
      expect(component.exposure).toBe(2.0);
    });

    it('should support low exposure', () => {
      component.exposure = 0.5;
      expect(component.exposure).toBe(0.5);
    });
  });

  describe('Enable/Disable', () => {
    it('should be enabled by default', () => {
      expect(component.enabled).toBe(true);
    });

    it('should allow disabling', () => {
      component.enabled = false;
      expect(component.enabled).toBe(false);
    });

    it('should allow re-enabling', () => {
      component.enabled = false;
      component.enabled = true;
      expect(component.enabled).toBe(true);
    });
  });

  describe('Cloud Properties', () => {
    it('should initialize with default cloud values', () => {
      expect(component.cloudsEnabled).toBe(true);
      expect(component.cloudDensity).toBe(0.55);
      expect(component.cloudSpeed).toBe(0.04);
    });

    it('should allow enabling clouds', () => {
      component.cloudsEnabled = false;
      expect(component.cloudsEnabled).toBe(false);
      component.cloudsEnabled = true;
      expect(component.cloudsEnabled).toBe(true);
    });

    it('should allow setting cloud density', () => {
      component.cloudDensity = 0.7;
      expect(component.cloudDensity).toBe(0.7);
    });

    it('should not auto-clamp cloud density on assignment (clamped via fromJSON)', () => {
      component.cloudDensity = -0.1;
      expect(component.cloudDensity).toBe(-0.1);
      component.cloudDensity = 1.5;
      expect(component.cloudDensity).toBe(1.5);
    });

    it('should allow setting cloud speed', () => {
      component.cloudSpeed = 0.05;
      expect(component.cloudSpeed).toBe(0.05);
    });

    it('should not auto-clamp cloud speed on assignment (clamped via fromJSON)', () => {
      component.cloudSpeed = -0.1;
      expect(component.cloudSpeed).toBe(-0.1);
      component.cloudSpeed = 1.5;
      expect(component.cloudSpeed).toBe(1.5);
    });
  });

  describe('Visual Preset', () => {
    it('should initialize without preset', () => {
      expect(component.visualPreset).toBeUndefined();
    });

    it('should allow setting stylized-balanced preset', () => {
      component.visualPreset = 'stylized-balanced';
      expect(component.visualPreset).toBe('stylized-balanced');
    });

    it('should allow setting cinematic preset', () => {
      component.visualPreset = 'cinematic';
      expect(component.visualPreset).toBe('cinematic');
    });

    it('should allow setting low preset', () => {
      component.visualPreset = 'low';
      expect(component.visualPreset).toBe('low');
    });

    it('should allow clearing preset', () => {
      component.visualPreset = 'stylized-balanced';
      component.visualPreset = undefined;
      expect(component.visualPreset).toBeUndefined();
    });
  });

  describe('Cloud Serialization', () => {
    it('should serialize cloud properties', () => {
      component.cloudsEnabled = true;
      component.cloudDensity = 0.6;
      component.cloudSpeed = 0.04;

      const json = component.toJSON();

      expect(json.cloudsEnabled).toBe(true);
      expect(json.cloudDensity).toBe(0.6);
      expect(json.cloudSpeed).toBe(0.04);
    });

    it('should deserialize cloud properties', () => {
      const data = {
        cloudsEnabled: true,
        cloudDensity: 0.5,
        cloudSpeed: 0.02,
      };

      component.fromJSON(data);

      expect(component.cloudsEnabled).toBe(true);
      expect(component.cloudDensity).toBe(0.5);
      expect(component.cloudSpeed).toBe(0.02);
    });

    it('should serialize visual preset', () => {
      component.visualPreset = 'stylized-balanced';

      const json = component.toJSON();

      expect(json.visualPreset).toBe('stylized-balanced');
    });

    it('should deserialize visual preset', () => {
      const data = {
        visualPreset: 'cinematic' as const,
      };

      component.fromJSON(data);

      expect(component.visualPreset).toBe('cinematic');
    });

    it('should ignore invalid visual preset values', () => {
      const originalPreset = component.visualPreset;
      const data = {
        visualPreset: 'invalid-preset' as never,
      };

      component.fromJSON(data);

      expect(component.visualPreset).toBe(originalPreset);
    });
  });

  describe('Cloud Clone', () => {
    it('should clone cloud properties', () => {
      component.cloudsEnabled = true;
      component.cloudDensity = 0.7;
      component.cloudSpeed = 0.05;
      component.visualPreset = 'stylized-balanced';

      const clone = component.clone();

      expect(clone.cloudsEnabled).toBe(component.cloudsEnabled);
      expect(clone.cloudDensity).toBe(component.cloudDensity);
      expect(clone.cloudSpeed).toBe(component.cloudSpeed);
      expect(clone.visualPreset).toBe(component.visualPreset);
    });
  });

  describe('Legacy Upgrade', () => {
    it('should upgrade previously dark defaults to the new palette', () => {
      const legacy = new EnvironmentComponent();
      legacy.fromJSON({
        skyColor: [0.05, 0.08, 0.12] as Vec3,
        horizonColor: [0.15, 0.18, 0.22] as Vec3,
        groundColor: [0.05, 0.06, 0.08] as Vec3,
        sunColor: [1.0, 0.95, 0.8] as Vec3,
        sunIntensity: 1.0,
        ambientIntensity: 0.3,
      });

      expect(legacy.skyColor).toEqual([0.2, 0.33, 0.62]);
      expect(legacy.horizonColor).toEqual([0.32, 0.45, 0.68]);
      expect(legacy.groundColor).toEqual([0.08, 0.1, 0.16]);
      expect(legacy.sunColor).toEqual([1.05, 1.0, 0.9]);
      expect(legacy.sunIntensity).toBe(1.1);
      expect(legacy.ambientIntensity).toBe(0.35);
      expect(legacy.cloudsEnabled).toBe(true);
    });

    it('should upgrade classic bright defaults to the new palette', () => {
      const legacy = new EnvironmentComponent();
      legacy.fromJSON({
        skyColor: [0.4, 0.6, 0.9] as Vec3,
        horizonColor: [0.8, 0.85, 0.9] as Vec3,
        groundColor: [0.3, 0.35, 0.4] as Vec3,
        sunColor: [1.0, 0.95, 0.8] as Vec3,
        sunIntensity: 1.0,
        ambientIntensity: 0.6,
      });

      expect(legacy.skyColor).toEqual([0.2, 0.33, 0.62]);
      expect(legacy.horizonColor).toEqual([0.32, 0.45, 0.68]);
      expect(legacy.groundColor).toEqual([0.08, 0.1, 0.16]);
      expect(legacy.sunColor).toEqual([1.05, 1.0, 0.9]);
      expect(legacy.sunIntensity).toBe(1.1);
      expect(legacy.ambientIntensity).toBe(0.35);
    });
  });
});

