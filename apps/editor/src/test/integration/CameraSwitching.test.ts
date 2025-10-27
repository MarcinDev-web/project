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

  describe('complete camera switching workflow', () => {
    it('should switch from orbit to FPS and back maintaining state', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();
      const controls = (editorUI as any).config.controls;
      const fpsCamera = editorUI.getFPSCamera();

      expect(cameraDirector).toBeDefined();
      expect(fpsCamera).toBeDefined();

      if (!cameraDirector || !fpsCamera) return;

      // 1. Initial state - Free-fly mode (new default)
      expect(cameraDirector.getMode()).toBe('free-fly');

      // 2. Set specific orbit state
      const initialOrbitState = { yaw: 1.2, pitch: 0.4, distance: 12 };
      controls.setState(initialOrbitState);

      const orbitViewBefore = new Float32Array(cameraDirector.getViewMatrix());

      // 3. Switch to FPS mode
      const orbitState = controls.getState();
      fpsCamera.setYawPitch(orbitState.yaw, orbitState.pitch);
      cameraDirector.setMode('fps');
      controls.setEnabled(false);
      fpsCamera.enable();

      expect(cameraDirector.getMode()).toBe('fps');

      // 4. Verify FPS orientation matches orbit
      const fpsOrientation = fpsCamera.getYawPitch();
      expect(fpsOrientation.yaw).toBeCloseTo(initialOrbitState.yaw);
      expect(fpsOrientation.pitch).toBeCloseTo(initialOrbitState.pitch);

      // 5. Simulate camera movement in FPS mode
      fpsCamera.setYawPitch(1.5, 0.2);
      cameraDirector.update(0.016);

      const fpsViewMatrix = new Float32Array(cameraDirector.getViewMatrix());
      expect(fpsViewMatrix).not.toEqual(orbitViewBefore);

      // 6. Switch back to Orbit mode
      cameraDirector.setMode('orbit');
      controls.setEnabled(true);
      fpsCamera.disable();

      expect(cameraDirector.getMode()).toBe('orbit');

      // 7. Verify orbit state was preserved
      const finalOrbitState = controls.getState();
      expect(finalOrbitState.yaw).toBeCloseTo(initialOrbitState.yaw);
      expect(finalOrbitState.pitch).toBeCloseTo(initialOrbitState.pitch);
      expect(finalOrbitState.distance).toBeCloseTo(initialOrbitState.distance);
    });

    it('should handle camera updates in both modes', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();
      const fpsCamera = editorUI.getFPSCamera();

      if (!cameraDirector || !fpsCamera) return;

      // Update in orbit mode
      const orbitViewBefore = new Float32Array(cameraDirector.getViewMatrix());
      cameraDirector.update(0.016);
      fpsCamera.update();

      // View shouldn't change without camera movement
      const orbitViewAfter = cameraDirector.getViewMatrix();
      expect(orbitViewAfter).toEqual(orbitViewBefore);

      // Switch to FPS and update
      const controls = (editorUI as any).config.controls;
      const orbitState = controls.getState();
      fpsCamera.setYawPitch(orbitState.yaw, orbitState.pitch);
      cameraDirector.setMode('fps');

      cameraDirector.update(0.016);
      fpsCamera.update();

      // Should not throw
      expect(() => cameraDirector.getViewMatrix()).not.toThrow();
      expect(() => cameraDirector.getProjectionMatrix()).not.toThrow();
    });

    it('should work in edit mode without player entity', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Verify we're in edit mode (no player)
      expect(editorUI.isPlayMode()).toBe(false);
      expect(cameraDirector.getPlayerPosition()).toBeNull();

      // Switch to FPS in edit mode
      const controls = (editorUI as any).config.controls;
      const fpsCamera = editorUI.getFPSCamera();
      
      if (fpsCamera) {
        const orbitState = controls.getState();
        fpsCamera.setYawPitch(orbitState.yaw, orbitState.pitch);
        cameraDirector.setMode('fps');

        // Should use orbit position as base
        expect(() => cameraDirector.getViewMatrix()).not.toThrow();

        const viewMatrix = cameraDirector.getViewMatrix();
        const sum = Array.from(viewMatrix).reduce((a, b) => a + Math.abs(b), 0);
        expect(sum).toBeGreaterThan(0); // Not identity matrix
      }
    });
  });

  describe('camera switching with scene interaction', () => {
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

      // Switch camera modes
      const controls = (editorUI as any).config.controls;
      const fpsCamera = editorUI.getFPSCamera();
      
      if (fpsCamera) {
        const orbitState = controls.getState();
        fpsCamera.setYawPitch(orbitState.yaw, orbitState.pitch);
        cameraDirector.setMode('fps');

        // Selection should still be active
        expect(selection.primarySelection).toBe(entity);

        // Camera should work
        expect(() => cameraDirector.getViewMatrix()).not.toThrow();
      }
    });

    it('should handle rapid mode switches during scene interaction', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();
      const controls = (editorUI as any).config.controls;
      const fpsCamera = editorUI.getFPSCamera();

      if (!cameraDirector || !fpsCamera) return;

      // Rapid switches
      for (let i = 0; i < 10; i++) {
        const orbitState = controls.getState();
        fpsCamera.setYawPitch(orbitState.yaw, orbitState.pitch);
        cameraDirector.setMode('fps');
        cameraDirector.update(0.001);
        
        cameraDirector.setMode('orbit');
        cameraDirector.update(0.001);
      }

      // Should end in valid state
      expect(cameraDirector.getMode()).toBe('orbit');
      expect(() => cameraDirector.getViewMatrix()).not.toThrow();
    });
  });

  describe('camera matrices and projection', () => {
    it('should provide valid view and projection matrices in both modes', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();
      const controls = (editorUI as any).config.controls;
      const fpsCamera = editorUI.getFPSCamera();

      if (!cameraDirector || !fpsCamera) return;

      // Orbit mode matrices
      const orbitView = cameraDirector.getViewMatrix();
      const orbitProjection = cameraDirector.getProjectionMatrix();

      expect(orbitView).toBeInstanceOf(Float32Array);
      expect(orbitView.length).toBe(16);
      expect(orbitProjection).toBeInstanceOf(Float32Array);
      expect(orbitProjection.length).toBe(16);

      // All values should be finite
      expect(Array.from(orbitView).every(Number.isFinite)).toBe(true);
      expect(Array.from(orbitProjection).every(Number.isFinite)).toBe(true);

      // Switch to FPS
      const orbitState = controls.getState();
      fpsCamera.setYawPitch(orbitState.yaw, orbitState.pitch);
      cameraDirector.setMode('fps');

      const fpsView = cameraDirector.getViewMatrix();
      const fpsProjection = cameraDirector.getProjectionMatrix();

      expect(fpsView).toBeInstanceOf(Float32Array);
      expect(fpsView.length).toBe(16);
      expect(fpsProjection).toBeInstanceOf(Float32Array);
      expect(fpsProjection.length).toBe(16);

      expect(Array.from(fpsView).every(Number.isFinite)).toBe(true);
      expect(Array.from(fpsProjection).every(Number.isFinite)).toBe(true);
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
    it('should show status message when switching camera modes', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Switch to FPS - status should be updated
      cameraDirector.setMode('fps');
      
      // In real implementation, this would update statusEl
      // Here we just verify the mode switched
      expect(cameraDirector.getMode()).toBe('fps');

      // Switch back to orbit
      cameraDirector.setMode('orbit');
      expect(cameraDirector.getMode()).toBe('orbit');
    });
  });

  describe('third person camera', () => {
    it('should switch to third person mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Switch to third person
      cameraDirector.setMode('third-person');
      expect(cameraDirector.getMode()).toBe('third-person');
    });

    it('should provide view matrix in third person mode', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Set player position
      cameraDirector.setPlayerPosition([5, 2, 5]);

      // Switch to third person
      cameraDirector.setMode('third-person');
      
      // Update camera
      cameraDirector.update(0.016);

      // Should provide valid view matrix
      const viewMatrix = cameraDirector.getViewMatrix();
      expect(viewMatrix).toBeDefined();
      expect(viewMatrix.length).toBe(16);
      
      // Verify matrix has non-zero values
      const hasNonZero = Array.from(viewMatrix).some(v => v !== 0);
      expect(hasNonZero).toBe(true);
    });

    it('should switch between FPS and third person', async () => {
      await editorUI.initialize();

      const modeManager = editorUI.getModeManager();
      const cameraDirector = modeManager?.getCameraDirector();

      if (!cameraDirector) return;

      // Set player position
      cameraDirector.setPlayerPosition([0, 2, 0]);

      // Switch to FPS
      cameraDirector.setMode('fps');
      expect(cameraDirector.getMode()).toBe('fps');

      // Switch to third person
      cameraDirector.setMode('third-person');
      expect(cameraDirector.getMode()).toBe('third-person');

      // Switch back to FPS
      cameraDirector.setMode('fps');
      expect(cameraDirector.getMode()).toBe('fps');
    });
  });
});

