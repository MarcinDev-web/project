import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorUI } from '../editor/ui/EditorUI';
import { SelectionManager } from '@engine/world';
import { Scene } from '@engine/world';
import type { OrbitControls } from '@engine/camera';
import { quatFromAxisAngle } from '@engine/core/math';

// Mock heavy UI modules to keep test minimal
vi.mock('../editor/panels/OutlinerPanel', () => ({
  OutlinerPanel: class {
    constructor() {}
    mount() {}
    refresh() {}
  },
}));
vi.mock('../editor/panels/PropertiesPanel', () => ({
  PropertiesPanel: class {
    constructor() {}
    mount() {}
    refresh() {}
  },
}));
vi.mock('../editor/assets/AssetBrowserV2', () => ({
  AssetBrowserV2: class {
    constructor() {}
    mount() {}
    refresh() {}
    dispose() {}
  },
}));
vi.mock('../editor/visuals/SelectionVisuals', () => ({
  applySelectionVisuals: () => {},
  initializeBaseColor: () => {},
}));

function createMockControls(): OrbitControls {
  let state = { yaw: 0, pitch: 0, distance: 3, enabled: true };
  return {
    getState: () => ({ ...state }),
    cleanup: () => {},
    setEnabled: (e: boolean) => {
      state = { ...state, enabled: e };
    },
    setState: (s) => {
      state = { ...state, ...s };
    },
    setPreset: (s) => {
      state = { ...state, ...s };
    },
  } as OrbitControls;
}

function setupEditor() {
  // DOM elements
  const canvas = document.createElement('canvas');
  // Ensure consistent geometry
  Object.defineProperty(canvas, 'width', { value: 200, writable: true });
  Object.defineProperty(canvas, 'height', { value: 200, writable: true });
  // JSDOM getBoundingClientRect returns zeros by default; stub it
  (canvas as any).getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 200,
    bottom: 200,
    width: 200,
    height: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const statusEl = document.createElement('div');
  document.body.appendChild(canvas);
  document.body.appendChild(statusEl);

  const scene = new Scene('Test');
  const selection = new SelectionManager();

  // Map world to screen: simple orthographic projection centered at (100, 100)
  const projectWorldToScreen = (world: [number, number, number]) => ({
    x: 100 + world[0] * 100,
    y: 100 - world[1] * 100,
  });

  const editor = new EditorUI({
    canvas,
    statusEl,
    controls: createMockControls(),
    scene,
    selection,
    updateSceneBuffers: () => {},
    projectWorldToScreen,
    getRenderer: () => null,
  });
  editor.initialize();

  const undoButton = document.querySelector<HTMLButtonElement>('button[title="Undo (Ctrl+Z)"]');
  const redoButton = document.querySelector<HTMLButtonElement>('button[title="Redo (Ctrl+Y)"]');

  expect(undoButton).toBeTruthy();
  expect(redoButton).toBeTruthy();

  return {
    editor,
    scene,
    selection,
    canvas,
    undoButton: undoButton!,
    redoButton: redoButton!,
  };
}

function getAxisGroup(axis: 'x' | 'y' | 'z'): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-axis="${axis}"]`);
  if (!el) throw new Error(`Axis group ${axis} not found`);
  return el;
}

describe('Editor Gizmo', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes history toolbar controls', () => {
    const { undoButton, redoButton, historyLimitInput } = setupEditor();
    expect(typeof undoButton.disabled).toBe('boolean');
    expect(typeof redoButton.disabled).toBe('boolean');

    if (historyLimitInput) {
      historyLimitInput.value = '150';
      historyLimitInput.dispatchEvent(new Event('change'));
      expect(historyLimitInput.value).toBe('150');
    }
  });

  it('applies translate snapping to delta based on original position', () => {
    const { editor, scene, selection } = setupEditor();
    // Select the Center entity created by seedDemoScene
    const center = scene.findEntitiesByName('Center')[0]!;
    selection.select(center);
    // Force overlay update once
    (editor as any).updateGizmoOverlay();

    const xAxis = getAxisGroup('x');
    const pointerId = 1;
    xAxis.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, pointerId, clientX: 0, clientY: 0 })
    );
    // Drag 37px along X → worldDelta ≈ 0.37 → snap(0.5) → +0.5 on X
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX: 37, clientY: 0 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId }));

    const pos = center.transform.position;
    expect(pos[0]).toBeCloseTo(0.5, 5);
  });

  it('rotates around axis relative to original rotation (not cumulative)', () => {
    const { editor, scene, selection } = setupEditor();
    const center = scene.findEntitiesByName('Center')[0]!;
    selection.select(center);
    (editor as any).updateGizmoOverlay();

    // Switch to rotate mode via key
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));

    const xAxis = getAxisGroup('x');
    const pointerId = 2;
    xAxis.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, pointerId, clientX: 0, clientY: 0 })
    );
    // Drag 50px → worldDelta 0.5 → angle = 0.5 * PI; snap(0.5 rad) => 1.5 rad
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX: 50, clientY: 0 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId }));

    const expected = quatFromAxisAngle([1, 0, 0], 1.5);
    const rot = center.transform.rotation;
    expect(rot[0]).toBeCloseTo(expected[0], 5);
    expect(rot[1]).toBeCloseTo(expected[1], 5);
    expect(rot[2]).toBeCloseTo(expected[2], 5);
    expect(rot[3]).toBeCloseTo(expected[3], 5);
  });

  it('scales relative to original scale along selected axis', () => {
    const { editor, scene, selection } = setupEditor();
    const center = scene.findEntitiesByName('Center')[0]!;
    selection.select(center);
    (editor as any).updateGizmoOverlay();

    // Switch to scale mode via key
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));

    const yAxis = getAxisGroup('y');
    const pointerId = 3;
    yAxis.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, pointerId, clientX: 0, clientY: 0 })
    );
    // Drag along Y axis: move upwards by 30px → worldDelta ≈ 0.3 → snap(0.5) => +0.5 on Y
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX: 0, clientY: -30 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId }));

    const scale = center.transform.scale;
    expect(scale[1]).toBeCloseTo(2 + 0.5, 5);
  });
});
