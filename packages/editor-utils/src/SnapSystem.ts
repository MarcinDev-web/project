/**
 * Snap-to-grid system for the editor.
 * Provides intelligent snapping of position, rotation, and scale to grid increments.
 */

import type { Vec3, Quat } from '@engine/core/math';
import { quatToEuler, quatFromEuler, quatNormalize } from '@engine/core/math';
import type { SnapConfig } from './SnapConfig';
import { DEFAULT_SNAP_CONFIG, validateSnapConfig } from './SnapConfig';

/**
 * SnapSystem handles snapping entities to grid increments.
 * Supports per-axis configuration and can snap position, rotation, and scale.
 */
export class SnapSystem {
  private config: SnapConfig;

  constructor(config?: Partial<SnapConfig>) {
    const merged: SnapConfig = {
      ...DEFAULT_SNAP_CONFIG,
      ...config,
      axes: { ...DEFAULT_SNAP_CONFIG.axes, ...(config?.axes ?? {}) },
      rotationAxes: { ...DEFAULT_SNAP_CONFIG.rotationAxes, ...(config?.rotationAxes ?? {}) },
    };
    const errors = validateSnapConfig(merged);
    if (errors.length) {
      throw new Error(`Invalid snap config: ${errors.join(', ')}`);
    }
    this.config = merged;
  }

  /**
   * Snaps a position to the nearest grid point.
   * @param position - Original position [x, y, z]
   * @param config - Optional configuration override for this call
   * @returns Snapped position
   */
  snapPosition(position: Vec3, config?: Partial<SnapConfig>): Vec3 {
    const cfg = config
      ? {
          ...this.config,
          ...config,
          axes: { ...this.config.axes, ...(config.axes ?? {}) },
        }
      : this.config;

    if (!cfg.enabled) {
      return [...position];
    }

    const result: Vec3 = [...position];
    const increment = cfg.increment;

    // Snap each axis independently based on configuration
    if (cfg.axes.x) {
      result[0] = this.snapValue(position[0], increment);
    }
    if (cfg.axes.y) {
      result[1] = this.snapValue(position[1], increment);
    }
    if (cfg.axes.z) {
      result[2] = this.snapValue(position[2], increment);
    }

    return result;
  }

  /**
   * Snaps a position in-place (mutates the input array).
   * Performance-optimized version for hot paths that avoids allocations.
   * @param position - Position to snap (will be mutated) [x, y, z]
   * @param out - Optional output array (if provided, input won't be mutated)
   * @param config - Optional configuration override for this call
   * @returns Snapped position (same reference as input or out)
   */
  snapPositionInPlace(
    position: Vec3,
    out?: Vec3,
    config?: Partial<SnapConfig>
  ): Vec3 {
    const cfg = config
      ? {
          ...this.config,
          ...config,
          axes: { ...this.config.axes, ...(config.axes ?? {}) },
        }
      : this.config;

    const result = out ?? position;

    if (!cfg.enabled) {
      if (out) {
        result[0] = position[0];
        result[1] = position[1];
        result[2] = position[2];
      }
      return result;
    }

    const increment = cfg.increment;

    // Snap each axis independently based on configuration
    if (cfg.axes.x) {
      result[0] = this.snapValue(position[0], increment);
    } else if (out) {
      result[0] = position[0];
    }
    if (cfg.axes.y) {
      result[1] = this.snapValue(position[1], increment);
    } else if (out) {
      result[1] = position[1];
    }
    if (cfg.axes.z) {
      result[2] = this.snapValue(position[2], increment);
    } else if (out) {
      result[2] = position[2];
    }

    return result;
  }

  /**
   * Snaps a rotation quaternion to the nearest rotation increment.
   * @param rotation - Original rotation quaternion [x, y, z, w]
   * @param config - Optional configuration override for this call
   * @returns Snapped rotation quaternion
   */
  snapRotation(rotation: Quat, config?: Partial<SnapConfig>): Quat {
    const cfg = config
      ? {
          ...this.config,
          ...config,
          rotationAxes: { ...this.config.rotationAxes, ...(config.rotationAxes ?? {}) },
        }
      : this.config;

    if (!cfg.enabled) {
      return [...rotation];
    }

    // Convert quaternion to Euler angles
    const euler = quatToEuler(rotation);

    // Snap each Euler angle based on per-axis configuration
    const increment = cfg.rotationIncrement;
    const snappedEuler: Vec3 = [
      cfg.rotationAxes.x ? this.snapValue(euler[0], increment) : euler[0],
      cfg.rotationAxes.y ? this.snapValue(euler[1], increment) : euler[1],
      cfg.rotationAxes.z ? this.snapValue(euler[2], increment) : euler[2],
    ];

    // Convert back to quaternion
    return quatNormalize(quatFromEuler(snappedEuler));
  }

  /**
   * Snaps a rotation quaternion in-place (mutates the input array).
   * Performance-optimized version for hot paths that avoids allocations.
   * Note: Due to quaternion normalization, this still creates a new array internally.
   * Use this method when you need to reuse the output array reference.
   * @param rotation - Rotation quaternion to snap (will be mutated) [x, y, z, w]
   * @param out - Optional output array (if provided, input won't be mutated)
   * @param config - Optional configuration override for this call
   * @returns Snapped rotation quaternion
   */
  snapRotationInPlace(
    rotation: Quat,
    out?: Quat,
    config?: Partial<SnapConfig>
  ): Quat {
    const cfg = config
      ? {
          ...this.config,
          ...config,
          rotationAxes: { ...this.config.rotationAxes, ...(config.rotationAxes ?? {}) },
        }
      : this.config;

    if (!cfg.enabled) {
      if (out) {
        out[0] = rotation[0];
        out[1] = rotation[1];
        out[2] = rotation[2];
        out[3] = rotation[3];
        return out;
      }
      return rotation;
    }

    // Convert quaternion to Euler angles
    const euler = quatToEuler(rotation);

    // Snap each Euler angle based on per-axis configuration
    const increment = cfg.rotationIncrement;
    const snappedEuler: Vec3 = [
      cfg.rotationAxes.x ? this.snapValue(euler[0], increment) : euler[0],
      cfg.rotationAxes.y ? this.snapValue(euler[1], increment) : euler[1],
      cfg.rotationAxes.z ? this.snapValue(euler[2], increment) : euler[2],
    ];

    // Convert back to quaternion (always creates new array due to normalization)
    const result = quatNormalize(quatFromEuler(snappedEuler));
    if (out) {
      out[0] = result[0];
      out[1] = result[1];
      out[2] = result[2];
      out[3] = result[3];
      return out;
    }
    // If no out provided, mutate input (though result is new array)
    rotation[0] = result[0];
    rotation[1] = result[1];
    rotation[2] = result[2];
    rotation[3] = result[3];
    return rotation;
  }

  /**
   * Snaps a scale vector to the nearest scale increment.
   * @param scale - Original scale [x, y, z]
   * @returns Snapped scale
   */
  snapScale(scale: Vec3): Vec3 {
    if (!this.config.enabled) {
      return [...scale];
    }

    const increment = this.config.scaleIncrement;
    const minScale = this.config.minScale;
    return [
      Math.max(minScale, this.snapValue(scale[0], increment)),
      Math.max(minScale, this.snapValue(scale[1], increment)),
      Math.max(minScale, this.snapValue(scale[2], increment)),
    ];
  }

  /**
   * Snaps a scale vector in-place (mutates the input array).
   * Performance-optimized version for hot paths that avoids allocations.
   * @param scale - Scale to snap (will be mutated) [x, y, z]
   * @param out - Optional output array (if provided, input won't be mutated)
   * @returns Snapped scale (same reference as input or out)
   */
  snapScaleInPlace(scale: Vec3, out?: Vec3): Vec3 {
    const result = out ?? scale;

    if (!this.config.enabled) {
      if (out) {
        result[0] = scale[0];
        result[1] = scale[1];
        result[2] = scale[2];
      }
      return result;
    }

    const increment = this.config.scaleIncrement;
    const minScale = this.config.minScale;

    result[0] = Math.max(minScale, this.snapValue(scale[0], increment));
    result[1] = Math.max(minScale, this.snapValue(scale[1], increment));
    result[2] = Math.max(minScale, this.snapValue(scale[2], increment));

    return result;
  }

  /**
   * Returns the nearest grid point for a given position.
   * This always snaps regardless of the enabled state.
   * @param position - Position to check
   * @returns Nearest grid point
   */
  getNearestGridPoint(position: Vec3): Vec3 {
    const increment = this.config.increment;
    return [
      this.snapValue(position[0], increment),
      this.snapValue(position[1], increment),
      this.snapValue(position[2], increment),
    ];
  }

  /**
   * Checks if two positions are on the same grid point.
   * @param pos1 - First position
   * @param pos2 - Second position
   * @returns true if both positions snap to the same grid point
   */
  areOnSameGridPoint(pos1: Vec3, pos2: Vec3): boolean {
    const grid1 = this.getNearestGridPoint(pos1);
    const grid2 = this.getNearestGridPoint(pos2);

    // Use epsilon relative to increment to handle different grid sizes correctly
    const epsilon = this.config.increment * 0.001;
    return (
      Math.abs(grid1[0] - grid2[0]) < epsilon &&
      Math.abs(grid1[1] - grid2[1]) < epsilon &&
      Math.abs(grid1[2] - grid2[2]) < epsilon
    );
  }

  /**
   * Updates the snap configuration.
   * @param config - Partial configuration to merge with current
   */
  setConfig(config: Partial<SnapConfig>): void {
    const next: SnapConfig = {
      ...this.config,
      ...config,
      axes: { ...this.config.axes, ...(config.axes ?? {}) },
      rotationAxes: { ...this.config.rotationAxes, ...(config.rotationAxes ?? {}) },
    };
    const errors = validateSnapConfig(next);
    if (errors.length) {
      throw new Error(`Invalid snap config: ${errors.join(', ')}`);
    }
    this.config = next;
  }

  /**
   * Gets the current snap configuration.
   * @returns Current configuration (copy)
   */
  getConfig(): SnapConfig {
    return {
      ...this.config,
      axes: { ...this.config.axes },
      rotationAxes: { ...this.config.rotationAxes },
    };
  }

  /**
   * Toggles snap on/off.
   */
  toggle(): void {
    this.config.enabled = !this.config.enabled;
  }

  /**
   * Enables snapping.
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disables snapping.
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Checks if snapping is currently enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Helper function to snap a single value to the nearest increment.
   * @param value - Value to snap
   * @param increment - Snap increment
   * @returns Snapped value
   */
  private snapValue(value: number, increment: number): number {
    // Handle invalid inputs
    if (!Number.isFinite(value) || !Number.isFinite(increment) || increment <= 0) {
      return value;
    }
    const snapped = Math.round(value / increment) * increment;
    // Normalize -0 to 0 for consistency (JavaScript distinguishes -0 from 0)
    return Object.is(snapped, -0) ? 0 : snapped;
  }

  /**
   * Synchronizes snap increment with grid cell size.
   * @param cellSize - Size of a grid cell in world units
   */
  syncSnapToGrid(cellSize: number): void {
    if (!(typeof cellSize === 'number' && Number.isFinite(cellSize) && cellSize > 0)) {
      throw new Error('cellSize must be a positive number');
    }
    this.setConfig({ increment: cellSize });
  }

  /**
   * Disposes of the snap system.
   * Currently a no-op, but included for consistency with other resources.
   */
  dispose(): void {
    // No resources to clean up, but method exists for API consistency
  }
}

