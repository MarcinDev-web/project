import { describe, it, expect, beforeEach } from 'vitest';
import { EditorState } from '../state';
import { Scene } from '@engine/world';
import { EditorPanelManager } from '../../panels/EditorPanelManager';
import { SelectionManager } from '@engine/world';
import { WorkflowSelector } from '../../ui/WorkflowSelector';
import { QuickMenu } from '../../ui/QuickMenu';
import { applyWorkflowPreset } from '../../workflows/WorkflowPresets';

describe('Phase 2 Integration', () => {
  let scene: Scene;
  let state: EditorState;
  let selection: SelectionManager;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    state = new EditorState(scene);
    selection = new SelectionManager();
    selection.setScene(scene);
  });

  it('applies panel visibility changes', () => {
    const manager = new EditorPanelManager({
      scene,
      selection,
      state,
      updateSceneBuffers: () => {},
      onTransformChanged: () => {},
      onColorChanged: () => {},
      onEntityRenamed: () => {},
      onAssetSpawn: () => {},
      onStartPlacement: () => {},
    });

    const sidebar = document.createElement('div');
    const inspector = document.createElement('div');

    manager.mount(sidebar, inspector);
    manager.setVisibility({ inspector: false });

    expect(inspector.style.display).toBe('none');

    manager.setVisibility({ inspector: true, sidebar: false });

    expect(inspector.style.display).toBe('flex');
    expect(sidebar.style.display).toBe('none');

    manager.dispose();
  });

  it('renders workflow selector and toggles dropdown', () => {
    const selector = new WorkflowSelector({ state });
    const element = selector.render();
    document.body.appendChild(element);

    const button = element.querySelector<HTMLButtonElement>('.workflow-button');
    expect(button).toBeTruthy();

    const dropdown = element.querySelector('.workflow-dropdown');
    expect(dropdown?.hidden).toBe(true);

    button?.click();
    expect(dropdown?.hidden).toBe(false);

    document.body.removeChild(element);
    selector.dispose();
  });

  it('updates state when workflow is selected', () => {
    const selector = new WorkflowSelector({ state });
    const element = selector.render();
    document.body.appendChild(element);

    const button = element.querySelector<HTMLButtonElement>('.workflow-button');
    button?.click();

    const buildOption = Array.from(element.querySelectorAll<HTMLButtonElement>('.workflow-dropdown-item'))
      .find((item) => item.textContent?.includes('Build Mode'));

    buildOption?.click();

    expect(state.workflowPreset.value).toBe('build');
    expect(state.uiPreferences.value.showAssetCatalog).toBe(true);
    expect(state.uiPreferences.value.showHotbar).toBe(true);  // Build mode has both hotbar and catalog

    document.body.removeChild(element);
    selector.dispose();
  });

  it('integrates workflow selector into QuickMenu', () => {
    const menu = new QuickMenu({
      state,
      onUndo: () => {},
      onRedo: () => {},
      canUndo: () => false,
      canRedo: () => false,
      toggleSnap: () => {},
      toggleGrid: () => {},
      onGizmoModeChange: () => {},
      onRotationSnapChange: () => {},
    });

    menu.mount();

    const selector = document.querySelector('.top-bar-workflow-selector');
    expect(selector).toBeTruthy();

    menu.dispose();
  });

  it('detects preset changes via helper', () => {
    const current = state.uiPreferences.value;
    const updated = applyWorkflowPreset(current, 'developer');

    expect(updated.showCodeEditor).toBe(true);
    expect(updated.showAssetCatalog).toBe(true);
  });
});


