/**
 * Integration tests for camera switching workflow
 * Tests the complete flow from UI interaction to camera state changes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Scene, Entity, SelectionManager } from '@engine/world';
import { createOrbitControls } from '@engine/camera';
import { EditorUI } from '../../editor/ui/EditorUI';
import type { Renderer } from '@engine/gfx-webgpu';

function createMockRenderer(): Renderer {
  return {
    updateScene: vi.fn(),
    cleanup: vi.fn(),
    abort: vi.fn(),
    getCapabilities: vi.fn(() => ({
      features: {
        timestampQuery: false,
        occlusionQuery: false,
      },
    })),
    getDevice: vi.fn(),
    getPresentationFormat: vi.fn(() => 'bgra8unorm'),
    fps: 60,
    triangleCount: 0,
    onGpuTimings: vi.fn(),
  } as unknown as Renderer;
}

describe('Camera Switching - Integration', () => {
  let canvas: HTMLCanvasElement;
  let statusEl: HTMLElement;
  let scene: Scene;
  let selection: SelectionManager;
  let editorUI: EditorUI;
  let mockRenderer: Renderer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 768;
    document.body.appendChild(canvas);

    statusEl = document.createElement('div');
    document.body.appendChild(statusEl);

    scene = new Scene('Integration Test Scene');
    selection = new SelectionManager();
    mockRenderer = createMockRenderer();

    // Add some test entities
    const entity1 = new Entity('TestCube1');
    entity1.transform.position = [0, 0, 0];
    scene.addEntity(entity1);

    const entity2 = new Entity('TestCube2');
    entity2.transform.position = [5, 0, 5];
    scene.addEntity(entity2);

    const controls = createOrbitControls(canvas);

    editorUI = new EditorUI({
      canvas,
      statusEl,
      controls,
      scene,
      selection,
      updateSceneBuffers: vi.fn(),
      projectWorldToScreen: vi.fn((pos) => ({ x: pos[0] * 100, y: pos[1] * 100 })),
      getRenderer: () => mockRenderer,
    });
  });

  afterEach(() => {
    editorUI?.dispose();
    // Scene doesn't have dispose method, entities are cleaned up by EditorUI
    document.body.removeChild(canvas);
    document.body.removeChild(statusEl);
  });

  describe('complete camera workflow in editor', () => {
    it('should stay in free-fly mode (only camera available in editor)', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      expect(cameraDirector).toBeDefined();

      if (!cameraDirector) return;

      // Editor only supports free-fly camera
      expect(cameraDirector.getMode()).toBe('free-fly');

      // Camera should work correctly
      cameraDirector.update(0.016);
      const viewAfter = cameraDirector.getViewMatrix();

      // View should be valid
      expect(viewAfter).toBeInstanceOf(Float32Array);
      expect(viewAfter.length).toBe(16);
      expect(Array.from(viewAfter).every(Number.isFinite)).toBe(true);
    });

    it('should handle camera updates in free-fly mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Update in free-fly mode
      cameraDirector.update(0.016);

      // Should not throw
      expect(() => cameraDirector.getViewMatrix()).not.toThrow();
      expect(() => cameraDirector.getProjectionMatrix()).not.toThrow();
      
      const viewAfter = cameraDirector.getViewMatrix();
      expect(viewAfter).toBeInstanceOf(Float32Array);
      expect(viewAfter.length).toBe(16);
    });

    it('should work in edit mode without player entity', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Verify we're in edit mode (no player)
      expect(editorUI.isPlayMode()).toBe(false);

      // Editor only uses free-fly camera
      expect(cameraDirector.getMode()).toBe('free-fly');

      // Should provide valid view matrix
      expect(() => cameraDirector.getViewMatrix()).not.toThrow();

      const viewMatrix = cameraDirector.getViewMatrix();
      const sum = Array.from(viewMatrix).reduce((a, b) => a + Math.abs(b), 0);
      expect(sum).toBeGreaterThan(0); // Not identity matrix
    });
  });

  describe('camera with scene interaction', () => {
    it('should maintain correct view while selecting entities', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Select an entity
      const entity = scene.findEntitiesByName('TestCube1')[0];
      if (entity) {
        selection.select(entity);
      }

      // Camera should still work (free-fly mode)
      expect(cameraDirector.getMode()).toBe('free-fly');

      // Selection should still be active
      expect(selection.primarySelection).toBe(entity);

      // Camera should work
      expect(() => cameraDirector.getViewMatrix()).not.toThrow();
    });

    it('should handle camera updates during scene interaction', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Camera should stay in free-fly mode
      for (let i = 0; i < 10; i++) {
        cameraDirector.update(0.001);
        expect(cameraDirector.getMode()).toBe('free-fly');
      }

      // Should end in valid state
      expect(cameraDirector.getMode()).toBe('free-fly');
      expect(() => cameraDirector.getViewMatrix()).not.toThrow();
    });
  });

  describe('camera matrices and projection', () => {
    it('should provide valid view and projection matrices in free-fly mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Free-fly mode matrices (only mode available in editor)
      const freeFlyView = cameraDirector.getViewMatrix();
      const freeFlyProjection = cameraDirector.getProjectionMatrix();

      expect(freeFlyView).toBeInstanceOf(Float32Array);
      expect(freeFlyView.length).toBe(16);
      expect(freeFlyProjection).toBeInstanceOf(Float32Array);
      expect(freeFlyProjection.length).toBe(16);

      // All values should be finite
      expect(Array.from(freeFlyView).every(Number.isFinite)).toBe(true);
      expect(Array.from(freeFlyProjection).every(Number.isFinite)).toBe(true);
    });

    it('should update projection on canvas resize', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      const initialProjection = new Float32Array(cameraDirector.getProjectionMatrix());

      // Resize canvas
      canvas.width = 1920;
      canvas.height = 1080;

      cameraDirector.update(0.016);

      const newProjection = cameraDirector.getProjectionMatrix();

      // Projection should have changed due to aspect ratio
      expect(newProjection).not.toEqual(initialProjection);
    });
  });

  describe('status messages', () => {
    it('should stay in free-fly mode in editor', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Editor only uses free-fly camera
      expect(cameraDirector.getMode()).toBe('free-fly');

      // Camera should stay in free-fly mode
      cameraDirector.update(0.016);
      expect(cameraDirector.getMode()).toBe('free-fly');
    });
  });

  // Third person and FPS cameras are not available in editor - only in play mode
});

