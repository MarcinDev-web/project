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
  style: {} as CSSStyleDeclaration,
} as unknown as HTMLCanvasElement;

const mockStatusEl = document.createElement('div');

describe.skip('AvatarBuilderCore', () => {
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
        HeadSlot: { mesh: 'head_default' }, // Use existing part ID
      },
    };

    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
      initialLoadout: customLoadout,
    });

    const loadout = core.getCurrentLoadout();
    expect(loadout.parts.HeadSlot?.mesh).toBe('head_default');
  });

  it('should apply loadout changes', () => {
    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
    });

    const newLoadout = {
      version: 1,
      parts: {
        HeadSlot: { mesh: 'head_default', colors: { primary: [1, 0, 0, 1] as RgbaColor } },
      },
    };

    core.applyLoadout(newLoadout);
    const loadout = core.getCurrentLoadout();
    expect(loadout.parts.HeadSlot?.mesh).toBe('head_default');
    expect(loadout.parts.HeadSlot?.colors?.primary).toEqual([1, 0, 0, 1]);
  });

  it('should reset camera to default position', () => {
    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
    });

    const controls = core.getControls();
    const initialState = controls.getState();

    // Change camera position
    controls.setState({ yaw: 1.5, pitch: 0.8, distance: 5 });

    // Reset camera
    core.resetCamera();

    const stateAfterReset = controls.getState();
    expect(stateAfterReset.yaw).toBe(0);
    expect(stateAfterReset.pitch).toBe(0.5);
    expect(stateAfterReset.distance).toBe(3);
  });

  it('should rotate camera left', () => {
    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
    });

    const controls = core.getControls();
    const initialState = controls.getState();

    core.rotateLeft(0.3);

    const stateAfterRotate = controls.getState();
    expect(stateAfterRotate.yaw).toBe(initialState.yaw - 0.3);
    expect(stateAfterRotate.pitch).toBe(initialState.pitch);
    expect(stateAfterRotate.distance).toBe(initialState.distance);
  });

  it('should rotate camera right', () => {
    core = new AvatarBuilderCore({
      canvas: mockCanvas,
      statusEl: mockStatusEl,
    });

    const controls = core.getControls();
    const initialState = controls.getState();

    core.rotateRight(0.3);

    const stateAfterRotate = controls.getState();
    expect(stateAfterRotate.yaw).toBe(initialState.yaw + 0.3);
    expect(stateAfterRotate.pitch).toBe(initialState.pitch);
    expect(stateAfterRotate.distance).toBe(initialState.distance);
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


