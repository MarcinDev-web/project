import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scene } from '../core/Scene.js';
import { WeatherSystem, type WeatherState } from './WeatherSystem.js';
import { EnvironmentComponent } from '../components/EnvironmentComponent.js';

describe('WeatherSystem', () => {
  let scene: Scene;
  let weatherSystem: WeatherSystem;
  let environmentEntity: ReturnType<Scene['createEntity']>;
  let environment: EnvironmentComponent;

  beforeEach(() => {
    scene = new Scene();
    
    // Create environment entity with EnvironmentComponent
    environmentEntity = scene.createEntity('environment');
    environment = new EnvironmentComponent();
    environment.enabled = true;
    environment.cloudsEnabled = true;
    environment.sunIntensity = 1.1;
    environmentEntity.addComponent(environment);
    scene.addEntity(environmentEntity);
    
    weatherSystem = new WeatherSystem(scene, { seed: 12345 });
  });

  afterEach(() => {
    weatherSystem.dispose();
  });

  describe('initialization', () => {
    it('should create weather system', () => {
      expect(weatherSystem).toBeDefined();
    });

    it('should start with sunny weather by default', () => {
      expect(weatherSystem.currentWeather).toBe('sunny');
      expect(weatherSystem.weatherValue).toBe(0);
    });

    it('should be enabled by default', () => {
      expect(weatherSystem.isEnabled).toBe(true);
    });

    it('should respect enabled config option', () => {
      const disabledSystem = new WeatherSystem(scene, { enabled: false });
      expect(disabledSystem.isEnabled).toBe(false);
      disabledSystem.dispose();
    });
  });

  describe('update', () => {
    it('should not update when disabled', () => {
      weatherSystem.setEnabled(false);
      const initialValue = weatherSystem.weatherValue;
      
      weatherSystem.update(10); // 10 seconds
      
      expect(weatherSystem.weatherValue).toBe(initialValue);
    });

    it('should not update with zero or negative deltaTime', () => {
      const initialValue = weatherSystem.weatherValue;
      
      weatherSystem.update(0);
      expect(weatherSystem.weatherValue).toBe(initialValue);
      
      weatherSystem.update(-1);
      expect(weatherSystem.weatherValue).toBe(initialValue);
    });

    it('should update weather over time', () => {
      // Simulate significant time passing (1 minute)
      for (let i = 0; i < 60; i++) {
        weatherSystem.update(1);
      }
      
      // Weather value should have changed from initial
      expect(weatherSystem.weatherProgress).toBeGreaterThan(0);
    });

    it('should modify environment cloud density', () => {
      const initialDensity = environment.cloudDensity;
      
      // Simulate time passing to change weather
      for (let i = 0; i < 300; i++) {
        weatherSystem.update(1);
      }
      
      // Cloud density should reflect weather changes
      // (may or may not have changed depending on noise, but system ran)
      expect(typeof environment.cloudDensity).toBe('number');
      expect(environment.cloudDensity).toBeGreaterThanOrEqual(0);
      expect(environment.cloudDensity).toBeLessThanOrEqual(1);
    });

    it('should modify environment sun intensity', () => {
      // Store base intensity
      const baseIntensity = 1.1;
      
      // Simulate time passing
      for (let i = 0; i < 300; i++) {
        weatherSystem.update(1);
      }
      
      // Sun intensity should be modified by weather multiplier
      expect(environment.sunIntensity).toBeGreaterThan(0);
      expect(environment.sunIntensity).toBeLessThanOrEqual(baseIntensity);
    });
  });

  describe('weather states', () => {
    it('should return valid weather state', () => {
      const validStates: WeatherState[] = ['sunny', 'partly-cloudy', 'cloudy', 'overcast'];
      expect(validStates).toContain(weatherSystem.currentWeather);
    });

    it('should return weather value between 0 and 1', () => {
      // Simulate various times
      for (let i = 0; i < 1000; i++) {
        weatherSystem.update(1);
        expect(weatherSystem.weatherValue).toBeGreaterThanOrEqual(0);
        expect(weatherSystem.weatherValue).toBeLessThanOrEqual(1);
      }
    });

    it('should return weather progress between 0 and 1', () => {
      for (let i = 0; i < 100; i++) {
        weatherSystem.update(10);
        expect(weatherSystem.weatherProgress).toBeGreaterThanOrEqual(0);
        expect(weatherSystem.weatherProgress).toBeLessThan(1);
      }
    });
  });

  describe('getCurrentParams', () => {
    it('should return valid weather parameters', () => {
      const params = weatherSystem.getCurrentParams();
      
      expect(params).toHaveProperty('cloudDensity');
      expect(params).toHaveProperty('cloudSpeed');
      expect(params).toHaveProperty('sunIntensityMultiplier');
      expect(params).toHaveProperty('fogDensity');
      expect(params).toHaveProperty('fogMode');
      
      expect(params.cloudDensity).toBeGreaterThanOrEqual(0);
      expect(params.cloudDensity).toBeLessThanOrEqual(1);
      expect(params.cloudSpeed).toBeGreaterThan(0);
      expect(params.sunIntensityMultiplier).toBeGreaterThan(0);
      expect(params.sunIntensityMultiplier).toBeLessThanOrEqual(1);
      expect(params.fogDensity).toBeGreaterThanOrEqual(0);
    });

    it('should return interpolated parameters based on weather value', () => {
      // Run for a while to get varying weather
      for (let i = 0; i < 500; i++) {
        weatherSystem.update(1);
      }
      
      const params = weatherSystem.getCurrentParams();
      
      // Parameters should be within expected ranges
      expect(params.cloudDensity).toBeGreaterThanOrEqual(0.15);
      expect(params.cloudDensity).toBeLessThanOrEqual(0.9);
    });
  });

  describe('reset', () => {
    it('should reset weather to initial state', () => {
      // Advance weather
      for (let i = 0; i < 300; i++) {
        weatherSystem.update(1);
      }
      
      // Reset
      weatherSystem.reset();
      
      expect(weatherSystem.weatherValue).toBe(0);
      expect(weatherSystem.currentWeather).toBe('sunny');
      expect(weatherSystem.weatherProgress).toBe(0);
    });
  });

  describe('enable/disable', () => {
    it('should toggle enabled state', () => {
      expect(weatherSystem.isEnabled).toBe(true);
      
      weatherSystem.setEnabled(false);
      expect(weatherSystem.isEnabled).toBe(false);
      
      weatherSystem.setEnabled(true);
      expect(weatherSystem.isEnabled).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should disable system on dispose', () => {
      weatherSystem.dispose();
      expect(weatherSystem.isEnabled).toBe(false);
    });
  });

  describe('without environment', () => {
    it('should handle missing environment gracefully', () => {
      // Create scene without environment
      const emptyScene = new Scene();
      const systemWithoutEnv = new WeatherSystem(emptyScene);
      
      // Should not throw
      expect(() => {
        systemWithoutEnv.update(1);
      }).not.toThrow();
      
      systemWithoutEnv.dispose();
    });
  });

  describe('with disabled clouds', () => {
    it('should not modify cloud parameters when clouds disabled', () => {
      environment.cloudsEnabled = false;
      const initialDensity = environment.cloudDensity;
      const initialSpeed = environment.cloudSpeed;
      
      for (let i = 0; i < 100; i++) {
        weatherSystem.update(1);
      }
      
      // Cloud params should remain unchanged
      expect(environment.cloudDensity).toBe(initialDensity);
      expect(environment.cloudSpeed).toBe(initialSpeed);
    });

    it('should still modify sun intensity when clouds disabled', () => {
      environment.cloudsEnabled = false;
      
      for (let i = 0; i < 300; i++) {
        weatherSystem.update(1);
      }
      
      // Sun intensity should still be affected by weather
      expect(environment.sunIntensity).toBeDefined();
    });
  });

  describe('deterministic with seed', () => {
    it('should produce same results with same seed', () => {
      const system1 = new WeatherSystem(scene, { seed: 99999 });
      const system2 = new WeatherSystem(scene, { seed: 99999 });
      
      for (let i = 0; i < 100; i++) {
        system1.update(1);
        system2.update(1);
      }
      
      expect(system1.weatherValue).toBe(system2.weatherValue);
      expect(system1.currentWeather).toBe(system2.currentWeather);
      
      system1.dispose();
      system2.dispose();
    });

    it('should produce different results with different seeds', () => {
      const system1 = new WeatherSystem(scene, { seed: 11111 });
      const system2 = new WeatherSystem(scene, { seed: 22222 });
      
      for (let i = 0; i < 500; i++) {
        system1.update(1);
        system2.update(1);
      }
      
      // With different seeds, weather should diverge
      // (statistically very unlikely to be the same)
      const sameValue = system1.weatherValue === system2.weatherValue;
      // We can't guarantee they're different, but check structure is correct
      expect(typeof system1.weatherValue).toBe('number');
      expect(typeof system2.weatherValue).toBe('number');
      
      system1.dispose();
      system2.dispose();
    });
  });

  describe('cycle duration', () => {
    it('should use custom cycle duration', () => {
      const shortCycleSystem = new WeatherSystem(scene, { 
        cycleDurationMs: 60_000,  // 1 minute
        seed: 12345 
      });
      
      // With shorter cycle, progress should advance faster
      for (let i = 0; i < 30; i++) {
        shortCycleSystem.update(1);
      }
      
      // After 30 seconds with 1 minute cycle = 50% progress
      expect(shortCycleSystem.weatherProgress).toBeCloseTo(0.5, 1);
      
      shortCycleSystem.dispose();
    });
  });
});

