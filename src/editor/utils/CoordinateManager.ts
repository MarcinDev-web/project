/**
 * CoordinateManager - Utility for coordinate operations
 * 
 * Provides:
 * - Copy/paste coordinates
 * - Coordinate validation
 * - Formatting for display
 * - Relative positioning
 */

import type { Vec3 } from '../../math';

export interface CoordinateFormat {
  precision: number;
  separator: string;
}

const DEFAULT_FORMAT: CoordinateFormat = {
  precision: 3,
  separator: ', ',
};

/**
 * Manages coordinate operations for precise positioning
 */
export class CoordinateManager {
  /**
   * Formats coordinates for display
   */
  static format(coords: Vec3, format: CoordinateFormat = DEFAULT_FORMAT): string {
    return coords
      .map(v => v.toFixed(format.precision))
      .join(format.separator);
  }

  /**
   * Copies coordinates to clipboard
   */
  static async copyToClipboard(coords: Vec3): Promise<boolean> {
    try {
      const text = this.format(coords);
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy coordinates:', err);
      return false;
    }
  }

  /**
   * Parses coordinates from text
   * Supports formats: "x, y, z" or "x y z" or "[x, y, z]"
   */
  static parse(text: string): Vec3 | null {
    try {
      // Remove brackets and trim
      const cleaned = text.replace(/[\[\]]/g, '').trim();
      
      // Split by comma or space
      const parts = cleaned.split(/[,\s]+/).filter(s => s.length > 0);
      
      if (parts.length !== 3) {
        return null;
      }

      const coords: Vec3 = [
        parseFloat(parts[0]!),
        parseFloat(parts[1]!),
        parseFloat(parts[2]!),
      ];

      // Validate all numbers are finite
      if (coords.every(v => Number.isFinite(v))) {
        return coords;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Pastes coordinates from clipboard
   */
  static async pasteFromClipboard(): Promise<Vec3 | null> {
    try {
      const text = await navigator.clipboard.readText();
      return this.parse(text);
    } catch (err) {
      console.error('Failed to paste coordinates:', err);
      return null;
    }
  }

  /**
   * Validates coordinate value
   */
  static validate(value: number, min?: number, max?: number): boolean {
    if (!Number.isFinite(value)) {
      return false;
    }

    if (min !== undefined && value < min) {
      return false;
    }

    if (max !== undefined && value > max) {
      return false;
    }

    return true;
  }

  /**
   * Clamps coordinate value to range
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Rounds coordinate to precision
   */
  static round(value: number, precision: number = 3): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  /**
   * Snaps coordinate to grid
   */
  static snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize;
  }

  /**
   * Snaps all coordinates to grid
   */
  static snapVectorToGrid(coords: Vec3, gridSize: number): Vec3 {
    return [
      this.snapToGrid(coords[0], gridSize),
      this.snapToGrid(coords[1], gridSize),
      this.snapToGrid(coords[2], gridSize),
    ];
  }

  /**
   * Calculates relative position
   */
  static getRelativePosition(from: Vec3, to: Vec3): Vec3 {
    return [
      to[0] - from[0],
      to[1] - from[1],
      to[2] - from[2],
    ];
  }

  /**
   * Applies relative offset
   */
  static applyOffset(coords: Vec3, offset: Vec3): Vec3 {
    return [
      coords[0] + offset[0],
      coords[1] + offset[1],
      coords[2] + offset[2],
    ];
  }

  /**
   * Calculates distance between two positions
   */
  static distance(a: Vec3, b: Vec3): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Linearly interpolates between two positions
   */
  static lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  }

  /**
   * Validates vector has all finite values
   */
  static isValidVector(coords: Vec3): boolean {
    return coords.every(v => Number.isFinite(v));
  }

  /**
   * Creates a copy of coordinates
   */
  static clone(coords: Vec3): Vec3 {
    return [coords[0], coords[1], coords[2]];
  }

  /**
   * Checks if two vectors are equal within epsilon
   */
  static equals(a: Vec3, b: Vec3, epsilon: number = 0.0001): boolean {
    return (
      Math.abs(a[0] - b[0]) < epsilon &&
      Math.abs(a[1] - b[1]) < epsilon &&
      Math.abs(a[2] - b[2]) < epsilon
    );
  }
}

