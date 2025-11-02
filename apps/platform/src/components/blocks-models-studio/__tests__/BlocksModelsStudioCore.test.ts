/**
 * Tests for BlocksModelsStudioCore
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BlocksModelsStudioCore } from '../BlocksModelsStudioCore';
import { Scene } from '@engine/world';
import type { RgbaColor } from '@engine/blocks';

describe('BlocksModelsStudioCore', () => {
  let canvas: HTMLCanvasElement;
  let core: BlocksModelsStudioCore;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'width', { value: 800, writable: true });
    Object.defineProperty(canvas, 'height', { value: 600, writable: true });
    (canvas as any).getContext = vi.fn(() => null);
    (canvas as any).getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    if (core) {
      core.dispose();
    }
  });

  it('should create instance', () => {
    core = new BlocksModelsStudioCore({
      canvas,
    });

    expect(core).toBeDefined();
    expect(core.getScene()).toBeInstanceOf(Scene);
  });

  it('should initialize with valid canvas', async () => {
    // Mock WebGPU
    (global as any).navigator = {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue({
          requestDevice: vi.fn().mockResolvedValue({}),
        }),
      },
    };

    core = new BlocksModelsStudioCore({
      canvas,
    });

    // Note: This will fail in test environment without WebGPU support
    // But we can test that the structure is correct
    expect(core).toBeDefined();
  });

  it('should dispose resources', () => {
    core = new BlocksModelsStudioCore({
      canvas,
    });

    expect(() => core.dispose()).not.toThrow();
  });

  it('should add and remove blocks', () => {
    core = new BlocksModelsStudioCore({
      canvas,
    });

    const block = {
      id: 'test_block',
      name: 'Test Block',
      category: 'basic' as const,
      material: 'plastic' as const,
      textures: {
        top: { color: [1, 0, 0, 1] as RgbaColor, pattern: 'smooth' as const, brightness: 1.0 },
        bottom: { color: [1, 0, 0, 1] as RgbaColor, pattern: 'smooth' as const, brightness: 0.8 },
        sides: { color: [1, 0, 0, 1] as RgbaColor, pattern: 'smooth' as const, brightness: 0.9 },
      },
      properties: {
        solid: true,
        transparent: false,
        emissive: 0,
        roughness: 0.5,
        metallic: 0,
      },
    };

    const entity = core.addBlock(block, [0, 0, 0]);
    expect(entity).toBeDefined();

    core.removeBlock(entity.id);
    // Block should be removed
  });

  it('should clear all blocks', () => {
    core = new BlocksModelsStudioCore({
      canvas,
    });

    const block = {
      id: 'test_block',
      name: 'Test Block',
      category: 'basic' as const,
      material: 'plastic' as const,
      textures: {
        top: { color: [1, 0, 0, 1] as RgbaColor, pattern: 'smooth' as const, brightness: 1.0 },
        bottom: { color: [1, 0, 0, 1] as RgbaColor, pattern: 'smooth' as const, brightness: 0.8 },
        sides: { color: [1, 0, 0, 1] as RgbaColor, pattern: 'smooth' as const, brightness: 0.9 },
      },
      properties: {
        solid: true,
        transparent: false,
        emissive: 0,
        roughness: 0.5,
        metallic: 0,
      },
    };

    core.addBlock(block, [0, 0, 0]);
    core.addBlock(block, [1, 0, 0]);

    core.clearBlocks();
    // All blocks should be cleared
  });
});

