import { MovementProfile } from './MovementProfile';
import { DEFAULT_CHARACTER_CONFIG } from '@engine/world';
import { FlyingExtension, SpeedBoostExtension, VehicleExtension } from './MovementProfileExtensions';

/**
 * Pre-defined movement profiles
 * 
 * These profiles provide common movement configurations
 * that can be used directly or as a base for custom profiles.
 */
export const PRESET_PROFILES = {
  /**
   * Standard human movement profile
   */
  HUMAN: MovementProfile.create({
    id: 'human',
    name: 'Human',
    description: 'Standard human movement with normal walking speed and jump height',
    config: {
      ...DEFAULT_CHARACTER_CONFIG,
    },
  }),

  /**
   * Fast human movement profile
   */
  FAST_HUMAN: MovementProfile.create({
    id: 'fast-human',
    name: 'Fast Human',
    description: 'Increased movement speed and sprint multiplier',
    config: {
      ...DEFAULT_CHARACTER_CONFIG,
      moveSpeed: 7.0,
      sprintMultiplier: 2.0,
      jumpForce: 10.0,
    },
  }),

  /**
   * Slow human movement profile
   */
  SLOW_HUMAN: MovementProfile.create({
    id: 'slow-human',
    name: 'Slow Human',
    description: 'Reduced movement speed and lower jump height',
    config: {
      ...DEFAULT_CHARACTER_CONFIG,
      moveSpeed: 3.0,
      sprintMultiplier: 1.2,
      jumpForce: 6.0,
      rotationSpeed: 5,
    },
  }),

  /**
   * Heavy human movement profile
   */
  HEAVY_HUMAN: MovementProfile.create({
    id: 'heavy-human',
    name: 'Heavy Human',
    description: 'Slower movement but higher jump force',
    config: {
      ...DEFAULT_CHARACTER_CONFIG,
      moveSpeed: 4.0,
      sprintMultiplier: 1.3,
      jumpForce: 12.0,
      gravityMultiplier: 1.2,
      airControlMultiplier: 0.2,
    },
  }),

  /**
   * Agile human movement profile
   */
  AGILE_HUMAN: MovementProfile.create({
    id: 'agile-human',
    name: 'Agile Human',
    description: 'Fast movement with high air control',
    config: {
      ...DEFAULT_CHARACTER_CONFIG,
      moveSpeed: 6.0,
      sprintMultiplier: 1.8,
      jumpForce: 9.0,
      airControlMultiplier: 0.6,
      rotationSpeed: 15,
    },
  }),

  /**
   * Flying human movement profile - enables flight mechanics
   */
  FLYING_HUMAN: MovementProfile.create({
    id: 'flying-human',
    name: 'Flying Human',
    description: 'Human movement with flight capability (Space to fly up, Ctrl/C to fly down)',
    config: {
      ...DEFAULT_CHARACTER_CONFIG,
      moveSpeed: 5.0,
      sprintMultiplier: 1.8,
      jumpForce: 8.0,
    },
    extensions: [new FlyingExtension()],
  }),

  /**
   * Speed boost human movement profile - temporarily increased speed
   */
  SPEED_BOOST_HUMAN: MovementProfile.create({
    id: 'speed-boost-human',
    name: 'Speed Boost Human',
    description: 'Human movement with speed boost (doubles movement speed)',
    config: {
      ...DEFAULT_CHARACTER_CONFIG,
      moveSpeed: 5.0,
    },
    extensions: [new SpeedBoostExtension(2.0, 1.5, 0, 0)], // Infinite duration, no cooldown
  }),

  /**
   * Vehicle mode profile - vehicle-like movement mechanics
   */
  VEHICLE_MODE: MovementProfile.create({
    id: 'vehicle-mode',
    name: 'Vehicle Mode',
    description: 'Vehicle-like movement with high speed and low air control',
    config: {
      ...DEFAULT_CHARACTER_CONFIG,
      moveSpeed: 5.0, // Base speed (will be multiplied by extension)
    },
    extensions: [new VehicleExtension(3.0)],
  }),
} as const;

/**
 * Get preset profile by ID
 */
export function getPresetProfile(id: keyof typeof PRESET_PROFILES): MovementProfile {
  return PRESET_PROFILES[id];
}

/**
 * Get all preset profile IDs
 */
export function getPresetProfileIds(): string[] {
  return Object.keys(PRESET_PROFILES);
}

