/**
 * Tests for EasyPlaceController
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EasyPlaceController } from '../src/editor/controllers/EasyPlaceController';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { EditorState } from '../src/editor/core/state';
import { SelectionManager } from '@engine/world';

describe('EasyPlaceController', () => {
  let controller: EasyPlaceController;
  let scene: Scene;
  let state: EditorState;
  let canvas: HTMLCanvasElement;
  let mockConfig: any;

  beforeEach(() => {
    // Create canvas mock
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    // Create scene and state
    scene = new Scene();
    state = new EditorState(scene);

    // Mock dependencies
    const mockControls = {
      getState: vi.fn().mockReturnValue({ yaw: 0, pitch: 0, distance: 10 }),
      setState: vi.fn(),
      setEnabled: vi.fn(),
    };

    const mockSelection = new SelectionManager();
    mockSelection.setScene(scene);

    const mockPlacementMode = {
      isActive: vi.fn().mockReturnValue(false),
      getPreviewEntity: vi.fn().mockReturnValue(null),
      confirmPlacement: vi.fn().mockReturnValue(null),
      cancelPlacement: vi.fn(),
      getPreview: vi.fn().mockReturnValue({ asset: null }),
      startPlacement: vi.fn(),
      rotatePreview: vi.fn(),
      getConfig: vi.fn().mockReturnValue({
        validColor: [0, 1, 0, 1],
        invalidColor: [1, 0, 0, 1],
      }),
    };

    const mockCollisionDetector = {
      checkCollisionOBB: vi.fn().mockReturnValue({ hasCollision: false, collidingEntities: [] }),
    };

    mockConfig = {
      canvas,
      controls: mockControls,
      scene,
      selection: mockSelection,
      state,
      placementMode: mockPlacementMode,
      collisionDetector: mockCollisionDetector,
      updateSceneBuffers: vi.fn(),
      recordSnapshot: vi.fn(),
      onStatusMessage: vi.fn(),
    };

    controller = new EasyPlaceController(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => controller.initialize()).not.toThrow();
    });

    it('should return cleanup function', () => {
      const cleanup = controller.initialize();
      expect(typeof cleanup).toBe('function');
    });

    it('should clean up event listeners on dispose', () => {
      const cleanup = controller.initialize();
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('isEasyPlaceActive', () => {
    it('should return false when Easy Place mode is disabled', () => {
      state.easyPlaceMode.value = false;
      expect(controller.isEasyPlaceActive()).toBe(false);
    });

    it('should return true when Easy Place mode is enabled', () => {
      state.easyPlaceMode.value = true;
      expect(controller.isEasyPlaceActive()).toBe(true);
    });
  });

  describe('pattern state', () => {
    it('should start with inactive pattern state', () => {
      const patternState = controller.getPatternState();
      expect(patternState.active).toBe(false);
      expect(patternState.type).toBe('single');
    });

    it('should track pattern type from state', () => {
      state.easyPlacePattern.value = 'line';
      // Pattern state updates when pattern placement is initiated
      expect(state.easyPlacePattern.value).toBe('line');
    });
  });

  describe('single-click placement', () => {
    beforeEach(() => {
      state.easyPlaceMode.value = true;
      state.easyPlacePattern.value = 'single';
      mockConfig.placementMode.isActive.mockReturnValue(true);
    });

    it('should confirm placement when single-click mode is active', () => {
      const entity = new Entity('placed');
      mockConfig.placementMode.confirmPlacement.mockReturnValue(entity);

      controller.initialize();

      // Simulate click
      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      expect(mockConfig.placementMode.confirmPlacement).toHaveBeenCalled();
      expect(mockConfig.updateSceneBuffers).toHaveBeenCalled();
      expect(mockConfig.recordSnapshot).toHaveBeenCalledWith('Easy Place object');
    });

    it('should not place when placement mode is inactive', () => {
      mockConfig.placementMode.isActive.mockReturnValue(false);

      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      expect(mockConfig.placementMode.confirmPlacement).not.toHaveBeenCalled();
    });

    it('should not place when Easy Place is disabled', () => {
      state.easyPlaceMode.value = false;

      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      expect(mockConfig.placementMode.confirmPlacement).not.toHaveBeenCalled();
    });
  });

  describe('wheel events', () => {
    beforeEach(() => {
      state.easyPlaceMode.value = true;
      mockConfig.placementMode.isActive.mockReturnValue(true);

      const mockEntity = new Entity('preview');
      mockEntity.transform.scale = [1, 1, 1];
      mockEntity.transform.rotation = [0, 0, 0, 1];
      mockConfig.placementMode.getPreviewEntity.mockReturnValue(mockEntity);
    });

    it('should rotate preview on wheel event', () => {
      controller.initialize();

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(wheelEvent);

      expect(mockConfig.placementMode.rotatePreview).toHaveBeenCalled();
    });

    it('should scale preview on shift+wheel event', () => {
      controller.initialize();

      const mockEntity = mockConfig.placementMode.getPreviewEntity();
      const originalScale = [...mockEntity.transform.scale];

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(wheelEvent);

      // Scale should have changed
      expect(mockEntity.transform.scale).not.toEqual(originalScale);
    });

    it('should not handle wheel when Easy Place is disabled', () => {
      state.easyPlaceMode.value = false;
      controller.initialize();

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(wheelEvent);

      expect(mockConfig.placementMode.rotatePreview).not.toHaveBeenCalled();
    });
  });

  describe('number keys for color presets', () => {
    beforeEach(() => {
      state.easyPlaceMode.value = true;
      mockConfig.placementMode.isActive.mockReturnValue(true);

      const mockEntity = new Entity('preview');
      mockEntity.color = [1, 1, 1, 1];
      mockEntity.userData.baseColor = [1, 1, 1, 1];
      mockConfig.placementMode.getPreviewEntity.mockReturnValue(mockEntity);
    });

    it('should apply color preset on number key 1', () => {
      controller.initialize();

      const mockEntity = mockConfig.placementMode.getPreviewEntity();
      const keyEvent = new KeyboardEvent('keydown', { key: '1' });
      window.dispatchEvent(keyEvent);

      // Color should have changed
      expect(mockEntity.color).not.toEqual([1, 1, 1, 1]);
    });

    it('should apply different colors for different number keys', () => {
      controller.initialize();

      const mockEntity = mockConfig.placementMode.getPreviewEntity();

      const key1Event = new KeyboardEvent('keydown', { key: '1' });
      window.dispatchEvent(key1Event);
      const color1 = [...mockEntity.color];

      const key2Event = new KeyboardEvent('keydown', { key: '2' });
      window.dispatchEvent(key2Event);
      const color2 = [...mockEntity.color];

      expect(color1).not.toEqual(color2);
    });

    it('should not apply colors when Easy Place is disabled', () => {
      state.easyPlaceMode.value = false;
      controller.initialize();

      const mockEntity = mockConfig.placementMode.getPreviewEntity();
      const originalColor = [...mockEntity.color];

      const keyEvent = new KeyboardEvent('keydown', { key: '1' });
      window.dispatchEvent(keyEvent);

      expect(mockEntity.color).toEqual(originalColor);
    });
  });

  describe('pattern placement', () => {
    beforeEach(() => {
      state.easyPlaceMode.value = true;
      mockConfig.placementMode.isActive.mockReturnValue(true);

      const mockEntity = new Entity('preview');
      mockEntity.transform.position = [0, 0, 0];
      mockEntity.transform.scale = [1, 1, 1];
      mockConfig.placementMode.getPreviewEntity.mockReturnValue(mockEntity);
    });

    it('should start pattern on first click when pattern mode is active', () => {
      state.easyPlacePattern.value = 'line';
      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      const patternState = controller.getPatternState();
      expect(patternState.active).toBe(true);
    });

    it('should finish pattern on second click', () => {
      state.easyPlacePattern.value = 'grid';
      controller.initialize();

      // First click
      const click1 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click1);

      // Second click
      const click2 = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(click2);

      expect(mockConfig.recordSnapshot).toHaveBeenCalled();
      expect(mockConfig.updateSceneBuffers).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      controller.initialize();
      expect(() => controller.dispose()).not.toThrow();
    });

    it('should remove event listeners', () => {
      const cleanup = controller.initialize();
      cleanup();

      // Events should no longer trigger actions
      state.easyPlaceMode.value = true;
      mockConfig.placementMode.isActive.mockReturnValue(true);

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);

      // Should not call placement methods after disposal
      expect(mockConfig.placementMode.confirmPlacement).not.toHaveBeenCalled();
    });
  });

  describe('pointer cancellation and focus loss', () => {
    beforeEach(() => {
      state.easyPlaceMode.value = true;
      state.easyPlacePattern.value = 'line';
      const preview = new Entity('preview');
      preview.transform.position = [1, 0, 2];
      preview.transform.scale = [1, 1, 1];
      mockConfig.placementMode.isActive.mockReturnValue(true);
      mockConfig.placementMode.getPreviewEntity.mockReturnValue(preview);
    });

    it('should reset pattern and cancel placement on pointercancel', () => {
      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockConfig.placementMode.cancelPlacement.mockClear();
      canvas.dispatchEvent(clickEvent);
      expect(controller.getPatternState().active).toBe(true);

      const pointerCancelEvent = new PointerEvent('pointercancel', {
        pointerId: 42,
        bubbles: true,
      });
      window.dispatchEvent(pointerCancelEvent);

      expect(controller.getPatternState().active).toBe(false);
      expect(mockConfig.placementMode.cancelPlacement).toHaveBeenCalledWith(true);
      expect(mockConfig.controls.setEnabled).toHaveBeenCalledWith(true);
      expect(mockConfig.onStatusMessage).toHaveBeenCalledWith('Placement cancelled', 800);
    });

    it('should cancel placement on window blur without status message', () => {
      controller.initialize();

      const clickEvent = new MouseEvent('click', { bubbles: true });
      canvas.dispatchEvent(clickEvent);
      mockConfig.placementMode.cancelPlacement.mockClear();
      mockConfig.onStatusMessage.mockClear();
      mockConfig.controls.setEnabled.mockClear();

      const blurEvent = new Event('blur');
      window.dispatchEvent(blurEvent);

      expect(controller.getPatternState().active).toBe(false);
      expect(mockConfig.placementMode.cancelPlacement).toHaveBeenCalledWith(true);
      expect(mockConfig.controls.setEnabled).toHaveBeenCalledWith(true);
      expect(mockConfig.onStatusMessage).not.toHaveBeenCalled();
    });
  });
});

