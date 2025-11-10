/**
 * Device Validator
 *
 * Centralized helper for validating WebGPU device consistency.
 * WebGPU requires all resources (textures, buffers, command encoders) to be
 * created with the same GPUDevice instance.
 *
 * This validator provides a snapshot-based approach to ensure device consistency
 * throughout a frame rendering operation.
 */

import { Logger } from '@engine/core/utils';

export interface DeviceSnapshot {
  device: GPUDevice;
  configuredDevice: GPUDevice;
  frameResourcesDevice: GPUDevice;
}

export interface DeviceValidationResult {
  valid: boolean;
  snapshot: DeviceSnapshot | null;
  error?: string;
}

/**
 * DeviceValidator provides centralized device validation logic.
 */
export class DeviceValidator {
  /**
   * Creates a device snapshot from a FrameRenderContext.
   * This snapshot should be taken at the start of a frame and used consistently.
   */
  static createSnapshot(ctx: {
    device: GPUDevice;
    configuredDevice?: GPUDevice;
    frameResourcesDevice?: GPUDevice;
  }): DeviceSnapshot {
    return {
      device: ctx.device,
      configuredDevice: ctx.configuredDevice ?? ctx.device,
      frameResourcesDevice: ctx.frameResourcesDevice ?? ctx.device,
    };
  }

  /**
   * Validates that all devices in the snapshot match.
   * Returns validation result with snapshot if valid, null snapshot if invalid.
   */
  static validateSnapshot(snapshot: DeviceSnapshot): DeviceValidationResult {
    if (snapshot.device !== snapshot.configuredDevice) {
      return {
        valid: false,
        snapshot: null,
        error: 'Device mismatch: device !== configuredDevice',
      };
    }

    if (snapshot.device !== snapshot.frameResourcesDevice) {
      return {
        valid: false,
        snapshot: null,
        error: 'Device mismatch: device !== frameResourcesDevice',
      };
    }

    return {
      valid: true,
      snapshot,
    };
  }

  /**
   * Validates current context against a snapshot.
   * Useful for checking if device changed during frame rendering.
   */
  static validateAgainstSnapshot(
    ctx: {
      device: GPUDevice;
      configuredDevice?: GPUDevice;
      frameResourcesDevice?: GPUDevice;
    },
    snapshot: DeviceSnapshot
  ): DeviceValidationResult {
    const current = this.createSnapshot(ctx);
    const currentResult = this.validateSnapshot(current);

    if (!currentResult.valid) {
      return {
        valid: false,
        snapshot: null,
        error: `Device changed during frame: ${currentResult.error}`,
      };
    }

    // Check if devices match the original snapshot
    if (current.device !== snapshot.device) {
      return {
        valid: false,
        snapshot: null,
        error: 'Device changed: current device !== snapshot device',
      };
    }

    if (current.configuredDevice !== snapshot.configuredDevice) {
      return {
        valid: false,
        snapshot: null,
        error: 'Device changed: current configuredDevice !== snapshot configuredDevice',
      };
    }

    if (current.frameResourcesDevice !== snapshot.frameResourcesDevice) {
      return {
        valid: false,
        snapshot: null,
        error: 'Device changed: current frameResourcesDevice !== snapshot frameResourcesDevice',
      };
    }

    return {
      valid: true,
      snapshot: current,
    };
  }

  /**
   * Validates device consistency and logs warnings if invalid.
   * Returns the validated device if valid, null otherwise.
   */
  static validateAndGetDevice(
    ctx: {
      device: GPUDevice;
      configuredDevice?: GPUDevice;
      frameResourcesDevice?: GPUDevice;
    },
    contextLabel = 'FrameRenderer'
  ): GPUDevice | null {
    const snapshot = this.createSnapshot(ctx);
    const result = this.validateSnapshot(snapshot);

    if (!result.valid) {
      Logger.warn(`[${contextLabel}] ${result.error} - skipping operation`);
      return null;
    }

    return snapshot.configuredDevice;
  }

  /**
   * Validates device consistency before a critical operation.
   * Returns true if valid, logs warning and returns false otherwise.
   */
  static validateBeforeOperation(
    ctx: {
      device: GPUDevice;
      configuredDevice?: GPUDevice;
      frameResourcesDevice?: GPUDevice;
    },
    snapshot: DeviceSnapshot,
    operationName: string,
    contextLabel = 'FrameRenderer'
  ): boolean {
    const result = this.validateAgainstSnapshot(ctx, snapshot);

    if (!result.valid) {
      Logger.warn(
        `[${contextLabel}] Device validation failed before ${operationName}: ${result.error}`
      );
      return false;
    }

    return true;
  }
}

