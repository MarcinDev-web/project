/**
 * WebGPU adapter probing and capability detection
 * 
 * Implements Tier-based feature selection and adapter fallback strategy
 * as defined in docs/technical/WEBGPU_FEATURE_POLICY.md
 */

import type { RendererCapabilities } from '../config';
import { Logger } from '@engine/core/utils';

export type FeatureTier = 0 | 1 | 2;

export interface AdapterProbeResult {
  adapter: GPUAdapter;
  tier: FeatureTier;
  features: Set<string>; // Use string instead of GPUFeatureName for compatibility
  limits: GPUSupportedLimits;
  textureCompression: 'bc' | 'etc2' | 'astc' | 'none';
  timestampQuery: boolean;
  shaderF16: boolean;
  adapterInfo?: {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  };
  adapterName?: string;
}

/**
 * Probes adapter features and determines the highest supported Tier
 * 
 * Tier 0 (Baseline): Core WebGPU only
 * Tier 1 (Preferred): + texture compression + depth24unorm-stencil8
 * Tier 2 (Enhanced): + timestamp-query + shader-f16 + indirect-first-instance
 */
export async function probeAdapterCapabilities(adapter: GPUAdapter): Promise<AdapterProbeResult> {
  const features = new Set<string>(adapter.features);
  const limits = adapter.limits;

  // Determine texture compression support (priority: BC > ETC2 > ASTC)
  let textureCompression: 'bc' | 'etc2' | 'astc' | 'none' = 'none';
  if (features.has('texture-compression-bc')) {
    textureCompression = 'bc';
  } else if (features.has('texture-compression-etc2')) {
    textureCompression = 'etc2';
  } else if (features.has('texture-compression-astc')) {
    textureCompression = 'astc';
  }

  // Check optional features (using string checks since some may not be in GPUFeatureName type)
  const hasTimestampQuery = features.has('timestamp-query');
  const hasShaderF16 = features.has('shader-f16');
  const hasDepth24Stencil8 = features.has('depth24unorm-stencil8');
  const hasIndirectFirstInstance = features.has('indirect-first-instance');

  // Determine Tier
  let tier: FeatureTier = 0;
  if (textureCompression !== 'none' && hasDepth24Stencil8) {
    tier = 1;
    if (hasTimestampQuery && hasShaderF16 && hasIndirectFirstInstance) {
      tier = 2;
    }
  }

  // Query adapter info (best-effort)
  let adapterInfo: AdapterProbeResult['adapterInfo'] | undefined;
  let adapterName: string | undefined;
  try {
    const anyAdapter = adapter as unknown as {
      requestAdapterInfo?: () => Promise<{
        vendor?: string;
        architecture?: string;
        device?: string;
        description?: string;
        name?: string;
      }>;
    };
    if (typeof anyAdapter.requestAdapterInfo === 'function') {
      const info = await anyAdapter.requestAdapterInfo();
      const normalized: AdapterProbeResult['adapterInfo'] = {};
      if (typeof info.vendor === 'string') normalized.vendor = info.vendor;
      if (typeof info.architecture === 'string') normalized.architecture = info.architecture;
      if (typeof info.device === 'string') normalized.device = info.device;
      if (typeof info.description === 'string') normalized.description = info.description;
      adapterInfo = Object.keys(normalized).length > 0 ? normalized : undefined;
      adapterName = typeof (info as any).name === 'string' ? (info as any).name : undefined;
    }
  } catch (err) {
    Logger.debug('Failed to query adapter info', err);
  }

  return {
    adapter,
    tier,
    features,
    limits,
    textureCompression,
    timestampQuery: hasTimestampQuery,
    shaderF16: hasShaderF16,
    adapterInfo,
    adapterName,
  };
}

/**
 * Attempts to acquire an adapter with fallback strategy:
 * 1. Try high-performance preference
 * 2. Fallback to low-power preference
 * 3. Fallback to no preference
 */
export async function pickAdapter(): Promise<GPUAdapter | null> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
    return null;
  }

  const preferences: GPUPowerPreference[] = ['high-performance', 'low-power'];
  
  for (const preference of preferences) {
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: preference });
      if (adapter) {
        Logger.debug(`Acquired adapter with powerPreference: ${preference}`);
        return adapter;
      }
    } catch (err) {
      Logger.debug(`Failed to request adapter with preference ${preference}`, err);
    }
  }

  // Final fallback: no preference
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter) {
      Logger.debug('Acquired adapter with no preference');
      return adapter;
    }
  } catch (err) {
    Logger.debug('Failed to request adapter without preference', err);
  }

  return null;
}

/**
 * Validates that adapter/device limits meet minimum requirements
 * Returns true if limits are acceptable, false otherwise
 */
export function validateMinimumLimits(limits: GPUSupportedLimits): boolean {
  const MIN_MAX_BIND_GROUPS = 4;
  const MIN_MAX_UNIFORM_BUFFERS_PER_SHADER_STAGE = 12;
  const MIN_MAX_STORAGE_BUFFER_BINDING_SIZE = 64 * 1024 * 1024; // 64 MiB
  const MIN_MAX_BUFFER_SIZE = 256 * 1024 * 1024; // 256 MiB
  const MIN_MAX_TEXTURE_DIMENSION_2D = 4096;

  if (limits.maxBindGroups < MIN_MAX_BIND_GROUPS) {
    Logger.warn(`maxBindGroups too low: ${limits.maxBindGroups} < ${MIN_MAX_BIND_GROUPS}`);
    return false;
  }

  // Note: maxUniformBuffersPerShaderStage might not be exposed in all browsers
  // We check if it exists and meets minimum, but don't fail if it's missing
  if ('maxUniformBuffersPerShaderStage' in limits) {
    const maxUniform = (limits as any).maxUniformBuffersPerShaderStage;
    if (typeof maxUniform === 'number' && maxUniform < MIN_MAX_UNIFORM_BUFFERS_PER_SHADER_STAGE) {
      Logger.warn(`maxUniformBuffersPerShaderStage too low: ${maxUniform} < ${MIN_MAX_UNIFORM_BUFFERS_PER_SHADER_STAGE}`);
      // Don't fail - this is a soft requirement
    }
  }

  if (limits.maxStorageBufferBindingSize < MIN_MAX_STORAGE_BUFFER_BINDING_SIZE) {
    Logger.warn(`maxStorageBufferBindingSize too low: ${limits.maxStorageBufferBindingSize} < ${MIN_MAX_STORAGE_BUFFER_BINDING_SIZE}`);
    // Don't fail - we can adapt content
  }

  if (limits.maxBufferSize < MIN_MAX_BUFFER_SIZE) {
    Logger.warn(`maxBufferSize too low: ${limits.maxBufferSize} < ${MIN_MAX_BUFFER_SIZE}`);
    // Don't fail - we can adapt content
  }

  if (limits.maxTextureDimension2D < MIN_MAX_TEXTURE_DIMENSION_2D) {
    Logger.warn(`maxTextureDimension2D too low: ${limits.maxTextureDimension2D} < ${MIN_MAX_TEXTURE_DIMENSION_2D}`);
    // Don't fail - we can adapt content
  }

  return true;
}

/**
 * Converts AdapterProbeResult to RendererCapabilities format
 */
export function probeResultToCapabilities(probe: AdapterProbeResult): RendererCapabilities {
  return {
    tier: probe.tier,
    adapterName: probe.adapterName,
    adapterInfo: probe.adapterInfo,
    textureCompression: probe.textureCompression,
    features: {
      timestampQuery: probe.timestampQuery,
      occlusionQuery: probe.features.has('occlusion-query'),
      compute: true, // WebGPU devices support compute
      shaderF16: probe.shaderF16,
      textureCompression: {
        bc: probe.textureCompression === 'bc',
        etc2: probe.textureCompression === 'etc2',
        astc: probe.textureCompression === 'astc',
      },
    },
    limits: {
      maxTextureDimension2D: probe.limits.maxTextureDimension2D,
      maxBufferSize: probe.limits.maxBufferSize,
      maxBindGroups: probe.limits.maxBindGroups,
      maxStorageBufferBindingSize: probe.limits.maxStorageBufferBindingSize,
      maxUniformBufferBindingSize: probe.limits.maxUniformBufferBindingSize,
      maxComputeWorkgroupSizeX: probe.limits.maxComputeWorkgroupSizeX,
      maxComputeWorkgroupSizeY: probe.limits.maxComputeWorkgroupSizeY,
      maxComputeWorkgroupSizeZ: probe.limits.maxComputeWorkgroupSizeZ,
    },
  };
}

