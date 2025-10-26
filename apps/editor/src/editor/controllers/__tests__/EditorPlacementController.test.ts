import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorPlacementController } from '../EditorPlacementController';
import { Scene } from '@engine/world';
import { SelectionManager } from '@engine/world';
import { EditorState } from '../../core/state';
import type { PlacementMode } from '../../placement/PlacementMode';
import type { OrbitControls } from '@engine/camera';
import { Entity } from '@engine/world';

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
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
  return canvas;
}

function createMockControls(): OrbitControls {
  return {
    getState: () => ({ yaw: 0, pitch: 0, distance: 5 }),
    cleanup: vi.fn(),
    setEnabled: vi.fn(),
    setState: vi.fn(),
    setPreset: vi.fn(),
  } as OrbitControls;
}

describe('EditorPlacementController', () => {
  let canvas: HTMLCanvasElement;
  let controls: OrbitControls;
  let scene: Scene;
  let selection: SelectionManager;
  let state: EditorState;
  let placementModeMock: {
    isActive: ReturnType<typeof vi.fn>;
    confirmPlacement: ReturnType<typeof vi.fn>;
    updatePreviewPosition: ReturnType<typeof vi.fn>;
    getPreviewEntity: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    canvas = createMockCanvas();
    controls = createMockControls();
    scene = new Scene('TestScene');
    selection = new SelectionManager();
    selection.setScene(scene);
    state = new EditorState(scene);

    selection.onSelectionChanged((selected) => {
      state.selection.value = Array.from(selected);
    });

    placementModeMock = {
      isActive: vi.fn(() => true),
      confirmPlacement: vi.fn(),
      updatePreviewPosition: vi.fn(),
      getPreviewEntity: vi.fn(() => null),
    };
  });

  it('selects the placed entity via SelectionManager when placement is confirmed', () => {
    const placedEntity = new Entity('Placed');
    scene.addEntity(placedEntity);
    placementModeMock.confirmPlacement.mockReturnValue(placedEntity);

    const controller = new EditorPlacementController({
      canvas,
      controls,
      scene,
      selection,
      state,
      placementMode: placementModeMock as unknown as PlacementMode,
      updateSceneBuffers: vi.fn(),
      recordSnapshot: vi.fn(),
      onStatusMessage: vi.fn(),
    });

    const dispose = controller.initialize();

    vi
      .spyOn(controller as unknown as { createRayFromMouseEvent: () => null }, 'createRayFromMouseEvent')
      .mockReturnValue(null);

    const dblClick = new MouseEvent('dblclick', {
      bubbles: true,
      clientX: 200,
      clientY: 300,
    });

    canvas.dispatchEvent(dblClick);

    expect(placementModeMock.confirmPlacement).toHaveBeenCalledTimes(1);
    expect(selection.primarySelection).toBe(placedEntity);
    expect(Array.from(selection.selectedEntities)).toEqual([placedEntity]);
    expect(state.selection.value).toEqual([placedEntity]);

    dispose();
  });
});


