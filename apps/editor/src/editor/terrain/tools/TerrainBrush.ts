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
    const size = config.size ?? 5.0;
    const intensity = config.intensity ?? 1.0;
    
    // Validate and clamp values
    const validatedSize = Math.max(0.1, Math.min(1000, size));
    const validatedIntensity = Math.max(0, Math.min(1, intensity));
    
    this.config = {
      size: validatedSize,
      intensity: validatedIntensity,
      falloff: config.falloff ?? 'smooth',
      falloffCurve: config.falloffCurve,
    };
  }

  /**
   * Updates brush configuration with validation
   */
  updateConfig(config: Partial<BrushConfig>): void {
    const updates: Partial<BrushConfig> = {};
    
    if (config.size !== undefined) {
      updates.size = Math.max(0.1, Math.min(1000, config.size));
    }
    
    if (config.intensity !== undefined) {
      updates.intensity = Math.max(0, Math.min(1, config.intensity));
    }
    
    if (config.falloff !== undefined) {
      if (['linear', 'smooth', 'spherical'].includes(config.falloff)) {
        updates.falloff = config.falloff;
      }
    }
    
    if (config.falloffCurve !== undefined) {
      updates.falloffCurve = config.falloffCurve;
    }
    
    this.config = { ...this.config, ...updates };
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
   * Optimized to limit maximum number of points for performance
   */
  getSamplePoints(center: Vec3, sampleSpacing: number, maxPoints: number = 1000): Vec3[] {
    const { size } = this.config;
    const points: Vec3[] = [];

    // Validate inputs
    if (sampleSpacing <= 0 || !Number.isFinite(sampleSpacing)) {
      return points;
    }

    // Calculate optimal sample spacing if too many points would be generated
    const estimatedPoints = Math.ceil((size * 2) / sampleSpacing) ** 2;
    let effectiveSpacing = sampleSpacing;
    
    if (estimatedPoints > maxPoints) {
      // Increase spacing to limit points
      effectiveSpacing = (size * 2) / Math.sqrt(maxPoints);
    }

    const steps = Math.ceil((size * 2) / effectiveSpacing);
    const halfSteps = Math.floor(steps / 2);

    for (let z = -halfSteps; z <= halfSteps; z++) {
      for (let x = -halfSteps; x <= halfSteps; x++) {
        const worldX = center[0] + x * effectiveSpacing;
        const worldZ = center[2] + z * effectiveSpacing;
        const point: Vec3 = [worldX, center[1], worldZ];

        const distance = distanceVec3(center, point);
        if (distance <= size) {
          points.push(point);
          
          // Hard limit to prevent excessive memory usage
          if (points.length >= maxPoints) {
            return points;
          }
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

