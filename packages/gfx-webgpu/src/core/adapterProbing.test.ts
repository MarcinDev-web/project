/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pickAdapter,
  probeAdapterCapabilities,
  probeResultToCapabilities,
  validateMinimumLimits,
  type AdapterProbeResult,
} from './adapterProbing';
import { Logger } from '@engine/core/utils';

const mockWarn = vi.spyOn(Logger, 'warn');
const mockDebug = vi.spyOn(Logger, 'debug');
const mockError = vi.spyOn(Logger, 'error');

describe('adapterProbing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('probeAdapterCapabilities', () => {
    it('determines Tier 0 for baseline WebGPU (no optional features)', async () => {
      const adapter = {
        features: new Set<string>([]),
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
        requestAdapterInfo: undefined,
      } as unknown as GPUAdapter;

      const result = await probeAdapterCapabilities(adapter);

      expect(result.tier).toBe(0);
      expect(result.textureCompression).toBe('none');
      expect(result.timestampQuery).toBe(false);
      expect(result.shaderF16).toBe(false);
    });

    it('determines Tier 1 when texture compression and depth24unorm-stencil8 are available', async () => {
      const adapter = {
        features: new Set<string>(['texture-compression-bc', 'depth24unorm-stencil8']),
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
        requestAdapterInfo: undefined,
      } as unknown as GPUAdapter;

      const result = await probeAdapterCapabilities(adapter);

      expect(result.tier).toBe(1);
      expect(result.textureCompression).toBe('bc');
      expect(result.timestampQuery).toBe(false);
      expect(result.shaderF16).toBe(false);
    });

    it('determines Tier 2 when all enhanced features are available', async () => {
      const adapter = {
        features: new Set<string>([
          'texture-compression-bc',
          'depth24unorm-stencil8',
          'timestamp-query',
          'shader-f16',
          'indirect-first-instance',
        ]),
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
        requestAdapterInfo: undefined,
      } as unknown as GPUAdapter;

      const result = await probeAdapterCapabilities(adapter);

      expect(result.tier).toBe(2);
      expect(result.textureCompression).toBe('bc');
      expect(result.timestampQuery).toBe(true);
      expect(result.shaderF16).toBe(true);
    });

    it('prioritizes BC over ETC2 over ASTC for texture compression', async () => {
      // BC only
      const adapterBC = {
        features: new Set<string>(['texture-compression-bc']),
        limits: {} as GPUSupportedLimits,
        requestAdapterInfo: undefined,
      } as unknown as GPUAdapter;
      const resultBC = await probeAdapterCapabilities(adapterBC);
      expect(resultBC.textureCompression).toBe('bc');

      // ETC2 only
      const adapterETC2 = {
        features: new Set<string>(['texture-compression-etc2']),
        limits: {} as GPUSupportedLimits,
        requestAdapterInfo: undefined,
      } as unknown as GPUAdapter;
      const resultETC2 = await probeAdapterCapabilities(adapterETC2);
      expect(resultETC2.textureCompression).toBe('etc2');

      // ASTC only
      const adapterASTC = {
        features: new Set<string>(['texture-compression-astc']),
        limits: {} as GPUSupportedLimits,
        requestAdapterInfo: undefined,
      } as unknown as GPUAdapter;
      const resultASTC = await probeAdapterCapabilities(adapterASTC);
      expect(resultASTC.textureCompression).toBe('astc');

      // BC + ETC2 + ASTC (should prefer BC)
      const adapterAll = {
        features: new Set<string>([
          'texture-compression-bc',
          'texture-compression-etc2',
          'texture-compression-astc',
        ]),
        limits: {} as GPUSupportedLimits,
        requestAdapterInfo: undefined,
      } as unknown as GPUAdapter;
      const resultAll = await probeAdapterCapabilities(adapterAll);
      expect(resultAll.textureCompression).toBe('bc');
    });

    it('queries adapter info when available', async () => {
      const adapterInfo = {
        vendor: 'Test Vendor',
        architecture: 'Test Arch',
        device: 'Test Device',
        description: 'Test Description',
        name: 'Test Adapter',
      };

      const adapter = {
        features: new Set<GPUFeatureName>([]),
        limits: {} as GPUSupportedLimits,
        requestAdapterInfo: vi.fn().mockResolvedValue(adapterInfo),
      } as unknown as GPUAdapter;

      const result = await probeAdapterCapabilities(adapter);

      expect(result.adapterInfo).toEqual({
        vendor: 'Test Vendor',
        architecture: 'Test Arch',
        device: 'Test Device',
        description: 'Test Description',
      });
      expect(result.adapterName).toBe('Test Adapter');
    });

    it('handles missing adapter info gracefully', async () => {
      const adapter = {
        features: new Set<string>([]),
        limits: {} as GPUSupportedLimits,
        requestAdapterInfo: vi.fn().mockRejectedValue(new Error('Not available')),
      } as unknown as GPUAdapter;

      const result = await probeAdapterCapabilities(adapter);

      expect(result.adapterInfo).toBeUndefined();
      expect(result.adapterName).toBeUndefined();
      expect(mockDebug).toHaveBeenCalled();
    });
  });

  describe('validateMinimumLimits', () => {
    it('returns true for limits meeting minimum requirements', () => {
      const limits = {
        maxBindGroups: 4,
        maxTextureDimension2D: 4096,
        maxBufferSize: 256 * 1024 * 1024,
        maxStorageBufferBindingSize: 64 * 1024 * 1024,
        maxUniformBufferBindingSize: 16384,
        maxComputeWorkgroupSizeX: 256,
        maxComputeWorkgroupSizeY: 256,
        maxComputeWorkgroupSizeZ: 64,
      } as GPUSupportedLimits;

      const result = validateMinimumLimits(limits);

      expect(result).toBe(true);
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it('warns but returns true for limits below minimum (graceful degradation)', () => {
      const limits = {
        maxBindGroups: 4, // Meets minimum
        maxTextureDimension2D: 2048, // Below minimum (4096)
        maxBufferSize: 128 * 1024 * 1024, // Below minimum (256 MiB)
        maxStorageBufferBindingSize: 32 * 1024 * 1024, // Below minimum (64 MiB)
        maxUniformBufferBindingSize: 16384,
        maxComputeWorkgroupSizeX: 256,
        maxComputeWorkgroupSizeY: 256,
        maxComputeWorkgroupSizeZ: 64,
      } as GPUSupportedLimits;

      const result = validateMinimumLimits(limits);

      expect(result).toBe(true); // Still returns true (graceful degradation)
      expect(mockWarn).toHaveBeenCalled();
    });

    it('returns false when maxBindGroups is too low (hard requirement)', () => {
      const limits = {
        maxBindGroups: 2, // Below minimum (4)
        maxTextureDimension2D: 4096,
        maxBufferSize: 256 * 1024 * 1024,
        maxStorageBufferBindingSize: 64 * 1024 * 1024,
        maxUniformBufferBindingSize: 16384,
        maxComputeWorkgroupSizeX: 256,
        maxComputeWorkgroupSizeY: 256,
        maxComputeWorkgroupSizeZ: 64,
      } as GPUSupportedLimits;

      const result = validateMinimumLimits(limits);

      expect(result).toBe(false);
      expect(mockWarn).toHaveBeenCalled();
    });
  });

  describe('probeResultToCapabilities', () => {
    it('converts probe result to RendererCapabilities format', () => {
      const probe: AdapterProbeResult = {
        adapter: {} as GPUAdapter,
        tier: 2,
        features: new Set<string>(['timestamp-query', 'occlusion-query', 'texture-compression-bc']),
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
        textureCompression: 'bc',
        timestampQuery: true,
        shaderF16: true,
        adapterInfo: {
          vendor: 'Test Vendor',
          architecture: 'Test Arch',
        },
        adapterName: 'Test Adapter',
      };

      const capabilities = probeResultToCapabilities(probe);

      expect(capabilities.tier).toBe(2);
      expect(capabilities.adapterName).toBe('Test Adapter');
      expect(capabilities.adapterInfo).toEqual({
        vendor: 'Test Vendor',
        architecture: 'Test Arch',
      });
      expect(capabilities.features.timestampQuery).toBe(true);
      expect(capabilities.features.occlusionQuery).toBe(true);
      expect(capabilities.features.compute).toBe(true);
      expect(capabilities.features.textureCompression.bc).toBe(true);
      expect(capabilities.features.textureCompression.etc2).toBe(false);
      expect(capabilities.features.textureCompression.astc).toBe(false);
      expect(capabilities.textureCompression).toBe('bc');
      expect(capabilities.limits.maxBindGroups).toBe(4);
    });
  });

  describe('pickAdapter', () => {
    it('returns null when WebGPU is not available', async () => {
      const originalNavigator = globalThis.navigator;
      // @ts-expect-error - intentionally removing navigator for test
      delete globalThis.navigator;

      const result = await pickAdapter();

      expect(result).toBeNull();

      globalThis.navigator = originalNavigator;
    });

    it('tries high-performance preference first', async () => {
      const mockAdapter = {} as GPUAdapter;
      const mockGpu = {
        requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
      };
      (globalThis as any).navigator = { gpu: mockGpu };

      const result = await pickAdapter();

      expect(result).toBe(mockAdapter);
      expect(mockGpu.requestAdapter).toHaveBeenCalledWith({ powerPreference: 'high-performance' });
      expect(mockGpu.requestAdapter).toHaveBeenCalledTimes(1);

      delete (globalThis as any).navigator;
    });

    it('falls back to low-power when high-performance fails', async () => {
      const mockAdapter = {} as GPUAdapter;
      const mockGpu = {
        requestAdapter: vi
          .fn()
          .mockResolvedValueOnce(null) // high-performance fails
          .mockResolvedValueOnce(mockAdapter), // low-power succeeds
      };
      (globalThis as any).navigator = { gpu: mockGpu };

      const result = await pickAdapter();

      expect(result).toBe(mockAdapter);
      expect(mockGpu.requestAdapter).toHaveBeenCalledWith({ powerPreference: 'high-performance' });
      expect(mockGpu.requestAdapter).toHaveBeenCalledWith({ powerPreference: 'low-power' });
      expect(mockGpu.requestAdapter).toHaveBeenCalledTimes(2);

      delete (globalThis as any).navigator;
    });

    it('falls back to no preference when both preferences fail', async () => {
      const mockAdapter = {} as GPUAdapter;
      const mockGpu = {
        requestAdapter: vi
          .fn()
          .mockResolvedValueOnce(null) // high-performance fails
          .mockResolvedValueOnce(null) // low-power fails
          .mockResolvedValueOnce(mockAdapter), // no preference succeeds
      };
      (globalThis as any).navigator = { gpu: mockGpu };

      const result = await pickAdapter();

      expect(result).toBe(mockAdapter);
      expect(mockGpu.requestAdapter).toHaveBeenCalledTimes(3);
      expect(mockGpu.requestAdapter).toHaveBeenLastCalledWith(); // No args = no preference

      delete (globalThis as any).navigator;
    });
  });
});

