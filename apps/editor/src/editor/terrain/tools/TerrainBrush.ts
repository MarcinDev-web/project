/**
 * TerrainBrush - Brush system for terrain editing
 *
 * Provides brush falloff calculations and brush operations.
 */

import type { Vec3 } from '@engine/core/math';
import { distanceVec3 } from '@engine/core/math';

/**
 * Brush falloff types
 */
export type BrushFalloffType = 'linear' | 'smooth' | 'spherical';

/**
 * Brush configuration
 */
export interface BrushConfig {
  /** Brush size in world units */
  size: number;
  /** Brush intensity (0-1) */
  intensity: number;
  /** Brush falloff type */
  falloff: BrushFalloffType;
  /** Custom falloff curve (optional, overrides falloff type) */
  falloffCurve?: (distance: number, radius: number) => number;
}

/**
 * Brush operation types
 */
export type BrushOperation = 'raise' | 'lower' | 'smooth' | 'flatten' | 'pinch';

/**
 * TerrainBrush - Handles brush calculations and operations
 */
export class TerrainBrush {
  private config: BrushConfig;

  constructor(config: Partial<BrushConfig> = {}) {
    this.config = {
      size: 5.0,
      intensity: 1.0,
      falloff: 'smooth',
      ...config,
    };
  }

  /**
   * Updates brush configuration
   */
  updateConfig(config: Partial<BrushConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets brush configuration
   */
  getConfig(): Readonly<BrushConfig> {
    return { ...this.config };
  }

  /**
   * Calculates brush influence at given distance from center
   */
  getInfluence(distance: number): number {
    const { size, intensity, falloff, falloffCurve } = this.config;

    if (distance >= size) {
      return 0;
    }

    // Custom falloff curve takes precedence
    if (falloffCurve) {
      return falloffCurve(distance, size) * intensity;
    }

    // Normalized distance (0 at center, 1 at edge)
    const normalizedDist = distance / size;

    let influence: number;

    switch (falloff) {
      case 'linear':
        influence = 1 - normalizedDist;
        break;

      case 'smooth':
        // Smooth falloff (cosine curve)
        influence = 0.5 * (1 + Math.cos(Math.PI * normalizedDist));
        break;

      case 'spherical':
        // Spherical falloff (1 - r^2)
        influence = 1 - normalizedDist * normalizedDist;
        break;

      default:
        influence = 1 - normalizedDist;
    }

    return influence * intensity;
  }

  /**
   * Gets brush influence at world position
   */
  getInfluenceAt(center: Vec3, position: Vec3): number {
    const distance = distanceVec3(center, position);
    return this.getInfluence(distance);
  }

  /**
   * Calculates brush effect for raise/lower operations
   */
  calculateHeightDelta(
    center: Vec3,
    position: Vec3,
    operation: 'raise' | 'lower',
    strength: number
  ): number {
    const influence = this.getInfluenceAt(center, position);
    const direction = operation === 'raise' ? 1 : -1;
    return influence * strength * direction;
  }

  /**
   * Calculates brush effect for smooth operation
   */
  calculateSmoothFactor(center: Vec3, position: Vec3, strength: number): number {
    const influence = this.getInfluenceAt(center, position);
    return influence * strength;
  }

  /**
   * Calculates brush effect for flatten operation
   */
  calculateFlattenFactor(center: Vec3, position: Vec3, strength: number): number {
    const influence = this.getInfluenceAt(center, position);
    return influence * strength; // Returns factor, targetHeight applied separately
  }

  /**
   * Calculates brush effect for pinch operation
   */
  calculatePinchFactor(center: Vec3, position: Vec3, strength: number): number {
    const distance = distanceVec3(center, position);
    const { size } = this.config;

    if (distance >= size) {
      return 0;
    }

    const normalizedDist = distance / size;
    // Pinch: stronger at center, weaker at edges
    const influence = (1 - normalizedDist) * (1 - normalizedDist);
    return influence * strength;
  }

  /**
   * Gets sample points within brush radius (for efficient batch processing)
   */
  getSamplePoints(center: Vec3, sampleSpacing: number): Vec3[] {
    const { size } = this.config;
    const points: Vec3[] = [];

    const steps = Math.ceil((size * 2) / sampleSpacing);
    const halfSteps = Math.floor(steps / 2);

    for (let z = -halfSteps; z <= halfSteps; z++) {
      for (let x = -halfSteps; x <= halfSteps; x++) {
        const worldX = center[0] + x * sampleSpacing;
        const worldZ = center[2] + z * sampleSpacing;
        const point: Vec3 = [worldX, center[1], worldZ];

        const distance = distanceVec3(center, point);
        if (distance <= size) {
          points.push(point);
        }
      }
    }

    return points;
  }

  /**
   * Checks if position is within brush influence
   */
  isWithinRadius(center: Vec3, position: Vec3): boolean {
    const distance = distanceVec3(center, position);
    return distance <= this.config.size;
  }
}

