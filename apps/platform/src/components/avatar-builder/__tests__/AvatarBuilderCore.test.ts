/**
 * Tests for AvatarBuilderCore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AvatarBuilderCore } from '../AvatarBuilderCore';
import { DEFAULT_AVATAR_LOADOUT } from '@engine/avatar';
import type { RgbaColor } from '@engine/world';

// Mock WebGPU
const mockCanvas = {
  getContext: vi.fn(() => ({
    configure: vi.fn(),
  })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as unknown as HTMLCanvasElement;

const mockStatusEl = document.createElement('div');

describe('AvatarBuilderCore', () => {
  let core: AvatarBuilderCore;

  beforeEach(() => {
    // Mock navigator.gpu
    (global.navigator as any).gpu = {
      requestAdapter: vi.fn().mockResolvedValue({
        requestDevice: vi.fn().mockResolvedValue({
          features: new Set(),
          limits: {},
        }),
        features: new Set(),
      }),
      getPreferredCanvasFormat: vi.fn(() => 'rgba8unorm'),
    };

    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      setTimeout(() => cb(performance.now()), 16);
      return 1;
    });

    global.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    if (core) {
      core.dispose();
    }
  });

  it('should create instance with default loadout', () => {
    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
    });

    const loadout = core.getCurrentLoadout();
    expect(loadout.version).toBe(1);
    expect(loadout.parts).toBeDefined();
  });

  it('should create instance with custom loadout', () => {
    const customLoadout = {
      version: 1,
      parts: {
        HeadSlot: { mesh: 'custom_head' },
      },
    };

    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
      initialLoadout: customLoadout,
    });

    const loadout = core.getCurrentLoadout();
    expect(loadout.parts.HeadSlot?.mesh).toBe('custom_head');
  });

  it('should apply loadout changes', () => {
    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
    });

    const newLoadout = {
      version: 1,
      parts: {
        HeadSlot: { mesh: 'new_head', colors: { primary: [1, 0, 0, 1] as RgbaColor } },
      },
    };

    core.applyLoadout(newLoadout);
    const loadout = core.getCurrentLoadout();
    expect(loadout.parts.HeadSlot?.mesh).toBe('new_head');
  });

  it('should reset to default loadout', () => {
    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
    });

    // Apply custom loadout first
    const customLoadout = {
      version: 1,
      parts: {
        HeadSlot: { mesh: 'custom' },
      },
    };
    core.applyLoadout(customLoadout);

    // Reset
    core.resetToDefault();
    const loadout = core.getCurrentLoadout();
    expect(loadout).toEqual(DEFAULT_AVATAR_LOADOUT);
  });

  it('should dispose resources', () => {
    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
    });

    expect(() => core.dispose()).not.toThrow();
    
    // After disposal, operations should fail
    expect(() => core.applyLoadout(DEFAULT_AVATAR_LOADOUT)).toThrow();
  });

  it('should notify on loadout change', () => {
    const onLoadoutChange = vi.fn();
    
    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
      onLoadoutChange,
    });

    const newLoadout = {
      version: 1,
      parts: {
        HeadSlot: { mesh: 'test' },
      },
    };

    core.applyLoadout(newLoadout);
    
    // Note: This might be called during initialization too
    expect(onLoadoutChange).toHaveBeenCalled();
  });
});

