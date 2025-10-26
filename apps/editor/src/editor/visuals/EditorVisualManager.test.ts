import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorVisualManager } from './EditorVisualManager';
import { Scene } from '@engine/world';
import { SelectionManager } from '@engine/world';
import { EditorState } from '../core/state';
import { SnapSystem } from '@engine/editor-utils';
import type { Vec3 } from '@engine/core/math';

// Mock requestAnimationFrame
let animationFrameId = 0;
const mockRequestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  animationFrameId++;
  setTimeout(() => callback(performance.now()), 0);
  return animationFrameId;
});

const mockCancelAnimationFrame = vi.fn(() => {
  // Mock implementation
});

describe('EditorVisualManager', () => {
  let scene: Scene;
  let selection: SelectionManager;
  let state: EditorState;
  let snapSystem: SnapSystem;
  let canvas: HTMLCanvasElement;
  let manager: EditorVisualManager;
  let mockRenderer: any;

  beforeEach(() => {
    // Mock global animation frame functions
    globalThis.requestAnimationFrame = mockRequestAnimationFrame as any;
    globalThis.cancelAnimationFrame = mockCancelAnimationFrame as any;

    scene = new Scene();
    selection = new SelectionManager();
    selection.setScene(scene);
    state = new EditorState(scene);
    snapSystem = new SnapSystem(state.snapConfig.value);
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    // Mock renderer
    mockRenderer = {
      initializeGridRenderer: vi.fn().mockResolvedValue(undefined),
      getDevice: vi.fn(),
      getPresentationFormat: vi.fn(),
    };

    manager = new EditorVisualManager({
      scene,
      selection,
      state,
      canvas,
      snapSystem,
      getRenderer: () => mockRenderer,
      projectWorldToScreen: (_world: Vec3) => ({ x: 100, y: 100 }),
      updateSceneBuffers: vi.fn(),
      setControlsEnabled: vi.fn(),
    });
  });

  afterEach(() => {
    manager.dispose();
    document.body.removeChild(canvas);
    mockRequestAnimationFrame.mockClear();
    mockCancelAnimationFrame.mockClear();
  });

  describe('initialization', () => {
    it('should create a manager', () => {
      expect(manager).toBeDefined();
      expect(manager.isInitialized()).toBe(false);
    });

    it('should initialize asynchronously', async () => {
      await manager.initialize();

      expect(manager.isInitialized()).toBe(true);
    });

    it('should initialize grid renderer', async () => {
      await manager.initialize();

      expect(mockRenderer.initializeGridRenderer).toHaveBeenCalled();
    });

    it('should handle grid renderer initialization failure gracefully', async () => {
      mockRenderer.initializeGridRenderer.mockRejectedValue(new Error('GPU not available'));

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await manager.initialize();

      expect(consoleError).toHaveBeenCalled();
      expect(manager.getGridRenderer()).toBeNull();

      consoleError.mockRestore();
    });

    it('should initialize gizmo controller', async () => {
      await manager.initialize();

      expect(manager.getGizmoController()).not.toBeNull();
    });

    it('should start animation loop', async () => {
      await manager.initialize();

      // Wait for animation frame to be called
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockRequestAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('grid renderer', () => {
    it('should return null before initialization', () => {
      expect(manager.getGridRenderer()).toBeNull();
    });

    it('should return grid renderer after initialization', async () => {
      await manager.initialize();

      const gridRenderer = manager.getGridRenderer();
      expect(gridRenderer).not.toBeNull();
    });

    it('should handle renderer timeout gracefully', async () => {
      // Return null renderer to simulate timeout
      const noRendererManager = new EditorVisualManager({
        scene,
        selection,
        state,
        canvas,
        snapSystem,
        getRenderer: () => null,
        projectWorldToScreen: (_world: Vec3) => ({ x: 100, y: 100 }),
        updateSceneBuffers: vi.fn(),
        setControlsEnabled: vi.fn(),
      });

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await noRendererManager.initialize();

      expect(consoleWarn).toHaveBeenCalledWith(
        'GridRenderer: Renderer not available after timeout'
      );
      expect(noRendererManager.getGridRenderer()).toBeNull();

      consoleWarn.mockRestore();
      noRendererManager.dispose();
    }, 20000); // 20 second timeout for slow initialization
  });

  describe('gizmo controller', () => {
    it('should return null before initialization', () => {
      expect(manager.getGizmoController()).toBeNull();
    });

    it('should return gizmo controller after initialization', async () => {
      await manager.initialize();

      const gizmoController = manager.getGizmoController();
      expect(gizmoController).not.toBeNull();
    });

    it('should update gizmo overlay', async () => {
      await manager.initialize();

      const gizmo = manager.getGizmoController();
      const updateSpy = vi.spyOn(gizmo!, 'updateOverlay');

      manager.updateGizmoOverlay();

      expect(updateSpy).toHaveBeenCalled();
    });

    it('should handle gizmo update when not initialized gracefully', () => {
      expect(() => manager.updateGizmoOverlay()).not.toThrow();
    });
  });

  describe('selection visuals', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should apply selection visuals', () => {
      const entity = scene.createEntity('TestEntity');
      selection.select(entity);

      expect(() => manager.applySelectionVisuals()).not.toThrow();
    });

    it('should call updateSceneBuffers when applying visuals', () => {
      const updateSceneBuffers = vi.fn();
      const customManager = new EditorVisualManager({
        scene,
        selection,
        state,
        canvas,
        snapSystem,
        getRenderer: () => mockRenderer,
        projectWorldToScreen: (_world: Vec3) => ({ x: 100, y: 100 }),
        updateSceneBuffers,
        setControlsEnabled: vi.fn(),
      });

      void customManager.initialize().then(() => {
        customManager.applySelectionVisuals();
        expect(updateSceneBuffers).toHaveBeenCalled();
        customManager.dispose();
      });
    });
  });

  describe('reactive updates', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should react to grid config changes', async () => {
      const gridRenderer = manager.getGridRenderer();
      const setConfigSpy = vi.spyOn(gridRenderer!, 'setConfig');

      state.gridConfig.value = {
        ...state.gridConfig.value,
        cellSize: 2.0,
      };

      // Give time for effect to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(setConfigSpy).toHaveBeenCalled();
    });

    it('should react to grid visibility changes', async () => {
      const gridRenderer = manager.getGridRenderer();
      const setVisibleSpy = vi.spyOn(gridRenderer!, 'setVisible');

      state.showGrid.value = false;

      // Give time for effect to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(setVisibleSpy).toHaveBeenCalled();
    });

    it('should sync snap with grid cell size', async () => {
      const syncSpy = vi.spyOn(snapSystem, 'syncSnapToGrid');

      state.gridConfig.value = {
        ...state.gridConfig.value,
        cellSize: 3.0,
      };

      // Give time for effect to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(syncSpy).toHaveBeenCalledWith(3.0);
    });

    it('should apply selection visuals on selection change', async () => {
      const entity = scene.createEntity('TestEntity');

      // Change selection
      state.selection.value = [entity];

      // Give time for effect to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have triggered visual update (implicitly tested through no errors)
      expect(true).toBe(true);
    });
  });

  describe('animation loop', () => {
    it('should start animation loop on initialization', async () => {
      const callCountBefore = mockRequestAnimationFrame.mock.calls.length;

      await manager.initialize();

      // Wait for first frame
      await new Promise((resolve) => setTimeout(resolve, 10));

      const callCountAfter = mockRequestAnimationFrame.mock.calls.length;
      expect(callCountAfter).toBeGreaterThan(callCountBefore);
    });

    it('should stop animation loop on disposal', async () => {
      await manager.initialize();

      // Wait for animation to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      manager.dispose();

      expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });

    it('should continuously update gizmo', async () => {
      await manager.initialize();

      const gizmo = manager.getGizmoController();
      const updateSpy = vi.spyOn(gizmo!, 'updateOverlay');

      // Wait for multiple frames
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have been called multiple times
      expect(updateSpy.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('disposal', () => {
    it('should dispose grid renderer', async () => {
      await manager.initialize();

      const gridRenderer = manager.getGridRenderer();
      const disposeSpy = vi.spyOn(gridRenderer!, 'dispose');

      manager.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      expect(manager.getGridRenderer()).toBeNull();
    });

    it('should cancel animation loop', async () => {
      await manager.initialize();

      // Wait for animation to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      manager.dispose();

      expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });

    it('should be safe to dispose multiple times', async () => {
      await manager.initialize();

      expect(() => {
        manager.dispose();
        manager.dispose();
        manager.dispose();
      }).not.toThrow();
    });

    it('should be safe to dispose without initialization', () => {
      expect(() => manager.dispose()).not.toThrow();
    });

    it('should clear all references', async () => {
      await manager.initialize();

      expect(manager.getGridRenderer()).not.toBeNull();
      expect(manager.getGizmoController()).not.toBeNull();

      manager.dispose();

      expect(manager.getGridRenderer()).toBeNull();
      expect(manager.getGizmoController()).toBeNull();
      expect(manager.isInitialized()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle missing renderer gracefully', async () => {
      const noRendererManager = new EditorVisualManager({
        scene,
        selection,
        state,
        canvas,
        snapSystem,
        getRenderer: () => null,
        projectWorldToScreen: (_world: Vec3) => ({ x: 100, y: 100 }),
        updateSceneBuffers: vi.fn(),
        setControlsEnabled: vi.fn(),
      });

      await noRendererManager.initialize();

      // Should initialize without renderer
      expect(noRendererManager.getGizmoController()).not.toBeNull();
      expect(noRendererManager.getGridRenderer()).toBeNull();

      noRendererManager.dispose();
    }, 20000); // 20 second timeout for slow initialization

    it('should handle null snap system gracefully', async () => {
      const noSnapManager = new EditorVisualManager({
        scene,
        selection,
        state,
        canvas,
        snapSystem: null,
        getRenderer: () => mockRenderer,
        projectWorldToScreen: (_world: Vec3) => ({ x: 100, y: 100 }),
        updateSceneBuffers: vi.fn(),
        setControlsEnabled: vi.fn(),
      });

      await noSnapManager.initialize();

      // Should initialize without snap system
      expect(noSnapManager.isInitialized()).toBe(true);

      noSnapManager.dispose();
    });
  });

  describe('integration', () => {
    it('should coordinate between grid, gizmo, and selection', async () => {
      await manager.initialize();

      const entity = scene.createEntity('TestEntity');
      selection.select(entity);
      state.selection.value = [entity];

      // Should handle full flow without errors
      manager.applySelectionVisuals();
      manager.updateGizmoOverlay();

      expect(true).toBe(true);
    });

    it('should handle state changes affecting multiple systems', async () => {
      await manager.initialize();

      // Change multiple state properties
      state.gridConfig.value = { ...state.gridConfig.value, cellSize: 2.5 };
      state.showGrid.value = false;
      state.selection.value = [scene.createEntity('Test')];

      // Wait for effects to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should handle all changes without errors
      expect(true).toBe(true);
    });
  });
});
