/**
 * Camera Selection Integration Tests
 * Tests camera type selection with CameraDirector and persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState, type CameraType } from '../../core/state';
import { Scene } from '@engine/world';
import { CameraDirector } from '@engine/camera';
import { createOrbitControls } from '@engine/camera';
import { persistCameraType, restoreCameraType } from '../../core/EditorPersistence';
import { storageLoad, storageSave } from '../../../utils/storage';

// Mock storage utilities
vi.mock('../../../utils/storage', () => ({
  storageLoad: vi.fn(),
  storageSave: vi.fn(),
}));

describe('Camera Selection Integration', () => {
  let state: EditorState;
  let scene: Scene;
  let canvas: HTMLCanvasElement;
  let cameraDirector: CameraDirector;

  beforeEach(() => {
    // Create test canvas
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    // Create test scene and state
    scene = new Scene('Test Scene');
    state = new EditorState(scene);

    // Create camera controls and director
    const controls = createOrbitControls(canvas);
    cameraDirector = new CameraDirector({
      orbitControls: controls,
      fpsCamera: null,
      canvas,
      scene,
      physicsWorld: null,
    });

    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    cameraDirector.dispose();
  });

  describe('EditorState camera type', () => {
    it('should default to orbit camera', () => {
      expect(state.cameraType.value).toBe('orbit');
    });

    it('should update camera type signal', () => {
      state.cameraType.value = 'fps';
      expect(state.cameraType.value).toBe('fps');

      state.cameraType.value = 'orbit';
      expect(state.cameraType.value).toBe('orbit');
    });
  });

  describe('CameraDirector integration', () => {
    it('should switch to orbit mode', () => {
      cameraDirector.setMode('orbit');
      expect(cameraDirector.getMode()).toBe('orbit');
    });

    it('should switch to fps mode', () => {
      cameraDirector.setMode('fps');
      expect(cameraDirector.getMode()).toBe('fps');
    });

    it('should switch from orbit to fps', () => {
      cameraDirector.setMode('orbit');
      expect(cameraDirector.getMode()).toBe('orbit');

      cameraDirector.setMode('fps');
      expect(cameraDirector.getMode()).toBe('fps');
    });

    it('should switch from fps to orbit', () => {
      cameraDirector.setMode('fps');
      expect(cameraDirector.getMode()).toBe('fps');

      cameraDirector.setMode('orbit');
      expect(cameraDirector.getMode()).toBe('orbit');
    });

    it('should handle switching to same mode', () => {
      cameraDirector.setMode('orbit');
      expect(cameraDirector.getMode()).toBe('orbit');

      // Should not throw
      cameraDirector.setMode('orbit');
      expect(cameraDirector.getMode()).toBe('orbit');
    });
  });

  describe('Camera type persistence', () => {
    it('should persist orbit camera type', () => {
      state.cameraType.value = 'orbit';
      persistCameraType(state);

      expect(storageSave).toHaveBeenCalledWith('cameraType', 'orbit');
    });

    it('should persist fps camera type', () => {
      state.cameraType.value = 'fps';
      persistCameraType(state);

      expect(storageSave).toHaveBeenCalledWith('cameraType', 'fps');
    });

    it('should restore orbit camera type', () => {
      vi.mocked(storageLoad).mockReturnValue('orbit');

      restoreCameraType(state);

      expect(state.cameraType.value).toBe('orbit');
      expect(storageLoad).toHaveBeenCalledWith('cameraType');
    });

    it('should restore fps camera type', () => {
      vi.mocked(storageLoad).mockReturnValue('fps');

      restoreCameraType(state);

      expect(state.cameraType.value).toBe('fps');
      expect(storageLoad).toHaveBeenCalledWith('cameraType');
    });

    it('should ignore invalid stored camera type', () => {
      const originalValue = state.cameraType.value;
      vi.mocked(storageLoad).mockReturnValue('invalid' as any);

      restoreCameraType(state);

      // Should not change
      expect(state.cameraType.value).toBe(originalValue);
    });

    it('should handle storage errors gracefully', () => {
      vi.mocked(storageLoad).mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => restoreCameraType(state)).not.toThrow();
    });

    it('should handle null from storage', () => {
      const originalValue = state.cameraType.value;
      vi.mocked(storageLoad).mockReturnValue(null);

      restoreCameraType(state);

      // Should keep original value
      expect(state.cameraType.value).toBe(originalValue);
    });

    it('should handle undefined from storage', () => {
      const originalValue = state.cameraType.value;
      vi.mocked(storageLoad).mockReturnValue(undefined);

      restoreCameraType(state);

      // Should keep original value
      expect(state.cameraType.value).toBe(originalValue);
    });
  });

  describe('Full workflow', () => {
    it('should persist and restore camera selection', () => {
      // Set to FPS
      state.cameraType.value = 'fps';
      persistCameraType(state);

      // Create new state (simulating page reload)
      const newState = new EditorState(scene);
      expect(newState.cameraType.value).toBe('orbit'); // Default

      // Restore from storage
      vi.mocked(storageLoad).mockReturnValue('fps');
      restoreCameraType(newState);

      // Should be restored
      expect(newState.cameraType.value).toBe('fps');
    });

    it('should synchronize state with camera director', () => {
      // Update state
      state.cameraType.value = 'fps';

      // Manually sync (in real app, this is done via effect)
      cameraDirector.setMode(state.cameraType.value);

      // Verify sync
      expect(cameraDirector.getMode()).toBe('fps');
      expect(state.cameraType.value).toBe('fps');

      // Change back
      state.cameraType.value = 'orbit';
      cameraDirector.setMode(state.cameraType.value);

      expect(cameraDirector.getMode()).toBe('orbit');
      expect(state.cameraType.value).toBe('orbit');
    });
  });

  describe('Type safety', () => {
    it('should only accept valid camera types', () => {
      const validTypes: CameraType[] = ['orbit', 'fps', 'third-person'];

      validTypes.forEach(type => {
        state.cameraType.value = type;
        expect(state.cameraType.value).toBe(type);
      });
    });
  });
});

