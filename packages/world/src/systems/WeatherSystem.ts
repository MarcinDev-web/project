/**
 * WeatherSystem - Dynamic weather simulation with natural transitions
 * 
 * Automatically modifies EnvironmentComponent parameters over time to create
 * realistic weather changes: cloud density, sun intensity, fog, and wind.
 */

import type { Scene } from '../core/Scene.js';
import { EnvironmentComponent, type FogMode } from '../components/EnvironmentComponent.js';

/**
 * Weather states representing different atmospheric conditions
 */
export type WeatherState = 'sunny' | 'partly-cloudy' | 'cloudy' | 'overcast';

/**
 * Internal parameters for each weather state
 */
interface WeatherParams {
  cloudDensity: number;
  cloudSpeed: number;
  sunIntensityMultiplier: number;
  fogDensity: number;
  fogMode: FogMode;
}

/**
 * Configuration for WeatherSystem
 */
export interface WeatherSystemConfig {
  /** Duration of a full weather cycle in milliseconds (default: 900000 = 15 minutes) */
  cycleDurationMs?: number;
  /** Whether the weather system is enabled (default: true) */
  enabled?: boolean;
  /** Random seed for reproducible weather patterns (optional) */
  seed?: number;
}

/**
 * Weather parameter presets for each state
 */
const WEATHER_PRESETS: Record<WeatherState, WeatherParams> = {
  'sunny': {
    cloudDensity: 0.15,
    cloudSpeed: 0.03,
    sunIntensityMultiplier: 1.0,
    fogDensity: 0.0,
    fogMode: 'none',
  },
  'partly-cloudy': {
    cloudDensity: 0.4,
    cloudSpeed: 0.05,
    sunIntensityMultiplier: 0.85,
    fogDensity: 0.005,
    fogMode: 'none',
  },
  'cloudy': {
    cloudDensity: 0.65,
    cloudSpeed: 0.07,
    sunIntensityMultiplier: 0.6,
    fogDensity: 0.015,
    fogMode: 'exponential',
  },
  'overcast': {
    cloudDensity: 0.9,
    cloudSpeed: 0.1,
    sunIntensityMultiplier: 0.35,
    fogDensity: 0.025,
    fogMode: 'exponential',
  },
};

/**
 * Simple 1D Simplex-like noise for smooth weather transitions
 * Based on a simplified gradient noise approach
 */
class SimpleNoise {
  private permutation: number[];

  constructor(seed: number = Math.random() * 10000) {
    // Generate permutation table from seed
    this.permutation = this.generatePermutation(seed);
  }

  private generatePermutation(seed: number): number[] {
    const perm: number[] = [];
    for (let i = 0; i < 256; i++) {
      perm[i] = i;
    }
    
    // Fisher-Yates shuffle with seeded random
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [perm[i], perm[j]] = [perm[j]!, perm[i]!];
    }
    
    // Duplicate for wrapping
    return [...perm, ...perm];
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number): number {
    return (hash & 1) === 0 ? x : -x;
  }

  /**
   * 1D noise function returning value in range [0, 1]
   */
  noise1D(x: number): number {
    const xi = Math.floor(x) & 255;
    const xf = x - Math.floor(x);
    
    const u = this.fade(xf);
    
    const a = this.permutation[xi]!;
    const b = this.permutation[xi + 1]!;
    
    const result = this.lerp(
      this.grad(a, xf),
      this.grad(b, xf - 1),
      u
    );
    
    // Normalize from [-1, 1] to [0, 1]
    return (result + 1) * 0.5;
  }

  /**
   * Fractal Brownian Motion for more natural variation
   */
  fbm(x: number, octaves: number = 4): number {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise1D(x * frequency);
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value / maxValue;
  }
}

/**
 * WeatherSystem manages dynamic weather changes in the scene
 * 
 * @example
 * ```typescript
 * const weatherSystem = new WeatherSystem(scene, { cycleDurationMs: 900_000 });
 * 
 * // In game loop
 * function update(deltaTime: number) {
 *   weatherSystem.update(deltaTime);
 * }
 * ```
 */
export class WeatherSystem {
  private readonly scene: Scene;
  private readonly noise: SimpleNoise;
  private readonly cycleDurationMs: number;
  private enabled: boolean;
  
  private elapsedTime: number = 0;
  private baseSunIntensity: number = 1.1;
  private cachedWeatherValue: number = 0;
  private cachedWeatherState: WeatherState = 'sunny';

  constructor(scene: Scene, config?: WeatherSystemConfig) {
    this.scene = scene;
    this.cycleDurationMs = config?.cycleDurationMs ?? 900_000; // 15 minutes default
    this.enabled = config?.enabled ?? true;
    this.noise = new SimpleNoise(config?.seed);
    
    // Cache initial sun intensity from environment
    this.initializeFromEnvironment();
  }

  /**
   * Initialize base values from current environment
   */
  private initializeFromEnvironment(): void {
    const environment = this.getEnvironment();
    if (environment) {
      this.baseSunIntensity = environment.sunIntensity;
    }
  }

  /**
   * Get the EnvironmentComponent from the scene
   */
  private getEnvironment(): EnvironmentComponent | undefined {
    const entities = this.scene.queryEntities(EnvironmentComponent);
    for (const entity of entities) {
      const env = entity.getComponent(EnvironmentComponent);
      if (env?.enabled) {
        return env;
      }
    }
    return undefined;
  }

  /**
   * Calculate weather value (0-1) based on noise
   */
  private calculateWeatherValue(): number {
    // Convert elapsed time to a slowly changing value
    // Using cycleDurationMs to control how fast weather changes
    const timeScale = this.elapsedTime / this.cycleDurationMs;
    
    // Use FBM for more natural, layered variation
    // Multiple frequencies create both gradual trends and local variations
    const baseWeather = this.noise.fbm(timeScale * 2, 4);
    
    // Add slight secondary variation for micro-changes
    const microVariation = this.noise.noise1D(timeScale * 8) * 0.1;
    
    return Math.max(0, Math.min(1, baseWeather + microVariation));
  }

  /**
   * Map weather value (0-1) to weather state
   */
  private valueToState(value: number): WeatherState {
    if (value < 0.25) return 'sunny';
    if (value < 0.5) return 'partly-cloudy';
    if (value < 0.75) return 'cloudy';
    return 'overcast';
  }

  /**
   * Interpolate between two weather parameter sets
   */
  private interpolateParams(from: WeatherParams, to: WeatherParams, t: number): WeatherParams {
    return {
      cloudDensity: this.lerp(from.cloudDensity, to.cloudDensity, t),
      cloudSpeed: this.lerp(from.cloudSpeed, to.cloudSpeed, t),
      sunIntensityMultiplier: this.lerp(from.sunIntensityMultiplier, to.sunIntensityMultiplier, t),
      fogDensity: this.lerp(from.fogDensity, to.fogDensity, t),
      // Use the target fog mode when past midpoint
      fogMode: t > 0.5 ? to.fogMode : from.fogMode,
    };
  }

  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Get interpolated weather parameters based on current weather value
   */
  private getInterpolatedParams(weatherValue: number): WeatherParams {
    // Determine which two states we're between
    let fromState: WeatherState;
    let toState: WeatherState;
    let localT: number;

    if (weatherValue < 0.25) {
      fromState = 'sunny';
      toState = 'partly-cloudy';
      localT = weatherValue / 0.25;
    } else if (weatherValue < 0.5) {
      fromState = 'partly-cloudy';
      toState = 'cloudy';
      localT = (weatherValue - 0.25) / 0.25;
    } else if (weatherValue < 0.75) {
      fromState = 'cloudy';
      toState = 'overcast';
      localT = (weatherValue - 0.5) / 0.25;
    } else {
      fromState = 'cloudy';
      toState = 'overcast';
      localT = (weatherValue - 0.75) / 0.25;
    }

    // Smooth the transition with ease-in-out
    const smoothT = localT * localT * (3 - 2 * localT);

    return this.interpolateParams(
      WEATHER_PRESETS[fromState],
      WEATHER_PRESETS[toState],
      smoothT
    );
  }

  /**
   * Apply weather parameters to the environment
   */
  private applyToEnvironment(params: WeatherParams): void {
    const environment = this.getEnvironment();
    if (!environment) return;

    // Only update if clouds are enabled in the environment
    if (environment.cloudsEnabled) {
      environment.cloudDensity = params.cloudDensity;
      environment.cloudSpeed = params.cloudSpeed;
    }

    // Update sun intensity (multiply base by weather modifier)
    environment.sunIntensity = this.baseSunIntensity * params.sunIntensityMultiplier;

    // Update fog settings
    environment.fogMode = params.fogMode;
    environment.fogDensity = params.fogDensity;
  }

  /**
   * Update weather system (call each frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!this.enabled) return;
    if (!(deltaTime > 0)) return;

    // Accumulate time (convert to milliseconds for cycle calculation)
    this.elapsedTime += deltaTime * 1000;

    // Calculate current weather
    this.cachedWeatherValue = this.calculateWeatherValue();
    this.cachedWeatherState = this.valueToState(this.cachedWeatherValue);

    // Get interpolated parameters and apply
    const params = this.getInterpolatedParams(this.cachedWeatherValue);
    this.applyToEnvironment(params);
  }

  /**
   * Get current weather state
   */
  get currentWeather(): WeatherState {
    return this.cachedWeatherState;
  }

  /**
   * Get current weather value (0-1)
   * 0 = sunny, 1 = overcast
   */
  get weatherValue(): number {
    return this.cachedWeatherValue;
  }

  /**
   * Get progress within current weather cycle (0-1)
   */
  get weatherProgress(): number {
    return (this.elapsedTime % this.cycleDurationMs) / this.cycleDurationMs;
  }

  /**
   * Check if weather system is enabled
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable the weather system
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Reset weather to initial state
   */
  reset(): void {
    this.elapsedTime = 0;
    this.cachedWeatherValue = 0;
    this.cachedWeatherState = 'sunny';
  }

  /**
   * Get the current weather parameters (for debugging/UI)
   */
  getCurrentParams(): WeatherParams {
    return this.getInterpolatedParams(this.cachedWeatherValue);
  }

  /**
   * Dispose of the weather system
   */
  dispose(): void {
    this.enabled = false;
  }
}

