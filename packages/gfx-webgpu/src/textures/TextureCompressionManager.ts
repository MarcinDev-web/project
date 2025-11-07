/**
 * Texture Compression Manager
 * 
 * Manages texture compression format selection based on GPU capabilities
 * and provides debug toggles for testing different formats.
 */

import type { RendererCapabilities } from '../config';
import { Logger } from '@engine/core/utils';

export type CompressionFormat = 'bc' | 'etc2' | 'astc' | 'uncompressed';

export interface CompressionOptions {
  /** Force a specific compression format (for debugging) */
  forceFormat?: CompressionFormat | null;
  /** Whether to use compression at all */
  enabled?: boolean;
}

/**
 * TextureCompressionManager handles format selection and compression settings
 */
export class TextureCompressionManager {
  private capabilities: RendererCapabilities;
  private forceFormat: CompressionFormat | null = null;
  private enabled: boolean = true;

  constructor(capabilities: RendererCapabilities) {
    this.capabilities = capabilities;
  }

  /**
   * Updates capabilities (called when device is recreated)
   */
  updateCapabilities(capabilities: RendererCapabilities): void {
    this.capabilities = capabilities;
    // Reset force format if it's no longer supported
    if (this.forceFormat && !this.isFormatSupported(this.forceFormat)) {
      Logger.warn(`Forced compression format '${this.forceFormat}' is not supported, resetting to auto`);
      this.forceFormat = null;
    }
  }

  /**
   * Gets the preferred compression format based on capabilities
   */
  getPreferredFormat(): CompressionFormat {
    // Check if compression is disabled
    if (!this.enabled) {
      return 'uncompressed';
    }

    // Check if a format is forced (for debugging)
    if (this.forceFormat !== null) {
      if (this.isFormatSupported(this.forceFormat)) {
        return this.forceFormat;
      } else {
        Logger.warn(`Forced format '${this.forceFormat}' not supported, falling back to auto`);
      }
    }

    // Auto-select based on capabilities (priority: BC > ETC2 > ASTC)
    if (this.capabilities.features.textureCompression.bc) {
      return 'bc';
    }
    if (this.capabilities.features.textureCompression.etc2) {
      return 'etc2';
    }
    if (this.capabilities.features.textureCompression.astc) {
      return 'astc';
    }

    return 'uncompressed';
  }

  /**
   * Checks if a specific format is supported
   */
  isFormatSupported(format: CompressionFormat): boolean {
    if (format === 'uncompressed') {
      return true; // Always supported
    }
    return this.capabilities.features.textureCompression[format];
  }

  /**
   * Gets the WebGPU texture format string for the selected compression
   */
  getTextureFormat(format?: CompressionFormat): GPUTextureFormat {
    const selectedFormat = format ?? this.getPreferredFormat();

    switch (selectedFormat) {
      case 'bc':
        // BC formats - prefer BC7 for RGBA, BC1 for RGB
        return 'bc7-rgba-unorm';
      case 'etc2':
        // ETC2 formats - prefer ETC2 RGBA8
        return 'etc2-rgba8unorm';
      case 'astc':
        // ASTC formats - prefer 4x4 block size
        return 'astc-4x4-unorm';
      case 'uncompressed':
      default:
        return 'rgba8unorm';
    }
  }

  /**
   * Gets the best format for a specific texture type
   */
  getFormatForTextureType(
    type: 'color' | 'normal' | 'roughness' | 'metallic' | 'ao' | 'emissive',
    options?: CompressionOptions
  ): GPUTextureFormat {
    const preferredFormat = options?.forceFormat ?? this.getPreferredFormat();

    // Normal maps often benefit from BC5 (2-channel) or uncompressed
    if (type === 'normal' && preferredFormat === 'bc') {
      return 'bc5-rg-unorm'; // BC5 for 2-channel normal maps
    }

    // Single-channel textures (roughness, metallic, AO) can use BC4
    if ((type === 'roughness' || type === 'metallic' || type === 'ao') && preferredFormat === 'bc') {
      return 'bc4-r-unorm'; // BC4 for single-channel
    }

    // Use the general format selection
    return this.getTextureFormat(preferredFormat);
  }

  /**
   * Debug: Force a specific compression format
   */
  setForceFormat(format: CompressionFormat | null): void {
    if (format !== null && !this.isFormatSupported(format)) {
      Logger.warn(`Cannot force unsupported format '${format}'`);
      return;
    }
    this.forceFormat = format;
    Logger.info(`Texture compression format forced to: ${format ?? 'auto'}`);
  }

  /**
   * Debug: Enable/disable compression
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    Logger.info(`Texture compression ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Gets current compression settings (for debugging)
   */
  getDebugInfo(): {
    preferredFormat: CompressionFormat;
    forceFormat: CompressionFormat | null;
    enabled: boolean;
    supportedFormats: CompressionFormat[];
  } {
    const supportedFormats: CompressionFormat[] = ['uncompressed'];
    if (this.capabilities.features.textureCompression.bc) supportedFormats.push('bc');
    if (this.capabilities.features.textureCompression.etc2) supportedFormats.push('etc2');
    if (this.capabilities.features.textureCompression.astc) supportedFormats.push('astc');

    return {
      preferredFormat: this.getPreferredFormat(),
      forceFormat: this.forceFormat,
      enabled: this.enabled,
      supportedFormats,
    };
  }

  /**
   * Resets all debug settings to defaults
   */
  reset(): void {
    this.forceFormat = null;
    this.enabled = true;
    Logger.info('Texture compression settings reset to defaults');
  }
}

