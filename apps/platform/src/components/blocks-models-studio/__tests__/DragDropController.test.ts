/**
 * Tests for DragDropController
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DragDropController } from '../DragDropController';
import { Scene } from '@engine/world';
import type { OrbitControls } from '@engine/camera';

function createMockControls(): OrbitControls {
  return {
    getState: () => ({ yaw: 0, pitch: 0, distance: 5 }),
    cleanup: vi.fn(),
    setEnabled: vi.fn(),
    setState: vi.fn(),
    setPreset: vi.fn(),
  } as any;
}

describe('DragDropController', () => {
  let canvas: HTMLCanvasElement;
  let scene: Scene;
  let controls: OrbitControls;
  let controller: DragDropController;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'width', { value: 800, writable: true });
    Object.defineProperty(canvas, 'height', { value: 600, writable: true });
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

    scene = new Scene('Test');
    controls = createMockControls();
  });

  afterEach(() => {
    if (controller) {
      controller.dispose();
    }
  });

  it('should create instance', () => {
    controller = new DragDropController({
      canvas,
      controls,
      scene,
    });

    expect(controller).toBeDefined();
  });

  it('should initialize and cleanup', () => {
    controller = new DragDropController({
      canvas,
      controls,
      scene,
    });

    const cleanup = controller.initialize();
    expect(cleanup).toBeDefined();
    expect(typeof cleanup).toBe('function');

    cleanup();
    // Should cleanup without errors
  });

  it('should set grid size', () => {
    controller = new DragDropController({
      canvas,
      controls,
      scene,
    });

    controller.setGridSize(0.25);
    // Grid size should be set
  });

  it('should check if dragging', () => {
    controller = new DragDropController({
      canvas,
      controls,
      scene,
    });

    expect(controller.isDraggingBlock()).toBe(false);
  });

  it('should cancel drag', () => {
    controller = new DragDropController({
      canvas,
      controls,
      scene,
    });

    expect(() => controller.cancelDrag()).not.toThrow();
  });
});

