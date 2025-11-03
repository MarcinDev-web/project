import { WaterComponent } from '../components/WaterComponent.js';
import type { Vec2, Vec4 } from '@engine/core/math';

/**
 * Water preset types for common water scenarios
 */
export type WaterPresetType =
  | 'calm_lake'
  | 'ocean'
  | 'pool'
  | 'river'
  | 'pond'
  | 'stormy_ocean';

/**
 * Create a water component from a preset
 * @param preset - Water preset type
 * @param size - Optional custom size [width, height]. Defaults based on preset
 * @returns New WaterComponent instance
 */
export function createWater(preset: WaterPresetType, size?: Vec2): WaterComponent {
  const water = new WaterComponent();

  // Apply preset-specific defaults
  switch (preset) {
    case 'calm_lake':
      water.size = size || [50, 50];
      water.waveSpeed = 0.5;
      water.waveHeight = 0.1;
      water.waveFrequency = 0.5;
      water.waveDirection = [1, 0];
      water.waterColor = [0.15, 0.4, 0.6, 0.75];
      water.foamColor = [1.0, 1.0, 1.0, 0.8];
      water.foamThreshold = 0.85;
      water.transparency = 0.25;
      water.refractionStrength = 0.05;
      water.reflectionStrength = 0.9;
      water.causticsEnabled = true;
      break;

    case 'ocean':
      water.size = size || [200, 200];
      water.waveSpeed = 1.5;
      water.waveHeight = 0.5;
      water.waveFrequency = 1.2;
      water.waveDirection = [1, 0.3];
      water.waterColor = [0.1, 0.3, 0.5, 0.8];
      water.foamColor = [1.0, 1.0, 1.0, 0.9];
      water.foamThreshold = 0.6;
      water.transparency = 0.2;
      water.refractionStrength = 0.15;
      water.reflectionStrength = 0.7;
      water.causticsEnabled = true;
      break;

    case 'pool':
      water.size = size || [10, 10];
      water.waveSpeed = 0.2;
      water.waveHeight = 0.05;
      water.waveFrequency = 0.3;
      water.waveDirection = [1, 0];
      water.waterColor = [0.2, 0.6, 0.9, 0.85];
      water.foamColor = [1.0, 1.0, 1.0, 0.7];
      water.foamThreshold = 0.9;
      water.transparency = 0.15;
      water.refractionStrength = 0.08;
      water.reflectionStrength = 0.95;
      water.causticsEnabled = true;
      break;

    case 'river':
      water.size = size || [100, 20];
      water.waveSpeed = 2.0;
      water.waveHeight = 0.2;
      water.waveFrequency = 1.5;
      water.waveDirection = [1, 0];
      water.waterColor = [0.2, 0.5, 0.7, 0.7];
      water.foamColor = [1.0, 1.0, 1.0, 0.85];
      water.foamThreshold = 0.7;
      water.transparency = 0.3;
      water.refractionStrength = 0.12;
      water.reflectionStrength = 0.75;
      water.causticsEnabled = false; // Rivers usually too shallow
      break;

    case 'pond':
      water.size = size || [15, 15];
      water.waveSpeed = 0.3;
      water.waveHeight = 0.08;
      water.waveFrequency = 0.4;
      water.waveDirection = [1, 0.2];
      water.waterColor = [0.15, 0.35, 0.55, 0.7];
      water.foamColor = [1.0, 1.0, 1.0, 0.75];
      water.foamThreshold = 0.8;
      water.transparency = 0.35;
      water.refractionStrength = 0.06;
      water.reflectionStrength = 0.85;
      water.causticsEnabled = true;
      break;

    case 'stormy_ocean':
      water.size = size || [200, 200];
      water.waveSpeed = 2.5;
      water.waveHeight = 1.0;
      water.waveFrequency = 1.8;
      water.waveDirection = [1, 0.5];
      water.waterColor = [0.05, 0.15, 0.3, 0.9];
      water.foamColor = [1.0, 1.0, 1.0, 1.0];
      water.foamThreshold = 0.4;
      water.transparency = 0.1;
      water.refractionStrength = 0.25;
      water.reflectionStrength = 0.5;
      water.causticsEnabled = false;
      break;
  }

  water.normalizeWaveDirection();
  return water;
}

/**
 * Create a custom water component with manual parameters
 * @param config - Custom water configuration
 * @returns New WaterComponent instance
 */
export function createCustomWater(config: {
  size?: Vec2;
  waveSpeed?: number;
  waveHeight?: number;
  waveFrequency?: number;
  waveDirection?: Vec2;
  waterColor?: Vec4;
  foamColor?: Vec4;
  foamThreshold?: number;
  transparency?: number;
  refractionStrength?: number;
  reflectionStrength?: number;
  causticsEnabled?: boolean;
}): WaterComponent {
  const water = new WaterComponent();

  if (config.size) water.size = config.size;
  if (typeof config.waveSpeed === 'number') water.waveSpeed = config.waveSpeed;
  if (typeof config.waveHeight === 'number') water.waveHeight = config.waveHeight;
  if (typeof config.waveFrequency === 'number') water.waveFrequency = config.waveFrequency;
  if (config.waveDirection) {
    water.waveDirection = config.waveDirection;
    water.normalizeWaveDirection();
  }
  if (config.waterColor) water.waterColor = config.waterColor;
  if (config.foamColor) water.foamColor = config.foamColor;
  if (typeof config.foamThreshold === 'number') water.foamThreshold = config.foamThreshold;
  if (typeof config.transparency === 'number') water.transparency = config.transparency;
  if (typeof config.refractionStrength === 'number')
    water.refractionStrength = config.refractionStrength;
  if (typeof config.reflectionStrength === 'number')
    water.reflectionStrength = config.reflectionStrength;
  if (typeof config.causticsEnabled === 'boolean') water.causticsEnabled = config.causticsEnabled;

  return water;
}

/**
 * Helper to add water to an entity in a scene
 * @param entity - Entity to add water to
 * @param preset - Water preset type
 * @param size - Optional custom size
 * @returns The created WaterComponent
 */
export function addWaterToEntity(
  entity: import('../core/Entity.js').Entity,
  preset: WaterPresetType,
  size?: Vec2
): WaterComponent {
  const water = createWater(preset, size);
  entity.addComponent(water);
  return water;
}

