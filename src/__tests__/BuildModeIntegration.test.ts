/**
 * Build Mode Integration Tests
 * Tests the complete unified build mode workflow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '../scene/Scene';
import { EditorState } from '../editor/core/state';
import { applyWorkflowPreset, getWorkflowPreset } from '../editor/workflows/WorkflowPresets';

describe('Build Mode Integration', () => {
  let scene: Scene;
  let state: EditorState;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    state = new EditorState(scene);
  });

  describe('Workflow Preset', () => {
    it('should have build preset defined', () => {
      const buildPreset = getWorkflowPreset('build');
      expect(buildPreset).toBeDefined();
      expect(buildPreset.name).toBe('Build Mode');
    });

    it('should enable both hotbar and catalog in build mode', () => {
      const buildPreset = getWorkflowPreset('build');
      expect(buildPreset.uiPreferences.showHotbar).toBe(true);
      expect(buildPreset.uiPreferences.showAssetCatalog).toBe(true);
    });

    it('should apply build preset to state', () => {
      const currentPrefs = state.uiPreferences.value;
      const updatedPrefs = applyWorkflowPreset(currentPrefs, 'build');

      expect(updatedPrefs.showHotbar).toBe(true);
      expect(updatedPrefs.showAssetCatalog).toBe(true);
      expect(updatedPrefs.catalogPosition).toBe('left');
    });
  });

  describe('UI Preferences', () => {
    it('should have catalogPosition in preferences', () => {
      const prefs = state.uiPreferences.value;
      expect(prefs).toHaveProperty('catalogPosition');
    });

    it('should default catalogPosition to left', () => {
      const prefs = state.uiPreferences.value;
      expect(prefs.catalogPosition).toBe('left');
    });

    it('should allow changing catalogPosition', () => {
      state.uiPreferences.value = {
        ...state.uiPreferences.value,
        catalogPosition: 'right',
      };

      expect(state.uiPreferences.value.catalogPosition).toBe('right');
    });
  });

  describe('Workflow Switching', () => {
    it('should switch from custom to build mode', () => {
      expect(state.workflowPreset.value).toBe('custom');

      const buildPrefs = applyWorkflowPreset(state.uiPreferences.value, 'build');
      state.uiPreferences.value = buildPrefs;
      state.workflowPreset.value = 'build';

      expect(state.workflowPreset.value).toBe('build');
      expect(state.uiPreferences.value.showHotbar).toBe(true);
      expect(state.uiPreferences.value.showAssetCatalog).toBe(true);
    });

    it('should maintain other preferences when switching', () => {
      const originalInspector = state.uiPreferences.value.showInspector;

      const buildPrefs = applyWorkflowPreset(state.uiPreferences.value, 'build');
      state.uiPreferences.value = buildPrefs;

      expect(state.uiPreferences.value.showInspector).toBe(originalInspector);
    });
  });

  describe('Build Mode Features', () => {
    beforeEach(() => {
      // Apply build mode
      const buildPrefs = applyWorkflowPreset(state.uiPreferences.value, 'build');
      state.uiPreferences.value = buildPrefs;
      state.workflowPreset.value = 'build';
    });

    it('should have both hotbar and catalog enabled', () => {
      expect(state.uiPreferences.value.showHotbar).toBe(true);
      expect(state.uiPreferences.value.showAssetCatalog).toBe(true);
    });

    it('should show detailed catalog style', () => {
      expect(state.uiPreferences.value.catalogStyle).toBe('detailed');
    });

    it('should position catalog on left by default', () => {
      expect(state.uiPreferences.value.catalogPosition).toBe('left');
    });

    it('should keep inspector visible', () => {
      expect(state.uiPreferences.value.showInspector).toBe(true);
    });

    it('should hide logic panel by default', () => {
      expect(state.uiPreferences.value.showLogicPanel).toBe(false);
    });

    it('should hide code editor by default', () => {
      expect(state.uiPreferences.value.showCodeEditor).toBe(false);
    });
  });
});

