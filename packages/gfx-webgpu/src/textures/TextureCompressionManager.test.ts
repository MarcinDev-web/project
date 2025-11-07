import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextureCompressionManager } from './TextureCompressionManager';
import type { RendererCapabilities } from '../config';

describe('TextureCompressionManager', () => {
  const createMockCapabilities = (overrides?: Partial<RendererCapabilities>): RendererCapabilities => ({
    tier: 1,
    features: {
      timestampQuery: false,
      occlusionQuery: false,
      compute: true,
      textureCompression: {
        bc: false,
        etc2: false,
        astc: false,
      },
    },
    limits: {
      maxTextureDimension2D: 4096,
      maxBufferSize: 256 * 1024 * 1024,
    },
    ...overrides,
  });

  describe('getPreferredFormat', () => {
    it('returns uncompressed when compression is disabled', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: true, etc2: true, astc: true },
        },
      });
      const manager = new TextureCompressionManager(caps);
      manager.setEnabled(false);
      expect(manager.getPreferredFormat()).toBe('uncompressed');
    });

    it('returns BC when available', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: true, etc2: true, astc: true },
        },
      });
      const manager = new TextureCompressionManager(caps);
      expect(manager.getPreferredFormat()).toBe('bc');
    });

    it('returns ETC2 when BC is not available', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: false, etc2: true, astc: true },
        },
      });
      const manager = new TextureCompressionManager(caps);
      expect(manager.getPreferredFormat()).toBe('etc2');
    });

    it('returns ASTC when only ASTC is available', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: false, etc2: false, astc: true },
        },
      });
      const manager = new TextureCompressionManager(caps);
      expect(manager.getPreferredFormat()).toBe('astc');
    });

    it('returns uncompressed when no compression is available', () => {
      const caps = createMockCapabilities();
      const manager = new TextureCompressionManager(caps);
      expect(manager.getPreferredFormat()).toBe('uncompressed');
    });

    it('returns forced format when set', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: true, etc2: true, astc: true },
        },
      });
      const manager = new TextureCompressionManager(caps);
      manager.setForceFormat('etc2');
      expect(manager.getPreferredFormat()).toBe('etc2');
    });

    it('falls back to auto when forced format is not supported', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: false, etc2: false, astc: false },
        },
      });
      const manager = new TextureCompressionManager(caps);
      manager.setForceFormat('bc');
      expect(manager.getPreferredFormat()).toBe('uncompressed');
    });
  });

  describe('getTextureFormat', () => {
    it('returns BC7 format for BC compression', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: true, etc2: false, astc: false },
        },
      });
      const manager = new TextureCompressionManager(caps);
      expect(manager.getTextureFormat('bc')).toBe('bc7-rgba-unorm');
    });

    it('returns ETC2 format for ETC2 compression', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: false, etc2: true, astc: false },
        },
      });
      const manager = new TextureCompressionManager(caps);
      expect(manager.getTextureFormat('etc2')).toBe('etc2-rgba8unorm');
    });

    it('returns ASTC format for ASTC compression', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: false, etc2: false, astc: true },
        },
      });
      const manager = new TextureCompressionManager(caps);
      expect(manager.getTextureFormat('astc')).toBe('astc-4x4-unorm');
    });

    it('returns rgba8unorm for uncompressed', () => {
      const caps = createMockCapabilities();
      const manager = new TextureCompressionManager(caps);
      expect(manager.getTextureFormat('uncompressed')).toBe('rgba8unorm');
    });
  });

  describe('getFormatForTextureType', () => {
    it('returns BC5 for normal maps with BC compression', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: true, etc2: false, astc: false },
        },
      });
      const manager = new TextureCompressionManager(caps);
      expect(manager.getFormatForTextureType('normal')).toBe('bc5-rg-unorm');
    });

    it('returns BC4 for single-channel textures with BC compression', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: true, etc2: false, astc: false },
        },
      });
      const manager = new TextureCompressionManager(caps);
      expect(manager.getFormatForTextureType('roughness')).toBe('bc4-r-unorm');
      expect(manager.getFormatForTextureType('metallic')).toBe('bc4-r-unorm');
      expect(manager.getFormatForTextureType('ao')).toBe('bc4-r-unorm');
    });

    it('returns general format for color textures', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: true, etc2: false, astc: false },
        },
      });
      const manager = new TextureCompressionManager(caps);
      expect(manager.getFormatForTextureType('color')).toBe('bc7-rgba-unorm');
    });
  });

  describe('updateCapabilities', () => {
    it('updates capabilities and resets force format if unsupported', () => {
      const caps1 = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: true, etc2: false, astc: false },
        },
      });
      const manager = new TextureCompressionManager(caps1);
      manager.setForceFormat('bc');
      expect(manager.getPreferredFormat()).toBe('bc');

      const caps2 = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: false, etc2: true, astc: false },
        },
      });
      manager.updateCapabilities(caps2);
      expect(manager.getPreferredFormat()).toBe('etc2');
    });
  });

  describe('getDebugInfo', () => {
    it('returns correct debug information', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: true, etc2: true, astc: false },
        },
      });
      const manager = new TextureCompressionManager(caps);
      const info = manager.getDebugInfo();

      expect(info.preferredFormat).toBe('bc');
      expect(info.forceFormat).toBeNull();
      expect(info.enabled).toBe(true);
      expect(info.supportedFormats).toContain('uncompressed');
      expect(info.supportedFormats).toContain('bc');
      expect(info.supportedFormats).toContain('etc2');
      expect(info.supportedFormats).not.toContain('astc');
    });
  });

  describe('reset', () => {
    it('resets all debug settings to defaults', () => {
      const caps = createMockCapabilities({
        features: {
          timestampQuery: false,
          occlusionQuery: false,
          compute: true,
          textureCompression: { bc: true, etc2: false, astc: false },
        },
      });
      const manager = new TextureCompressionManager(caps);
      manager.setForceFormat('etc2');
      manager.setEnabled(false);

      manager.reset();

      const info = manager.getDebugInfo();
      expect(info.forceFormat).toBeNull();
      expect(info.enabled).toBe(true);
      expect(info.preferredFormat).toBe('bc');
    });
  });
});

