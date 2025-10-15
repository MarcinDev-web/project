import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OutlinerPanel } from './OutlinerPanel';
import { Scene } from '../../scene/Scene';
import { SelectionManager } from '../../scene/Selection';
import { Entity } from '../../scene/Entity';
import { EditorState } from '../core/state';

function createHost(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('OutlinerPanel', () => {
  let scene: Scene;
  let selection: SelectionManager;
  let host: HTMLElement;
  let editorState: EditorState;

  beforeEach(() => {
    scene = new Scene('Scene');
    selection = new SelectionManager();
    editorState = new EditorState(scene);
    host = createHost();
  });

  afterEach(() => {
    host.remove();
    document.body.innerHTML = '';
  });

  it('renders root entities and triggers selection callback on click', () => {
    const entity = new Entity('Cube');
    scene.addEntity(entity);
    selection.setScene(scene);

    // Register callback to update editorState when selection changes (mimics EditorUI behavior)
    selection.onSelectionChanged(() => {
      const selected = selection.primarySelection;
      editorState.selection.value = selected ? [selected] : [];
    });

    const onEntitySelected = vi.fn((selectedEntity: Entity) => {
      // Symulujemy faktyczne zachowanie - callback aktualizuje SelectionManager
      selection.select(selectedEntity);
    });
    const panel = new OutlinerPanel({ scene, selection, onEntitySelected, state: editorState });
    panel.mount(host);

    panel.refresh();
    // Find the outliner item button specifically (not quick action buttons)
    const itemButton = host.querySelector('.outliner-item');
    expect(itemButton).toBeTruthy();

    itemButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onEntitySelected).toHaveBeenCalledWith(entity);
    expect(editorState.selection.value).toEqual([entity]);
    expect(selection.isSelected(entity)).toBe(true);
  });
});
