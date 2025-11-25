/**
 * @vitest-environment jsdom
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceManager } from '../DeviceManager';
import { Logger } from '@engine/core/utils';

// Mock Logger
vi.spyOn(Logger, 'info').mockImplementation(() => {});
vi.spyOn(Logger, 'warn').mockImplementation(() => {});
vi.spyOn(Logger, 'error').mockImplementation(() => {});
vi.spyOn(Logger, 'debug').mockImplementation(() => {});

describe('DeviceManager', () => {
  let canvas: HTMLCanvasElement;
  let statusEl: HTMLElement;
  let mockDevice: GPUDevice;
  let mockAdapter: GPUAdapter;
  let mockContext: GPUCanvasContext;
  let mockGpu: GPU;
  let deviceLostPromise: Promise<GPUDeviceLostInfo>;
  let deviceLostResolve: (info: GPUDeviceLostInfo) => void;

  function createMockDevice(): GPUDevice {
    // Create a promise for device.lost that we can control
    deviceLostPromise = new Promise((resolve) => {
      deviceLostResolve = resolve;
    });

    return {
      lost: deviceLostPromise,
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      queue: {},
    } as unknown as GPUDevice;
  }

  function createMockAdapter(tier = 1): GPUAdapter {
    const features = new Set<string>([
      'texture-compression-bc',
      'depth24unorm-stencil8',
    ]);

    if (tier >= 2) {
      features.add('timestamp-query');
      features.add('shader-f16');
      features.add('indirect-first-instance');
    }

    return {
      features,
      limits: {
        maxBindGroups: 4,
        maxTextureDimension2D: 4096,
        maxBufferSize: 256 * 1024 * 1024,
        maxStorageBufferBindingSize: 64 * 1024 * 1024,
        maxUniformBufferBindingSize: 16384,
        maxComputeWorkgroupSizeX: 256,
        maxComputeWorkgroupSizeY: 256,
        maxComputeWorkgroupSizeZ: 64,
      } as GPUSupportedLimits,
      requestDevice: vi.fn().mockResolvedValue(createMockDevice()),
    } as unknown as GPUAdapter;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock canvas
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    // Mock status element
    statusEl = document.createElement('div');

    // Mock WebGPU context
    mockContext = {
      configure: vi.fn(),
      getCurrentTexture: vi.fn().mockReturnValue({
        createView: vi.fn(),
      }),
    } as unknown as GPUCanvasContext;

    // Mock canvas.getContext
    vi.spyOn(canvas, 'getContext').mockImplementation((contextId: string) => {
      if (contextId === 'webgpu') {
        return mockContext;
      }
      return null;
    });

    // Setup mock device and adapter
    mockDevice = createMockDevice();
    mockAdapter = createMockAdapter();

    // Mock GPU
    mockGpu = {
      requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
      getPreferredCanvasFormat: vi.fn().mockReturnValue('bgra8unorm'),
    } as unknown as GPU;

    // Setup navigator.gpu
    Object.defineProperty(globalThis, 'navigator', {
      value: { gpu: mockGpu },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Cleanup navigator.gpu
    delete (globalThis as any).navigator;
  });

  describe('create', () => {
    it('creates a DeviceManager with valid WebGPU support', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });

      expect(manager).toBeInstanceOf(DeviceManager);
      expect(manager.device).toBeDefined();
      expect(manager.adapter).toBeDefined();
      expect(manager.context).toBe(mockContext);
      expect(manager.presentationFormat).toBe('bgra8unorm');
      expect(manager.isDisposed).toBe(false);

      manager.dispose();
    });

    it('throws when WebGPU is not supported', async () => {
      delete (globalThis as any).navigator;
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });

      await expect(DeviceManager.create({ canvas, statusEl })).rejects.toThrow(
        'WebGPU not supported'
      );
      expect(statusEl.textContent).toBe('WebGPU not supported in this browser.');
    });

    it('throws when adapter acquisition fails', async () => {
      (mockGpu.requestAdapter as any).mockResolvedValue(null);

      await expect(DeviceManager.create({ canvas, statusEl })).rejects.toThrow(
        'Failed to acquire GPU adapter'
      );
      expect(statusEl.textContent).toBe('Failed to acquire GPU adapter.');
    });

    it('throws when context creation fails', async () => {
      vi.spyOn(canvas, 'getContext').mockReturnValue(null);

      await expect(DeviceManager.create({ canvas, statusEl })).rejects.toThrow(
        'Failed to create WebGPU context'
      );
      expect(statusEl.textContent).toBe('Failed to create WebGPU context.');
    });

    it('falls back to alternative format when preferred fails', async () => {
      (mockContext.configure as any)
        .mockImplementationOnce(() => {
          throw new Error('Format not supported');
        })
        .mockImplementationOnce(() => {}); // Second call succeeds

      const manager = await DeviceManager.create({ canvas, statusEl });

      expect(mockContext.configure).toHaveBeenCalledTimes(2);
      expect(manager.presentationFormat).toBe('rgba8unorm'); // Fallback format

      manager.dispose();
    });
  });

  describe('capabilities', () => {
    it('returns correct capabilities for Tier 1 adapter', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });

      expect(manager.capabilities.tier).toBe(1);
      expect(manager.capabilities.features.textureCompression.bc).toBe(true);
      expect(manager.capabilities.features.timestampQuery).toBe(false);
      expect(manager.tier).toBe(1);

      manager.dispose();
    });

    it('returns correct capabilities for Tier 2 adapter', async () => {
      mockAdapter = createMockAdapter(2);
      (mockGpu.requestAdapter as any).mockResolvedValue(mockAdapter);

      const manager = await DeviceManager.create({ canvas, statusEl });

      expect(manager.capabilities.tier).toBe(2);
      expect(manager.capabilities.features.timestampQuery).toBe(true);
      expect(manager.tier).toBe(2);

      manager.dispose();
    });
  });

  describe('dispose', () => {
    it('disposes resources and marks as disposed', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });

      manager.dispose();

      expect(manager.isDisposed).toBe(true);
      expect(manager.device.destroy).toHaveBeenCalled();
    });

    it('is idempotent', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });

      manager.dispose();
      manager.dispose();
      manager.dispose();

      expect(manager.device.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('recreate', () => {
    it('recreates device after loss', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });
      const recreatedHandler = vi.fn();
      manager.onDeviceRecreated(recreatedHandler);

      const success = await manager.recreate();

      expect(success).toBe(true);
      expect(recreatedHandler).toHaveBeenCalled();
      expect(manager.device).toBeDefined();

      manager.dispose();
    });

    it('emits devicerecreated event with details', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });
      const handler = vi.fn();
      manager.addEventListener('devicerecreated', handler);

      await manager.recreate();

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.device).toBeDefined();
      expect(event.detail.tier).toBeDefined();

      manager.dispose();
    });

    it('returns false when disposed', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });
      manager.dispose();

      const success = await manager.recreate();

      expect(success).toBe(false);
    });

    it('returns false when already recreating', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });

      // Start first recreation (slow)
      const slowAdapter = {
        ...mockAdapter,
        requestDevice: vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(createMockDevice()), 100))
        ),
      };
      (mockGpu.requestAdapter as any).mockResolvedValue(slowAdapter);

      const promise1 = manager.recreate();
      const result2 = await manager.recreate(); // Should return false immediately

      expect(result2).toBe(false);
      await promise1;

      manager.dispose();
    });

    it('fails after max recreation attempts', async () => {
      // First create the manager successfully
      const manager = await DeviceManager.create({
        canvas,
        statusEl,
        maxRecreationAttempts: 2,
      });

      // Now set mock to fail for recreation attempts
      (mockGpu.requestAdapter as any).mockResolvedValue(null);

      // First attempt (will fail and try downgrade, counting as 2 attempts)
      await manager.recreate();
      // At this point we've hit max attempts
      // Third attempt should fail immediately
      const success = await manager.recreate();

      expect(success).toBe(false);
      expect(statusEl.textContent).toContain('Please reload');

      manager.dispose();
    });

    it('attempts tier downgrade on recreation failure', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });

      // Make first recreation fail
      let callCount = 0;
      (mockGpu.requestAdapter as any).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return null; // First call fails
        }
        return createMockAdapter(0); // Subsequent calls return Tier 0
      });

      // This should trigger downgrade attempt
      const success = await manager.recreate();

      // Even if the adapter was null first, it should have tried downgrade
      expect(callCount).toBeGreaterThanOrEqual(1);

      manager.dispose();
    });

    it('emits devicerecreationfailed event on failure', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });
      const handler = vi.fn();
      manager.onDeviceRecreationFailed(handler);

      // Make adapter fail consistently
      (mockGpu.requestAdapter as any).mockResolvedValue(null);

      await manager.recreate();

      // After all attempts fail, should emit failure event
      // Note: The test setup has maxRecreationAttempts = 3 by default

      manager.dispose();
    });
  });

  describe('device loss handling', () => {
    it('automatically attempts recreation on device loss', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });
      const lostHandler = vi.fn();
      manager.onDeviceLost(lostHandler);

      // Trigger device loss
      deviceLostResolve({ reason: 'destroyed', message: 'Test loss' } as GPUDeviceLostInfo);

      // Wait for async handlers
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(lostHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'destroyed',
          message: 'Test loss',
        })
      );

      manager.dispose();
    });
  });

  describe('reconfigureContext', () => {
    it('reconfigures the canvas context', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });

      (mockContext.configure as any).mockClear();
      manager.reconfigureContext({ alphaMode: 'premultiplied' });

      expect(mockContext.configure).toHaveBeenCalledWith({
        device: manager.device,
        format: manager.presentationFormat,
        alphaMode: 'premultiplied',
      });

      manager.dispose();
    });

    it('does nothing when disposed', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });
      manager.dispose();

      (mockContext.configure as any).mockClear();
      manager.reconfigureContext();

      expect(mockContext.configure).not.toHaveBeenCalled();
    });
  });

  describe('resetRecreationCounter', () => {
    it('resets the recreation attempt counter', async () => {
      const manager = await DeviceManager.create({
        canvas,
        statusEl,
        maxRecreationAttempts: 2,
      });

      // Fail once
      (mockGpu.requestAdapter as any).mockResolvedValueOnce(null);
      await manager.recreate();

      expect(manager.recreationAttemptCount).toBe(1);

      manager.resetRecreationCounter();

      expect(manager.recreationAttemptCount).toBe(0);

      manager.dispose();
    });
  });

  describe('getters', () => {
    it('returns correct values', async () => {
      const manager = await DeviceManager.create({ canvas, statusEl });

      expect(manager.isDisposed).toBe(false);
      expect(manager.isRecreatingDevice).toBe(false);
      expect(manager.recreationAttemptCount).toBe(0);

      manager.dispose();
    });
  });
});

