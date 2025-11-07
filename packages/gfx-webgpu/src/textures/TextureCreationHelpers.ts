/**
 * Texture Creation Helpers with Compression Fallbacks
 * 
 * Provides safe texture creation with automatic fallback when compression fails.
 */

import type { TextureCompressionManager } from './TextureCompressionManager';
import { Logger } from '@engine/core/utils';

export interface SafeTextureCreationOptions {
  /** Texture type for format selection */
  type?: 'color' | 'normal' | 'roughness' | 'metallic' | 'ao' | 'emissive';
  /** Force uncompressed format */
  forceUncompressed?: boolean;
  /** Compression manager for format selection */
  compressionManager?: TextureCompressionManager;
}

/**
 * Safely creates a texture with compression fallback.
 * If compression format fails, falls back to uncompressed RGBA.
 */
export function createTextureSafe(
  device: GPUDevice,
  options: {
    label: string;
    size: GPUExtent3D;
    format: GPUTextureFormat;
    usage: GPUTextureUsageFlags;
  },
  safeOptions?: SafeTextureCreationOptions
): GPUTexture {
  const { label, size, format: requestedFormat, usage } = options;
  const { compressionManager, type, forceUncompressed } = safeOptions ?? {};

  // If uncompressed is forced or no compression manager, use requested format directly
  if (forceUncompressed || !compressionManager) {
    try {
      return device.createTexture({ label, size, format: requestedFormat, usage });
    } catch (err) {
      Logger.warn(`Failed to create texture '${label}' with format '${requestedFormat}'`, err);
      // Fallback to uncompressed
      return device.createTexture({
        label: `${label}-fallback`,
        size,
        format: 'rgba8unorm',
        usage,
      });
    }
  }

  // Try to use compression-aware format
  let formatToTry: GPUTextureFormat;
  if (type) {
    formatToTry = compressionManager.getFormatForTextureType(type);
  } else {
    formatToTry = compressionManager.getTextureFormat();
  }

  // If format is already uncompressed, use it directly
  if (formatToTry === 'rgba8unorm' || formatToTry === 'rgba8unorm-srgb') {
    try {
      return device.createTexture({ label, size, format: formatToTry, usage });
    } catch (err) {
      Logger.warn(`Failed to create uncompressed texture '${label}'`, err);
      throw err; // No fallback from uncompressed
    }
  }

  // Try compressed format first
  try {
    return device.createTexture({ label, size, format: formatToTry, usage });
  } catch (err) {
    Logger.warn(
      `Failed to create compressed texture '${label}' with format '${formatToTry}', falling back to uncompressed`,
      err
    );
    
    // Fallback to uncompressed RGBA
    try {
      return device.createTexture({
        label: `${label}-fallback`,
        size,
        format: 'rgba8unorm',
        usage,
      });
    } catch (fallbackErr) {
      Logger.error(
        `Failed to create fallback texture '${label}'`,
        fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr))
      );
      throw fallbackErr;
    }
  }
}

/**
 * Safely creates a texture from pixel data with compression fallback.
 * Uses compression manager to select format, falls back to uncompressed if compression fails.
 */
export function createTextureFromDataSafe(
  device: GPUDevice,
  width: number,
  height: number,
  data: Uint8Array,
  label: string,
  safeOptions?: SafeTextureCreationOptions
): GPUTexture {
  const { compressionManager, type, forceUncompressed } = safeOptions ?? {};

  // Determine format
  let format: GPUTextureFormat;
  if (forceUncompressed) {
    format = 'rgba8unorm-srgb';
  } else if (compressionManager && type) {
    format = compressionManager.getFormatForTextureType(type);
  } else if (compressionManager) {
    format = compressionManager.getTextureFormat();
  } else {
    format = 'rgba8unorm-srgb';
  }

  // Try to create texture with selected format
  try {
    return createTextureSafe(
      device,
      {
        label,
        size: { width, height },
        format,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      },
      safeOptions
    );
  } catch (err) {
    Logger.error(
      `Failed to create texture '${label}' from data`,
      err instanceof Error ? err : new Error(String(err))
    );
    throw err;
  }
}

/**
 * Validates that a texture format is supported by the device.
 */
export function isTextureFormatSupported(
  device: GPUDevice,
  format: GPUTextureFormat
): boolean {
  try {
    // Try to create a minimal texture with the format
    const testTexture = device.createTexture({
      label: 'format-test',
      size: [1, 1],
      format,
      usage: GPUTextureUsage.TEXTURE_BINDING,
    });
    testTexture.destroy();
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets a list of supported texture formats for a device.
 */
export function getSupportedTextureFormats(device: GPUDevice): GPUTextureFormat[] {
  const formatsToTest: GPUTextureFormat[] = [
    // Uncompressed
    'rgba8unorm',
    'rgba8unorm-srgb',
    'rgba16float',
    // BC
    'bc1-rgba-unorm',
    'bc2-rgba-unorm',
    'bc3-rgba-unorm',
    'bc4-r-unorm',
    'bc5-rg-unorm',
    'bc6h-rgb-float',
    'bc7-rgba-unorm',
    // ETC2
    'etc2-rgb8unorm',
    'etc2-rgb8a1unorm',
    'etc2-rgba8unorm',
    // ASTC
    'astc-4x4-unorm',
    'astc-5x4-unorm',
    'astc-5x5-unorm',
    'astc-6x5-unorm',
    'astc-6x6-unorm',
    'astc-8x5-unorm',
    'astc-8x6-unorm',
    'astc-8x8-unorm',
    'astc-10x5-unorm',
    'astc-10x6-unorm',
    'astc-10x8-unorm',
    'astc-10x10-unorm',
    'astc-12x10-unorm',
    'astc-12x12-unorm',
  ];

  return formatsToTest.filter(format => isTextureFormatSupported(device, format));
}

