/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { EditorPlacementController } from '../EditorPlacementController';
import { Scene, Entity } from '@engine/world';
import { SelectionManager } from '@engine/world';
import { EditorState } from '../../core/state';
import type { OrbitControls } from '@engine/camera';

// Mock dependencies
vi.mock('../../wasm/collisionWorkerClient', () => ({
  warmupCollisionWorker: vi.fn(),
}));

// Mock wasm-collision specifically
vi.mock('@engine/wasm-collision', () => ({
  init: vi.fn().mockResolvedValue({}),
}));

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'width', { value: 800, writable: true });
  Object.defineProperty(canvas, 'height', { value: 600, writable: true });
  (canvas as any).getBoundingClientRect = () => ({
    left: 0, top: 0, width: 800, height: 600,
  });
  return canvas;
}

function createMockControls(): OrbitControls {
  return {
    getState: () => ({ yaw: 0, pitch: 0, distance: 5 }),
  } as any;
}

describe('EditorPlacementController New Features', () => {
  let canvas: HTMLCanvasElement;
  let controls: OrbitControls;
  let scene: Scene;
  let selection: SelectionManager;
  let state: EditorState;
  let placementModeMock: any;
  let controller: EditorPlacementController;

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Mock requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      return setTimeout(fn, 0);
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      clearTimeout(id);
    });

    canvas = createMockCanvas();
    controls = createMockControls();
    scene = new Scene('TestScene');
    selection = new SelectionManager();
    state = new EditorState(scene);
    
    placementModeMock = {
      isActive: vi.fn(() => true),
      confirmPlacement: vi.fn(),
      updatePreviewPosition: vi.fn(),
      getPreviewEntity: vi.fn(() => new Entity('preview')),
      getPreviewEntities: vi.fn(() => [new Entity('preview')]),
      getConfig: vi.fn(() => ({ contactTolerance: 0.001 })),
      handleInput: vi.fn(),
    };

    controller = new EditorPlacementController({
      canvas,
      controls,
      scene,
      selection,
      state,
      placementMode: placementModeMock,
      updateSceneBuffers: vi.fn(),
      recordSnapshot: vi.fn(),
      onStatusMessage: vi.fn(),
      getGridRenderer: vi.fn(() => ({ setHighlight: vi.fn() } as any)),
    });

    // Mock internal methods to isolate logic
    (controller as any).createRayFromMouseEvent = vi.fn(() => ({
      origin: [0, 10, 0],
      direction: [0, -1, 0], // Down
    }));
    // Mock raycastToGroundPlane to return a specific point
    (controller as any).raycastToGroundPlane = vi.fn(() => [2.4, 0, 3.6]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should snap to global grid when enabled', async () => {
    // Enable Grid Snap
    state.snapConfig.value = { ...state.snapConfig.value, enabled: true, increment: 1.0 };
    state.gridConfig.value = { ...state.gridConfig.value, cellSize: 1.0 };

    // Mock getAdjacentPlacementFromRay to return something (which should be ignored in grid mode)
    (controller as any).getAdjacentPlacementFromRay = vi.fn(() => ({ position: [10, 10, 10], normal: [0, 1, 0] }));

    controller.initialize();
    const event = new MouseEvent('mousemove');
    canvas.dispatchEvent(event);

    // Trigger rAF
    vi.runAllTimers();

    // Check if updatePreviewPosition was called with SNAPPED coordinates
    // 2.4 -> 2.0, 3.6 -> 4.0 (Math.round)
    expect(placementModeMock.updatePreviewPosition).toHaveBeenCalledWith(
      [2, 0, 4],
      expect.objectContaining({
        applySnap: false, // Should be false because we manually snapped
        surfaceNormal: [0, 1, 0]
      })
    );
  });

  it('should use adjacent placement (face snap) when global grid snap is disabled', async () => {
    // Disable Grid Snap
    state.snapConfig.value = { ...state.snapConfig.value, enabled: false };

    // Mock adjacent placement finding a spot
    const adjacentPos = [5, 1, 5];
    const adjacentNormal = [1, 0, 0];
    (controller as any).getAdjacentPlacementFromRay = vi.fn(() => ({ position: adjacentPos, normal: adjacentNormal }));

    controller.initialize();
    const event = new MouseEvent('mousemove');
    canvas.dispatchEvent(event);

    vi.runAllTimers();

    expect(placementModeMock.updatePreviewPosition).toHaveBeenCalledWith(
      adjacentPos,
      expect.objectContaining({
        applySnap: false,
        surfaceNormal: adjacentNormal
      })
    );
  });
});
