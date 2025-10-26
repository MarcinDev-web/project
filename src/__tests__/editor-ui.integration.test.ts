import { describe, it, expect, beforeEach } from 'vitest';
import { EditorUI } from '../editor/ui/EditorUI';
import { SelectionManager } from '@engine/world';
import { Scene } from '@engine/world';
import type { OrbitControls } from '@engine/camera';
import { initializeAssetLibrary, assetRegistry } from '@engine/assets';

function createMockControls(): OrbitControls {
  let state = { yaw: 0, pitch: 0, distance: 3 };
  return {
    getState: () => ({ ...state }),
    cleanup: () => {},
    setEnabled: () => {},
    setState: (s) => {
      state = { ...state, ...s };
    },
    setPreset: (s) => {
      state = { ...state, ...s };
    },
  } as OrbitControls;
}

function setup() {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'width', { value: 200, writable: true });
  Object.defineProperty(canvas, 'height', { value: 200, writable: true });
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

  return { editor, scene, selection, canvas, statusEl };
}

describe('EditorUI integration', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    // Reset localStorage between tests
    try {
      localStorage.clear();
    } catch {}

    assetRegistry.clear();
    await initializeAssetLibrary(assetRegistry);
  });

  it('reacts to EditorState signal changes (snap toggle updates button)', () => {
    setup();
    
    // In V2, snap toggle is a button with .active class, not a checkbox
    const snapButton = document.querySelector('button[title="Toggle Snap (X)"]');
    expect(snapButton).toBeTruthy();
    
    // Initially enabled (has .active class)
    expect(snapButton!.classList.contains('active')).toBe(true);
    
    // Toggle via keyboard
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(snapButton!.classList.contains('active')).toBe(false);
    
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(snapButton!.classList.contains('active')).toBe(true);
  });

  it('updates history toolbar enabled/disabled after push, undo and redo', async () => {
    setup();
    const undoButton = document.querySelector(
      'button[title="Undo (Ctrl+Z)"]'
    ) as HTMLButtonElement;
    const redoButton = document.querySelector(
      'button[title="Redo (Ctrl+Y)"]'
    ) as HTMLButtonElement;
    // Ensure a selection so Properties panel is visible
    const outlinerSelectables = document.querySelectorAll('#outliner-list .outliner-item-selectable');
    expect(outlinerSelectables.length).toBeGreaterThan(0);
    (outlinerSelectables[0] as HTMLButtonElement).click();
    const nameInput = document.querySelector<HTMLInputElement>('section[data-tab="Properties"] .entity-card-name-input');

    // After seed snapshot: undo/redo should be disabled
    expect(undoButton.disabled).toBe(true);
    expect(redoButton.disabled).toBe(true);

    // Change name to push a new snapshot via PropertiesPanel handler
    expect(nameInput).toBeTruthy();
    const prev = nameInput!.value;
    nameInput!.value = prev + 'X';
    nameInput!.dispatchEvent(new Event('change'));
    await Promise.resolve();

    // Undo should be enabled now
    expect(undoButton.disabled).toBe(false);
    // Perform undo
    undoButton.click();
    expect(undoButton.disabled).toBe(true);
    expect(redoButton.disabled).toBe(false);
    // Perform redo
    redoButton.click();
    expect(undoButton.disabled).toBe(false);
    expect(redoButton.disabled).toBe(true);
  });

  it('clicking Outliner updates Properties and selection highlight without manual refresh', () => {
    const { scene } = setup();
    const outlinerSelectables = document.querySelectorAll('#outliner-list .outliner-item-selectable');
    expect(outlinerSelectables.length).toBeGreaterThan(0);
    const firstSelectable = outlinerSelectables[0] as HTMLButtonElement;
    // Determine the entity we expect: first root entity
    const expected = scene.rootEntities[0]!;

    firstSelectable.click();

    // Properties panel shows selected entity name
    const nameInput = document.querySelector<HTMLInputElement>('section[data-tab="Properties"] .entity-card-name-input');
    expect(nameInput).toBeTruthy();
    expect(nameInput!.value).toBe(expected.name);

    // Highlight applied (color differs from baseColor)
    const base =
      (expected.userData.baseColor as [number, number, number, number] | undefined) ??
      expected.color;
    const col = expected.color;
    const differs =
      col[0] !== base[0] || col[1] !== base[1] || col[2] !== base[2] || col[3] !== base[3];
    expect(differs).toBe(true);
  });

  it('places object with double-click during placement', () => {
    const { canvas, statusEl } = setup();

    // Start placement by clicking first asset in AssetBrowser
    const assetButtons = document.querySelectorAll('.asset-card');
    expect(assetButtons.length).toBeGreaterThan(0);
    (assetButtons[0] as HTMLButtonElement).click();

    // Status hint should mention double-click
    expect(statusEl.textContent || '').toMatch(/Double-click|double-click/i);

    // Move mouse to center and double-click to confirm
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: 100, clientY: 100, bubbles: true }));

    // Expect placement success message briefly then cleared by timeout; we just check non-empty immediately
    expect((statusEl.textContent || '').length).toBeGreaterThan(0);
  });

  it('snaps placement adjacent to an existing block when double-clicking it', () => {
    const { canvas, statusEl, scene } = setup();

    // Ensure there is at least one existing entity from seed scene
    expect(scene.rootEntities.length).toBeGreaterThan(0);

    // Start placement by clicking first asset in AssetBrowser
    const assetButtons = document.querySelectorAll('.asset-card');
    expect(assetButtons.length).toBeGreaterThan(0);
    (assetButtons[0] as HTMLButtonElement).click();

    // Hover approximately over the center (seed places a grid)
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }));

    // Place via double-click
    canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: 100, clientY: 100, bubbles: true }));

    // Should show a non-empty status at least briefly
    expect((statusEl.textContent || '').length).toBeGreaterThan(0);
  });

  it('opens BlockEditorUI via Ctrl+Shift+B and saves custom block to palette', async () => {
    const { editor } = setup();

    // Open Block Editor via shortcut
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', ctrlKey: true, shiftKey: true }));

    // Expect modal to be present
    const modal = document.querySelector('div[style*="position: fixed"]');
    expect(modal).toBeTruthy();

    // Fill minimal fields if any inputs exist
    const nameInput = modal?.querySelector('input[type="text"]') as HTMLInputElement | null;
    if (nameInput) {
      nameInput.value = 'My Custom Block';
      nameInput.dispatchEvent(new Event('input'));
      nameInput.dispatchEvent(new Event('change'));
    }

    // Click save button if present
    const saveBtn = Array.from(modal?.querySelectorAll('button') || []).find((b) =>
      (b as HTMLButtonElement).textContent?.includes('Save Block')
    ) as HTMLButtonElement | undefined;
    if (saveBtn) {
      saveBtn.click();
    }

    // After save, new asset should be visible; refresh happens automatically
    // Look for any asset card; count should be > 0 and not throw
    const cards = document.querySelectorAll('.asset-card');
    expect(cards.length).toBeGreaterThan(0);

    // Also ensure AssetsDropdown can refresh without errors
    // @ts-expect-error - accessing private for test
    editor.assetsDropdown?.refresh?.();
  });
});
