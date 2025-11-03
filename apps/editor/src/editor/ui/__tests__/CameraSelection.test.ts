/**
 * Camera Selection Integration Tests
 * Tests camera type selection with CameraDirector and persistence
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '../../core/state';
import { Scene } from '@engine/world';
import { CameraDirector } from '@engine/camera';
import { createOrbitControls } from '@engine/camera';
import { persistCameraType, restoreCameraType } from '../../core/EditorPersistence';
import { storageLoad, storageSave } from '../../../utils/storage';
import { initBrowserPolyfills } from '../../../test/setup';

// Mock storage utilities
vi.mock('../../../utils/storage', () => ({
  storageLoad: vi.fn(),
  storageSave: vi.fn(),
}));

describe.skip('Camera Selection Integration', () => {
  let state: EditorState;
  let scene: Scene;
  let canvas: HTMLCanvasElement;
  let cameraDirector: CameraDirector;

  beforeEach(() => {
    initBrowserPolyfills(); // Ensure DOM is ready
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
      editorCamera: null,
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
    it('should default to free-fly camera', () => {
      expect(state.cameraType.value).toBe('free-fly');
    });

    it('should update camera type signal', () => {
      state.cameraType.value = 'free-fly';
      expect(state.cameraType.value).toBe('free-fly');
    });
  });

  describe('CameraDirector integration', () => {
    it('should start in free-fly mode', () => {
      expect(cameraDirector.getMode()).toBe('free-fly');
    });

    // FPS and third-person modes are not available in editor - only in play mode

    it('should handle switching to same mode', () => {
      cameraDirector.setMode('free-fly');
      expect(cameraDirector.getMode()).toBe('free-fly');

      // Should not throw
      cameraDirector.setMode('free-fly');
      expect(cameraDirector.getMode()).toBe('free-fly');
    });
  });

  describe('Camera type persistence', () => {
    it('should persist free-fly camera type', () => {
      state.cameraType.value = 'free-fly';
      persistCameraType(state);

      expect(storageSave).toHaveBeenCalledWith('cameraType', 'free-fly');
    });

    // FPS camera type persistence removed - not used in editor

    it('should restore free-fly camera type', () => {
      vi.mocked(storageLoad).mockReturnValue('free-fly');

      restoreCameraType(state);

      expect(state.cameraType.value).toBe('free-fly');
      expect(storageLoad).toHaveBeenCalledWith('cameraType');
    });

    it('should ignore fps camera type from storage (not used in editor)', () => {
      vi.mocked(storageLoad).mockReturnValue('fps');

      restoreCameraType(state);

      // Should fallback to free-fly (editor default)
      expect(state.cameraType.value).toBe('free-fly');
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
    it('should persist and restore free-fly camera selection', () => {
      // Set to free-fly
      state.cameraType.value = 'free-fly';
      persistCameraType(state);

      // Create new state (simulating page reload)
      const newState = new EditorState(scene);
      expect(newState.cameraType.value).toBe('free-fly'); // Default

      // Restore from storage
      vi.mocked(storageLoad).mockReturnValue('free-fly');
      restoreCameraType(newState);

      // Should be restored
      expect(newState.cameraType.value).toBe('free-fly');
    });

    it('should synchronize state with camera director', () => {
      // Update state
      state.cameraType.value = 'free-fly';

      // Manually sync (in real app, this is done via effect)
      cameraDirector.setMode(state.cameraType.value);

      // Verify sync
      expect(cameraDirector.getMode()).toBe('free-fly');
      expect(state.cameraType.value).toBe('free-fly');
    });
  });

  describe('Type safety', () => {
    it('should accept camera types (though only free-fly is used in editor)', () => {
      // Type system allows all camera types, but editor only uses free-fly
      state.cameraType.value = 'free-fly';
      expect(state.cameraType.value).toBe('free-fly');
      
      // FPS and third-person are for play mode only
      state.cameraType.value = 'fps';
      expect(state.cameraType.value).toBe('fps'); // Type allows it
    });
  });
});


