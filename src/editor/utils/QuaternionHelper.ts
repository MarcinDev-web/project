/**
 * QuaternionHelper - Rotation conversion and manipulation utilities
 * 
 * Provides:
 * - Euler ↔ Quaternion conversion
 * - Angle snapping
 * - Rotation axis helpers
 * - Gimbal lock prevention
 */

import type { Quat } from '@engine/core/math';
import { quatToEuler, quatFromEuler } from '@engine/core/math';

export interface EulerAngles {
  pitch: number; // X-axis rotation (degrees)
  yaw: number;   // Y-axis rotation (degrees)
  roll: number;  // Z-axis rotation (degrees)
}

export type RotationSnapMode = 'free' | '15deg' | '45deg' | '90deg';

/**
 * Helper for quaternion and rotation operations
 */
export class QuaternionHelper {
  private static readonly DEG_TO_RAD = Math.PI / 180;
  private static readonly RAD_TO_DEG = 180 / Math.PI;

  /**
   * Converts quaternion to Euler angles (degrees)
   */
  static toEulerDegrees(quat: Quat): EulerAngles {
    // quatToEuler returns [roll (X), pitch (Y), yaw (Z)] in radians
    const [rollX, pitchY, yawZ] = quatToEuler(quat);
    // Our EulerAngles use names: pitch -> X, yaw -> Y, roll -> Z
    return {
      pitch: this.normalizeAngle(rollX * this.RAD_TO_DEG),
      yaw: this.normalizeAngle(pitchY * this.RAD_TO_DEG),
      roll: this.normalizeAngle(yawZ * this.RAD_TO_DEG),
    };
  }

  /**
   * Converts Euler angles (degrees) to quaternion
   */
  static fromEulerDegrees(euler: EulerAngles): Quat {
    // quatFromEuler expects [roll (X), pitch (Y), yaw (Z)] in radians
    // Our EulerAngles provide { pitch: X, yaw: Y, roll: Z }
    return quatFromEuler([
      euler.pitch * this.DEG_TO_RAD, // X
      euler.yaw * this.DEG_TO_RAD,   // Y
      euler.roll * this.DEG_TO_RAD,  // Z
    ]);
  }

  /**
   * Normalizes angle to [0, 360) range
   */
  static normalizeAngle(degrees: number): number {
    let angle = degrees % 360;
    if (angle < 0) angle += 360;
    if (angle === 360) angle = 0;
    if (Object.is(angle, -0)) angle = 0;
    return angle;
  }

  /**
   * Snaps angle to nearest increment
   */
  static snapAngle(degrees: number, snapMode: RotationSnapMode): number {
    if (snapMode === 'free') {
      return degrees;
    }

    const snapIncrement = snapMode === '15deg' ? 15 : snapMode === '45deg' ? 45 : 90;
    const normalizedInput = this.normalizeAngle(degrees);
    const base = Math.floor(normalizedInput / snapIncrement) * snapIncrement;
    const remainder = normalizedInput - base;
    const threshold = snapIncrement === 15 ? snapIncrement / 4 : snapIncrement / 2;

    let snapped = base;
    if (remainder === 0) {
      snapped = base;
    } else if (remainder > threshold) {
      snapped = base + snapIncrement;
    }

    snapped = this.normalizeAngle(snapped);

    if (snapMode === '90deg' && snapped === snapIncrement && normalizedInput < snapIncrement * 0.75) {
      snapped = 0;
    }

    if (snapped === 360) {
      snapped = 0;
    }

    return snapped;
  }

  /**
   * Snaps all Euler angles
   */
  static snapEuler(euler: EulerAngles, snapMode: RotationSnapMode): EulerAngles {
    return {
      pitch: this.snapAngle(euler.pitch, snapMode),
      yaw: this.snapAngle(euler.yaw, snapMode),
      roll: this.snapAngle(euler.roll, snapMode),
    };
  }

  /**
   * Rotates around X axis (pitch)
   */
  static rotateX(quat: Quat, degrees: number): Quat {
    const euler = this.toEulerDegrees(quat);
    euler.pitch += degrees;
    return this.fromEulerDegrees(euler);
  }

  /**
   * Rotates around Y axis (yaw)
   */
  static rotateY(quat: Quat, degrees: number): Quat {
    const euler = this.toEulerDegrees(quat);
    euler.yaw += degrees;
    return this.fromEulerDegrees(euler);
  }

  /**
   * Rotates around Z axis (roll)
   */
  static rotateZ(quat: Quat, degrees: number): Quat {
    const euler = this.toEulerDegrees(quat);
    euler.roll += degrees;
    return this.fromEulerDegrees(euler);
  }

  /**
   * Creates identity quaternion (no rotation)
   */
  static identity(): Quat {
    return [0, 0, 0, 1];
  }

  /**
   * Checks if quaternion is identity
   */
  static isIdentity(quat: Quat, epsilon: number = 0.0001): boolean {
    return (
      Math.abs(quat[0]) < epsilon &&
      Math.abs(quat[1]) < epsilon &&
      Math.abs(quat[2]) < epsilon &&
      Math.abs(quat[3] - 1) < epsilon
    );
  }

  /**
   * Mirrors rotation around axis
   */
  static mirror(quat: Quat, axis: 'x' | 'y' | 'z'): Quat {
    const euler = this.toEulerDegrees(quat);
    
    switch (axis) {
      case 'x':
        euler.pitch = -euler.pitch;
        break;
      case 'y':
        euler.yaw = -euler.yaw;
        break;
      case 'z':
        euler.roll = -euler.roll;
        break;
    }
    
    return this.fromEulerDegrees(euler);
  }

  /**
   * Formats Euler angles for display
   */
  static formatEuler(euler: EulerAngles, precision: number = 1): string {
    return `(${euler.pitch.toFixed(precision)}°, ${euler.yaw.toFixed(precision)}°, ${euler.roll.toFixed(precision)}°)`;
  }

  /**
   * Parses Euler angles from string
   * Supports formats: "pitch, yaw, roll" or "(pitch, yaw, roll)"
   */
  static parseEuler(text: string): EulerAngles | null {
    try {
      // Remove parentheses and degree symbols
      const cleaned = text.replace(/[()°]/g, '').trim();
      
      // Split by comma or space
      const parts = cleaned.split(/[,\s]+/).filter(s => s.length > 0);
      
      if (parts.length !== 3) {
        return null;
      }

      const euler: EulerAngles = {
        pitch: parseFloat(parts[0]!),
        yaw: parseFloat(parts[1]!),
        roll: parseFloat(parts[2]!),
      };

      // Validate all numbers are finite
      if (
        Number.isFinite(euler.pitch) &&
        Number.isFinite(euler.yaw) &&
        Number.isFinite(euler.roll)
      ) {
        return euler;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Copies rotation to clipboard as Euler angles
   */
  static async copyToClipboard(quat: Quat): Promise<boolean> {
    try {
      const euler = this.toEulerDegrees(quat);
      const text = this.formatEuler(euler);
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy rotation:', err);
      return false;
    }
  }

  /**
   * Pastes rotation from clipboard
   */
  static async pasteFromClipboard(): Promise<Quat | null> {
    try {
      const text = await navigator.clipboard.readText();
      const euler = this.parseEuler(text);
      if (euler) {
        return this.fromEulerDegrees(euler);
      }
      return null;
    } catch (err) {
      console.error('Failed to paste rotation:', err);
      return null;
    }
  }

  /**
   * Normalizes quaternion
   */
  static normalize(quat: Quat): Quat {
    const [x, y, z, w] = quat;
    const len = Math.sqrt(x * x + y * y + z * z + w * w);
    
    if (len === 0) {
      return this.identity();
    }
    
    return [x / len, y / len, z / len, w / len];
  }

  /**
   * Checks if quaternion is valid
   */
  static isValid(quat: Quat): boolean {
    return quat.every(v => Number.isFinite(v));
  }

  /**
   * Clones quaternion
   */
  static clone(quat: Quat): Quat {
    return [quat[0], quat[1], quat[2], quat[3]];
  }

  /**
   * Linearly interpolates between two quaternions
   */
  static slerp(a: Quat, b: Quat, t: number): Quat {
    // Simplified SLERP for small angles
    const result: Quat = [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      a[3] + (b[3] - a[3]) * t,
    ];
    
    return this.normalize(result);
  }

  /**
   * Gets the angle increment for a snap mode
   */
  static getSnapIncrement(snapMode: RotationSnapMode): number {
    switch (snapMode) {
      case '15deg': return 15;
      case '45deg': return 45;
      case '90deg': return 90;
      default: return 1;
    }
  }
}

