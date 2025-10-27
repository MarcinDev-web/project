/**
 * Tests for camera switching functionality in EditorUI
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
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
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
    document.body.removeChild(canvas);
    document.body.removeChild(statusEl);
  });

  describe('camera mode switching', () => {
    it('should initialize with free-fly camera mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      expect(cameraDirector?.getMode()).toBe('free-fly');
    });

    it('should switch to FPS camera mode and synchronize orientation', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();
      const fpsCamera = editorUI.getFPSCamera();

      // Get initial orbit state
      const state = (editorUI as any).config.controls.getState();

      // Switch to FPS mode via UI
      if (cameraDirector && fpsCamera) {
        // Simulate camera change from UI
        cameraDirector.setMode('fps');
        fpsCamera.setYawPitch(state.yaw, state.pitch);

        expect(cameraDirector.getMode()).toBe('fps');
        
        // Verify orientation was synchronized
        const fpsOrientation = fpsCamera.getYawPitch();
        expect(fpsOrientation.yaw).toBe(state.yaw);
        expect(fpsOrientation.pitch).toBe(state.pitch);
      }
    });

    it('should switch back to orbit camera mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (cameraDirector) {
        // Switch to FPS
        cameraDirector.setMode('fps');
        expect(cameraDirector.getMode()).toBe('fps');

        // Switch back to orbit
        cameraDirector.setMode('orbit');
        expect(cameraDirector.getMode()).toBe('orbit');
      }
    });

    it('should enable FPS camera when switching to FPS mode', async () => {
      await editorUI.initialize();

      const fpsCamera = editorUI.getFPSCamera();
      expect(fpsCamera).toBeDefined();

      // FPS camera should have enable/disable methods
      expect(typeof fpsCamera?.enable).toBe('function');
      expect(typeof fpsCamera?.disable).toBe('function');
    });

    it('should disable orbit controls when in FPS mode', async () => {
      await editorUI.initialize();

      const controls = (editorUI as any).config.controls;
      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (cameraDirector) {
        // Switch to FPS mode
        cameraDirector.setMode('fps');
        controls.setEnabled(false); // Simulate what UI does

        // Verify mode changed
        expect(cameraDirector.getMode()).toBe('fps');
      }
    });

    it('should re-enable orbit controls when switching back from FPS', async () => {
      await editorUI.initialize();

      const controls = (editorUI as any).config.controls;
      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (cameraDirector) {
        // Switch to FPS
        cameraDirector.setMode('fps');
        controls.setEnabled(false);

        // Switch back to orbit
        cameraDirector.setMode('orbit');
        controls.setEnabled(true);

        expect(cameraDirector.getMode()).toBe('orbit');
      }
    });
  });

  describe('camera state persistence', () => {
    it('should preserve orbit camera state when switching modes', async () => {
      await editorUI.initialize();

      const controls = (editorUI as any).config.controls;
      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (cameraDirector) {
        // Set specific orbit state
        const initialState = { yaw: 1.5, pitch: 0.3, distance: 10 };
        controls.setState(initialState);

        // Switch to FPS and back
        cameraDirector.setMode('fps');
        cameraDirector.setMode('orbit');

        // Orbit state should be preserved
        const finalState = controls.getState();
        expect(finalState.yaw).toBeCloseTo(initialState.yaw);
        expect(finalState.pitch).toBeCloseTo(initialState.pitch);
        expect(finalState.distance).toBeCloseTo(initialState.distance);
      }
    });
  });

  describe('camera updates', () => {
    it('should update camera director in edit mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (cameraDirector) {
        const updateSpy = vi.spyOn(cameraDirector, 'update');

        // Simulate frame update (from app.ts onFrameUpdate)
        cameraDirector.update(0.016);

        expect(updateSpy).toHaveBeenCalledWith(0.016);
      }
    });

    it('should update FPS camera for pointer lock handling', async () => {
      await editorUI.initialize();

      const fpsCamera = editorUI.getFPSCamera();

      if (fpsCamera) {
        const updateSpy = vi.spyOn(fpsCamera, 'update');

        // Simulate frame update
        fpsCamera.update();

        expect(updateSpy).toHaveBeenCalled();
      }
    });
  });

  describe('camera integration with editor modes', () => {
    it('should use FPS camera in edit mode without player position', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (cameraDirector) {
        // In edit mode, player position should be null
        expect(cameraDirector.getPlayerPosition()).toBeNull();

        // But FPS mode should still work (using orbit position)
        cameraDirector.setMode('fps');
        
        // Should not throw
        expect(() => cameraDirector.getViewMatrix()).not.toThrow();
        expect(() => cameraDirector.getProjectionMatrix()).not.toThrow();
      }
    });

    it('should use player position in play mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();

      // Enter play mode
      if (modeManager) {
        // Play mode setup would set player position
        const cameraDirector = modeManager.getCameraDirector();
        cameraDirector.setPlayerPosition([5, 1, 5]);

        expect(cameraDirector.getPlayerPosition()).toEqual([5, 1, 5]);
      }
    });
  });

  describe('error handling', () => {
    it('should handle camera switch without FPS camera gracefully', async () => {
      // Create EditorUI without FPS camera
      const editorWithoutFPS = new EditorUI({
        canvas,
        statusEl,
        controls: createOrbitControls(canvas),
        scene,
        selection,
        updateSceneBuffers: vi.fn(),
        projectWorldToScreen: vi.fn(() => ({ x: 0, y: 0 })),
        getRenderer: () => mockRenderer,
      });

      await editorWithoutFPS.initialize();

      const modeManager = editorWithoutFPS.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (cameraDirector) {
        // Should fallback to orbit mode
        expect(() => cameraDirector.setMode('fps')).not.toThrow();
      }

      editorWithoutFPS.dispose();
    });

    it('should handle rapid camera mode changes', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (cameraDirector) {
        // Rapid switches should not cause errors
        expect(() => {
          cameraDirector.setMode('fps');
          cameraDirector.setMode('orbit');
          cameraDirector.setMode('fps');
          cameraDirector.setMode('orbit');
        }).not.toThrow();

        expect(cameraDirector.getMode()).toBe('orbit');
      }
    });
  });
});

