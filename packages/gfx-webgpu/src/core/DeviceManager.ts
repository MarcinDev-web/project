/**
 * Device Manager
 *
 * Manages the WebGPU device lifecycle including:
 * - Adapter acquisition and device creation
 * - Device loss handling with automatic recovery
 * - Tier-based feature downgrade strategy
 * - Canvas context configuration
 * - Capabilities tracking
 *
 * Emits events:
 * - 'devicelost': When the device is lost
 * - 'devicerecreated': When the device is successfully recreated
 * - 'devicerecreationfailed': When device recreation fails
 */

import { Logger } from '@engine/core/utils';
import {
  pickAdapter,
  probeAdapterCapabilities,
  probeResultToCapabilities,
  validateMinimumLimits,
  type FeatureTier,
  type AdapterProbeResult,
} from './adapterProbing';
import type { RendererCapabilities } from '../config';
import { MAX_DEVICE_RECREATION_ATTEMPTS, DEFAULT_STATUS_MESSAGE } from '../config';
import type { DeviceManagerConfig, DeviceManagerEvents } from './RendererTypes';

/**
 * Result of device creation operation.
 */
export interface DeviceCreationResult {
  device: GPUDevice;
  adapter: GPUAdapter;
  context: GPUCanvasContext;
  presentationFormat: GPUTextureFormat;
  capabilities: RendererCapabilities;
  probeResult: AdapterProbeResult;
}

/**
 * Event detail for device-related events.
 */
export interface DeviceEventDetail {
  device?: GPUDevice;
  adapter?: GPUAdapter;
  capabilities?: RendererCapabilities;
  tier?: FeatureTier;
  reason?: string;
  message?: string;
  error?: Error;
  attempts?: number;
}

/**
 * Checks if navigator.gpu has getPreferredCanvasFormat.
 */
function hasPreferredCanvasFormat(
  gpu: unknown
): gpu is { getPreferredCanvasFormat: () => GPUTextureFormat } {
  return (
    typeof gpu === 'object' &&
    gpu !== null &&
    typeof (gpu as GPU).getPreferredCanvasFormat === 'function'
  );
}

/**
 * DeviceManager handles WebGPU device lifecycle and recovery.
 *
 * Features:
 * - Automatic device loss detection and recovery
 * - Tier-based feature downgrade on recovery failure
 * - Event-based notification system
 * - Canvas context management
 *
 * @example
 * ```typescript
 * const deviceManager = await DeviceManager.create({ canvas, statusEl });
 *
 * deviceManager.addEventListener('devicelost', (e) => {
 *   console.log('Device lost:', e.detail.reason);
 * });
 *
 * deviceManager.addEventListener('devicerecreated', (e) => {
 *   // Recreate resources with new device
 *   console.log('Device recreated at Tier:', e.detail.tier);
 * });
 * ```
 */
export class DeviceManager extends EventTarget {
  private _device: GPUDevice;
  private _adapter: GPUAdapter;
  private _context: GPUCanvasContext;
  private _presentationFormat: GPUTextureFormat;
  private _capabilities: RendererCapabilities;
  private _probeResult: AdapterProbeResult;

  private readonly canvas: HTMLCanvasElement;
  private readonly statusEl?: HTMLElement;
  private readonly maxRecreationAttempts: number;

  private recreationAttempts = 0;
  private isRecreating = false;
  private disposed = false;
  private currentTier: FeatureTier;

  // Listener cleanup
  private deviceLostHandler: ((info: GPUDeviceLostInfo) => void) | null = null;
  private uncapturedErrorHandler: ((event: Event) => void) | null = null;

  private constructor(
    result: DeviceCreationResult,
    config: DeviceManagerConfig
  ) {
    super();
    this._device = result.device;
    this._adapter = result.adapter;
    this._context = result.context;
    this._presentationFormat = result.presentationFormat;
    this._capabilities = result.capabilities;
    this._probeResult = result.probeResult;
    this.currentTier = result.capabilities.tier;

    this.canvas = config.canvas;
    this.statusEl = config.statusEl;
    this.maxRecreationAttempts = config.maxRecreationAttempts ?? MAX_DEVICE_RECREATION_ATTEMPTS;

    this.setupDeviceListeners();
  }

  /**
   * Creates a new DeviceManager instance.
   *
   * @param config - Configuration options
   * @returns Promise resolving to DeviceManager instance
   * @throws Error if WebGPU is not supported or device creation fails
   */
  static async create(config: DeviceManagerConfig): Promise<DeviceManager> {
    const result = await DeviceManager.createDevice(config.canvas, config.statusEl);
    return new DeviceManager(result, config);
  }

  /**
   * Creates a WebGPU device and configures the canvas context.
   */
  private static async createDevice(
    canvas: HTMLCanvasElement,
    statusEl?: HTMLElement,
    targetTier?: FeatureTier
  ): Promise<DeviceCreationResult> {
    // Check WebGPU support
    if (!('gpu' in navigator) || !navigator.gpu) {
      if (statusEl) statusEl.textContent = 'WebGPU not supported in this browser.';
      throw new Error('WebGPU not supported');
    }

    // Acquire adapter
    const adapter = await pickAdapter();
    if (!adapter) {
      if (statusEl) statusEl.textContent = 'Failed to acquire GPU adapter.';
      throw new Error('Failed to acquire GPU adapter');
    }

    // Probe capabilities
    const probeResult = await probeAdapterCapabilities(adapter);
    validateMinimumLimits(probeResult.limits);

    // Determine effective tier
    let effectiveTier = probeResult.tier;
    if (targetTier !== undefined && targetTier < probeResult.tier) {
      effectiveTier = targetTier;
      Logger.info(`Using lower tier ${effectiveTier} as requested (adapter supports ${probeResult.tier})`);
    }

    // Build required features
    const requiredFeatures: GPUFeatureName[] = [];
    if (effectiveTier >= 2 && probeResult.timestampQuery) {
      requiredFeatures.push('timestamp-query');
    }

    // Request device
    const device = await adapter.requestDevice({ requiredFeatures });

    // Get canvas context
    const context = canvas.getContext('webgpu');
    if (!context) {
      if (statusEl) statusEl.textContent = 'Failed to create WebGPU context.';
      throw new Error('Failed to create WebGPU context');
    }

    // Configure presentation format
    let presentationFormat: GPUTextureFormat = hasPreferredCanvasFormat(navigator.gpu)
      ? navigator.gpu.getPreferredCanvasFormat()
      : 'rgba8unorm';

    try {
      context.configure({ device, format: presentationFormat, alphaMode: 'opaque' });
    } catch (err) {
      // Try fallback format
      const altFormat: GPUTextureFormat =
        presentationFormat === 'rgba8unorm' ? 'bgra8unorm' : 'rgba8unorm';
      try {
        context.configure({ device, format: altFormat, alphaMode: 'opaque' });
        Logger.warn('Canvas configure fallback format used:', {
          from: presentationFormat,
          to: altFormat,
        });
        presentationFormat = altFormat;
      } catch (err2) {
        if (statusEl) statusEl.textContent = 'WebGPU canvas configuration failed.';
        throw err instanceof Error ? err : new Error(String(err));
      }
    }

    // Build capabilities
    const capabilities = probeResultToCapabilities(probeResult);
    capabilities.tier = effectiveTier;

    return {
      device,
      adapter,
      context,
      presentationFormat,
      capabilities,
      probeResult,
    };
  }

  // ========== Public Getters ==========

  /** The current GPU device. */
  get device(): GPUDevice {
    return this._device;
  }

  /** The current GPU adapter. */
  get adapter(): GPUAdapter {
    return this._adapter;
  }

  /** The WebGPU canvas context. */
  get context(): GPUCanvasContext {
    return this._context;
  }

  /** The presentation format for the canvas. */
  get presentationFormat(): GPUTextureFormat {
    return this._presentationFormat;
  }

  /** Renderer capabilities determined at init time. */
  get capabilities(): RendererCapabilities {
    return this._capabilities;
  }

  /** Current feature tier. */
  get tier(): FeatureTier {
    return this.currentTier;
  }

  /** Whether the device manager has been disposed. */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Whether device recreation is in progress. */
  get isRecreatingDevice(): boolean {
    return this.isRecreating;
  }

  /** Number of recreation attempts made. */
  get recreationAttemptCount(): number {
    return this.recreationAttempts;
  }

  // ========== Public Methods ==========

  /**
   * Attempts to recreate the device after device loss.
   *
   * @param downgradeTier - Whether to force a tier downgrade
   * @returns True if recreation succeeded, false otherwise
   */
  async recreate(downgradeTier = false): Promise<boolean> {
    if (this.disposed || this.isRecreating) {
      return false;
    }

    if (this.recreationAttempts >= this.maxRecreationAttempts) {
      Logger.error('Max device recreation attempts reached');
      if (this.statusEl) {
        this.statusEl.textContent = 'WebGPU device lost. Please reload the page.';
      }
      return false;
    }

    this.isRecreating = true;
    this.recreationAttempts++;

    try {
      Logger.info(
        `Attempting device recreation (attempt ${this.recreationAttempts}/${this.maxRecreationAttempts}, tier: ${this.currentTier})`
      );
      if (this.statusEl) {
        this.statusEl.textContent = 'Recreating WebGPU device...';
      }

      // Determine target tier
      const targetTier = downgradeTier ? Math.max(0, this.currentTier - 1) as FeatureTier : undefined;

      // Cleanup old device listeners
      this.removeDeviceListeners();

      // Create new device
      const result = await DeviceManager.createDevice(this.canvas, this.statusEl, targetTier);

      // Update internal state
      this._device = result.device;
      this._adapter = result.adapter;
      this._context = result.context;
      this._presentationFormat = result.presentationFormat;
      this._capabilities = result.capabilities;
      this._probeResult = result.probeResult;
      this.currentTier = result.capabilities.tier;

      // Setup listeners for new device
      this.setupDeviceListeners();

      // Emit success event
      this.dispatchEvent(
        new CustomEvent<DeviceEventDetail>('devicerecreated', {
          detail: {
            device: this._device,
            adapter: this._adapter,
            capabilities: this._capabilities,
            tier: this.currentTier,
          },
        })
      );

      Logger.info(`Device recreated successfully at Tier ${this.currentTier}`);
      if (this.statusEl) {
        this.statusEl.textContent = DEFAULT_STATUS_MESSAGE;
      }

      return true;
    } catch (err) {
      Logger.error('Device recreation failed:', err instanceof Error ? err : new Error(String(err)));

      // Try tier downgrade if we haven't already
      if (!downgradeTier && this.currentTier > 0) {
        Logger.info('Attempting tier downgrade for device recreation');
        this.isRecreating = false; // Reset to allow retry
        return this.recreate(true);
      }

      // Emit failure event
      this.dispatchEvent(
        new CustomEvent<DeviceEventDetail>('devicerecreationfailed', {
          detail: {
            error: err instanceof Error ? err : new Error(String(err)),
            attempts: this.recreationAttempts,
          },
        })
      );

      if (this.statusEl) {
        this.statusEl.textContent = 'Failed to recreate WebGPU device. Please reload.';
      }

      return false;
    } finally {
      this.isRecreating = false;
    }
  }

  /**
   * Reconfigures the canvas context with the current device.
   * Useful after canvas resize or presentation format change.
   *
   * @param options - Optional configuration overrides
   */
  reconfigureContext(options?: { alphaMode?: GPUCanvasAlphaMode }): void {
    if (this.disposed) return;

    try {
      this._context.configure({
        device: this._device,
        format: this._presentationFormat,
        alphaMode: options?.alphaMode ?? 'opaque',
      });
    } catch (err) {
      Logger.warn('Context reconfiguration failed:', err);
    }
  }

  /**
   * Resets the recreation attempt counter.
   * Call this when the device has been stable for a while.
   */
  resetRecreationCounter(): void {
    this.recreationAttempts = 0;
  }

  /**
   * Disposes the device manager and releases resources.
   * After disposal, the manager cannot be used.
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.removeDeviceListeners();

    try {
      this._device.destroy();
    } catch (e) {
      Logger.debug('Device destroy failed during disposal', e);
    }
  }

  // ========== Event Handling Helpers ==========

  /**
   * Adds a listener for device lost events.
   */
  onDeviceLost(handler: (detail: DeviceEventDetail) => void): void {
    this.addEventListener('devicelost', ((e: CustomEvent<DeviceEventDetail>) => {
      handler(e.detail);
    }) as EventListener);
  }

  /**
   * Adds a listener for device recreated events.
   */
  onDeviceRecreated(handler: (detail: DeviceEventDetail) => void): void {
    this.addEventListener('devicerecreated', ((e: CustomEvent<DeviceEventDetail>) => {
      handler(e.detail);
    }) as EventListener);
  }

  /**
   * Adds a listener for device recreation failed events.
   */
  onDeviceRecreationFailed(handler: (detail: DeviceEventDetail) => void): void {
    this.addEventListener('devicerecreationfailed', ((e: CustomEvent<DeviceEventDetail>) => {
      handler(e.detail);
    }) as EventListener);
  }

  // ========== Private Methods ==========

  private setupDeviceListeners(): void {
    // Handle device loss
    this.deviceLostHandler = async (info: GPUDeviceLostInfo) => {
      if (this.disposed) return;

      const reason = info.reason || 'unknown';
      Logger.error('WebGPU device lost', {
        reason,
        message: info.message || 'No message provided',
      } as unknown as Error);

      // Emit device lost event
      this.dispatchEvent(
        new CustomEvent<DeviceEventDetail>('devicelost', {
          detail: {
            reason,
            message: info.message || 'No message provided',
          },
        })
      );

      // Attempt recovery based on reason
      const shouldDowngrade = reason !== 'destroyed' && reason !== 'unknown';
      const success = await this.recreate(shouldDowngrade);

      if (!success) {
        Logger.error('Device recovery failed after device loss');
      }
    };

    this._device.lost.then(this.deviceLostHandler).catch((err) => {
      Logger.error('device.lost handler failed', err as unknown as Error);
    });

    // Handle uncaptured errors
    this.uncapturedErrorHandler = (event: Event) => {
      const gpuEvent = event as GPUUncapturedErrorEvent;
      Logger.error('WebGPU uncaptured error', gpuEvent.error as unknown as Error);
      // Don't trigger recreation for validation errors
    };

    this._device.addEventListener('uncapturederror', this.uncapturedErrorHandler);
  }

  private removeDeviceListeners(): void {
    if (this.uncapturedErrorHandler) {
      try {
        this._device.removeEventListener('uncapturederror', this.uncapturedErrorHandler);
      } catch (e) {
        Logger.debug('Failed to remove uncapturederror listener', e);
      }
      this.uncapturedErrorHandler = null;
    }
    this.deviceLostHandler = null;
  }
}

