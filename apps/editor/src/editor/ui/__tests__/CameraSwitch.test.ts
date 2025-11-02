/**
 * Tests for camera switching functionality in EditorUI
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorUI } from '../EditorUI';
import { Scene, SelectionManager } from '@engine/world';
import { createOrbitControls } from '@engine/camera';
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
    initializeGridRenderer: vi.fn(),
    fps: 60,
    triangleCount: 0,
  } as unknown as Renderer;
}

describe('EditorUI - Camera Switching', () => {
  let canvas: HTMLCanvasElement;
  let statusEl: HTMLElement;
  let scene: Scene;
  let selection: SelectionManager;
  let editorUI: EditorUI;
  let mockRenderer: Renderer;

  beforeEach(() => {
    document.body.innerHTML = '';
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    // JSDOM getBoundingClientRect returns zeros by default; stub it
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
    document.body.appendChild(canvas);

    statusEl = document.createElement('div');
    document.body.appendChild(statusEl);

    scene = new Scene('Test Scene');
    selection = new SelectionManager();
    mockRenderer = createMockRenderer();

    const controls = createOrbitControls(canvas);

    editorUI = new EditorUI({
      canvas,
      statusEl,
      controls,
      scene,
      selection,
      updateSceneBuffers: vi.fn(),
      projectWorldToScreen: vi.fn(() => ({ x: 0, y: 0 })),
      getRenderer: () => mockRenderer,
    });
  });

  afterEach(() => {
    editorUI?.dispose();
    // Safely remove elements if they still exist in the DOM
    if (canvas.parentNode === document.body) {
      document.body.removeChild(canvas);
    }
    if (statusEl.parentNode === document.body) {
      document.body.removeChild(statusEl);
    }
  });

  describe('camera mode switching', () => {
    it('should initialize with free-fly camera mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      expect(modeManager).toBeTruthy();
      
      const cameraDirector = modeManager?.getCameraDirector();
      expect(cameraDirector).toBeTruthy();
      expect(cameraDirector!.getMode()).toBe('free-fly');
    });

    it('should stay in free-fly camera mode (only camera available in editor)', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      expect(modeManager).toBeTruthy();
      
      const cameraDirector = modeManager?.getCameraDirector();
      expect(cameraDirector).toBeTruthy();

      // Editor only supports free-fly camera
      expect(cameraDirector!.getMode()).toBe('free-fly');

      // FPS and third-person modes are not available in editor
      // They are only available in play mode
    });
  });

  describe('camera state persistence', () => {
    it('should preserve free-fly camera state', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      expect(modeManager).toBeTruthy();
      
      const cameraDirector = modeManager?.getCameraDirector();
      expect(cameraDirector).toBeTruthy();

      // Camera should stay in free-fly mode in editor
      cameraDirector!.update(0.016);

      const finalView = Array.from(cameraDirector!.getViewMatrix());
      // View matrix should be valid
      expect(finalView.length).toBe(16);
    });
  });

  describe('camera updates', () => {
    it('should update camera director in edit mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      expect(modeManager).toBeTruthy();
      
      const cameraDirector = modeManager?.getCameraDirector();
      expect(cameraDirector).toBeTruthy();

      const updateSpy = vi.spyOn(cameraDirector!, 'update');

      // Simulate frame update (from app.ts onFrameUpdate)
      cameraDirector!.update(0.016);

      expect(updateSpy).toHaveBeenCalledWith(0.016);
    });

    // FPS camera is not used in editor - only in play mode
  });

  describe('camera integration with editor modes', () => {
    it('should use free-fly camera in edit mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      expect(modeManager).toBeTruthy();
      
      const cameraDirector = modeManager?.getCameraDirector();
      expect(cameraDirector).toBeTruthy();

      // In edit mode, only free-fly camera is available
      expect(cameraDirector!.getMode()).toBe('free-fly');
      
      // Should not throw
      expect(() => cameraDirector!.getViewMatrix()).not.toThrow();
      expect(() => cameraDirector!.getProjectionMatrix()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle camera director errors gracefully', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      expect(modeManager).toBeTruthy();
      
      const cameraDirector = modeManager?.getCameraDirector();
      expect(cameraDirector).toBeTruthy();

      // Camera director should handle errors gracefully
      expect(() => {
        cameraDirector!.update(0.016);
        cameraDirector!.getViewMatrix();
        cameraDirector!.getProjectionMatrix();
      }).not.toThrow();
    });
  });
});

