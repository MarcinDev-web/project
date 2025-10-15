/**
 * RotationController - Advanced rotation control system
 * 
 * Features:
 * - Snap modes (15°, 45°, 90°, free)
 * - Keyboard rotation
 * - Copy/paste/mirror rotation
 * - Rotation history
 */

import type { Entity } from '../../scene';
import type { Quat } from '../../math';
import { QuaternionHelper, type RotationSnapMode, type EulerAngles } from '../utils/QuaternionHelper';
import { Logger } from '../../logger';

export interface RotationControllerConfig {
  onRotationChanged?: (entity: Entity, rotation: Quat) => void;
  onStatusMessage?: (message: string, duration?: number) => void;
}

/**
 * Manages advanced rotation controls
 */
export class RotationController {
  private snapMode: RotationSnapMode = '45deg';
  private copiedRotation: Quat | null = null;

  constructor(private readonly config: RotationControllerConfig = {}) {}

  /**
   * Gets current snap mode
   */
  getSnapMode(): RotationSnapMode {
    return this.snapMode;
  }

  /**
   * Sets snap mode
   */
  setSnapMode(mode: RotationSnapMode): void {
    this.snapMode = mode;
    this.config.onStatusMessage?.(
      `Rotation snap: ${mode === 'free' ? 'Free' : mode}`,
      1000
    );
    Logger.debug(`Rotation snap mode: ${mode}`);
  }

  /**
   * Cycles through snap modes
   */
  cycleSnapMode(): RotationSnapMode {
    const modes: RotationSnapMode[] = ['free', '15deg', '45deg', '90deg'];
    const currentIndex = modes.indexOf(this.snapMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex]!;
    this.setSnapMode(nextMode);
    return nextMode;
  }

  /**
   * Rotates entity around X axis
   */
  rotateX(entity: Entity, degrees: number): void {
    const newRotation = QuaternionHelper.rotateX(entity.transform.rotation, degrees);
    const snapped = this.applySnap(newRotation);
    entity.transform.rotation = snapped;
    this.config.onRotationChanged?.(entity, snapped);
  }

  /**
   * Rotates entity around Y axis
   */
  rotateY(entity: Entity, degrees: number): void {
    const newRotation = QuaternionHelper.rotateY(entity.transform.rotation, degrees);
    const snapped = this.applySnap(newRotation);
    entity.transform.rotation = snapped;
    this.config.onRotationChanged?.(entity, snapped);
  }

  /**
   * Rotates entity around Z axis
   */
  rotateZ(entity: Entity, degrees: number): void {
    const newRotation = QuaternionHelper.rotateZ(entity.transform.rotation, degrees);
    const snapped = this.applySnap(newRotation);
    entity.transform.rotation = snapped;
    this.config.onRotationChanged?.(entity, snapped);
  }

  /**
   * Sets entity rotation from Euler angles
   */
  setEulerAngles(entity: Entity, euler: EulerAngles): void {
    const target = this.snapMode === 'free'
      ? {
          pitch: this.normalizeDegrees(euler.pitch),
          yaw: this.normalizeDegrees(euler.yaw),
          roll: this.normalizeDegrees(euler.roll),
        }
      : QuaternionHelper.snapEuler(euler, this.snapMode);
    const quat = QuaternionHelper.fromEulerDegrees(target);
    entity.transform.rotation = quat;
    this.config.onRotationChanged?.(entity, quat);
  }

  /**
   * Gets entity rotation as Euler angles
   */
  getEulerAngles(entity: Entity): EulerAngles {
    const rotation = entity.transform.rotation;
    const euler = QuaternionHelper.toEulerDegrees(rotation);
    return {
      pitch: this.normalizeDegrees(euler.pitch),
      yaw: this.normalizeDegrees(euler.yaw),
      roll: this.normalizeDegrees(euler.roll),
    };
  }

  private normalizeDegrees(value: number): number {
    const normalized = QuaternionHelper.normalizeAngle(value);
    return Math.round(normalized * 1000) / 1000;
  }

  /**
   * Applies current snap mode to rotation
   */
  private applySnap(rotation: Quat): Quat {
    if (this.snapMode === 'free') {
      return rotation;
    }

    const euler = QuaternionHelper.toEulerDegrees(rotation);
    const snapped = QuaternionHelper.snapEuler(euler, this.snapMode);
    return QuaternionHelper.fromEulerDegrees(snapped);
  }

  /**
   * Resets entity rotation to identity
   */
  resetRotation(entity: Entity): void {
    const identity = QuaternionHelper.identity();
    entity.transform.rotation = identity;
    this.config.onRotationChanged?.(entity, identity);
    this.config.onStatusMessage?.('Rotation reset', 1000);
  }

  /**
   * Copies entity rotation
   */
  copyRotation(entity: Entity): void {
    this.copiedRotation = QuaternionHelper.clone(entity.transform.rotation);
    this.config.onStatusMessage?.('Rotation copied', 1000);
    Logger.debug('Rotation copied');
  }

  /**
   * Pastes rotation to entity
   */
  pasteRotation(entity: Entity): boolean {
    if (!this.copiedRotation) {
      this.config.onStatusMessage?.('No rotation to paste', 1000);
      return false;
    }

    entity.transform.rotation = QuaternionHelper.clone(this.copiedRotation);
    this.config.onRotationChanged?.(entity, entity.transform.rotation);
    this.config.onStatusMessage?.('Rotation pasted', 1000);
    Logger.debug('Rotation pasted');
    return true;
  }

  /**
   * Copies rotation to clipboard
   */
  async copyToClipboard(entity: Entity): Promise<boolean> {
    const success = await QuaternionHelper.copyToClipboard(entity.transform.rotation);
    if (success) {
      this.config.onStatusMessage?.('Rotation copied to clipboard', 1000);
    } else {
      this.config.onStatusMessage?.('Failed to copy rotation', 1000);
    }
    return success;
  }

  /**
   * Pastes rotation from clipboard
   */
  async pasteFromClipboard(entity: Entity): Promise<boolean> {
    const rotation = await QuaternionHelper.pasteFromClipboard();
    if (rotation) {
      entity.transform.rotation = rotation;
      this.config.onRotationChanged?.(entity, rotation);
      this.config.onStatusMessage?.('Rotation pasted from clipboard', 1000);
      return true;
    } else {
      this.config.onStatusMessage?.('Failed to paste rotation', 1000);
      return false;
    }
  }

  /**
   * Mirrors rotation around axis
   */
  mirrorRotation(entity: Entity, axis: 'x' | 'y' | 'z'): void {
    const mirrored = QuaternionHelper.mirror(entity.transform.rotation, axis);
    entity.transform.rotation = mirrored;
    this.config.onRotationChanged?.(entity, mirrored);
    this.config.onStatusMessage?.(`Rotation mirrored on ${axis.toUpperCase()} axis`, 1000);
  }

  /**
   * Quick rotates by preset angle
   */
  quickRotate(entity: Entity, axis: 'x' | 'y' | 'z', angle: 45 | 90 | 180): void {
    switch (axis) {
      case 'x':
        this.rotateX(entity, angle);
        break;
      case 'y':
        this.rotateY(entity, angle);
        break;
      case 'z':
        this.rotateZ(entity, angle);
        break;
    }
    // Report the resulting snapped angle for the selected axis
    const euler = this.getEulerAngles(entity);
    const displayed = axis === 'x' ? euler.pitch : axis === 'y' ? euler.yaw : euler.roll;
    this.config.onStatusMessage?.(`Rotated to ${Math.round(displayed)}° on ${axis.toUpperCase()} axis`, 1000);
  }

  /**
   * Aligns rotation to world axes
   */
  alignToWorld(entity: Entity): void {
    const euler = this.getEulerAngles(entity);
    
    // Round to nearest 90 degrees
    euler.pitch = Math.round(euler.pitch / 90) * 90;
    euler.yaw = Math.round(euler.yaw / 90) * 90;
    euler.roll = Math.round(euler.roll / 90) * 90;
    
    this.setEulerAngles(entity, euler);
    this.config.onStatusMessage?.('Aligned to world axes', 1000);
  }

  /**
   * Formats rotation for display
   */
  formatRotation(entity: Entity): string {
    const euler = this.getEulerAngles(entity);
    return QuaternionHelper.formatEuler(euler);
  }

  /**
   * Checks if rotation is identity (no rotation)
   */
  isIdentity(entity: Entity): boolean {
    return QuaternionHelper.isIdentity(entity.transform.rotation);
  }
}